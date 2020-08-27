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
 * @fileoverview File to handle checks when a PR gets reviewed.
 */
const utilityModule = require('./utils');
const CHANGES_REQUESTED = 'changes_requested';
const COMMENTED = 'commented';
const LGTM_LABEL = 'PR: LGTM';
const THREE_MINUTES = 60 * 1000 * 3;
const CLOSED_STATE = 'closed';

/**
 * This functions handles a "changes requested" review.
 * 1. Wait for 3 minutes for the reviewer to perform required action.
 * 2. Fetch the pull request for new changes.
 * 3. Check if the pull request has been closed or merged and exit.
 * 4. Check if the reviewer is still assigned to the PR and unassign them.
 * 5. Assign / ping the PR author if not already assigned (in the 3 minutes wait).
 *
 * @param {import('probot').Context} context
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const handleChangesRequested = async (context, pullRequest) => {
  /**
   * @type {import('probot').Octokit.PullsGetReviewResponse} review
   */
  const review = context.payload.review;
  const reviewer = review.user.login;
  const author = pullRequest.user.login;

  // Attempt to unassign reviewer.
  const allAssignees = pullRequest.assignees.map((assignee) => assignee.login);
  if (allAssignees.includes(reviewer)) {
    // Unassign the reviewer if still assigned.
    await context.github.issues.removeAssignees(
      context.repo({
        issue_number: pullRequest.number,
        assignees: [reviewer],
      })
    );

    await context.github.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body: 'Unassigning @' + reviewer + ' since the review is done.',
      })
    );
  }

  // Attempt to assign author.
  if (!allAssignees.includes(author)) {
    // Ping and assign author if unassigned.
    await context.github.issues.addAssignees(
      context.repo({
        issue_number: pullRequest.number,
        assignees: [author],
      })
    );

    await context.github.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body:
          'Assigning @' +
          author +
          ' to respond to reviews from @' +
          reviewer +
          '. Thanks!',
      })
    );
  }
};

/**
 * This functions handles an approved review.
 * 1. Wait for 3 minutes for the reviewer to perform required action.
 * 2. Fetch the pull request for new changes.
 * 3. Check if the pull request has been closed or merged and exit.
 * 4. Check if the reviewer is still assigned to the PR and unassign them.
 * 5. Assign other reviewers if any.
 * 5. If reviewer was the last reviewer, check if pull request has been
 *    approved, and add the LGTM Label.
 * 6. If pull request has been approved, assign PR author or last reviewer
 *    to merge the PR.
 *
 * @param {import('probot').Context} context
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const handleApproval = async (context, pullRequest) => {
  /**
   * @type {import('probot').Octokit.PullsGetReviewResponse} review
   */
  const review = context.payload.review;
  const reviewer = review.user.login;

  const reviewerIsAssigned = pullRequest.assignees.some(
    (assignee) => assignee.login === reviewer
  );

  if (reviewerIsAssigned) {
    // Unassign the reviewer if still assigned.
    await context.github.issues.removeAssignees(
      context.repo({
        issue_number: pullRequest.number,
        assignees: [reviewer],
      })
    );

    await context.github.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body: 'Unassigning @' + reviewer + ' since the PR is approved.',
      })
    );
  }

  // Check if pull request has been approved by all reviewers.
  // The pull request data does not contain information if the pull request
  // has been approved, so we are searching for an approved pull request
  //  with the pull request number and in the appropriate repository. An
  // empty array will be returned if the pull request is not approved by
  // all reviewers.
  const repoSearchString = `repo:${context.payload.repository.full_name}`;
  const reviewApprovedSearchString = 'review:approved';
  const searchResult = await context.github.search.issuesAndPullRequests(
    context.repo({
      q:
        repoSearchString +
        ' ' +
        reviewApprovedSearchString +
        ' ' +
        pullRequest.number,
    })
  );

  const searchData = searchResult.data.items;
  const assignees = pullRequest.assignees.map((assignee) => assignee.login);
  if (searchData.length === 0) {
    // Pull request has not been approved by all reviewers, hence we need to
    // assign the remaining reviewers.
    const reviewersYetToReview = pullRequest.requested_reviewers.map(
      (reviewer) => reviewer.login
    );

    const unassignedReviewers = reviewersYetToReview.filter(
      (reviewer) => !assignees.includes(reviewer)
    );
    if (unassignedReviewers.length > 0) {
      // Ping and assign unassigned reviewers.
      const commentBody =
        'Assigning @' +
        unassignedReviewers.join(', @') +
        ' for code owner reviews, Thanks!';

      await context.github.issues.createComment(
        context.repo({
          issue_number: pullRequest.number,
          body: commentBody,
        })
      );

      await context.github.issues.addAssignees(
        context.repo({
          issue_number: pullRequest.number,
          assignees: unassignedReviewers,
        })
      );
    }
  } else {
    // Since the pull request has been approved, we add the LGTM label.
    const labels = pullRequest.labels.map((label) => label.name);
    if (!labels.includes(LGTM_LABEL)) {
      await context.github.issues.addLabels(
        context.repo({
          issue_number: pullRequest.number,
          labels: [LGTM_LABEL],
        })
      );
    }

    // Check if author can merge PR. All members can merge the pull request.
    const membershipCheckResponse = await context.github.orgs.checkMembership({
      org: context.payload.organization.login,
      username: pullRequest.user.login,
    });
    const SUCCESS_STATUS = 204;

    if (membershipCheckResponse.status === SUCCESS_STATUS) {
      // Assign author.
      await context.github.issues.addAssignees(
        context.repo({
          issue_number: pullRequest.number,
          assignees: [pullRequest.user.login],
        })
      );
      await context.github.issues.createComment(
        context.repo({
          issue_number: pullRequest.number,
          body:
            'Hi @' +
            pullRequest.user.login +
            ', this PR is ready to be merged. Please make sure there are no ' +
            'pending comments before merge. Thanks!',
        })
      );
    } else {
      // Assign project owner to merge the pull request.
      // A pull request will always have a changelog label because we are
      // assigning the PR author to the pull request on creation if created
      // without a changelog label.
      const changelogLabel = utilityModule.getChangelogLabelFromPullRequest(
        pullRequest
      );
      const projectOwner = utilityModule.getProjectOwnerFromLabel(
        changelogLabel
      );
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
            ', this PR is ready to be merged. We are assigning you since ' +
            'the author does not have merging rights. Please make sure ' +
            "there are no pending comments from the author's end before " +
            'merge. Thanks!',
        })
      );
    }
  }
};

/**
 * This function checks when a pull request gets reviewed and calls the
 * appropriate function based on the type of review.
 *
 * @param {import('probot').Context} context
 */
const handlePullRequestReview = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetReviewResponse} review
   */
  const review = context.payload.review;
  if (review.state === COMMENTED) {
    return;
  }
  // Pause for 3 minutes in case reviewer wants to perform
  // the required actions.
  await utilityModule.sleep(THREE_MINUTES);
  // Fetch the pull request incase there has been any changes since
  // the review was made.
  const pullRequestResponse = await context.github.pulls.get(
    context.repo({
      pull_number: context.payload.pull_request.number,
    })
  );
  const pullRequest = pullRequestResponse.data;

  if (pullRequest.state === CLOSED_STATE) {
    // If the pull request got merged or closed, do nothing and exit.
    return;
  }

  if (review.state === CHANGES_REQUESTED) {
    await handleChangesRequested(context, pullRequest);
  } else {
    await handleApproval(context, pullRequest);
  }
};

module.exports = {
  handlePullRequestReview,
};
