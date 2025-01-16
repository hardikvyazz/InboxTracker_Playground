import express from 'express';
import { PORT } from './conf/constants';
import { authorize } from './services/authService';
import { processReports } from './services/emailProcessor';
import { log } from 'console';

const app = express();

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  try {
    const auth = await authorize(app); // Pass the app instance
    console.log('Authorized successfully.');
    console.log(auth);
    
    await processReports(auth);
  } catch (error) {
    console.error('Authorization Failed:', error);
  }
});
