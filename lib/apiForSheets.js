// Copyright 2020 The Oppia Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Google Sheets API v4
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const claLabel = "PR: don't merge - NEEDS CLA";
var spreadsheetId = process.env.SPREADSHEET_ID;

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
    console.log('No data found.');
  } else {
    const prParams = context.repo({
      pull_number: prNumber,
    });
    const commits = await context.github.pulls.listCommits(prParams);
    var allAuthors = [];

    for (var i = 0; i < commits.data.length; i++) {
      allAuthors.push(commits.data[i].author.login);
    }

    var authorSet = new Set(allAuthors);
    allAuthors = [...authorSet];

    var userNamesNotSignedCLA = '';
    var claCheckStatus = false;

    for (var i = 0; i < allAuthors.length; i++) {
      var hasUserSignedCla = false;
      var userName = allAuthors[i];

      // Check if the commit author has signed the CLA.
      for (var row in rows) {
        var rowUserName = rows[row][0];
        if (rowUserName.toLowerCase() === userName.toLowerCase()) {
          hasUserSignedCla = true;
          break;
        }
      }

      // If the commit author has signed the CLA, no action is required.
      if (hasUserSignedCla === true) {
        continue;
      }

      userNamesNotSignedCLA = userNamesNotSignedCLA + '@' + userName + ', ';
    }

    if (userNamesNotSignedCLA.length === 0) {
      return;
    }

    // If any commit author has not signed the CLA, ping the authors
    // in the PR thread to sign the CLA.
    var linkText = 'here';
    var linkResult = linkText.link(
      'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#' +
      'setting-things-up'
    );
    var params = context.repo({
      number: prNumber,
      body:
        'Hi! ' +
        userNamesNotSignedCLA +
        'Welcome to Oppia! Please could you ' +
        'follow the instructions ' +
        linkResult +
        " to get started? You'll need to do " +
        'this before we can accept your PR. I am closing this PR for now. ' +
        'Feel free to re-open it once you are done with the above ' +
        'instructions. Thanks!',
    });
    await context.github.issues.createComment(params);

    // Close the pull request.
    const closeIssueParams = context.repo({
      issue_number: prNumber,
      state: 'closed',
    });
    await context.github.issues.update(closeIssueParams);

    claCheckStatus = true;
    return claCheckStatus;
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
        console.log('The API returned an error: ' + err);
        return;
      }

      var pullRequestNumber = context.payload.pull_request.number;
      var pullRequestDetails = context.payload.pull_request;

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
module.exports.checkClaStatus = async function (contextData) {
  context = contextData;

  // Authorize a client with the loaded credentials.
  const oauthClient = module.exports.authorize(JSON.parse(clientSecret));

  // Call the sheets API with the authorized client.
  module.exports.checkClaSheet(oauthClient);
};
