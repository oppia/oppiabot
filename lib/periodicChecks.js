const {
  getAllOpenPullRequests,
  hasPullRequestBeenApproved,
} = require('./utils');

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
}

/**
 * @param {import('probot').Context} context
 */
const ensurePullRequestIsAssigned = async (context) => {
  // Fetch all pull requests
  // Filter out those without assignees
  // Find out appropriate assignee
  // Assign appropriate assignee
  // Ping appropriate assignee

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
      pullRequest.number
    );

    if (hasMergeConflict(pullRequestData)) {
      // Assign PR author
    } else if (hasPendingReviews(pullRequestData)) {
      // assignRemaining reviewers
    } else if (!hasBeenApproved) {
      // Assign PR authors
    } else if (hasBeenApproved) {
      handleApproval();
    } else {
      // Ping welfare team about the PR.
    }
  });
};

/**
 * @param {import('probot').Context} context
 */
const main = (context) => {
  const duration = 24 * 60 * 60 * 1000; // 24 hours.
  setInterval(() => {
    console.log('RUNNING PERIODIC CHECKS...');
    ensurePullRequestIsAssigned(context);
  }, duration);
};
