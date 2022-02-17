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

 const core = require('@actions/core');
 const { context, GitHub } = require('@actions/github');
 const { commentAndAssignUsers } = require('../utils');

/**
 * This function checks for CI test failure and pings PR author.
 * @param {import('@octokit/rest').Octokit} octokit
 * @returns{Promise<Boolean>}
 */
const handleFailure = async () => {
  
  const token = core.getInput('repo-token');
  const octokit = new GitHub(token);
  const checkSuite = context.payload.check_suite;
  if (checkSuite.conclusion === 'failure') {
    // Some checks fail in develop due to a PR being merged.
    // These checks are not affiliated to any pull request since they
    // happened on the develop branch, and as a result, will lead to
    // an empty pull_requests array from the payload.
    if (checkSuite.pull_requests.length > 0) {
      // The response from the payload does not include the complete
      // pull request data, hence we need to fetch the pull request
      // so we can get the author.
      const pullRequestData = checkSuite.pull_requests[0];
      const pullRequestResponse = await octokit.pulls.get(
        {
          pull_number: pullRequestData.number,
          ...context.repo
        }
      );
      const pullRequest = pullRequestResponse.data;
      const prAuthor = pullRequest.user.login;

      const commentBody =
        'Hi @' + prAuthor + ', there are some failing CI checks in your latest push ' + ' If you think this is due to a flake, please file an issue ' + 'before restarting the tests. Thanks!';
      await commentAndAssignUsers(octokit, pullRequest, [prAuthor], commentBody);
    }
  }
};

module.exports = {
  handleFailure,
};
