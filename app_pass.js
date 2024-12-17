const Imap = require('imap');
const inspect = require('util').inspect;
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const express = require('express');

const app = express();
const PORT = 3000;

const EMAIL = 'kensciodevelopment001@gmail.com'; // Replace with your email
const APP_PASSWORD = 'govl suur yqlx sapr'; // Replace with your app password
const LAST_PROCESSED_FILE = 'last_processed.json';
const filePath = 'data/detailed_email_hardikdev.csv';

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

const csvWriter = createCsvWriter({
    path: filePath,
    header: [
        { id: 'Message_ID', title: 'Message ID' },
        { id: 'From', title: 'From' },
        { id: 'To', title: 'To' },
        { id: 'Subject', title: 'Subject' },
        { id: 'Date', title: 'Date' },
    ],
    append: true,
});

function processMessage(message) {
    const headers = message.headers;
    return {
        Message_ID: headers['message-id'] || 'N/A',
        From: headers['from'] || 'N/A',
        To: headers['to'] || 'N/A',
        Subject: headers['subject'] || 'N/A',
        Date: headers['date'] || 'N/A',
    };
}

function fetchEmails(imap) {
    return new Promise((resolve, reject) => {
        const lastProcessed = loadLastProcessedTimestamp();
        console.log(`Last processed timestamp: ${lastProcessed}`);

        imap.search(['ALL'], (err, results) => {
            if (err) return reject(err);

            const latestEmails = results.slice(-10); // Fetch latest 10 emails
            const messages = [];

            const fetcher = imap.fetch(latestEmails, { bodies: '' });

            fetcher.on('message', (msg, seqno) => {
                let headers = '';
                msg.on('body', (stream) => {
                    stream.on('data', (chunk) => {
                        headers += chunk.toString('utf8');
                    });
                });

                msg.once('end', () => {
                    const parsedHeaders = Imap.parseHeader(headers);
                    messages.push({
                        headers: parsedHeaders,
                    });
                });
            });

            fetcher.once('error', reject);

            fetcher.once('end', () => {
                console.log('Messages fetched successfully.');
                resolve(messages);
            });
        });
    });
}

function connectToInbox() {
    const imap = new Imap({
        user: EMAIL,
        password: APP_PASSWORD,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
    });

    return new Promise((resolve, reject) => {
        imap.once('ready', () => {
            console.log('IMAP connection ready.');
            imap.openBox('INBOX', false, (err, box) => {
                if (err) return reject(err);
                console.log(`Opened mailbox: ${box.name}`);
                resolve(imap);
            });
        });

        imap.once('error', reject);

        imap.connect();
    });
}

async function processEmails() {
    try {
        const imap = await connectToInbox();
        const messages = await fetchEmails(imap);

        const records = messages.map(processMessage);
        await csvWriter.writeRecords(records);

        console.log('All emails processed and saved.');

        const latestTimestamp = new Date().getTime() / 1000; // Example of a timestamp
        saveLastProcessedTimestamp(latestTimestamp);

        imap.end();
    } catch (error) {
        console.error('Error processing emails:', error);
    }
}

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    processEmails();
});
