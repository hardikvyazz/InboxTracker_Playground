const fs = require('fs');
const { google } = require('googleapis');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const express = require('express');

const app = express();
const PORT = 3000;

const CREDENTIALS_PATH = 'credentials.json';
const LAST_PROCESSED_FILE = 'last_processed.json';
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function loadLastProcessedTimestamp() {
    if (fs.existsSync(LAST_PROCESSED_FILE)) {
        const data = fs.readFileSync(LAST_PROCESSED_FILE, 'utf-8');
        return JSON.parse(data).lastProcessed || null;
    }
    return null;
}

function saveLastProcessedTimestamp(timestamp) {
    const data = { lastProcessed: timestamp };
    fs.writeFileSync(LAST_PROCESSED_FILE, JSON.stringify(data));
}

async function authorize() {
    const content = fs.readFileSync(CREDENTIALS_PATH);
    const { client_secret, client_id, redirect_uris } = JSON.parse(content).web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });

    console.log('Authorize this app by visiting this url:', authUrl);

    return new Promise((resolve, reject) => {
        app.get('/oauth2callback', (req, res) => {
            const code = req.query.code;
            oAuth2Client.getToken(code, (err, token) => {
                if (err) return reject('Error retrieving access token');
                oAuth2Client.setCredentials(token);
                fs.writeFileSync('token.json', JSON.stringify(token));
                res.send('Authentication successful! You can close this tab.');
                resolve(oAuth2Client);
            });
        });
    });
}

async function processReports(auth) {
    const gmail = google.gmail({ version: 'v1', auth });

    const csvWriter = createCsvWriter({
        path: 'data/detailed_email_reports_abi.csv',
        header: [
            { id: 'Message_ID', title: 'Message ID' },
            { id: 'From', title: 'From' },
            { id: 'To', title: 'To' },
            { id: 'Subject', title: 'Subject' },
            { id: 'Date', title: 'Date' },
        ],
        append: true,
    });

    const lastProcessed = loadLastProcessedTimestamp();
    console.log(`Last processed timestamp: ${lastProcessed}`);

    const query = lastProcessed ? `after:${lastProcessed}` : '';
    console.log(`Query: ${query}`);

    let pageToken = null;
    let latestTimestamp = lastProcessed;

    do {
        const res = await gmail.users.messages.list({
            userId: 'me',
            pageToken: pageToken,
            maxResults: 100,
            q: query,
        });

        const messages = res.data.messages;

        if (messages && messages.length) {
            for (const message of messages) {
                try {
                    const msg = await gmail.users.messages.get({ userId: 'me', id: message.id, format: 'full' });
                    const headers = msg.data.payload.headers.reduce((acc, header) => {
                        acc[header.name] = header.value;
                        return acc;
                    }, {});

                    const dateHeader = headers['Date'];
                    const messageDate = new Date(dateHeader).getTime() / 1000;

                    if (!latestTimestamp || messageDate > latestTimestamp) {
                        latestTimestamp = messageDate;
                    }

                    await csvWriter.writeRecords([
                        {
                            Message_ID: message.id,
                            From: headers['From'] || 'N/A',
                            To: headers['To'] || 'N/A',
                            Subject: headers['Subject'] || 'N/A',
                            Date: headers['Date'] || 'N/A',
                        },
                    ]);

                    console.log(`Processed and saved message ID: ${message.id}`);
                } catch (error) {
                    console.error(`Failed to process message ${message.id}:`, error.message);
                }
            }
        }

        pageToken = res.data.nextPageToken;
    } while (pageToken);

    if (latestTimestamp) {
        saveLastProcessedTimestamp(latestTimestamp);
        console.log(`Updated last processed timestamp: ${latestTimestamp}`);
    }

    console.log('All messages processed and saved.');
}

async function main() {
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