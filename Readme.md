# Gmail API Email Processor

This project is a Node.js application that connects to the Gmail API to process emails and save email details into a CSV file. The program ensures efficiency by only fetching new emails after the last processed timestamp.

## Features

- **Fetch New Emails**: Retrieves only new emails received after the last processed time.
- **CSV Output**: Saves email details to `detailed_email_reports.csv`.
- **OAuth Authentication**: Uses OAuth 2.0 for secure access to Gmail.
- **Timestamp Tracking**: Saves and reads the timestamp of the last processed email to avoid redundant processing.

## Requirements

- Node.js (version 14.x or later)
- npm (Node package manager)
- A Google Cloud project with Gmail API enabled
- Gmail API credentials file (`credentials.json`)

## Setup

### 1. Clone the Repository
```bash
git clone <repository_url>
cd <repository_directory>
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Enable Gmail API
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Enable the Gmail API.
4. Create credentials for an OAuth 2.0 Client ID and download the `credentials.json` file.
5. Place the `credentials.json` file in the root of this project.

### 4. Run the Application
```bash
node app.js
```

### 5. Authorize the Application
When the application runs for the first time, it will generate an authentication URL. Open this URL in your browser, authenticate, and copy-paste the code back into the application as instructed.

## Configuration

### Files:
- **`credentials.json`**: Contains your OAuth client credentials.
- **`last_processed.json`**: Stores the timestamp of the last processed email.
- **`detailed_email_reports.csv`**: Output file containing processed email details.

### CSV Fields:
The following details are saved in the CSV:
- `Message ID`
- `Thread ID`
- `From`
- `To`
- `Cc`
- `Bcc`
- `Subject`
- `Date`
- `Labels`
- `SPF`
- `DKIM`
- `DMARC`
- `IP Address`

## How It Works

1. **Authentication**: The application authenticates with Gmail API using OAuth 2.0.
2. **Fetch Emails**: Emails are fetched using the `after:` query to filter emails received after the saved timestamp.
3. **Process and Save**: Email metadata is extracted and appended to `detailed_email_reports.csv`.
4. **Save Timestamp**: Updates `last_processed.json` with the timestamp of the latest processed email.

## Troubleshooting

- **Authentication Issues**: Ensure the `credentials.json` file is correctly configured.
- **Email Permissions**: Verify that your Gmail account has granted the necessary permissions to the app.
- **Node.js Errors**: Check that all dependencies are installed with `npm install`.

## Contribution
Feel free to fork this project and submit pull requests for improvements or bug fixes.

## License
This project is licensed under the MIT License.
