/**
 * Assign pull request to reviewers.
 * @param {import('probot').Context} context
 */
const assignAllCodeowners = async (context) => {
  // Github automatically requests for review from codeowners.
  /**
   * @type {import('probot').Octokit.PullsGetResponse} context
   */
  const pullRequest = context.payload.pull_request;
  const assignees = pullRequest.requested_reviewers.map(
    (reviewer) => reviewer.login
  );
  if(assignees.length > 0) {
    // Assign Reviewers
    const assignmentParams = context.issue({
      assignees,
    });
    context.github.issues.addAssignees(assignmentParams);

    // Ping codeowners.
    const message =
      'Assigning @' +
      assignees.join(', @') +
      ' for the first pass review of this PR. Thanks!';

    const commentParams = context.issue({
      body: message
    });
    context.github.issues.createComment(commentParams);
  }
};
module.exports = {
  assignAllCodeowners,
};
