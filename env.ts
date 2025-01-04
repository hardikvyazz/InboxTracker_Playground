import fs from 'fs';
import { google } from 'googleapis';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import express from 'express';

const app = express();
const PORT = 3000;

const CREDENTIALS_PATH = 'credentials.json';
const LAST_PROCESSED_FILE = 'last_processed.json';
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const filePath = 'data/detailed_spam_test001.csv';

interface LastProcessedData {
    lastProcessed: number | null;
}

function loadLastProcessedTimestamp(): number | null {
    if (fs.existsSync(LAST_PROCESSED_FILE)) {
        const data = fs.readFileSync(LAST_PROCESSED_FILE, 'utf-8');
        return (JSON.parse(data) as LastProcessedData).lastProcessed || null;
    }
    return null;
}

function saveLastProcessedTimestamp(timestamp: number): void {
    const data: LastProcessedData = { lastProcessed: timestamp };
    fs.writeFileSync(LAST_PROCESSED_FILE, JSON.stringify(data));
}

async function authorize(): Promise<any> {
    const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const { client_secret, client_id, redirect_uris } = JSON.parse(content).web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });

    console.log('Authorize this app by visiting this url:', authUrl);

    return new Promise((resolve, reject) => {
        app.get('/oauth2callback', (req, res) => {
            const code = req.query.code as string;
            oAuth2Client.getToken(code, (err, token) => {
                if (err) return reject('Error retrieving access token');
                oAuth2Client.setCredentials(token!);
                fs.writeFileSync('token.json', JSON.stringify(token));
                res.send('Authentication successful! You can close this tab.');
                resolve(oAuth2Client);
            });
        });
    });
}

async function processReports(auth: any): Promise<void> {
    const gmail = google.gmail({ version: 'v1', auth });

    const csvWriter = createCsvWriter({
        path: filePath,
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

    const lastProcessed = loadLastProcessedTimestamp();
    console.log(`Last processed timestamp: ${lastProcessed}`);

    const query = lastProcessed ? `after:${lastProcessed} (in:inbox OR in:spam)` : '(in:inbox OR in:spam)';

    console.log(`Query: ${query}`);

    let pageToken: string | null = null;
    let latestTimestamp = lastProcessed;

    do {
        const res = await gmail.users.messages.list({
            userId: 'me',
            pageToken: pageToken || undefined,
            maxResults: 100,
            q: query,
        });

        const messages = res.data.messages;

        if (messages && messages.length) {
            for (const message of messages) {
                try {
                    const msg = await gmail.users.messages.get({ userId: 'me', id: message.id, format: 'full' });
                    const payload = msg.data.payload;
                    const headers = payload?.headers?.reduce((acc: { [key: string]: string }, header) => {
                        acc[header.name] = header.value;
                        return acc;
                    }, {}) || {};

                    const dateHeader = headers['Date'];
                    const messageDate = new Date(dateHeader).getTime() / 1000;

                    if (!latestTimestamp || messageDate > latestTimestamp) {
                        latestTimestamp = messageDate;
                    }

                    const spf = headers['Received-SPF'] || 'N/A';
                    const dkim = headers['Authentication-Results'] && headers['Authentication-Results'].includes('dkim=pass') ? 'Pass' : 'Fail';
                    const dmarc = headers['Authentication-Results'] && headers['Authentication-Results'].includes('dmarc=pass') ? 'Pass' : 'Fail';

                    const ipRegex = /(?:[0-9]{1,3}\.){3}[0-9]{1,3}/;
                    const receivedHeader = headers['Received'] || '';
                    const ipAddress = receivedHeader.match(ipRegex) ? receivedHeader.match(ipRegex)![0] : 'N/A';

                    await csvWriter.writeRecords([
                        {
                            Message_ID: message.id,
                            Thread_ID: msg.data.threadId || 'N/A',
                            From: headers['From'] || 'N/A',
                            To: headers['To'] || 'N/A',
                            CC: headers['Cc'] || 'N/A',
                            BCC: headers['Bcc'] || 'N/A',
                            Subject: headers['Subject'] || 'N/A',
                            Date: headers['Date'] || 'N/A',
                            Labels: msg.data.labelIds ? msg.data.labelIds.join(', ') : 'N/A',
                            SPF: spf,
                            DKIM: dkim,
                            DMARC: dmarc,
                            IP_Address: ipAddress,
                        },
                    ]);

                    console.log(`Processed and saved message ID: ${message.id}`);
                } catch (error) {
                    console.error(`Failed to process message ${message.id}:`, (error as Error).message);
                }
            }
        }

        pageToken = res.data.nextPageToken || null;
    } while (pageToken);

    if (latestTimestamp) {
        saveLastProcessedTimestamp(latestTimestamp);
        console.log(`Updated last processed timestamp: ${latestTimestamp}`);
    }

    console.log('All messages processed and saved.');
}

async function main(): Promise<void> {
    try {
        const auth = await authorize();
        await processReports(auth);
    } catch (error) {
        console.error('Error:', error);
    }
}

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    main();
});