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
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = authorize;
const googleapis_1 = require("googleapis");
const constants_1 = require("../conf/constants");
const fileReadandWrite_1 = require("./fileReadandWrite");
function authorize(app) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Authorizing...');
        const credentials = (0, fileReadandWrite_1.loadJsonFile)(constants_1.CREDENTIALS_PATH);
        if (!credentials)
            throw new Error('Credentials file not found.');
        const { client_id, client_secret, redirect_uris } = credentials.web;
        const oAuth2Client = new googleapis_1.google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        const token = (0, fileReadandWrite_1.loadJsonFile)(constants_1.TOKEN_PATH);
        if (token) {
            oAuth2Client.setCredentials(token);
            console.log('Reusing existing credentials.');
            return oAuth2Client;
        }
        const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: constants_1.SCOPES });
        console.log('Authorize this app by visiting:', authUrl);
        return new Promise((resolve, reject) => {
            // Attach the route to handle the OAuth2 callback
            app.get('/oauth2callback', (req, res) => {
                console.log('OAuth2 callback route hit');
                console.log('Query parameters:', req.query);
                const code = req.query.code;
                oAuth2Client.getToken(code, (err, token) => {
                    if (err) {
                        console.error('Error retrieving token:', err);
                        return reject(err);
                    }
                    oAuth2Client.setCredentials(token);
                    (0, fileReadandWrite_1.saveJsonFile)(constants_1.TOKEN_PATH, token);
                    res.send('Authentication successful! You can close this tab.');
                    resolve(oAuth2Client);
                });
            });
        });
    });
}
