import express, { Request, Response } from 'express';
import { google } from 'googleapis';
import { CREDENTIALS_PATH, SCOPES, TOKEN_DIR, TOKEN_PATH } from '../conf/constants';
import { loadJsonFile, saveJsonFile } from '../untils/fileReadandWrite';
import { apiRouter } from '../routes/api';
import path from 'path';

const app = express();

app.use(apiRouter);

const router = express.Router(); // Express router initialization

// Endpoint to generate the OAuth URL
router.get('/authorize', async (req: Request, res: Response): Promise<any> => {
  console.log('Generating OAuth2 authorization URL...');

  const credentials = loadJsonFile<{ web: any }>(CREDENTIALS_PATH);
  if (!credentials) {
    return res.status(500).json({ error: 'Credentials file not found.' });
  }

  const { client_id, client_secret, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('Authorization URL:', authUrl);
  return res.redirect(authUrl); // Redirect the user to the generated URL for authorization
});

// OAuth2 callback route for Google API
router.get('/oauth2callback', (req: Request, res: Response) => {
  console.log('OAuth2 callback route hit');
  const credentials = loadJsonFile<{ web: any }>(CREDENTIALS_PATH);
  const { client_id, client_secret, redirect_uris } = credentials?.web || {};
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  
  const code = req.query.code as string;

  oAuth2Client.getToken(code, async (err, token) => {
    if (err) {
      console.error('Error retrieving token:', err);
      return res.status(500).json({ error: 'Error retrieving token.' });
    }

    if (!token) {
      console.error('No token received.');
      return res.status(400).json({ error: 'No token received.' });
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
          return res.status(500).json({ error: 'Error retrieving email.' });
        }

        const email = response?.data?.emailAddresses?.[0]?.value;
        if (!email) {
          console.error('No email found.');
          return res.status(500).json({ error: 'No email found.' });
        }

        // Save token with email-based filename
        const tokenPath = path.join(TOKEN_DIR, `token-${email}.json`);
        console.log(`Saving token to: ${tokenPath}`);
        saveJsonFile(tokenPath, oAuth2Client.credentials);
        
        res.send('Authentication successful! You can close this tab.');
      }
    );
  });
});

export default router; // Export router to be used in app.ts
