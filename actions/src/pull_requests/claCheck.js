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
const github = require('@actions/github');
const { google } = require('googleapis');

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given claCheck function.
 */
const authorize = async function() {
  try {
    const CREDENTIALS = JSON.parse(core.getInput('sheets-cred'));
    const SHEETS_TOKEN = JSON.parse(core.getInput('sheets-token'));
    // eslint-disable-next-line camelcase
    const { client_secret, client_id, redirect_uris } = CREDENTIALS.installed;
    var oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );
    oAuth2Client.credentials = SHEETS_TOKEN;
    return oAuth2Client;
  } catch (err) {
    core.setFailed('Auth failure: ' + err);
  }
};

const generateOutput = async (hasClaSigned) => {
  const GITHUB_TOKEN = core.getInput('repo-token');
  const octokit = github.getOctokit(GITHUB_TOKEN);
  const PR_NUMBER = github.context.payload.pull_request.number;
  const PR_AUTHOR = github.context.payload.pull_request.user.login;
  const REPO_NAME = github.context.payload.repository.name;

  let LINK_RESULT = '';

  if (REPO_NAME === 'oppia-android' ){
    LINK_RESULT = 'here'.link(
      'https://github.com/oppia/oppia-android/wiki#onboarding-instructions'
    );
  } else {
    LINK_RESULT = 'here'.link(
      'https://github.com/oppia/oppia/wiki/' +
      'Contributing-code-to-Oppia#setting-things-up'
    );
  }

  let comment = '';
  if (!hasClaSigned) {
    comment = ('Hi! @' +
        PR_AUTHOR +
        ' Welcome to Oppia! Could you please ' +
        'follow the instructions ' + LINK_RESULT +
        " and sign the CLA Sheet to get started? You'll need to do " +
        "this before we can accept your PR. Once you're done," +
        ' please reopen the PR. Thanks!');
    core.info('Closing and commenting in PR...');

    await octokit.rest.issues.update({
      issue_number: PR_NUMBER,
      state: 'closed',
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
    });
    await octokit.rest.issues.createComment(
      {
        body: comment,
        issue_number: PR_NUMBER,
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
      }
    );
    core.setFailed(PR_AUTHOR + ' has not signed the CLA');
  } else {
    core.info(`${PR_AUTHOR} has signed the CLA`);
  }
};


/**
 * Checks if the PR Author has signed the CLA Sheet.
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
const checkSheet = async (auth) => {
  const PR_AUTHOR = github.context.payload.pull_request.user.login;
  const sheets = google.sheets({ version: 'v4', auth });
  const SPREADSHEET_ID = core.getInput('cla-sheet-id');
  await sheets.spreadsheets.values.get(
    {
      spreadsheetId: SPREADSHEET_ID,
      range: 'Usernames!A:A',
    },
    async (err, res) => {
      if (err) {
        core.setFailed('The API returned an error: ' + err);
        return;
      }

      const rows = res.data.values;
      const flatRows = [].concat.apply([], rows);
      if (!rows || rows.length === 0) {
        core.setFailed('No data found.');
      } else {
        core.info(`Checking if ${PR_AUTHOR} has signed the CLA`);
        const hasUserSignedCla = flatRows.some(
          username => username.toLowerCase() === PR_AUTHOR.toLowerCase()
        );

        await generateOutput(hasUserSignedCla);
      }
    }
  );
};

const claCheckGithubAction = async () => {
  // Authorize a client with the loaded credentials.
  const auth = await authorize();

  // Call the sheets API with the authorized client.
  await checkSheet(auth);
};

module.exports = {
  claCheckGithubAction,
};
