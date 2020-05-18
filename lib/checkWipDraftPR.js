/**
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 * @returns {Boolean}
 */
const isDraftPr = (pullRequest) => {
  return pullRequest.draft;
};

/**
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 * @returns {Boolean}
 */
const isWIPPr = ({ title, body }) => {
  return (
    title.toLowerCase().includes('wip') || body.toLowerCase().includes('wip')
  );
};

/**
 * @param {import('probot').Context} context
 */
module.exports.checkWIP = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;
  const prAuthor = pullRequest.user.login;

  if (isDraftPr(pullRequest) || isWIPPr(pullRequest)) {
    const link = 'here'.link(
      'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia' +
      '#wip--draft-pull-requests');
    // Comment on Pull Request.
    const commentBody = (
      'Hi @' + prAuthor + ', WIP/Draft PRs are highly discouraged. You can ' +
      'learn more about it ' + link + '. Do well to reopen it when it\'s ' +
      'ready to be reviewed and ensure that it is without any WIP text. ' +
      'Thanks!');
    const commentParams = context.repo({
      issue_number: pullRequest.number,
      body: commentBody,
    });
    await context.github.issues.createComment(commentParams);

    // Close Pull Request.
    const closeIssueParams = context.repo({
      issue_number: pullRequest.number,
      state: 'closed',
    });
    await context.github.issues.update(closeIssueParams);
  }
};
