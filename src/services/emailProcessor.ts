import { google, gmail_v1 } from 'googleapis';
import { LAST_PROCESSED_FILE } from '../conf/constants';
import { loadJsonFile, saveJsonFile } from '../services/fileReadandWrite';
import { createObjectCsvWriter } from 'csv-writer';

export async function processReports(auth: any): Promise<void> {
  const gmail = google.gmail({ version: 'v1', auth });
  const csvWriter = createObjectCsvWriter({
    path: 'data/email_data.csv',
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

  const lastProcessed =
    loadJsonFile<{ lastProcessed: number }>(LAST_PROCESSED_FILE)?.lastProcessed || 0;

  const query = lastProcessed ? `after:${lastProcessed}` : '';
  const res = await gmail.users.messages.list({ userId: 'me', q: query });
  const messages = res.data.messages || [];

  let latestTimestamp = lastProcessed;

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

      latestTimestamp = Math.max(latestTimestamp, messageDate);

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
    } catch (error: any) {
      console.error(`Failed to process message ${message.id}:`, error.message);
    }
  }

  if (latestTimestamp > lastProcessed) {
    saveJsonFile(LAST_PROCESSED_FILE, { lastProcessed: latestTimestamp });
  }
}

function parseHeaders(
  headers: gmail_v1.Schema$MessagePartHeader[] = []
): Record<string, string> {
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