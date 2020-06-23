const core = require('@actions/core');
const { context, GitHub } = require('@actions/github');
const { google } = require('googleapis');

const checkAssignees = async () => {
  core.info('A USER GOT ASSIGNED TO AN ISSUE...');
  const token = core.getInput('repo-token');
  const octokit = new GitHub(token);
  const assignee = context.payload.assignee;
  const issue = context.payload.issue;
  const linkToCla = 'here'.link(
    'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#setting-things-up');

  core.info('Checking if ' + assignee.login + ' has signed the CLA');
  const assigneeHasSignedCla = await hasSignedCla(assignee.login);
  if (!assigneeHasSignedCla) {
    core.info(assignee.login + ' has not signed the CLA');

    const commentBody = 'Hi @' + assignee.login + ', you need to sign the ' +
      'CLA before you can get assigned to issues. Follow the instructions ' +
      linkToCla + ' to get started. Thanks!';

    await octokit.issues.createComment({
      issue_number: issue.number,
      repo: context.repo.repo,
      owner: context.repo.owner,
      body: commentBody,
    });

    await octokit.issues.removeAssignees({
      issue_number: issue.number,
      repo: context.repo.owner,
      owner: context.repo.owner,
      assignees: [assignee.login],
    });
  }

};

/**
 * Checks that a user has signed the CLA.
 *
 * @param {String} username - Username of the user that added the label.
 * @param {import('@actions/github').GitHub} octokit
 */
const hasSignedCla = async (username) => {
  const GOOGLE_API_KEY = core.getInput('google-api-key');
  const CLA_SHEET_ID = core.getInput('cla-sheet-id');

  const sheets = google.sheets('v4');
  const rows = await sheets.spreadsheets.values.get({
    auth: GOOGLE_API_KEY,
    spreadsheetId: CLA_SHEET_ID,
    range: 'Usernames!A:A',
  });

  const hasUserSignedCla = rows.data.values.some(row => {
    return row[0].toLowerCase() === username.toLowerCase();
  });

  return hasUserSignedCla;
};

module.exports = {
  checkAssignees,
};
