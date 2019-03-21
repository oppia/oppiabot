// Google Sheets API v4
const fs = require('fs');
const readline = require('readline');
const google = require('googleapis');
const googleAuth = require('google-auth-library');
const claLabel = ['PR: don\'t merge - NEEDS CLA'];
var spreadsheetId = process.env.SPREADSHEET_ID;

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
var clientSecret = process.env.CLIENT_SECRET;
var context;

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

module.exports.generateOutput = async function(rows, prNumber, prDetails) {
  if (rows.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No data found.');
  } else {
    var params;
    var labels = prDetails.labels;
    var claFlag = false;
    var hasUserSignedCla = false;
    var commentCreatedStatus = false;
    var userName = prDetails.user.login;

    // Check if the PR already has a CLA label.
    for (var label in labels) {
      if (labels[label].name === claLabel[0]) {
        claFlag = true;
        break;
      }
    }

    // Check if the author has signed the CLA.
    for (var row in rows) {
      var rowUserName = rows[row][0];
      if (rowUserName === userName) {
        hasUserSignedCla = true;
        break;
      }
    }

    // If the PR has a CLA label, check if the author has signed the CLA.
    if (claFlag === true) {
      // If author has signed the CLA, remove the CLA label.
      if (hasUserSignedCla === true) {
        await context.github.issues.removeLabel(context.repo({
          number: prNumber,
          name: claLabel[0]
        }));
      }
      return;
    }

    // If the PR does not have a CLA label and the author has signed
    // the CLA, no action is required.
    if (hasUserSignedCla === true) {
      return;
    }

    // If the PR does not have a CLA label and the author has not signed
    // the CLA, ping the author in the PR thread to sign the CLA.
    if (claFlag === false && hasUserSignedCla === false) {
      var linkText = 'here';
      var linkResult = linkText.link(
        'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#setting-things-up');
      var params = context.repo({
        number: prNumber,
        body: 'Hi! @' + userName +
            '. Welcome to Oppia! Please could you ' +
            'follow the instructions ' + linkResult +
            ' to get started? You\'ll need to do ' +
            'this before we can accept your PR. Thanks!'});
      labelPromiseObj = await context.github.issues.addLabels(context.repo({
        number: prNumber,
        labels: claLabel}));
      await context.github.issues.createComment(params);
      commentCreatedStatus = true;
      return commentCreatedStatus;
    }
  }
};

module.exports.checkClaSheet = async function(auth) {
  var sheets = google.sheets('v4');
  await sheets.spreadsheets.values.get({
    auth: auth,
    spreadsheetId: spreadsheetId,
    range: 'Usernames!A:A',
  }, async function(err, response) {
    if (err) {
      // eslint-disable-next-line no-console
      console.log('The API returned an error: ' + err);
      return;
    }

    var pullRequestsPromiseObj = await context.github.pullRequests.getAll(
      context.repo({per_page: 40}));

    var arrayOfOpenPullRequests = pullRequestsPromiseObj.data;

    for (var indexOfPullRequest in arrayOfOpenPullRequests) {
      var pullRequestNumber = arrayOfOpenPullRequests[
        indexOfPullRequest].number;
      var pullRequestDetailsPromiseObj = await context.github.pullRequests.get(
        context.repo({number: pullRequestNumber}));

      var pullRequestDetails = pullRequestDetailsPromiseObj.data;

      // eslint-disable-next-line no-console
      console.log(
        'CHECKING PULL REQUEST NUMBER ' + pullRequestNumber + ' FOR CLA..');

      await module.exports.generateOutput(
        response.values, pullRequestNumber, pullRequestDetails);
    }
  });
};

module.exports.apiForSheets = function(contextData) {
  context = contextData;

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
