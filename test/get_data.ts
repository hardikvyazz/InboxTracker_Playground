import fs from 'fs';
import {google, gmail_v1} from 'googleapis';
import { createObjectCsvWriter } from 'csv-writer';
import { Express } from 'express';
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = 'token.json';

async function authorize() {
    const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (fs.existsSync(TOKEN_PATH)) {
        const token = fs.readFileSync(TOKEN_PATH, 'utf8');
        oAuth2Client.setCredentials(JSON.parse(token));
    } else {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });
        console.log('Authorize this app by visiting this url:', authUrl);
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question('Enter the code from that page here: ', (code) => {
            rl.close();
            oAuth2Client.getToken(code, (err, token) => {
                if (err) return console.error('Error retrieving access token', err);
                oAuth2Client.setCredentials(token);
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
                console.log('Token stored to', TOKEN_PATH);
            });
        });
    }
    return oAuth2Client;
}

async function listMessages(auth: any) {
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.messages.list({ userId: 'me' });
    const messages = res.data.messages || [];
    return messages;
}

async function getMessage(auth: any, messageId: string) {
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.messages.get({ userId: 'me', id: messageId });
    return res.data;
}

async function main() {
    const auth = await authorize();
    const messages = await listMessages(auth);
    for (const message of messages) {
        const msg = await getMessage(auth, message.id);
        console.log(`Message snippet: ${msg.snippet}`);
    }
}

main().catch(console.error);