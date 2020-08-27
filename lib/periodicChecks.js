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
 * @fileoverview Handler for checks to be carried out periodically.
 */

const {
  getAllOpenPullRequests,
  hasPullRequestBeenApproved,
  getChangelogLabelFromPullRequest,
  getProjectOwnerFromLabel,
  doesPullRequestHaveChangesRequested,
  isUserAMemberOfTheOrganisation,
} = require('./utils');
const mergeConflictModule = require('./checkMergeConflicts');
const { teamLeads } = require('../userWhitelist.json');

/**
 *  This function checks if a pull request has merge conflicts.
 *
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const hasMergeConflict = (pullRequest) => {
  return pullRequest.mergeable === false;
};

/**
 *  This function checks if a pull request has pending reviews.
 *
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const hasPendingReviews = (pullRequest) => {
  return pullRequest.requested_reviewers.length > 0;
};

/**
 * This function pings and assigns all pending reviewers to a pull request.
 * @param {import('probot').Context} context
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const pingAndAssignReviewers = async (context, pullRequest) => {
  const reviewers = pullRequest.requested_reviewers.map(
    (reviewer) => reviewer.login
  );

  context.github.issues.addAssignees(
    context.repo({
      issue_number: pullRequest.number,
      assignees: reviewers,
    })
  );

  context.github.issues.createComment(
    context.repo({
      issue_number: pullRequest.number,
      body:
        'Assigning @' +
        reviewers.join(', @') +
        ' for codeowner reviews. Thanks!',
    })
  );
};

/**
 * This function assigns the PR author to a pull request.
 * @param {import('probot').Context} context
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 * @param {string} comment
 */
const pingAndAssignPrAuthor = async (context, pullRequest, comment) => {
  context.github.issues.addAssignees(
    context.repo({
      issue_number: pullRequest.number,
      assignees: [pullRequest.user.login],
    })
  );
  await context.github.issues.createComment(
    context.repo({
      issue_number: pullRequest.number,
      body: comment,
    })
  );
};

/**
 * This function handles the state when a pull request has been approved.
 * 1. Check if the PR author has merging rights and assign them to the PR.
 * 2. If the PR author does not have merging rights, assign the PR to the
 *    project owner from the changelog label.
 * 3. If the pull request does not have a changelog label, assign the pr
 *    author asking them to ping one of the reviewers to merge the PR.
 *
 * @param {import('probot').Context} context
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const handleApprovedPR = async (context, pullRequest) => {
  // Check if author can merge PR. All members can merge the pull request.
  const authorCanMerge = await isUserAMemberOfTheOrganisation(
    context,
    pullRequest.user.login
  );

  if (authorCanMerge) {
    // Assign author.
    await pingAndAssignPrAuthor(
      context,
      pullRequest,
      'Hi @' +
        pullRequest.user.login +
        ', this PR is ready to be merged. Please make sure there are no ' +
        'pending comments before merge. Thanks!'
    );
  } else {
    // Assign project owner.
    const label = getChangelogLabelFromPullRequest(pullRequest);
    if (label) {
      const projectOwner = getProjectOwnerFromLabel(label);
      await context.github.issues.addAssignees(
        context.repo({
          issue_number: pullRequest.number,
          assignees: [projectOwner],
        })
      );
      await context.github.issues.createComment(
        context.repo({
          issue_number: pullRequest.number,
          body:
            'Hi @' +
            projectOwner +
            ', this PR is ready to be merged. Please make sure there are no ' +
            "pending comments from the author's end before merge. Thanks!",
        })
      );
    } else {
      await pingAndAssignPrAuthor(
        context,
        pullRequest,
        'Hi @' +
          pullRequest.user.login +
          ', this PR is ready to be merged. Please ask one of the ' +
          'reviewers to help with the merge, also, make sure there are no ' +
          'pending comments before merge. Thanks!'
      );
    }
  }
};

/**
 * This function ensures that a pull request is assigned.
 * 1. Fetch all pull requests.
 * 2. Filter out those without assignees.
 * 3. Find out appropriate assignee.
 *  - If pull request has a merge conflict    -- PR author.
 *  - If pull request has pending reviews     -- Remaining reviewers.
 *  - If pull request has changes requested   -- PR author.
 *  - If pull request has been approved       -- Any member of the Organisation.
 *  - If none of the above cases              -- Welfare team lead.
 * 4. Assign appropriate assignee.
 * 5. Ping appropriate assignee.
 * @param {import('probot').Context} context
 */
const ensurePullRequestIsAssigned = async (context) => {
  const allOpenPullRequests = await getAllOpenPullRequests(context);
  const unassignedPullRequests = allOpenPullRequests.filter((pullRequest) => {
    return pullRequest.assignees.length === 0;
  });

  unassignedPullRequests.forEach(async (pullRequest) => {
    const pullRequestResponse = await context.github.pulls.get(
      context.repo({
        pull_number: pullRequest.number,
      })
    );
    const pullRequestData = pullRequestResponse.data;

    const hasBeenApproved = await hasPullRequestBeenApproved(
      context,
      pullRequestData.number
    );
    const hasChangesRequested = await doesPullRequestHaveChangesRequested(
      context,
      pullRequestData.number
    );

    if (hasMergeConflict(pullRequestData)) {
      console.log('PULL REQUEST HAS MERGE CONFLICT...');
      await mergeConflictModule.checkMergeConflictsInPullRequest(
        context,
        pullRequestData
      );
    } else if (hasPendingReviews(pullRequestData)) {
      console.log('PULL REQUEST HAS PENDING REVIEWS...');
      await pingAndAssignReviewers(context, pullRequestData);
    } else if (hasChangesRequested) {
      console.log('PULL REQUEST HAS CHANGES REQUESTED...');
      await pingAndAssignPrAuthor(
        context,
        pullRequestData,
        'Hi @' +
          pullRequestData.user.login +
          ', changes was requested on this pull request, PTAL. Thanks!'
      );
    } else if (hasBeenApproved) {
      console.log('PULL REQUEST HAS BEEN APPROVED...');
      await handleApprovedPR(context, pullRequestData);
    } else {
      console.log('CONFUSED STATE, ASK FOR HELP FROM WELFARE TEAM...');
      context.github.issues.createComment(
        context.repo({
          issue_number: pullRequestData.number,
          body:
            'Hi @' +
            teamLeads.welfareTeam +
            ', this pull request needs some assistance, PTAL. Thanks!',
        })
      );

      context.github.issues.addAssignees(
        context.repo({
          issue_number: pullRequestData.number,
          assignees: [teamLeads.welfareTeam],
        })
      );
    }
  });
};

module.exports = {
  ensurePullRequestIsAssigned,
};
