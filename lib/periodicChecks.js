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
  getLastReviewOfSpecificType,
  doesPullRequestHaveChangesRequested,
  pingAndAssignUsers,
  getAllOpenIssues,
  getAllProjectCards,
  hasPendingReviews,
  sleep,
} = require('./utils');
const mergeConflictModule = require('./checkMergeConflicts');
const pullRequestReviewModule = require('./checkPullRequestReview');
const { teamLeads, oppiaMaintainers } = require('../userWhitelist.json');
const CHANGES_REQUESTED = 'changes_requested';

/**
 *  This function checks if a pull request has merge conflicts.
 *
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const hasMergeConflict = (pullRequest) => {
  return pullRequest.mergeable === false;
};



/**
 * This function ensures that a pull request is assigned.
 * 1. Fetch all pull requests.
 * 2. Filter out those without assignees.
 * 3. Find out appropriate assignee.
 *  - If pull request has a merge conflict    -- PR author.
 *  - If pull request has pending reviews     -- Remaining reviewers.
 *  - If pull request has changes requested   -- PR author.
 *  - If pull request has been approved       -- Project Owner or PR author.
 *  - If none of the above cases              -- Onboarding team lead.
 * 4. Assign appropriate assignee.
 * 5. Ping appropriate assignee.
 * @param {import('probot').Context} context
 */
const ensureAllPullRequestsAreAssigned = async (context) => {
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
      const reviewers = pullRequest.requested_reviewers.map(
        (reviewer) => reviewer.login
      );
      const commentBody =
        'Assigning @' +
        reviewers.join(', @') +
        ' for code owner reviews. Thanks!';
      await pingAndAssignUsers(
        context,
        pullRequestData,
        reviewers,
        commentBody
      );
    } else if (hasChangesRequested) {
      console.log('PULL REQUEST HAS CHANGES REQUESTED...');
      const review = await getLastReviewOfSpecificType(
        context,
        CHANGES_REQUESTED,
        pullRequestData.number
      );

      pullRequestReviewModule.handleChangesRequested(
        context,
        pullRequestData,
        review
      );
    } else if (hasBeenApproved) {
      console.log('PULL REQUEST HAS BEEN APPROVED...');
      await pullRequestReviewModule.handleApprovalByAllReviewers(
        context,
        pullRequestData
      );
    } else {
      console.log('CONFUSED STATE, ASK FOR HELP FROM ONBOARDING TEAM...');
      const commentBody =
        'Hi @' +
        teamLeads.onboardingTeam +
        ', @' +
        oppiaMaintainers +
        ' I cannot decide what to do with this PR, ' +
        'please assign reviewers manually thanks!';

      pingAndAssignUsers(
        context,
        pullRequestData,
        [teamLeads.onboardingTeam],
        commentBody
      );
    }
  });
};

/**
 * This function ensures that all issue are linked to a project.
 * 1. Fetch all open issues.
 * 2. Fetch all project cards.
 * 3. Filter open issues by the ones that have a project card.
 * 4. Get Remaining issues.
 * 5. Ping core maintainers.
 * @param {import('probot').Context} context
 */
const ensureAllIssuesHaveProjects = async (context) => {
  await sleep(10000);
  const allOpenIssues = await getAllOpenIssues(context);
  const allProjectCards = await getAllProjectCards(context);

  const issuesWithoutProjects = allOpenIssues.filter((issue) => {
    const issueBelongsToProject = allProjectCards.some((card) => {
      return card.content_url.endsWith(issue.number);
    });
    return !issueBelongsToProject;
  });

  issuesWithoutProjects.forEach((issue) => {
    // Ping core maintainers about the issue that doesn't have a project.
    context.github.issues.createComment(
      context.repo({
        issue_number: issue.number,
        body:
          'Hi @' +
          oppiaMaintainers +
          ', this issue is not assigned to ' +
          'any project. Can you please update the same? Thanks!',
      })
    );
  });
};

module.exports = {
  ensureAllPullRequestsAreAssigned,
  ensureAllIssuesHaveProjects,
};
