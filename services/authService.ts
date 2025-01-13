import { google } from 'googleapis';
import { CREDENTIALS_PATH, TOKEN_PATH, SCOPES } from '../src/conf/constants';
import { loadJsonFile, saveJsonFile } from './fileReadandWrite';
import express from 'express';

const app = express();

export async function authorize(): Promise<any> {
  const credentials = loadJsonFile<{ web: any }>(CREDENTIALS_PATH);
  if (!credentials) throw new Error('Credentials file not found.');

  const { client_id, client_secret, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const token = loadJsonFile(TOKEN_PATH);
  if (token) {
    oAuth2Client.setCredentials(token);
    console.log('Reusing existing credentials.');
    return oAuth2Client;
  }

  const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
  console.log('Authorize this app by visiting:', authUrl);

  return new Promise((resolve, reject) => {
    app.get('/oauth2callback', (req, res) => {
      const code = req.query.code as string;
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return reject(err);
        oAuth2Client.setCredentials(token!);
        saveJsonFile(TOKEN_PATH, token);
        res.send('Authentication successful! You can close this tab.');
        resolve(oAuth2Client);
      });
    });
  });
}
