import { google } from 'googleapis';
import { CREDENTIALS_PATH, TOKEN_DIR, SCOPES, TOKEN_PATH } from '../conf/constants';
import { loadJsonFile, saveJsonFile } from './fileReadandWrite';
import express from 'express';
import path from 'path';

export async function authorize(app: express.Application): Promise<any> {
  console.log('Authorizing...');

  const credentials = loadJsonFile<{ web: any }>(CREDENTIALS_PATH);
  if (!credentials) throw new Error('Credentials file not found.');

  const { client_id, client_secret, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const token = loadJsonFile<{ refresh_token?: string }>(TOKEN_PATH);
  if (token) {
    oAuth2Client.setCredentials(token);

    // Refresh access token if expired
    if (!oAuth2Client.credentials.access_token || (oAuth2Client.credentials.expiry_date && oAuth2Client.credentials.expiry_date < Date.now())) {
      console.log('Refreshing access token...');
      const { credentials } = await oAuth2Client.refreshAccessToken();
      oAuth2Client.setCredentials(credentials);
      saveJsonFile(TOKEN_PATH, credentials);
    }

    console.log('Using refreshed access token.');
    return oAuth2Client;
  }

  // Generate auth URL with correct options
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting:', authUrl);

  return new Promise((resolve, reject) => {
    app.get('/oauth2callback', (req, res) => {
      console.log('OAuth2 callback route hit');
      const code = req.query.code as string;

      oAuth2Client.getToken(code, async (err, token) => {
        if (err) {
          console.error('Error retrieving token:', err);
          return reject(err);
        }

        if (!token) {
          console.error('No token received.');
          return reject(new Error('No token received.'));
        }

        oAuth2Client.setCredentials(token);

        // Ensure refresh token is saved
        if (!token.refresh_token) {
          const existingToken = loadJsonFile<{ refresh_token?: string }>(TOKEN_PATH);
          oAuth2Client.setCredentials({
            ...token,
            refresh_token: existingToken?.refresh_token || token?.refresh_token,
          });
        }

        // Retrieve user's email
        const people = google.people({ version: 'v1', auth: oAuth2Client });
        people.people.get(
          { resourceName: 'people/me', personFields: 'emailAddresses' },
          (err, response) => {
            if (err) {
              console.error('Error retrieving email:', err);
              return reject(err);
            }

            const email = response?.data?.emailAddresses?.[0]?.value;
            if (!email) {
              console.error('No email found.');
              return reject(new Error('No email found.'));
            }

            // Save token with email-based filename
            const tokenPath = path.join(TOKEN_DIR, `token-${email}.json`);
            console.log(`Saving token to: ${tokenPath}`);
            saveJsonFile(tokenPath, oAuth2Client.credentials);

            res.send('Authentication successful! You can close this tab.');
            resolve(oAuth2Client);
          }
        );
      });
    });
  });
}
