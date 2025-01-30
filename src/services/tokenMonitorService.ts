import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { CREDENTIALS_PATH, TOKEN_DIR } from '../conf/constants';
import { loadJsonFile, saveJsonFile } from '../untils/fileReadandWrite';
import fs from 'fs';
import path from 'path';

async function loadTokens() {
  console.log('Checking existing tokens...');

  const credentials = loadJsonFile<{ web: any }>(CREDENTIALS_PATH);
  if (!credentials) throw new Error('Credentials file not found.');

  const { client_id, client_secret, redirect_uris } = credentials.web;
  const tokenFiles = fs.readdirSync(TOKEN_DIR).filter(file => file.endsWith('.json'));

  if (tokenFiles.length === 0) {
    throw new Error('No existing tokens found.');
  }

  const authenticatedClients: OAuth2Client[] = [];

  for (const file of tokenFiles) {
    const tokenPath = path.join(TOKEN_DIR, file);
    const token = loadJsonFile<{ refresh_token?: string }>(tokenPath);
    if (!token) continue;

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(token);

    // Refresh token if expired
    if (!oAuth2Client.credentials.access_token || 
        (oAuth2Client.credentials.expiry_date && oAuth2Client.credentials.expiry_date < Date.now())) {
      console.log(`Refreshing access token for: ${file}`);
      const { credentials } = await oAuth2Client.refreshAccessToken();
      oAuth2Client.setCredentials(credentials);
      saveJsonFile(tokenPath, credentials);
    }

    console.log(`Using refreshed access token for: ${file}`);
    authenticatedClients.push(oAuth2Client);
  }

  // Return the array of authenticated clients
  return authenticatedClients;
}

export default loadTokens;
