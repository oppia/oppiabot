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
 * @fileoverview Assign PR Reviewers handler.
 */

const { defaultReviewer } = require('../userWhitelist.json');

/**
 * Assign pull request to reviewers.
 * @param {import('probot').Context} context
 */
const assignAllCodeowners = async (context) => {
  // Github automatically requests for review from codeowners.
  /**
   * @type {import('probot').Octokit.PullsGetResponse} context
   */
  const pullRequest = context.payload.pull_request;
  const assignees = pullRequest.requested_reviewers.map(
    (reviewer) => reviewer.login
  );
  if (assignees.length > 0) {
    // Assign Reviewers.
    const assignmentParams = context.repo({
      issue_number: pullRequest.number,
      assignees,
    });
    await context.github.issues.addAssignees(assignmentParams);

    // Ping codeowners.
    const message =
      'Assigning @' +
      assignees.join(', @') +
      ' for the first pass review of this PR. Thanks!';

    const commentParams = context.repo({
      issue_number: pullRequest.number,
      body: message,
    });
    await context.github.issues.createComment(commentParams);
  } else {
    // Assign default reviewer
    const assignmentParams = context.repo({
      issue_number: pullRequest.number,
      assignees: [defaultReviewer],
    });
    await context.github.issues.addAssignees(assignmentParams);

    // Ping reviewer.
    const message =
      'Assigning @' +
      defaultReviewer +
      ' for the first pass review of this PR. Thanks!';

    const commentParams = context.repo({
      issue_number: pullRequest.number,
      body: message,
    });
    await context.github.issues.createComment(commentParams);
  }
};
module.exports = {
  assignAllCodeowners,
};
