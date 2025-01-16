import { google } from 'googleapis';
import { CREDENTIALS_PATH, TOKEN_PATH, SCOPES } from '../conf/constants';
import { loadJsonFile, saveJsonFile } from './fileReadandWrite';
import express from 'express';

export async function authorize(app: express.Application): Promise<any> {
  console.log('Authorizing...');
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
    // Attach the route to handle the OAuth2 callback
    app.get('/oauth2callback', (req, res) => {
      console.log('OAuth2 callback route hit');
      console.log('Query parameters:', req.query);
      const code = req.query.code as string;
      oAuth2Client.getToken(code, (err, token) => {
        if (err) {
          console.error('Error retrieving token:', err);
          return reject(err);
        }
        oAuth2Client.setCredentials(token!);
        saveJsonFile(TOKEN_PATH, token);
        res.send('Authentication successful! You can close this tab.');
        resolve(oAuth2Client);
      });
    });
  });
}
