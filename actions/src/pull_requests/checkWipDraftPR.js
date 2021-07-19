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
 * @fileoverview File to handle checks when a draft or work in progress
 * pull request is opened or reopened.
 */

const core = require('@actions/core');
const { context, GitHub } = require('@actions/github');
const { pingAndAssignUsers } = require('../utils');

/**
 * @param {import('@octokit/rest').Octokit.PullsGetResponse} pullRequest
 * @returns {Boolean}
 */
const isDraftPr = (pullRequest) => {
  return pullRequest.draft;
};

/**
 * @param {import('@octokit/rest').Octokit.PullsGetResponse} pullRequest
 * @returns {Boolean}
 */
const isWIPPr = ({ title, body }) => {
  return (
    title.toLowerCase().includes('wip') || body.toLowerCase().includes('wip')
  );
};

/**
 * @param {import('@octokit/rest').Octokit} octokit
 * @returns {Promise<Boolean>}
 */
const isSkipCICommit = async (octokit) => {
  const pullRequest = context.payload.pull_request;

  const commitParams = {
    commit_sha: pullRequest.head.sha,
    ...context.repo
  };
  const commitResponse = await octokit.git.getCommit(commitParams);

  return (
    commitResponse.data.message.startsWith('[ci skip]') ||
    commitResponse.data.message.startsWith('[skip ci]')
  );
};

module.exports.checkWIP = async () => {
  const token = core.getInput('repo-token');
  const octokit = new GitHub(token);
  const pullRequest = context.payload.pull_request;
  const prAuthor = pullRequest.user.login;

  if (isDraftPr(pullRequest) || isWIPPr(pullRequest)) {
    const hasSkipCIMessage = await isSkipCICommit(octokit);
    if (!hasSkipCIMessage) {
      // Ping and assign PR author.
      const link = 'here'.link(
        'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia' +
          '#wip--draft-pull-requests'
      );

      const commentBody =
        'Hi @' + prAuthor + ', when creating WIP/Draft PRs, ensure that ' +
        'your commit messages are prefixed with **[ci skip]** or ' +
        '**[skip ci]** to prevent CI checks from running. ' +
        'You can learn more about it ' + link + '.';

      await pingAndAssignUsers(octokit, pullRequest, [prAuthor], commentBody);
    }
  }
};
