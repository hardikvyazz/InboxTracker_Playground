import { google } from 'googleapis';
import { CREDENTIALS_PATH, TOKEN_DIR, SCOPES } from '../conf/constants';
import { loadJsonFile, saveJsonFile } from './fileReadandWrite';
import express from 'express';
import fs from 'fs';
import path from 'path';

export async function authorize(app: express.Application): Promise<any> {
  console.log('Authorizing...');

  // Load credentials
  const credentials = loadJsonFile<{ web: any }>(CREDENTIALS_PATH);
  if (!credentials) throw new Error('Credentials file not found.');

  const { client_id, client_secret, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Generate the auth URL
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });

  console.log('Authorize this app by visiting the URL:', authUrl);

  return new Promise((resolve, reject) => {
    app.get('/oauth2callback', (req, res) => {
      console.log('OAuth2 callback route hit');
      
      // Retrieve the authorization code from the query parameters
      const code = req.query.code as string;
      
      // Exchange the authorization code for a token
      oAuth2Client.getToken(code, (err, token) => {
        if (err) {
          console.error('Error retrieving token:', err);
          return reject(err);
        }

        // Set credentials for OAuth client
        oAuth2Client.setCredentials(token!);

        // Set credentials for OAuth client
        oAuth2Client.setCredentials(token!);

        // Use the People API to get the user's email
        const people = google.people({ version: 'v1', auth: oAuth2Client });
        people.people.get({
          resourceName: 'people/me',
          personFields: 'emailAddresses'
        }, (err, response) => {
          if (err) {
            console.error('Error retrieving email:', err);
            return reject(err);
          }

          const email = response?.data?.emailAddresses?.[0]?.value;

          if (!email) {
            console.error('No email found.');
            return reject(new Error('No email found.'));
          }

          // Save the token with the dynamic email filename
          const tokenPath = path.join(TOKEN_DIR, `token-${email}.json`);
          saveJsonFile(tokenPath, token);

          res.send('Authentication successful! You can close this tab.');
          resolve(oAuth2Client);
        });
      });
    });
  });
}
