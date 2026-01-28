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
 * @fileoverview Handles checks when a branch gets force-pushed.
 */

const { sleep } = require('./utils');

const WHITELISTED_BRANCH_PREFIXES = ['develop', 'release-'];

/**
 * Handles a force-push event.
 * @param {import('probot').Context} context
 */
const handleForcePush = async (context) => {
  const refs = context.payload.ref.split('/');
  const branchName = refs[refs.length - 1];

  const isWhitelistedBranch = WHITELISTED_BRANCH_PREFIXES.some((prefix) =>
    branchName.startsWith(prefix)
  );

  // Skip whitelisted branches like 'develop' or 'release-*'.
  if (isWhitelistedBranch) {
    return;
  }

  if (context.payload.forced === true) {
    const sha = context.payload.after;
    const maxWaitTime = 10000; // 10 seconds
    const waitTime = 2000; // 2 seconds
    let pullRequest;
    let totalWaitTime = 0;

    do {
      // Wait before searching so that GitHub syncs the PR data.
      await sleep(waitTime);
      totalWaitTime += waitTime;

      if (totalWaitTime >= maxWaitTime) {
        return;
      }

      try {
        const pullRequestData = await context.github.search.issuesAndPullRequests({
          q: `${sha} repo:${context.payload.repository.full_name}`,
        });
        pullRequest = pullRequestData.data.items[0];
      } catch (error) {
        context.log.error('Error searching for PR linked to commit SHA:', error);
        return;
      }
    } while (!pullRequest);

    const user = context.payload.sender.login;
    const link = '[here (point 5)](https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#instructions-for-making-a-code-change)';

    const commentParams = context.repo({
      body:
        `Hi @${user}, force pushing is not allowed as it makes code reviews hard. ` +
        `You can learn more about this ${link}. I'll be closing this, ` +
        `please make a new PR with the required changes. Thanks!`,
      issue_number: pullRequest.number,
    });

    try {
      await context.github.issues.createComment(commentParams);
    } catch (error) {
      context.log.error('Error posting comment on PR:', error);
    }

    const closePRParams = context.repo({
      issue_number: pullRequest.number,
      state: 'closed',
    });

    try {
      await context.github.issues.update(closePRParams);
    } catch (error) {
      context.log.error('Error closing PR after force push:', error);
    }
  }
};

module.exports = {
  handleForcePush,
};
