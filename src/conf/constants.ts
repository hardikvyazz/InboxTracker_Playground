
export const PORT = 3000;
export const CREDENTIALS_PATH = '../credentials/gmail/credentials.json';
export const TOKEN_PATH = '../credentials/gmail/tokens/';
export const LAST_PROCESSED_FILE = '../credentials/gmail/last_processed.json';
export const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'];
import path from 'path';
import fs from 'fs';
export const TOKEN_DIR = '../credentials/gmail/tokens';


export const TODAY = new Date();
export const TODAYDATE = TODAY.toISOString().split('T')[0]; // Format as YYYY-MM-DD
export const outputFileName = `email_data_${TODAYDATE}.csv`;
export const outputFilePath = path.join(__dirname, '../../../csv_data/', outputFileName);