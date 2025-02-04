import { google, gmail_v1 } from 'googleapis';
import { LAST_PROCESSED_FILE, outputFilePath } from '../conf/constants';
import { loadJsonFile, saveJsonFile } from '../untils/fileReadandWrite';
import { createObjectCsvWriter } from 'csv-writer';

export async function processReports(authClients: any[]): Promise<void> {
  const csvWriter = createObjectCsvWriter({
    path: outputFilePath,
    header: [
      { id: 'Message_ID', title: 'Message ID' },
      { id: 'Thread_ID', title: 'Thread ID' },
      { id: 'From', title: 'From' },
      { id: 'To', title: 'To' },
      { id: 'CC', title: 'CC' },
      { id: 'BCC', title: 'BCC' },
      { id: 'Subject', title: 'Subject' },
      { id: 'Date', title: 'Date' },
      { id: 'Labels', title: 'Labels' },
      { id: 'SPF', title: 'SPF' },
      { id: 'DKIM', title: 'DKIM' },
      { id: 'DMARC', title: 'DMARC' },
      { id: 'IP_Address', title: 'IP Address' },
    ],
    append: true,
  });

  const lastProcessedData = loadJsonFile<{ lastProcessed: number }>(LAST_PROCESSED_FILE);
  const lastProcessed = lastProcessedData?.lastProcessed || 0;
  
  // Ensure we fetch all emails, including Inbox and Spam
  const query = lastProcessed
    ? `after:${Math.floor(lastProcessed / 1000)} (in:inbox OR in:spam)`
    : 'in:inbox OR in:spam';

  console.log('Using query:', query);

  let newMessagesProcessed = false;
  let latestTimestamp = lastProcessed;
  let mailArray: { message: gmail_v1.Schema$Message; headers: Record<string, string>; msg: any }[] = [];

  for (const auth of authClients) {
    const gmail = google.gmail({ version: 'v1', auth });

    let nextPageToken: string | undefined = undefined;
    let messages: gmail_v1.Schema$Message[] = [];

    // Fetch all messages with pagination
    do {
      const res: any = await gmail.users.messages.list({
        userId: 'me',
        q: query, // Ensures Inbox & Spam emails are included
        maxResults: 500, // Fetch up to 500 per request
        pageToken: nextPageToken,
      });

      if (res.data.messages) {
        messages.push(...res.data.messages);
      }
      nextPageToken = res.data.nextPageToken; // Continue fetching next page
    } while (nextPageToken);

    if (messages.length === 0) {
      console.log('No new messages found.');
      continue;
    }

    for (const message of messages) {
      try {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: message.id || '',
          format: 'full',
        });

        const payload = msg.data.payload;
        const headers = parseHeaders(payload?.headers || []);
        const dateHeader = headers['Date'] || '';
        const messageDate = new Date(dateHeader).getTime();

        if (messageDate > lastProcessed) {
          newMessagesProcessed = true;
          latestTimestamp = Math.max(latestTimestamp, messageDate);
        }

        mailArray.unshift({ message, headers, msg });
      } catch (error: any) {
        console.error(`Failed to process message ${message.id}:`, error.message);
      }
    }
  }

  // Write to CSV if new emails were processed
  if (newMessagesProcessed) {
    for (const { message, headers, msg } of mailArray) {
      console.log('Processing message:', message, msg, headers);
      await csvWriter.writeRecords([
        {
          Message_ID: message.id || 'N/A',
          Thread_ID: msg.data.threadId || 'N/A',
          From: headers['From'] || 'N/A',
          To: headers['To'] || 'N/A',
          CC: headers['Cc'] || 'N/A',
          BCC: headers['Bcc'] || 'N/A',
          Subject: headers['Subject'] || 'N/A',
          Date: headers['Date'] || 'N/A',
          Labels: msg.data.labelIds?.join(', ') || 'N/A',
          SPF: headers['Received-SPF'] || 'N/A',
          DKIM: headers['Authentication-Results']?.includes('dkim=pass') ? 'Pass' : 'Fail',
          DMARC: headers['Authentication-Results']?.includes('dmarc=pass') ? 'Pass' : 'Fail',
          IP_Address: extractIpAddress(headers['Received'] || ''),
        },
      ]);
    }

    // Save last processed timestamp
    if (latestTimestamp > lastProcessed) {
      saveJsonFile(LAST_PROCESSED_FILE, { lastProcessed: latestTimestamp });
      console.log(`Updated lastProcessed to: ${new Date(latestTimestamp).toISOString()}`);
    }
  } else {
    console.log('No new messages were processed.');
  }
}

// Utility function to parse headers into a dictionary
function parseHeaders(headers: gmail_v1.Schema$MessagePartHeader[] = []): Record<string, string> {
  return headers.reduce((acc, header) => {
    if (header.name && header.value) {
      acc[header.name] = header.value;
    }
    return acc;
  }, {} as Record<string, string>);
}

// Extract IP address from 'Received' headers
function extractIpAddress(receivedHeader: string): string {
  const ipRegex = /(?:\d{1,3}\.){3}\d{1,3}/;
  const match = receivedHeader.match(ipRegex);
  return match ? match[0] : 'N/A';
}