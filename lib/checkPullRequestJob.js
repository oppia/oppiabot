const {SERVER_JOBS_ADMIN} = require('../userWhitelist.json');
/**
 * @param {string} filename
 */
const isJobFile = (filename) => {
  const REGISTRY_FILENAME = 'jobs_registry.py';
  const JOB_FILE_FIX = '_jobs_';

  if (filename.endsWith(REGISTRY_FILENAME)) {
    return true;
  }

  if (filename.includes(JOB_FILE_FIX)) {
    return true;
  }

  return false;
};

/**
 * @param {import('probot').Context} context
 */
const checkForNewJob = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;

  const pullRequestParams = context.repo({
    pull_number: pullRequest.number,
  });

  const filesResponse = await context.github.pulls.listFiles(pullRequestParams);
  const changedFiles = filesResponse.data;
  const containsJobFile = changedFiles.some((file) => {
    return isJobFile(file.filename);
  });

  if (containsJobFile) {
    const prAuthor = pullRequest.user.login;
    const serverJobsForm = 'server jobs form'.link(
      'https://goo.gl/forms/XIj00RJ2h5L55XzU2');
    const commentBody = 'Hi @' + SERVER_JOBS_ADMIN + ', PTAL at this PR, ' +
      'it adds/modifies a server job. Also @' + prAuthor + ', please ' +
      'endeavour to fill the ' + serverJobsForm + ' for the new job ' +
      'to get tested on the test server. Thanks!';
    const commentParams = context.repo({
      issue_number: pullRequest.number,
      body: commentBody,
    });

    await context.github.issues.createComment(commentParams);
  }
};

module.exports = {
  checkForNewJob
};
