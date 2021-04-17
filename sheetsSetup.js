require('dotenv').config();
const readline = require('readline');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {Function} callback The callback for the authorized client.
 */
const getNewToken = (oAuth2Client, callback) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        return console.error(
          'Error while trying to retrieve access token', err
        );
      }
      oAuth2Client.setCredentials(token);
      callback(token);
    });
  });
};

(function() {
  const credentials = JSON.parse(process.env.CLIENT_SECRET);
  const clientSecret = credentials.installed.client_secret;
  const clientId = credentials.installed.client_id;
  const redirectUrl = credentials.installed.redirect_uris[0];
  const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUrl);

  getNewToken(oauth2Client, function(token) {
    // Logs new sheets access token.
    console.log('');
    console.log('Access Token: ', JSON.stringify(token));
    console.log('');
    console.log(
      'Add the newly generated access token to the CREDENTIALS variable in ' +
      'the .env'
    );
  });
})();
