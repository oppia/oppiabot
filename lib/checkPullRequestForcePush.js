// Copyright 2026 The Oppia Authors. All Rights Reserved.
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
 * @fileoverview File to handle checks when a pull request gets force pushed.
 */

/**
 * @param {import('probot').Context} context
 */
const checkForPreviousForcePush = async (context) => {
  // If a PR is reopened, we must check if it was previously closed due to
  // a force push. It is much easier to verify this deterministically by
  // checking for the bot's static rejection comment, rather than inspecting
  // the commit history. Analyzing commit history after a force push is complex
  // and would require expensive GraphQL API calls. If the comment exists,
  // we firmly close the PR again.
  const comments = await context.github.issues.listComments(context.repo({
    issue_number: context.payload.pull_request.number
  }));

  const hasForcePushComment = comments.data.some(comment =>
    comment.body.includes(
      'force pushing is not allowed as it makes code reviews hard.')
  );

  if (hasForcePushComment) {
    // eslint-disable-next-line no-console
    console.log('PR reopened after force push. Closing it again.');
    const user = context.payload.sender.login;
    const commentParams = context.repo({
      body: 'Hi @' + user +
        ', as mentioned previously, force pushing is not allowed. ' +
        'Please make a new PR. Thanks!',
      issue_number: context.payload.pull_request.number,
    });
    await context.github.issues.createComment(commentParams);

    const closePRParams = context.repo({
      issue_number: context.payload.pull_request.number,
      state: 'closed',
    });
    await context.github.issues.update(closePRParams);
  }
};

/**
 * @param {import('probot').Context} context
 */
const checkForForcePush = async (context) => {
  const beforeSha = context.payload.before;
  const afterSha = context.payload.after;

  // eslint-disable-next-line no-console
  console.log(`Commit SHAs - before: ${beforeSha}, after: ${afterSha}`);

  if (!beforeSha || !afterSha) {
    // eslint-disable-next-line no-console
    console.log(
      'Skipping force push check because before or after SHA is missing.');
    return;
  }

  // Compare the commits to see if it's a force push.
  // When a force push happens, the base (beforeSha) will not be an ancestor
  // of the head (afterSha), so the status will be 'diverged' or 'behind'.
  let response;
  try {
    response = await context.github.repos.compareCommits(context.repo({
      base: beforeSha,
      head: afterSha
    }));
    // eslint-disable-next-line no-console
    console.log('Compare commits status:', response.data.status);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error comparing commits:', error);
    return;
  }

  if (
    response.data.status === 'diverged' ||
    response.data.status === 'behind'
  ) {
    // eslint-disable-next-line no-console
    console.log('Force push detected. Leaving comment and closing PR.');
    const user = context.payload.sender.login;
    const link = '[here (point 3)]' +
      '(https://github.com/oppia/oppia/wiki/Rules-for-making-PRs' +
      '#step-3-push-changes-to-your-github-fork)';

    const commentParams = context.repo({
      body: 'Hi @' + user +
        ', force pushing is not allowed as it makes code reviews hard. ' +
        'You can learn more about this ' + link + '. I’ll be closing this, ' +
        'please make a new PR with the required changes. Thanks!',
      issue_number: context.payload.pull_request.number,
    });
    await context.github.issues.createComment(commentParams);

    const closePRParams = context.repo({
      issue_number: context.payload.pull_request.number,
      state: 'closed',
    });
    await context.github.issues.update(closePRParams);
  }
};

module.exports = {
  checkForPreviousForcePush,
  checkForForcePush
};
