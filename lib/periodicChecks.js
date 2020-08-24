const {
  getAllOpenPullRequests,
  hasPullRequestBeenApproved,
  getChangelogLabelFromPullRequest,
  getProjectOwnerFromLabel,
} = require('./utils');
const { checkMergeConflictsInPullRequest } = require('./checkMergeConflicts');
const { teamLeads } = require('../userWhitelist.json');

/**
 *
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const hasMergeConflict = (pullRequest) => {
  return pullRequest.mergeable === false;
};

/**
 *
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const hasPendingReviews = (pullRequest) => {
  return pullRequest.requested_reviewers.length > 0;
};

/**
 * This function assigns all pending reviewers to a pull request.
 * @param {import('probot').Context} context
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const assignReviewers = async (context, pullRequest) => {
  const reviewers = pullRequest.requested_reviewers.map(
    (reviewer) => reviewer.login
  );

  context.github.issues.addAssignees(
    context.repo({
      issue_number: pullRequest.number,
      assignees: reviewers,
    })
  );
};

/**
 * This function assigns the PR author to a pull request.
 * @param {import('probot').Context} context
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const assignPrAuthor = async (context, pullRequest) => {
  context.github.issues.addAssignees(
    context.repo({
      issue_number: pullRequest.number,
      assignees: [pullRequest.user.login],
    })
  );
};

/**
 * This function assigns the PR author to a pull request.
 * @param {import('probot').Context} context
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const handleApproval = async (context, pullRequest) => {
  // Check if author can merge PR. All members can merge the pull request.
  const membershipCheckResponse = await context.github.orgs.checkMembership({
    org: context.payload.organization.login,
    username: pullRequest.user.login,
  });
  const SUCCESS_STATUS = 204;

  if (membershipCheckResponse.status === SUCCESS_STATUS) {
    // Assign author.
    await assignPrAuthor(context, pullRequest);
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
      await assignPrAuthor(context, pullRequest);
      await context.github.issues.createComment(
        context.repo({
          issue_number: pullRequest.number,
          body:
            'Hi @' +
            pullRequest.user.login +
            ', this PR is ready to be merged. Please ask one of the ' +
            'reviewers to help with the merge, also, make sure there are no ' +
            'pending comments before merge. Thanks!',
        })
      );
    }
  }
};

/**
 * This function ensures that a pull request is assigned.
 * 1. Fetch all pull requests.
 * 2. Filter out those without assignees.
 * 3. Find out appropriate assignee.
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

    if (hasMergeConflict(pullRequestData)) {
      await checkMergeConflictsInPullRequest(context, pullRequestData);
    } else if (hasPendingReviews(pullRequestData)) {
      await assignReviewers(context, pullRequestData);
    } else if (!hasBeenApproved) {
      await assignPrAuthor(context, pullRequestData);
    } else if (hasBeenApproved) {
      await handleApproval(context, pullRequestData);
    } else {
      context.github.issues.createComment(
        context.repo({
          issue_number: pullRequestData.number,
          body:
            'Hi @' +
            teamLeads.welfareTeam +
            ', this pull request needs some assistance. PTAL, thanks!',
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
 * @param {import('probot').Context} context
 */
const runPeriodicChecks = (context) => {
  const duration = 24 * 60 * 60 * 1000; // 24 hours.
  setInterval(() => {
    console.log('RUNNING PERIODIC CHECKS...');
    ensurePullRequestIsAssigned(context);
  }, duration);
};

module.exports = {
  // runPeriodicChecks,
  ensurePullRequestIsAssigned
};
