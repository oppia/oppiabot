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
const { context } = require('@actions/github');
const {getAllOpenPullRequests} = require('./utils');
const utilityModule = require('./utils');
const CHANGES_REQUESTED = 'changes_requested';
const COMMENTED = 'commented';
const LGTM_LABEL = 'PR: LGTM';
const CLOSED_STATE = 'closed';
const PTAL_COMMENTS = ['PTAL', 'Please take a look'];

/**
 * This functions handles a "changes requested" review.
 * 1. Wait for 3 minutes for the reviewer to perform required action.
 * 2. Fetch the pull request for new changes.
 * 3. Check if the pull request has been closed or merged and exit.
 * 4. Check if the reviewer is still assigned to the PR and unassign them.
 * 5. Assign / ping the PR author if not already assigned
 *    (in the 3 minutes wait).
 *
 * @param {import('probot').Context} context
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 * @param {import('probot').Octokit.PullsGetReviewResponse} review
 */
const handleChangesRequested = async (context, pullRequest, review) => {
  let allLabels = pullRequest.labels.map((label)=>{
    if (typeof label !== 'undefined') {
      return label.name;
    }
  });
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
    const commentBody =
      'Hi @' +
      author +
      ', it looks like some changes were requested on this pull request by @' +
      reviewer +
      '. PTAL. Thanks!';
    await utilityModule.pingAndAssignUsers(
      context,
      pullRequest,
      [author],
      commentBody
    );
  }

  if (allLabels.includes(LGTM_LABEL)) {
    await context.github.issues.removeLabel(
      context.repo({
        issue_number: pullRequest.number,
        name: [LGTM_LABEL]
      })
    );
    await context.github.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body: 'Hi, @' + pullRequest.assignee.login +
        ', Removing LGTM Label since some Changes are Requested.',
      }
      )
    );
  }
};



/**
 * @param {import('probot').Context} context
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const handleApprovalByAllReviewers = async (context, pullRequest) => {
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
  const authorCanMerge = await utilityModule.isUserAMemberOfTheOrganisation(
    context, pullRequest.user.login
  );

  if (authorCanMerge) {
    // Ping and assign author.
    const commentBody =
      'Hi @' +
      pullRequest.user.login +
      ', this PR is ready to be merged. Please address any remaining ' +
      'comments prior to merging, and feel free to merge this PR ' +
      "once the CI checks pass and you're happy with it. Thanks!";

    await utilityModule.pingAndAssignUsers(
      context,
      pullRequest,
      [pullRequest.user.login],
      commentBody
    );
  } else {
    // Assign project owner to merge the pull request.
    // A pull request will always have a changelog label because we are
    // assigning the PR author to the pull request if it is created without
    // changelog label.
    const changelogLabel = utilityModule.getChangelogLabelFromPullRequest(
      pullRequest
    );
    const projectOwner = utilityModule.getProjectOwnerFromLabel(
      changelogLabel
    );

    const commentBody =
      'Hi @' +
      projectOwner +
      ', this PR is ready to be merged. Author of this PR ' +
      'does not have permissions to merge this PR. Before you merge it, ' +
      'please make sure that there are no pending comments that require ' +
      'action from the author\'s end. Thanks!';
    await utilityModule.pingAndAssignUsers(
      context,
      pullRequest,
      [projectOwner],
      commentBody
    );
  }
};

/**
 *
 * @param {import('probot').Context} context
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const handlePendingReviews = async (context, pullRequest) => {
  // Pull request has not been approved by all reviewers, hence we need to
  // assign the remaining reviewers.
  const assignees = pullRequest.assignees.map((assignee) => assignee.login);
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
      ' for code owner reviews. Thanks!';
    await utilityModule.pingAndAssignUsers(
      context,
      pullRequest,
      unassignedReviewers,
      commentBody
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
 * 6. If pull request has LGTM Label, assign PR author or project owner
 *    to merge the PR.
 *
 * @param {import('probot').Context} context
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 * @param {import('probot').Octokit.PullsGetReviewResponse} review
 */
const handleApproval = async (context, pullRequest, review) => {
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
        body:
          'Unassigning @' +
          reviewer +
          ' since they have already approved the PR.',
      })
    );
  }

  // Check if the PR has pending reviews and assign remaining reviewers.
  // If the PR does not have any pending review, check if it has changes
  // requested and do nothing since the PR author was already assigned when
  // the review was made.
  // If none of the above cases, check if the PR has been approved by searching
  // through github for approved PRs.
  const hasChangesRequested = (
    await utilityModule.doesPullRequestHaveChangesRequested(
      context,
      pullRequest.number
    )
  );
  const hasBeenApproved = await utilityModule.hasPullRequestBeenApproved(
    context,
    pullRequest.number
  );

  if (utilityModule.hasPendingReviews(pullRequest)) {
    handlePendingReviews(context, pullRequest);
    return;
  }
  if (hasChangesRequested) {
    // Do nothing since author was already assigned when the review was made.
    return;
  }
  if (hasBeenApproved) {
    handleApprovalByAllReviewers(context, pullRequest);
    return;
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
  await utilityModule.sleep(utilityModule.THREE_MINUTES);
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
    await handleChangesRequested(context, pullRequest, review);
  } else {
    await handleApproval(context, pullRequest, review);
  }
};

/**
 * This function handles the case when a PR author comments on the pull
 * request. If pr author comments on the PR asking reviewers to please
 * take a look (PTAL).
 * The function checks if the reviewers have been assigned and if not,
 * assigns them.
 *
 * @param {import('probot').Context} context
 */
const handleResponseToReview = async (context) => {
  /**
   * @type {import('probot').Octokit.IssuesGetResponse}
   */
  const pullRequest = context.payload.issue;
  const pullRequestProp = 'pull_request';
  const isPullRequest = pullRequestProp in pullRequest;
  if (!isPullRequest) {
    return;
  }

  /**
   * @type {import('probot').Octokit.IssuesGetCommentResponse}
   */
  const comment = context.payload.comment;
  const commenter = comment.user.login;
  const commenterIsAuthor = commenter === pullRequest.user.login;
  if (!commenterIsAuthor) {
    return;
  }

  const containsPtalComment = PTAL_COMMENTS.some((item) =>
    comment.body.toLowerCase().includes(item.toLowerCase())
  );
  if (!containsPtalComment) {
    return;
  }

  // Pause for 3 minutes in case author wants to perform
  // the required actions.
  await utilityModule.sleep(utilityModule.THREE_MINUTES);

  // Fetch the pull request in case there has been any changes since
  // the comment was made.
  const pullRequestResponse = await context.github.pulls.get(
    context.repo({
      pull_number: pullRequest.number,
    })
  );
  const updatedPullRequest = pullRequestResponse.data;

  const usersInComment = utilityModule.getUsernamesFromText(comment.body);
  // Check if assignment was carried out by author.
  const assignees = updatedPullRequest.assignees.map(
    (assignee) => assignee.login
  );
  const unassignedUsers = usersInComment.filter(
    (user) => !assignees.includes(user)
  );

  if (unassignedUsers.length === 0) {
    // All users in comment have been assigned.
    return;
  }

  // Assign users in comment
  context.github.issues.addAssignees(
    context.repo({
      issue_number: updatedPullRequest.number,
      assignees: unassignedUsers,
    })
  );

  // Unassign author if assigned.
  const authorIsAssigned = updatedPullRequest.assignees.some(
    (assignee) => assignee.login === updatedPullRequest.user.login
  );
  if (authorIsAssigned) {
    context.github.issues.removeAssignees(
      context.repo({
        issue_number: updatedPullRequest.number,
        assignees: [updatedPullRequest.user.login],
      })
    );

    context.github.issues.createComment(
      context.repo({
        issue_number: updatedPullRequest.number,
        body:
          'Unassigning @' +
          updatedPullRequest.user.login +
          ' since a re-review was requested. @' +
          updatedPullRequest.user.login +
          ', please make sure you have addressed all review comments. Thanks!',
      })
    );
  }
};

const handleLabels = async(context)=>{
  const allOpenPullRequests = await getAllOpenPullRequests(context);
  allOpenPullRequests.map((pullRequest)=>{
    handleChangesRequested(context, pullRequest, pullRequest.base);
  });
};
module.exports = {
  handlePullRequestReview,
  handleApprovalByAllReviewers,
  handleChangesRequested,
  handleResponseToReview,
  handleLabels
};
