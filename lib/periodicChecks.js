const { getAllOpenPullRequests } = require('./utils');

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
const hasChangesRequested = (pullRequest) => {
  return false;
};

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
    if (hasMergeConflict(pullRequestData)) {
      // Assign PR author
    } else if (hasChangesRequested(pullRequestData)) {
    } else if (hasPendingReviews(pullRequestData)) {
    } else if (hasBeenApproved(pullRequestData)) {
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
