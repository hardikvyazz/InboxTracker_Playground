import { TOKEN_PATH } from "../conf/constants";
import { saveJsonFile } from "../untils/fileReadandWrite";

export async function refreshAccessToken(oAuth2Client: any) {
    return new Promise((resolve, reject) => {
      oAuth2Client.getAccessToken((err: any, token: any) => {
        if (err) {
          console.error('Error refreshing access token:', err);
          reject(err);
        } else {
          console.log('Access token refreshed:', token);
          saveJsonFile(TOKEN_PATH, oAuth2Client.credentials); // Save updated token
          resolve(token);
        }
      });
    });
  }
  