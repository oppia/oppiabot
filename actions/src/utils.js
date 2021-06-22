const { context } = require('@actions/github');

/**
 * This function pings and assigns all pending reviewers to a pull request.
 * @param {import('@octokit/rest').Octokit} octokit
 * @param {import('@octokit/rest').Octokit.PullsGetResponse} pullRequest
 * @param {string[]} assignees
 * @param {string} comment
 */
const pingAndAssignUsers = async (octokit, pullRequest, assignees, comment) => {
  await octokit.issues.createComment({
    issue_number: pullRequest.number,
    body: comment,
    ...context.repo,
  });

  await octokit.issues.addAssignees({
    issue_number: pullRequest.number,
    assignees: assignees,
    ...context.repo,
  });
};

module.exports = {
  pingAndAssignUsers,
};
