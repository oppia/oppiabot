const utils = require('./utils');

/**
 * This function comments on and tags pull requests in which the last
 * commit was created 2 days ago
 * @param {import('probot').Context} context
 */
const checkAndTagPRsWithOldBuilds = async (context) => {
  const allOpenPullRequests = await utils.getAllOpenPullRequests(
    context
  );

  allOpenPullRequests.forEach(async (pullRequest) => {
    const containsOldBuildLabel = pullRequest.labels.some(
      label => label.name === utils.OLD_BUILD_LABEL
    );
    // If label has already been added, do nothing.
    if (containsOldBuildLabel) {
      return;
    }
    // Get last commit for pull request.
    const {data: lastCommit} = await context.github.repos.getCommit(
      context.repo({
        ref: pullRequest.head.sha
      })
    );

    const lastCommitDate = new Date(lastCommit.commit.author.date);
    // Commit is older than 2 days
    if (utils.MIN_BUILD_DATE > lastCommitDate) {
      const labelParams = context.repo({
        issue_number: pullRequest.number,
        labels: [utils.OLD_BUILD_LABEL],
      });
      context.github.issues.addLabels(labelParams);

      // Ping PR author.
      const commentParams = context.repo({
        issue_number: pullRequest.number,
        body:
            'Hi @' + pullRequest.user.login + ', the build of this PR is ' +
            'stale and this could result in tests failing in develop. Please ' +
            'update this pull request with the latest changes from develop. ' +
            'Thanks!',
      });
      context.github.issues.createComment(commentParams);
    }
  }
  );
};

/**
 * This function removes the old build label when a PR has a new commit.
 * @param {import('probot').Context} context
 */
const removeOldBuildLabel = async (context) => {
  const pullRequest = context.payload.pull_request;

  const containsOldBuildLabel = pullRequest.labels.some(
    label => label.name === utils.OLD_BUILD_LABEL
  );

  if (!containsOldBuildLabel) {
    return;
  }

  // Get last commit for pull request.
  const {data: lastCommit} = await context.github.repos.getCommit(
    context.repo({
      ref: pullRequest.head.sha
    })
  );

  const lastCommitDate = new Date(lastCommit.commit.author.date);
  // Commit is older than 2 days
  if (utils.MIN_BUILD_DATE > lastCommitDate) {
    return;
  }

  context.github.issues.removeLabel(
    context.repo({
      issue_number: pullRequest.number,
      name: utils.OLD_BUILD_LABEL,
    })
  );
};
module.exports = {
  checkAndTagPRsWithOldBuilds,
  removeOldBuildLabel
};
