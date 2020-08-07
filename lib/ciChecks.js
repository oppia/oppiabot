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
 *
 * @fileoverview File to handle checks when a PR fails CI checks.
 */

/**
 * This function checks for CI test failure and pings PR author.
 * @param {import('probot').Context} context
 */
const handleFailure = async (context) => {
  /**
   * @type {import('probot').Octokit.ChecksGetSuiteResponse} checkSuite
   */
  const checkSuite = context.payload.check_suite;
  if (checkSuite.conclusion === 'failure') {
    // A checksuite might fail due to a merge to develop. We don't need to
    // check for these since they are not failures related to a pull request.
    if (checkSuite.pull_requests.length > 0) {
      // The response from the payload does not include the complete pull request
      // data, hence we need to fetch the pull request so we can get the author.
      const pullRequestData = checkSuite.pull_requests[0];
      const pullRequestResponse = await context.github.pulls.get(
        context.repo({
          pull_number: pullRequestData.number,
        })
      );
      const pullRequest = pullRequestResponse.data;
      const prAuthor = pullRequest.user.login;
      const commentParams = context.repo({
        issue_number: pullRequest.number,
        body:
          'Hi @' +
          prAuthor +
          ', there are some failing CI checks in your latest push ' +
          ' If you think this is due to a flake, please file an issue ' +
          'before restarting the tests. Thanks!',
      });
      await context.github.issues.createComment(commentParams);

      // Assign PR author.
      const assigneeParams = context.repo({
        issue_number: pullRequest.number,
        assignees: [prAuthor],
      });
      await context.github.issues.addAssignees(assigneeParams);
    }
  }
};

module.exports = {
  handleFailure,
};
