// Google Sheets API v4
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const claLabel = "PR: don't merge - NEEDS CLA";
const claLabelArray = [claLabel];
var spreadsheetId = process.env.SPREADSHEET_ID;

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
var clientSecret = process.env.CLIENT_SECRET;

/**
 * @type {import('probot').Context} context
 */
var context;

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the
 *   authorized client.
 */

module.exports.authorize = function (credentials) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUrl);
  oauth2Client.credentials = JSON.parse(process.env.CREDENTIALS);
  return oauth2Client;
};

module.exports.generateOutput = async function (rows, prNumber, prDetails) {
  if (!rows || rows.length === 0) {
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
    claFlag = labels.some(function (label) {
      return label.name === claLabel;
    });

    // Check if the author has signed the CLA.
    for (var row in rows) {
      var rowUserName = rows[row][0];
      if (rowUserName.toLowerCase() === userName.toLowerCase()) {
        hasUserSignedCla = true;
        break;
      }
    }

    // If the PR has a CLA label, check if the author has signed the CLA.
    if (claFlag === true) {
      // If author has signed the CLA, remove the CLA label.
      if (hasUserSignedCla === true) {
        await context.github.issues.removeLabel(
          context.repo({
            number: prNumber,
            name: claLabel,
          })
        );
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
    var linkText = 'here';
    var linkResult = linkText.link(
      'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#setting-things-up'
    );
    var params = context.repo({
      number: prNumber,
      body:
        'Hi! @' +
        userName +
        '. Welcome to Oppia! Please could you ' +
        'follow the instructions ' +
        linkResult +
        " to get started? You'll need to do " +
        'this before we can accept your PR. Thanks!',
    });
    await context.github.issues.addLabels(
      context.repo({
        number: prNumber,
        labels: claLabelArray,
      })
    );
    await context.github.issues.createComment(params);
    commentCreatedStatus = true;
    return commentCreatedStatus;
  }
};

module.exports.checkClaSheet = async function (auth) {
  var sheets = google.sheets('v4');
  await sheets.spreadsheets.values.get(
    {
      auth: auth,
      spreadsheetId: spreadsheetId,
      range: 'Usernames!A:A',
    },
    async function (err, response) {
      if (err) {
        // eslint-disable-next-line no-console
        console.log('The API returned an error: ' + err);
        return;
      }

      var pullRequestNumber = context.payload.pull_request.number;
      var pullRequestDetails = context.payload.pull_request;

      // eslint-disable-next-line no-console
      console.log(
        'CHECKING PULL REQUEST NUMBER ' + pullRequestNumber + ' FOR CLA..'
      );
      await module.exports.generateOutput(
        response.data.values,
        pullRequestNumber,
        pullRequestDetails
      );
    }
  );
};

/**
 * @param {import('probot').Context} contextData
 */
module.exports.checkClaStatus = function (contextData) {
  context = contextData;

  // Authorize a client with the loaded credentials.
  const oauthClient = module.exports.authorize(JSON.parse(clientSecret));

  // Call the sheets API with the authorized client.
  module.exports.checkClaSheet(oauthClient);
};
