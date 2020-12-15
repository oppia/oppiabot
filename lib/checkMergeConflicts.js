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

const {
  sleep,
  getAllOpenPullRequests,
  pingAndAssignUsers,
  MINIMUM_WAIT_TIME,
  MAX_WAIT_TIME
} = require('./utils');
const mergeConflictLabel = "PR: don't merge - HAS MERGE CONFLICTS";
const mergeConflictLabelArray = [mergeConflictLabel];
const mergeAllPRsWithDevelopLabel = 'PR: require post-merge sync to HEAD';

/**
 * @param {import('probot').Context} context
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
module.exports.checkMergeConflictsInPullRequest = async function (
    context,
    pullRequest
) {
  var hasMergeConflictLabel = false;
  var pullRequestNumber = pullRequest.number;

  console.log(
    'CHECKING PR NUMBER ' + pullRequestNumber + ' FOR MERGE CONFLICTS..'
  );

  console.log(' IS PR MERGEABLE BEFORE POLLING? ' + pullRequest.mergeable);

  // The value of the mergeable attribute can be true, false, or null.
  // If the value is null, then GitHub has started a background job to
  // compute the mergeability.
  // After giving the job time to complete, resubmit the request.
  // When the job finishes, a non-null value for the mergeable attribute
  // will be observed in the response.
  // Therefore, we poll the request until a non-null value is observed as
  // suggested here:
  // https://developer.github.com/v3/git/#checking-mergeability-of-pull-requests
  let totalWaitTime = 0;
  while (pullRequest.mergeable === null) {
    // Wait for 2 seconds before making another request.
    await sleep(MINIMUM_WAIT_TIME);
    totalWaitTime += MINIMUM_WAIT_TIME;
    if (totalWaitTime >= MAX_WAIT_TIME) {
      return;
    }
    var pullRequestPromiseObj = await context.github.pulls.get(
      context.repo({ number: pullRequestNumber })
    );
    pullRequest = pullRequestPromiseObj.data;
  }

  console.log(' IS PR MERGEABLE AFTER POLLING? ' + pullRequest.mergeable);

  var labels = pullRequest.labels;

  hasMergeConflictLabel = labels.some(function (label) {
    return label.name === mergeConflictLabel;
  });

  var isMergeable = pullRequest.mergeable;

  if (hasMergeConflictLabel === false && isMergeable === false) {
    var userName = pullRequest.user.login;
    var linkText = 'link';
    var linkResult = linkText.link(
      'https://help.github.com/articles/' +
      'resolving-a-merge-conflict-using-the-command-line/'
    );

    await context.github.issues.addLabels(
      context.repo({
        issue_number: pullRequestNumber,
        labels: mergeConflictLabelArray,
      })
    );

    const commentBody =
      'Hi @' +
      userName +
      '. Due to recent changes in the "develop" branch, ' +
      'this PR now has a merge conflict. ' +
      'Please follow this ' +
      linkResult +
      ' if you need help resolving the conflict, ' +
      'so that the PR can be merged. Thanks!';

    await pingAndAssignUsers(context, pullRequest, [userName], commentBody);
  }

  if (hasMergeConflictLabel === true && isMergeable === true) {
    await context.github.issues.removeLabel(
      context.repo({
        issue_number: pullRequestNumber,
        name: mergeConflictLabel,
      })
    );
  }

  if (hasMergeConflictLabel === true && isMergeable === false) {
    // Check if author is assigned.
    const isAuthorAssigned = pullRequest.assignees.some(
      user => user.login === pullRequest.user.login
    );

    if (!isAuthorAssigned) {
      await context.github.issues.addAssignees(
        context.repo({
          issue_number: pullRequestNumber,
          assignees: [pullRequest.user.login],
        })
      );
    }
  }
};

/**
 * @param {import('probot').Context} context
 */
module.exports.checkMergeConflictsInAllPullRequests = async function (context) {
  // pulls.list(..) fetches atmost 30 PRs in a batch, by default.
  // Since we've seen increasing number of PRs in the past, this value has
  // been increased to 60 PRs in a batch.
  var pullRequestsPromiseObj = await context.github.pulls.list(
    context.repo({ per_page: 60 })
  );

  var arrayOfOpenPullRequests = pullRequestsPromiseObj.data;
  for (var indexOfPullRequest in arrayOfOpenPullRequests) {
    var pullRequestNumber = arrayOfOpenPullRequests[indexOfPullRequest].number;
    var pullRequestDetailsPromiseObj = await context.github.pulls.get(
      context.repo({ number: pullRequestNumber })
    );
    var pullRequestDetails = pullRequestDetailsPromiseObj.data;
    this.checkMergeConflictsInPullRequest(context, pullRequestDetails);
  }
};

/**
 * This function checks whether a PR which requires merge to head for all
 * other PRs is merged. If yes, it adds a comment and assigns authors on
 * all PRs to do the same.
 *
 * @param {import('probot').Context} context
 */
module.exports.pingAllPullRequestsToMergeFromDevelop = async function (
    context
) {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const mergedPR = context.payload.pull_request;
  const prLabels = mergedPR.labels.map((label) => label.name);
  // Check if the PR that got merged requires all other PRs to be updated.
  if (prLabels.includes(mergeAllPRsWithDevelopLabel)) {
    // Fetch all open pull requests.
    const allOpenPullRequests = await getAllOpenPullRequests(context);
    allOpenPullRequests.forEach(async (pullRequest) => {
      // Comment on all pull requests.
      const linkToChange = 'new change'.link(mergedPR.html_url);
      const linkToWiki = 'link'.link(
        'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#' +
        'instructions-for-making-a-code-change'
      );

      const commentBody =
        'Hi @' +
        pullRequest.user.login +
        ', there is a ' +
        linkToChange +
        ' in develop which needs to ' +
        'be in your PR. Please update your branch with the latest changes ' +
        'in develop. For instructions, refer to this ' +
        linkToWiki +
        '. Thanks!';

      await pingAndAssignUsers(
        context,
        pullRequest,
        [pullRequest.user.login],
        commentBody
      );
    });
  }
};
