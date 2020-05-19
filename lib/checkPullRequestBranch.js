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
    return branchName === prefix || branchName.startsWith(prefix);
  });

  if (branchIsInvalid) {
    const prAuthor = pullRequest.user.login;
    // Comment on the pull request.
    const commentParams = context.repo({
      issue_number: pullRequest.number,
      body:
        'Hi @' + prAuthor + ', PRs made from develop, release or test ' +
        'branches are not allowed. In the meantime, I will be closing ' +
        'this. Please make your changes in another branch and send in ' +
        'the PR. Thanks!',
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
