const { context } = require('@actions/github');

/**
 * This function creates a comment and assigns users.
 * @param {import('@octokit/rest').Octokit} octokit
 * @param {import('@octokit/rest').Octokit.PullsGetResponse} pullRequest
 * @param {string[]} assignees
 * @param {string} comment
 */
const commentAndAssignUsers = async (
    octokit, pullRequest, assignees, comment
) => {
  await octokit.rest.issues.createComment({
    issue_number: pullRequest.number,
    body: comment,
    ...context.repo,
  });

  await octokit.rest.issues.addAssignees({
    issue_number: pullRequest.number,
    assignees: assignees,
    ...context.repo,
  });
};

module.exports = {
  commentAndAssignUsers,
};
