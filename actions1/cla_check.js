const core = require('@actions/core');
const { context, GitHub } = require('@actions/github');
const { execSync } = require('child_process');
const { google } = require('googleapis');

const SHEETS_TOKEN = process.env.SHEETS_TOKEN;
const CREDENTIALS = JSON.parse(process.env.SHEETS_CRED);
const SPREADSHEET_ID = '1naQC7iEfnro5iOjTFEn7iPCxNMPaPa4YnIddjT5CTM8';
const RANGE = 'Usernames';
const PR_AUTHOR = context.payload.pull_request.user.login;
const PR_NUMBER = context.payload.pull_request.number;
const LINK_RESULT = (
  'https://github.com/oppia/oppia/wiki' +
  '/Contributing-code-to-Oppia#setting-things-up')

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} CREDENTIALS The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
const authorize = function(callback) {
  const { client_secret, client_id, redirect_uris } = CREDENTIALS.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );
  oAuth2Client.setCredentials(JSON.parse(SHEETS_TOKEN));
  callback(oAuth2Client);
};


/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
const claCheck = async (auth) => {
  let comment = '';
  let cmd = '';
  const sheets = google.sheets({ version: 'v4', auth });
  sheets.spreadsheets.values.get(
    {
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    },
    (err, res) => {
      if (err) {
        core.setFailed('The API returned an error: ' + err);
      }
      const rows = res.data.values;
      const flatRows = [].concat.apply([], rows);
      if (rows.length) {
        console.log('Checking if ', PR_AUTHOR, ' has signed the CLA');
        const isSign = flatRows.includes(PR_AUTHOR);
        if (!isSign) {
          comment = ('Hi! ' +
              PR_AUTHOR +
              'Welcome to Oppia! Please could you ' +
              'follow the instructions ' + LINK_RESULT +
              " to get started? You'll need to do " +
              'this before we can accept your PR. Thanks!');
          cmd = 'gh pr comment ' + PR_NUMBER + ' --body "' + comment + '"';
          console.log(cmd);
          try {
            execSync(cmd);
            core.setFailed(PR_AUTHOR + ' has not signed the CLA');
          } catch (err){
            core.setFailed('Comment failed: ' + err);
          }
        }
      } else {
        console.log('No data found.');
      }
    }
  );
};

authorize(claCheck);
