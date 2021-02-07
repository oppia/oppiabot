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
  LABELS_EXCLUDED_FROM_CODEOWNER_ASSIGNMENT,
  DATASTORE_LABEL,
  getProjectOwnerFromLabel,
  getChangelogLabelFromPullRequest,
  isChangelogLabel,
  pingAndAssignUsers,
  isUserACollaborator
} = require('./utils');
const {
  releaseCoordinators,
  oppiaReleaseCoordinators,
  oppiaDevWorkflowTeam,
  serverJobAdmins,
} = require('../userWhitelist.json');
const DEFAULT_CHANGELOG_LABEL = 'REVIEWERS: Please add changelog label';
const PR_LABELS = ['dependencies', 'stale', DEFAULT_CHANGELOG_LABEL];

/**
 * This function tests a changelog label against a regex.
 *
 * @param {String} changelogLabel
 */
var matchChangelogLabelWithRegex = function (changelogLabel) {
  // Please refer to https://regex101.com/r/Eo976S/3 for explanation
  // of the below regular expression.
  var regExpForChangelogLabel = (
    /^([pP][rR] [cC][hH][aA][nN][gG][eE][lL][oO][gG]: .* -- @\s*\w+\s*)/);
  return regExpForChangelogLabel.test(changelogLabel);
};

/**
 * This function checks if the project owner can be assigned to a PR.
 *
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 * @param {String} changelogLabel
 */
const canAssignProjectOwner = (pullRequest, changelogLabel) => {
  // Check if the changelog label is excluded from codeowner assignment.
  const isLabelExcluded = LABELS_EXCLUDED_FROM_CODEOWNER_ASSIGNMENT.some(
    (label) => changelogLabel.startsWith(label)
  );
  if (isLabelExcluded) {
    return true;
  }
  const projectOwner = getProjectOwnerFromLabel(changelogLabel);
  const reviewers = pullRequest.requested_reviewers.map(
    (reviewer) => reviewer.login
  );
  const canReview = reviewers.includes(projectOwner);

  return canReview;
};

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
 * This function checks and assign the appropriate reviewer from the added
 * changelog label. The steps taken for this are outlined below:
 *
 * 1. Check that there is a valid changelog label.
 * 2. If the project owner is one of the reviewers, assign them to the PR.
 * 3. If the changelog label is excluded from codeowner assignment, assign
 *    the project owner to the PR.
 * 4. If the project owner is not one of the reviewers and the label is not
 *    excluded from codeowner assignment, assign all codeowners to the PR.
 *
 * @param {import('probot').Context} context
 */
module.exports.checkAssignee = async function (context) {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  var pullRequest = context.payload.pull_request;

  if (pullRequest.review_comments !== 0) {
    // We do not assign anyone to the pull request in this case since
    // a review is already done.
    return;
  }
  var pullRequestNumber = pullRequest.number;

  console.log(
    'RUNNING ASSIGNEE CHECK ON PULL REQUEST ' + pullRequestNumber + ' ...'
  );

  const assignees = pullRequest.assignees.map(assignee => assignee.login);
  if (assignees.length !== 0) {
    // We do not update the assignees if the pull request already has a
    // main reviewer/author assigned.
    return;
  }

  var changelogLabel = context.payload.label.name.trim();
  var hasChangelogLabel = isChangelogLabel(changelogLabel);

  // If the PR has a changelog label, assign the project owner
  // for the first-pass review of the PR and leave a top-level comment.
  if (hasChangelogLabel) {
    var changelogLabelIsValid = matchChangelogLabelWithRegex(changelogLabel);
    if (!changelogLabelIsValid) {
      // No action is taken here since a comment is already added initially
      // for invalid labels when a pull request is opened.
      return;
    }

    const projectOwner = getProjectOwnerFromLabel(changelogLabel);

    const shouldAssignProjectOwner = canAssignProjectOwner(
      pullRequest, changelogLabel);
    if (shouldAssignProjectOwner) {
      const commentBody =
        'Assigning @' +
        projectOwner +
        ' for the first-pass review of this pull request. Thanks!';

      pingAndAssignUsers(context, pullRequest, [projectOwner], commentBody);
      // Project owner is already assigned so we do nothing.
    } else {
      // Attempt to assign all codeowners.
      await assignAllCodeowners(context);
    }
  }
  // If no changelog label is found, no action is required.
};

/**
 * This function ensures that a valid changelog label is added to the PR.
 *
 * @param {import('probot').Context} context
 */
module.exports.checkChangelogLabel = async function (context) {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} context
   */
  var pullRequest = context.payload.pull_request;
  var pullRequestNumber = pullRequest.number;

  console.log(
    'RUNNING CHANGELOG LABEL CHECK ON PULL REQUEST ' +
    pullRequestNumber
  );

  var userName = pullRequest.user.login;
  var changelogLabel = getChangelogLabelFromPullRequest(pullRequest);
  var hasChangelogLabel = Boolean(changelogLabel);

  // If the PR has a changelog label, no action is required.
  if (hasChangelogLabel) {
    var changelogLabelIsValid = matchChangelogLabelWithRegex(changelogLabel);
    if (!changelogLabelIsValid) {
      // There is some problem with the changelog label.
      // Ping the dev workflow team in a comment on the PR.
      var failedCommentParams = context.issue({
        body:
          'Hi, @' + oppiaDevWorkflowTeam + '.' +
          ' The changelog label on this pull request seems to be invalid.' +
          ' Can you please take a look at this pull request? Thanks!',
      });
      await context.github.issues.createComment(failedCommentParams);
    }
    return;
  }

  const isCollaborator = await isUserACollaborator(context, userName);
  if (!isCollaborator) {
    const labelParams = context.repo({
      issue_number: pullRequestNumber,
      labels: [DEFAULT_CHANGELOG_LABEL],
    });
    await context.github.issues.addLabels(labelParams);
    const reviewers = pullRequest.requested_reviewers.map(
      (reviewer) => reviewer.login
    );
    let reviewersToPing = [];
    let commentBody = '';
    if (reviewers.length === 1) {
      reviewersToPing = [reviewers[0]];
      commentBody =
        'Hi @' +
        reviewers[0] +
        ', could you please add the appropriate changelog label to this ' +
        'pull request? Thanks!';
    } else {
      reviewersToPing = [reviewers[0], reviewers[1]];
      commentBody =
        'Hi @' +
        reviewers[0] +
        ', @' +
        reviewers[1] +
        ' -- could one of you please add the appropriate changelog label ' +
        'to this pull request? Thanks!';
    }
    await pingAndAssignUsers(
      context,
      pullRequest,
      reviewersToPing,
      commentBody
    );
    return;
  }

  // If no changelog label is found, ping the author in the PR
  // thread and ask them to add a label.
  const commentBody =
    'Hi, @' +
    userName +
    ', this pull request does not have a "CHANGELOG: ..." label ' +
    'as mentioned in the PR checkbox list. Assigning @ ' +
    userName +
    ' to add the required label. ' +
    'PRs without this label will not be merged. If you are unsure ' +
    'of which label to add, please ask the reviewers for ' +
    'guidance. Thanks!';
  await pingAndAssignUsers(context, pullRequest, [userName], commentBody);
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
