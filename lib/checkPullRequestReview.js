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
const APPROVED = 'approved';
const LGTM_LABEL = 'PR: LGTM';

/**
 * This functions handles a changes requested review.
 *
 * @param {import('probot').Context} context
 */
const handleChangesRequested = async (context) => {
  // Pause for 3 minutes in case reviewer wants to perform
  // the required actions.
  await utilityModule.sleep(60 * 1000 * 3);

  /**
   * @type {import('probot').Octokit.PullsGetReviewResponse} review
   */
  const review = context.payload.review;
  // Fetch the pull request incase there has been any changes since
  // the review was made.
  const pullRequestResponse = await context.github.pulls.get(
    context.repo({
      pull_number: context.payload.pull_request.number,
    })
  );
  const pullRequest = pullRequestResponse.data;
  const reviewer = review.user.login;
  const author = pullRequest.user.login;

  if (pullRequest.state === 'closed') {
    // If the pull request got merged or closed, do nothing and exit.
    return;
  }

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
 * This functions handles a changes requested review.
 *
 * @param {import('probot').Context} context
 */
const handleApproval = async (context) => {
  // Pause for 3 minutes in case reviewer wants to perform
  // the required actions.
  await utilityModule.sleep(60 * 1000 * 3);

  /**
   * @type {import('probot').Octokit.PullsGetReviewResponse} review
   */
  const review = context.payload.review;
  const reviewer = review.user.login;
  // Fetch the pull request incase there has been any changes since
  // the review was made.
  const pullRequestResponse = await context.github.pulls.get(
    context.repo({
      pull_number: context.payload.pull_request.number,
    })
  );
  const pullRequest = pullRequestResponse.data;

  if (pullRequest.state === 'closed') {
    // If the pull request got merged or closed, do nothing and exit.
    return;
  }
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
  }

  // Check if pull request has been approved by all reviewers.
  // We are searching for an approved pull request with the pull request
  // number and in the appropriate repository. An empty array will be
  // returned if the pull request is not approved by all reviewers.
  const searchResult = await context.github.search.issuesAndPullRequests(
    context.repo({
      q: `repo:${context.payload.repository.full_name} review:approved ${pullRequest.number}`,
    })
  );

  const searchData = searchResult.data.items;
  if (searchData.length === 0) {
    // Pull request has not been approved by all reviewers, hence we need to
    // assign the remaining reviewers.
    const reviewersYetToReview = pullRequest.requested_reviewers.map(
      (reviewer) => reviewer.login
    );
    const assignees = pullRequest.assignees.map((assignee) => assignee.login);

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
    // The pull request has been approved, and we need to add the LGTM label.
    const labels = pullRequest.labels.map((label) => label.name);
    if (labels.includes(LGTM_LABEL)) {
      // Do nothing and end execution if label has already been added.
      return;
    }
    await context.github.issues.addLabels(
      context.repo({
        issue_number: pullRequest.number,
        labels: [LGTM_LABEL],
      })
    );

    // Check if author can merge PR. All members can merge the pull request.
    const membershipCheckResponse = await context.github.orgs.checkMembership({
      org: context.payload.organization.login,
      username: pullRequest.user.login,
    });

    if (membershipCheckResponse.status === 204) {
      // Assign author.
      await context.github.issues.addAssignees(
        context.repo({
          issue_number: pullRequest.number,
          assignees: [pullRequest.user.login],
        })
      );
    } else {
      // Assign last reviewer.
      await context.github.issues.addAssignees(
        context.repo({
          issue_number: pullRequest.number,
          assignees: [reviewer],
        })
      );
      await context.github.issues.createComment(
        context.repo({
          issue_number: pullRequest.number,
          body:
            'Hi @' +
            reviewer +
            ', this PR is ready to be merged, PTAL. Thanks!',
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
  if (review.state === CHANGES_REQUESTED) {
    await handleChangesRequested(context);
  } else if (review.state === APPROVED) {
    await handleApproval(context);
  }
};

module.exports = {
  handlePullRequestReview,
};
