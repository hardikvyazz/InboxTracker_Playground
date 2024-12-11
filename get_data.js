const fs = require('fs');
const { google } = require('googleapis');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const express = require('express');
const base64url = require('base64url');
const { simpleParser } = require('mailparser');

const app = express();
const PORT = 3000;

const CREDENTIALS_PATH = 'credentials.json'; // Your credentials file
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

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

    // Define the CSV file path and header
    const csvFilePath = 'data/detailed_email_reports_alex.csv';
    const csvWriter = createCsvWriter({
        path: csvFilePath,
        header: [
            { id: 'Message_ID', title: 'Message ID' },
            { id: 'Thread_ID', title: 'Thread ID' },
            { id: 'From', title: 'From' },
            { id: 'To', title: 'To' },
            { id: 'Cc', title: 'Cc' },
            { id: 'Bcc', title: 'Bcc' },
            { id: 'Subject', title: 'Subject' },
            { id: 'Date', title: 'Date' },
            // { id: 'Body_Text', title: 'Body (Text)' },
            // { id: 'Body_HTML', title: 'Body (HTML)' },
            // { id: 'Attachments', title: 'Attachments' },
            { id: 'Labels', title: 'Labels' },
            { id: 'SPF', title: 'SPF' },
            { id: 'DKIM', title: 'DKIM' },
            { id: 'DMARC', title: 'DMARC' },
            { id: 'IP_Address', title: 'IP Address' },
        ],
        append: true, // Append records to the file without overwriting
    });

    // Check if the file exists and write headers if not
    if (!fs.existsSync(csvFilePath)) {
        await csvWriter.writeRecords([]); // Writing an empty record to create the file with headers
    }

    let pageToken = null;

    do {
        const res = await gmail.users.messages.list({
            userId: 'me',
            pageToken: pageToken,
            maxResults: 100,
        });
        const messages = res.data.messages;

        if (messages && messages.length) {
            for (const message of messages) {
                try {
                    const msg = await gmail.users.messages.get({ userId: 'me', id: message.id, format: 'full' });
                    const payload = msg.data.payload;

                    // Metadata extraction
                    const headers = payload.headers.reduce((acc, header) => {
                        acc[header.name] = header.value;
                        return acc;
                    }, {});

                    const messageId = message.id;
                    const threadId = msg.data.threadId;
                    const from = headers['From'] || 'N/A';
                    const to = headers['To'] || 'N/A';
                    const cc = headers['Cc'] || 'N/A';
                    const bcc = headers['Bcc'] || 'N/A';
                    const subject = headers['Subject'] || 'N/A';
                    const date = headers['Date'] || 'N/A';
                    const labels = msg.data.labelIds ? msg.data.labelIds.join(', ') : 'N/A';

                    // // Parse the message body
                    // const parts = payload.parts || [];
                    // let bodyText = '';
                    // let bodyHtml = '';
                    // const attachments = [];

                    // for (const part of parts) {
                    //     if (part.mimeType === 'text/plain' && part.body.data) {
                    //         bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    //     } else if (part.mimeType === 'text/html' && part.body.data) {
                    //         bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    //     } else if (part.filename) {
                    //         attachments.push(part.filename);
                    //     }
                    // }

                    // Parse email headers for authentication results
                    const spf = headers['Received-SPF'] || 'N/A';
                    const dkim = headers['Authentication-Results'] && headers['Authentication-Results'].includes('dkim=pass') ? 'Pass' : 'Fail';
                    const dmarc = headers['Authentication-Results'] && headers['Authentication-Results'].includes('dmarc=pass') ? 'Pass' : 'Fail';

                    // Extract IP address
                    const ipRegex = /(?:[0-9]{1,3}\.){3}[0-9]{1,3}/;
                    const receivedHeader = headers['Received'] || '';
                    const ipAddress = receivedHeader.match(ipRegex) ? receivedHeader.match(ipRegex)[0] : 'N/A';

                    // Append the extracted record to the CSV
                    await csvWriter.writeRecords([
                        {
                            Message_ID: messageId,
                            Thread_ID: threadId,
                            From: from,
                            To: to,
                            Cc: cc,
                            Bcc: bcc,
                            Subject: subject,
                            Date: date,
                            // Body_Text: bodyText,
                            // Body_HTML: bodyHtml,
                            // Attachments: attachments.join(', '),
                            Labels: labels,
                            SPF: spf,
                            DKIM: dkim,
                            DMARC: dmarc,
                            IP_Address: ipAddress,
                        },
                    ]);

                    console.log(`Processed and saved message ID: ${messageId}`);
                } catch (error) {
                    console.error(`Failed to process message ${message.id}:`, error.message);
                }
            }
        }

        pageToken = res.data.nextPageToken;
    } while (pageToken);

    console.log('All messages processed and saved to CSV.');
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