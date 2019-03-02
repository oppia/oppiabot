// Google Sheets API v4
const fs = require('fs');
const readline = require('readline');
const google = require('googleapis');
const googleAuth = require('google-auth-library');
const claLabel = ['PR: don\'t merge - NEEDS CLA'];
var hasUserSignedCla = false;
var spreadsheetId = process.env.SPREADSHEET_ID;

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
var clientSecret = process.env.CLIENT_SECRET;
var context, userName, isPullRequest;
var commentCreatedStatus = false;

/**
  * Create an OAuth2 client with the given credentials, and then execute the
  * given callback function.
  *
  * @param {Object} credentials The authorization client credentials.
  * @param {function} callback The callback to call with the
  *   authorized client.
  */
module.exports.authorize = function(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
  oauth2Client.credentials = JSON.parse(process.env.CREDENTIALS);
  callback(oauth2Client);
};

module.exports.generateOutput = async function(rows) {
  if (rows.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No data found.');
  } else {
    var params;
    const labels = await context.github.issues.getIssueLabels(
      context.issue());
    var labelData;
    var claFlag = false;
    labelData = labels.data;
    for (var label in labelData) {
      if (labelData[label].name === claLabel[0]) {
        claFlag = true;
        break;
      }
    }

    if (claFlag === true) {
      for (var row in rows) {
        var rowUserName = rows[row][0];
        if (rowUserName === userName) {
          hasUserSignedCla = true;
          break;
        }
      }
      if (hasUserSignedCla === true) {
        await context.github.issues.removeLabel(context.issue({
          name: claLabel[0]
        }));
      }
      return;
    }

    if (isPullRequest === true) {
      for (var row in rows) {
        var rowUserName = rows[row][0];
        if (rowUserName === userName) {
          hasUserSignedCla = true;
          break;
        }
      }
      if (hasUserSignedCla === false) {
        var linkText = 'here';
        var linkResult = linkText.link(
          'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#setting-things-up');
        params = context.issue({
          body: 'Hi! @' + userName +
              '. Welcome to Oppia! Please could you ' +
              'follow the instructions ' + linkResult +
              ' to get started? You\'ll need to do ' +
              'this before we can accept your PR. Thanks!'});
        await context.github.issues.addLabels(context.issue({
          labels: claLabel
        }));
        await context.github.issues.createComment(params);
        commentCreatedStatus = true;
        return commentCreatedStatus;
      }
    }
  }
};

module.exports.checkClaSheet = async function(auth) {
  var sheets = google.sheets('v4');
  await sheets.spreadsheets.values.get({
    auth: auth,
    spreadsheetId: spreadsheetId,
    range: 'Usernames!A:A',
  }, function(err, response) {
    if (err) {
      // eslint-disable-next-line no-console
      console.log('The API returned an error: ' + err);
      return;
    }
    module.exports.generateOutput(response.values);
  });
};

module.exports.apiForSheets = function(
    userNameData, contextData, isPullRequestData) {
  context = contextData;
  userName = userNameData;
  isPullRequest = isPullRequestData;

  /**
    * Get and store new token after prompting for user authorization, and then
    * execute the given callback with the authorized OAuth2 client.
    *
    * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get
    *   token for.
    * @param {getEventsCallback} callback The callback to call with
    *    the authorized client.
    */
  var getNewToken = function(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    });
      // eslint-disable-next-line no-console
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
      rl.close();
      oauth2Client.getToken(code, function(err, token) {
        if (err) {
          // eslint-disable-next-line no-console
          console.log('Error while trying to retrieve access token', err);
          return;
        }
        oauth2Client.credentials = token;
        storeToken(token);
        callback(oauth2Client);
      });
    });
  };

  /**
    * Store token to disk be used in later program executions.
    *
    * @param {Object} token The token to store to disk.
    */
  var storeToken = function(token) {
    try {
      fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    // eslint-disable-next-line no-console
    console.log('Token stored to ' + TOKEN_PATH);
  };

    // Authorize a client with the loaded credentials, then call the
    // Google Sheets API.
  module.exports.authorize(
    JSON.parse(clientSecret), module.exports.checkClaSheet);
};
