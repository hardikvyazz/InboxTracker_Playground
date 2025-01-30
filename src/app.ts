import express from 'express';
import { PORT } from './conf/constants';
import authUrlRouter from './services/authUrlService';  // Correct import of the router
import refreshTokens from './services/tokenMonitorService';
import { processReports } from './services/emailProcessor';

const app = express();

// Attach the router to '/auth' endpoint
app.use('/auth', authUrlRouter);

app._router.stack.forEach((middleware: { route: { path: any; }; }) => {
  if (middleware.route) {
    console.log(middleware.route.path);
  }
});


app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  try {
    console.log('Starting token monitoring service...');
    const auth = await refreshTokens(); // Start the background service for token refresh
    console.log('Authorized successfully.');
    
    await processReports(auth);
  } catch (error) {
    console.error('Error in token monitoring:', error);
  }
});