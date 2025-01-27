import { google, gmail_v1 } from 'googleapis';
import { LAST_PROCESSED_FILE } from '../conf/constants';
import { loadJsonFile, saveJsonFile } from '../services/fileReadandWrite';
import { createObjectCsvWriter } from 'csv-writer'; 
const today = new Date();
import { outputFilePath } from '../conf/constants';

export async function processReports(auth: any): Promise<void> {
  const gmail = google.gmail({ version: 'v1', auth });
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
  
  const query = lastProcessed
    ? `after:${Math.floor(lastProcessed / 1000)} (in:inbox OR in:spam)`
    : '(in:inbox OR in:spam)'; // Convert milliseconds to seconds for Gmail API
  
  console.log('Using query:', query);
  
  const res = await gmail.users.messages.list({ userId: 'me', q: query });
  if (!res.data.messages || res.data.messages.length === 0) {
    console.log('No new messages found.');
    return; // Exit if no messages are found
  }

  const messages = res.data.messages || [];
  let latestTimestamp = lastProcessed;
  let newMessagesProcessed = false;
  let mailArray = [];

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
        newMessagesProcessed = true; // Mark that a new email was processed
        latestTimestamp = Math.max(latestTimestamp, messageDate);
      }

      mailArray.unshift({ msg, headers, message });
    } catch (error: any) {
      console.error(`Failed to process message ${message.id}:`, error.message);
    }
  }

  // Only write to CSV if there are new emails to process
  if (newMessagesProcessed) {
    for (let i = 0; i < mailArray.length; i++) {
      const { message, headers, msg } = mailArray[i];
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
          DKIM: headers['Authentication-Results']?.includes('dkim=pass')
            ? 'Pass'
            : 'Fail',
          DMARC: headers['Authentication-Results']?.includes('dmarc=pass')
            ? 'Pass'
            : 'Fail',
          IP_Address: extractIpAddress(headers['Received'] || ''),
        },
      ]);
    }

    // Update lastProcessed only if new messages were processed
    if (latestTimestamp > lastProcessed) {
      saveJsonFile(LAST_PROCESSED_FILE, { lastProcessed: latestTimestamp });
      console.log(`Updated lastProcessed to: ${new Date(latestTimestamp).toISOString()}`);
    }
  } else {
    console.log('No new messages were processed.');
  }
}

function parseHeaders(headers: gmail_v1.Schema$MessagePartHeader[] = []): Record<string, string> {
  return headers.reduce((acc, header) => {
    if (header.name && header.value) {
      acc[header.name] = header.value;
    }
    return acc;
  }, {} as Record<string, string>);
}

function extractIpAddress(receivedHeader: string): string {
  const ipRegex = /(?:\d{1,3}\.){3}\d{1,3}/;
  const match = receivedHeader.match(ipRegex);
  return match ? match[0] : 'N/A';
}
