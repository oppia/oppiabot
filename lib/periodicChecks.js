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
  getLastReviewOfType,
  doesPullRequestHaveChangesRequested,
  pingAndAssignReviewers,
  getAllOpenIssues,
  getAllProjectCards,
} = require('./utils');
const mergeConflictModule = require('./checkMergeConflicts');
const pullRequestReviewModule = require('./checkPullRequestReview');
const { teamLeads, oppiaMaintainers } = require('../userWhitelist.json');
const CHANGES_REQUESTED = 'changes_requested';
const TODO_TRIAGE_LABEL = 'TODO: triage';

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
      const reviewers = pullRequest.requested_reviewers.map(
        (reviewer) => reviewer.login
      );
      await pingAndAssignReviewers(context, pullRequestData, reviewers);
    } else if (hasChangesRequested) {
      console.log('PULL REQUEST HAS CHANGES REQUESTED...');
      const review = await getLastReviewOfType(
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
      console.log('CONFUSED STATE, ASK FOR HELP FROM WELFARE TEAM...');
      context.github.issues.createComment(
        context.repo({
          issue_number: pullRequestData.number,
          body:
            'Hi @' +
            teamLeads.welfareTeam +
            ', @' +
            oppiaMaintainers +
            ' -- flagging this PR since it needs some assistance. PTAL, ' +
            'thanks!',
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

/**
 * This function ensures that all issue are linked to a project.
 * 1. Fetch all open issues.
 * 2. Fetch all project cards.
 * 3. Filter open issues by the ones that have the triage label.
 * 4. Filter open issues by the ones that have a project card.
 * 5. Get Remaining issues
 * 6. Add todo triage label.
 * 7. Ping core maintainers
 * @param {import('probot').Context} context
 */
const ensureIssueHasProjects = async (context) => {
  const allOpenIssues = await getAllOpenIssues(context);
  const allProjectCards = await getAllProjectCards(context);

  const issuesWithoutProjects = allOpenIssues.filter((issue) => {
    const issueBelongsToProject = allProjectCards.some((card) => {
      return card.content_url.endsWith(issue.number);
    });
    return !issueBelongsToProject;
  });

  issuesWithoutProjects.forEach((issue) => {
    const labels = issue.labels.map((label) => label.name);
    // Add Todo triage label if not already added in a previous iteration.
    if (!labels.includes(TODO_TRIAGE_LABEL)) {
      context.github.issues.addLabels(
        context.repo({
          issue_number: issue.number,
          labels: [TODO_TRIAGE_LABEL],
        })
      );
    }
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
  ensurePullRequestIsAssigned,
  ensureIssueHasProjects,
};
