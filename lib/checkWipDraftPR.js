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
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 * @returns {Boolean}
 */
const isDraftPr = (pullRequest) => {
  return pullRequest.draft;
};

/**
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 * @returns {Boolean}
 */
const isWIPPr = ({ title, body }) => {
  return (
    title.toLowerCase().includes('wip') || body.toLowerCase().includes('wip')
  );
};

/**
 * @param {import('probot').Context} context
 *
 */
const isSkipCICommit = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;

  const commitParams = context.repo({
    commit_sha: pullRequest.head.sha
  });
  const commitResponse = await context.github.git.getCommit(commitParams);

  return (
    commitResponse.data.message.startsWith('[ci skip]') ||
    commitResponse.data.message.startsWith('[skip ci]'));
};

/**
 * @param {import('probot').Context} context
 */
module.exports.checkWIP = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;
  const prAuthor = pullRequest.user.login;

  if (isDraftPr(pullRequest) || isWIPPr(pullRequest)) {
    const hasSkipCIMessage = await isSkipCICommit(context);
    if (!hasSkipCIMessage) {
      const link = 'here'.link(
        'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia' +
        '#wip--draft-pull-requests');
      // Comment on Pull Request.
      const commentBody = (
        'Hi @' + prAuthor + ', when creating WIP/Draft PRs, ensure that ' +
        'your commit messages are prefixed with **[ci skip]** or ' +
        '**[skip ci]** to prevent CI checks from running. ' +
        'You can learn more about it ' + link + '.');
      const commentParams = context.repo({
        issue_number: pullRequest.number,
        body: commentBody,
      });
      await context.github.issues.createComment(commentParams);

      // Close Pull Request.
      const closePRParams = context.repo({
        issue_number: pullRequest.number,
        state: 'closed',
      });
      await context.github.issues.update(closePRParams);
    }
  }
};
