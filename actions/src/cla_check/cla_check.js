// Copyright 2021 The Oppia Authors. All Rights Reserved.
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

/**
 * @fileoverview File to check if PR Author has signed the CLA
 */

const core = require('@actions/core');
const { context } = require('@actions/github');
const { execSync } = require('child_process');
const { google } = require('googleapis');

const SHEETS_TOKEN = process.env.SHEETS_TOKEN;
const CREDENTIALS = JSON.parse(process.env.SHEETS_CRED);
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const RANGE = 'Usernames';
const PR_AUTHOR = context.payload.pull_request.user.login;
const PR_NUMBER = context.payload.pull_request.number;

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given claCheck function.
 */
const authorize = function() {
  try {
    // eslint-disable-next-line camelcase
    const { client_secret, client_id, redirect_uris } = CREDENTIALS.installed;
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );
    oAuth2Client.setCredentials(JSON.parse(SHEETS_TOKEN));
    return oAuth2Client;
  } catch (err){
    core.setFailed('Auth failure: ' + err);
  }
};

const generateOutput = (hasClaSigned) => {
  const LINK_RESULT = 'here'.link(
    'https://github.com/oppia/oppia/wiki/' +
    'Contributing-code-to-Oppia#setting-things-up'
  );

  let comment = '';
  let cmd = '';
  if (!hasClaSigned) {
    comment = ('Hi! @' +
        PR_AUTHOR +
        ' Welcome to Oppia! Please could you ' +
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
};


/**
 * Checks if the PR Author has signed the CLA Sheet.
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
const checkSheet = async (auth) => {
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.get(
    {
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    },
    async (err, res) => {
      if (err) {
        core.setFailed('The API returned an error: ' + err);
      }
      const rows = res.data.values;
      const flatRows = [].concat.apply([], rows);
      if (!rows || rows.length === 0) {
        core.setFailed('No data found.');
      } else {
        console.log('Checking if ', PR_AUTHOR, ' has signed the CLA');
        const hasUserSignedCla = flatRows.includes(PR_AUTHOR);
        generateOutput(hasUserSignedCla);
      }
    }
  );
};

const claCheckGithubAction = () => {
  // Authorize a client with the loaded credentials.
  const auth = authorize();

  // Call the sheets API with the authorized client.
  checkSheet(auth);
};

module.exports = {
  claCheckGithubAction,
};
