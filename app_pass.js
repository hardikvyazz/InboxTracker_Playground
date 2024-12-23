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
        { id: 'Thread_ID', title: 'Thread ID' },
        { id: 'From', title: 'From' },
        { id: 'To', title: 'To' },
        { id: 'Cc', title: 'Cc' },
        { id: 'Bcc', title: 'Bcc' },
        { id: 'Subject', title: 'Subject' },
        { id: 'Date', title: 'Date' },
        { id: 'Attachments', title: 'Attachments' },
        { id: 'Labels', title: 'Labels' },
        { id: 'SPF', title: 'SPF' },
        { id: 'DKIM', title: 'DKIM' },
        { id: 'DMARC', title: 'DMARC' },
        { id: 'IP_Address', title: 'IP Address' },
    ],
    append: true,
});

function processMessage(message) {
    const headers = message.headers;
    const attachments = message.attachments ? message.attachments.join(', ') : 'None';
    const labels = message.labels ? message.labels.join(', ') : 'None';

    // Placeholder for email authentication checks
    const spf = 'Pass'; // Example value
    const dkim = 'Pass'; // Example value
    const dmarc = 'Pass'; // Example value
    const ipAddress = '127.0.0.1'; // Replace with logic to extract IP

    return {
        Message_ID: headers['message-id'] || 'N/A',
        Thread_ID: headers['x-thread-id'] || 'N/A',
        From: headers['from'] || 'N/A',
        To: headers['to'] || 'N/A',
        Cc: headers['cc'] || 'N/A',
        Bcc: headers['bcc'] || 'N/A',
        Subject: headers['subject'] || 'N/A',
        Date: headers['date'] || 'N/A',
        Attachments: attachments,
        Labels: labels,
        SPF: spf,
        DKIM: dkim,
        DMARC: dmarc,
        IP_Address: ipAddress,
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
                const message = { attachments: [], labels: [] };

                msg.on('body', (stream) => {
                    stream.on('data', (chunk) => {
                        headers += chunk.toString('utf8');
                    });
                });

                msg.once('attributes', (attrs) => {
                    if (attrs.struct) {
                        attrs.struct.forEach((part) => {
                            if (part.disposition && part.disposition.type.toUpperCase() === 'ATTACHMENT') {
                                message.attachments.push(part.disposition.params.filename);
                            }
                        });
                    }
                    if (attrs.flags) {
                        message.labels = attrs.flags;
                    }
                });

                msg.once('end', () => {
                    const parsedHeaders = Imap.parseHeader(headers);
                    message.headers = parsedHeaders;
                    messages.push(message);
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
