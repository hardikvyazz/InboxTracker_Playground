"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processReports = processReports;
const googleapis_1 = require("googleapis");
const path_1 = __importDefault(require("path"));
const constants_1 = require("../conf/constants");
const fileReadandWrite_1 = require("../services/fileReadandWrite");
const csv_writer_1 = require("csv-writer");
const today = new Date();
const todayDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
const fileName = `email_data_${todayDate}.csv`;
const filePath = path_1.default.join(__dirname, `../../../../csv_data/${fileName}`);
function processReports(auth) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: filePath,
            header: [
                { id: 'Message_ID', title: 'Message ID' },
                { id: 'Thread_ID', title: 'Thread ID' },
                { id: 'From', title: 'From' },
                { id: 'To', title: 'To' },
                { id: 'CC', title: 'CC' },
                { id: 'BCC', title: 'BCC' },
                { id: 'Subject', title: 'Subject' },
                { id: 'Date', title: 'Date' },
                { id: 'Labels', title: 'Labels' },
                { id: 'SPF', title: 'SPF' },
                { id: 'DKIM', title: 'DKIM' },
                { id: 'DMARC', title: 'DMARC' },
                { id: 'IP_Address', title: 'IP Address' },
            ],
            append: true,
        });
        const lastProcessed = ((_a = (0, fileReadandWrite_1.loadJsonFile)(constants_1.LAST_PROCESSED_FILE)) === null || _a === void 0 ? void 0 : _a.lastProcessed) || 0;
        const query = lastProcessed ? `after:${lastProcessed}` : '';
        const res = yield gmail.users.messages.list({ userId: 'me', q: query });
        const messages = res.data.messages || [];
        let latestTimestamp = lastProcessed;
        for (const message of messages) {
            try {
                const msg = yield gmail.users.messages.get({
                    userId: 'me',
                    id: message.id || '',
                    format: 'full',
                });
                const payload = msg.data.payload;
                const headers = parseHeaders((payload === null || payload === void 0 ? void 0 : payload.headers) || []);
                const dateHeader = headers['Date'] || '';
                const messageDate = new Date(dateHeader).getTime();
                latestTimestamp = Math.max(latestTimestamp, messageDate);
                yield csvWriter.writeRecords([
                    {
                        Message_ID: message.id || 'N/A',
                        Thread_ID: msg.data.threadId || 'N/A',
                        From: headers['From'] || 'N/A',
                        To: headers['To'] || 'N/A',
                        CC: headers['Cc'] || 'N/A',
                        BCC: headers['Bcc'] || 'N/A',
                        Subject: headers['Subject'] || 'N/A',
                        Date: headers['Date'] || 'N/A',
                        Labels: ((_b = msg.data.labelIds) === null || _b === void 0 ? void 0 : _b.join(', ')) || 'N/A',
                        SPF: headers['Received-SPF'] || 'N/A',
                        DKIM: ((_c = headers['Authentication-Results']) === null || _c === void 0 ? void 0 : _c.includes('dkim=pass'))
                            ? 'Pass'
                            : 'Fail',
                        DMARC: ((_d = headers['Authentication-Results']) === null || _d === void 0 ? void 0 : _d.includes('dmarc=pass'))
                            ? 'Pass'
                            : 'Fail',
                        IP_Address: extractIpAddress(headers['Received'] || ''),
                    },
                ]);
            }
            catch (error) {
                console.error(`Failed to process message ${message.id}:`, error.message);
            }
        }
        if (latestTimestamp > lastProcessed) {
            (0, fileReadandWrite_1.saveJsonFile)(constants_1.LAST_PROCESSED_FILE, { lastProcessed: latestTimestamp });
        }
    });
}
function parseHeaders(headers = []) {
    return headers.reduce((acc, header) => {
        if (header.name && header.value) {
            acc[header.name] = header.value;
        }
        return acc;
    }, {});
}
function extractIpAddress(receivedHeader) {
    const ipRegex = /(?:\d{1,3}\.){3}\d{1,3}/;
    const match = receivedHeader.match(ipRegex);
    return match ? match[0] : 'N/A';
}
