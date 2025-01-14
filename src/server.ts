import express from 'express';
import { PORT } from './conf/constants';
import { authorize } from './services/authService';
import { processReports } from './services/emailProcessor';

const app = express();

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  try {
    const auth = await authorize();
    await processReports(auth);
  } catch (error) {
    console.error('Error:', error);
  }
});