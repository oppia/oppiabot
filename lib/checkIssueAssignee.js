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

/**
 * @fileoverview Handler to check issue assigned event.
 */

const { google } = require('googleapis');
const apiForSheets = require('./apiForSheets');

/**
 * Checks that a user has signed the CLA.
 *
 * @param {String} username - Username of the user that added the label.
 */
const hasSignedCla = async (username) => {
  const clientSecret = process.env.CLIENT_SECRET;
  const CLA_SHEET_ID = process.env.SPREADSHEET_ID;
  const oauthClient = apiForSheets.authorize(JSON.parse(clientSecret));
  const sheets = google.sheets('v4');

  const rows = await sheets.spreadsheets.values.get({
    auth: oauthClient,
    spreadsheetId: CLA_SHEET_ID,
    range: 'Usernames!A:A',
  });

  const hasUserSignedCla = rows.data.values.some(row => {
    return row[0].toLowerCase() === username.toLowerCase();
  });

  return hasUserSignedCla;
};


/**
 * @param {import('probot').Context} context
 */
const checkAssignees = async (context) => {
  const assignee = context.payload.assignee;
  const issue = context.payload.issue;
  const linkToCla = 'here'.link(
    'https://github.com/oppia/oppia/wiki/' +
    'Contributing-code-to-Oppia#setting-things-up'
  );

  // Catch and log any error that will occur while accessing google sheets api.
  try {
    console.log('Checking if ' + assignee.login + ' has signed the CLA');
    const assigneeHasSignedCla = await hasSignedCla(assignee.login);
    if (!assigneeHasSignedCla) {
      console.log(assignee.login + ' has not signed the CLA');

      const commentBody = 'Hi @' + assignee.login + ', you need to sign the ' +
        'CLA before you can get assigned to issues. Follow the instructions ' +
        linkToCla + ' to get started. I am unassigning you for now, feel ' +
        'free to assign yourself once you have signed the CLA. Thanks!';

      const commentParam = context.repo({
        issue_number: issue.number,
        body: commentBody
      });
      await context.github.issues.createComment(commentParam);

      const assigneeParam = context.repo({
        issue_number: issue.number,
        assignees: [assignee.login]
      });
      await context.github.issues.removeAssignees(assigneeParam);
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  checkAssignees
};
