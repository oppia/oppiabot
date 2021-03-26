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
 * @fileoverview File to handle checks when a branch gets forced pushed.
 */

const {
  teamLeads
} = require('../userWhitelist.json');
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
};

/**
 * @param {import('probot').Context} context
 */

const alertOnboardingTeam = async (context) => {
  const pullRequest = context.payload.pull_request;
  const pullrequestAuthor = pullRequest.user.login;
  const onBoardingTeamMember = [teamLeads.onboardingTeam];
  const assigneeHasSignedCla = await hasSignedCla(pullrequestAuthor);
  if (!assigneeHasSignedCla) {
    var members = '';
    onBoardingTeamMember.forEach((member)=>{
      members = members + '@' + member + ',';
    });
    members = members.slice(0, -1);
    const commentBody = members +
    ' The author of this pull request has not signed CLA.';
    const commentParam = context.repo({
      issue_number: pullRequest.number,
      body: commentBody
    });
    await context.github.issues.createComment(commentParam);
  }
};
module.exports = {
  alertOnboardingTeam
};