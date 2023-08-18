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
 * @fileoverview File to handle checks when a PR gets labeled.
 */
const {
  DATASTORE_LABEL,
  HOTFIX_LABEL,
  OLD_BUILD_LABEL,
  pingAndAssignUsers,
  checkPrIsStale
} = require('./utils');
const {
  releaseCoordinators,
  oppiaReleaseCoordinators,
  serverJobAdmins,
} = require('../userWhitelist.json');
const PR_LABELS = ['dependencies', 'stale'];
const utilityModule = require('./utils');

/**
 * This function assigns pull request to the appropriate reviewers.
 *
 * @param {import('probot').Context} context
 */
const assignAllCodeowners = async (context) => {
  // Github automatically requests for review from codeowners.
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;
  // Wait for github finding reviewers.
  await utilityModule.sleep(10000);

  const assignees = pullRequest.requested_reviewers.map(
    (reviewer) => reviewer.login
  );
  if (assignees.length > 0) {
    // Ping and assign codeowners.
    const message =
      'Assigning @' +
      assignees.join(', @') +
      ' for the first pass review of this PR. Thanks!';
    await pingAndAssignUsers(context, pullRequest, assignees, message);
  } else {
    // Oppiabot can't assign here since the only codeowner is the PR author,
    // hence we ping PR author to assign appropriate reviewer as they will have
    // access to assign the required reviewer.
    const author = pullRequest.user.login;
    const message =
      'Hi @' +
      author +
      ' please assign the required reviewer(s) for this PR. Thanks!';

    await pingAndAssignUsers(context, pullRequest, [author], message);
  }
};

/**
 * This function checks and assign the appropriate reviewer.
 *
 * @param {import('probot').Context} context
 */
module.exports.checkAssignee = async function (context) {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;

  if (pullRequest.review_comments !== 0) {
    // We do not assign anyone to the pull request in this case since
    // a review is already done.
    return;
  }
  const pullRequestNumber = pullRequest.number;

  console.log(
    'RUNNING ASSIGNEE CHECK ON PULL REQUEST ' + pullRequestNumber + ' ...'
  );


  const assignees = pullRequest.assignees.map(assignee => assignee.login);
  if (assignees.length !== 0) {
    // We do not update the assignees if the pull request already has a
    // main reviewer/author assigned.
    return;
  }
  await assignAllCodeowners(context);
  // If no changelog label is found, no action is required.
};

/**
 * This function checks if a user is allowed to remove the critical label.
 *
 * @param {String} username
 */
const isUserAllowedToRemoveCriticalLabel = function (username) {
  return (
    serverJobAdmins.includes(username) ||
    releaseCoordinators.includes(username));
};

/**
 * This function checks and prevent the removal of critical label
 * by unauthorised users.
 *
 * @param {import('probot').Context} context
 */
module.exports.checkCriticalLabel = async function (context) {
  /**
   * @type {import('probot').Octokit.IssuesGetLabelResponse} label
   */
  const label = context.payload.label;

  if (label.name === DATASTORE_LABEL) {
    // Check that user is allowed to remove the label.
    const user = context.payload.sender;
    if (!isUserAllowedToRemoveCriticalLabel(user.login)) {
      const commentParams = context.issue({
        body:
        'Hi @' + user.login + ', only members of the release team' +
        ' /cc @' + oppiaReleaseCoordinators +
        ' are allowed to remove ' + DATASTORE_LABEL + ' labels. ' +
        'I will be adding it back. Thanks!',
      });
      await context.github.issues.createComment(commentParams);

      const addLabelParams = context.issue({
        labels: [DATASTORE_LABEL],
      });
      await context.github.issues.addLabels(addLabelParams);
    }
  }
};

/**
 * This function pings the release team if PR is labelled as required
 * for hotfix.
 *
 * @param {import('probot').Context} context
 */
module.exports.checkHotfixLabel = async function (context) {
  /**
   * @type {import('probot').Octokit.IssuesGetLabelResponse} label
   */
  const label = context.payload.label;
  if (label.name === HOTFIX_LABEL) {
    var commentParams = context.issue({
      body:
          'Hi, @oppia/release-coordinators flagging this pull request for ' +
          'for your attention since this is labelled as a hotfix PR. ' +
          'Please ensure that you add the "PR: for current release" ' +
          'label if the next release is in progress. Thanks!'
    });
    await context.github.issues.createComment(commentParams);
  }
};

/**
 * This function checks if a label is allowed on Pull Requests.
 *
 * @param {import('probot').Octokit.IssuesGetLabelResponse} label
 */
const isPrLabel = function (label) {
  return label.name.startsWith('PR') || PR_LABELS.includes(label.name);
};

/**
 * This function checks that an issue label has not been added to a
 * Pull Request.
 *
 * @param {import('probot').Context} context
 */
module.exports.checkForIssueLabel = async function (context) {
  /**
   * @type {import('probot').Octokit.IssuesGetLabelResponse} label
   */
  const label = context.payload.label;

  if (!isPrLabel(label)) {
    // Issue label got added.
    const user = context.payload.sender;
    const link = 'here'.link(
      'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#' +
      'labeling-issues-and-pull-requests'
    );
    const commentBody =
      'Hi @' + user.login + ', the ' + label.name + ' label should only be ' +
      'used on issues, and I’m removing the label. You can learn more about ' +
      'labels ' + link + '. Thanks!';

    const commentParams = context.issue({
      body: commentBody,
    });
    await context.github.issues.createComment(commentParams);

    const removeLabelParams = context.issue({
      name: label.name,
    });
    await context.github.issues.removeLabel(removeLabelParams);
  }
};

/**
 * This function checks and prevent the removal of stale build label
 * if branch is not updated.
 *
 * @param {import('probot').Context} context
 */
module.exports.checkStaleBuildLabelRemoved = async function (context) {
  /**
   * @type {import('probot').Octokit.IssuesGetLabelResponse} label
   */
  const label = context.payload.label;
  const pullRequest = context.payload.pull_request;
  if (label.name === OLD_BUILD_LABEL) {
    const user = context.payload.sender;

    if (await checkPrIsStale(pullRequest, context)) {
      const commentParams = context.issue({
        body:
        'Hi @' + user.login + ', the build of this PR is' +
        ' stale please do not remove \'' + OLD_BUILD_LABEL + '\'' +
        ' label. ',
      });
      await context.github.issues.createComment(commentParams);
      const addLabelParams = context.issue({
        labels: [OLD_BUILD_LABEL],
      });
      await context.github.issues.addLabels(addLabelParams);
    }
  }
};
