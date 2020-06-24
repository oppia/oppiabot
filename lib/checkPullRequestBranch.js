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

const DISSALLOWED_BRANCH_PREFIXES = ['develop', 'release-', 'test-'];

/**
 * @param {import('probot').Context} context
 */
const checkBranch = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;
  const branchName = pullRequest.head.ref;
  const branchIsInvalid = DISSALLOWED_BRANCH_PREFIXES.some((prefix) => {
    return branchName.startsWith(prefix);
  });

  if (branchIsInvalid) {
    const prAuthor = pullRequest.user.login;
    // Comment on the pull request.
    const wiki = 'wiki'.link(
      'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#' +
        'instructions-for-making-a-code-change'
    );
    const commentParams = context.repo({
      issue_number: pullRequest.number,
      body:
        'Hi @' + prAuthor +
        ', PRs made from develop branch or from a branch ' +
        'whose name is prefixed with develop, release or test are not ' +
        'allowed. So this PR is being closed. Please make your changes in ' +
        'another branch and send in the PR. To learn more about contributing ' +
        'to Oppia, take a look at our ' +
        wiki + ' (Rule 1 specifically). Thanks!',
    });
    await context.github.issues.createComment(commentParams);
    // Close the pull request.
    const closeIssueParams = context.repo({
      issue_number: pullRequest.number,
      state: 'closed',
    });
    await context.github.issues.update(closeIssueParams);
  }
};

module.exports = {
  checkBranch,
};
