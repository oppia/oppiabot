const {SERVER_JOBS_ADMIN} = require('../userWhitelist.json');
const REGISTRY_FILENAME = 'jobs_registry.py';
const JOB_FILE_FIX = '_jobs_';

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem}
 */
const isJobFile = ({filename}) => {
  return filename.includes(JOB_FILE_FIX);
};

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem}
 */
const isNewFile = ({status}) => {
  return status === 'added';
};

/**
 * @param {string} filename
 */
const getJobNameFromFileName = (filename) => {
  // Filename is the relative path to the file, we need to
  // get the exact file name.
  const substrings = filename.split('/');
  const actualFileNameWithExtension = substrings[substrings.length - 1];
  const extensionIndex = actualFileNameWithExtension.indexOf('.py');

  return actualFileNameWithExtension.substring(0, extensionIndex);
};

/**
 * @param {string} filename
 * @param {import('probot').Octokit.PullsListFilesResponse} files
 */
const doesRegistryContainFile = (filename, files) => {
  const jobName = getJobNameFromFileName(filename);

  const registryFile = files.find(({filename}) => {
    return filename.includes(REGISTRY_FILENAME);
  });

  return registryFile && registryFile.patch.includes(jobName);
};

/**
 * Gets all the changed files in the repo
 * @param {import('probot').Context} context
 * @returns {Promise<import('probot').Octokit.PullsListFilesResponseItem[]>}
 */
const getAllChangedFiles = async (context) => {
  const changedFiles = [];
  /**
   * @type {import('probot').Octokit.PullsGetResponse}
   */
  const pullRequest = context.payload.pull_request;
  const maxFilesPerPage = 100;

  let totalFilesFetched = 0;
  let currentPage = 1;
  do {
    const fileListParams = context.repo({
      pull_number: pullRequest.number,
      per_page: maxFilesPerPage,
      page: currentPage,
    });

    const fileResponse = await context.github.pulls.listFiles(fileListParams);
    changedFiles.push(...fileResponse.data);
    totalFilesFetched += fileResponse.data.length;
    currentPage++;
  } while (totalFilesFetched < pullRequest.changed_files);

  return changedFiles;
};

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} newJobFiles
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} changedFiles
 */
const getRegistryReminder = (newJobFiles, changedFiles) => {
  let registryReminder = ', ';

  const hasNotAddedFileToRegistry = newJobFiles.some(
    (file) => !doesRegistryContainFile(file.filename, changedFiles)
  );

  if (hasNotAddedFileToRegistry) {
    const fileText = newJobFiles.length > 1 ? 'files' : 'file';
    registryReminder +=
      'endeavour to add the new job ' + fileText + ' to the job registry and ';
  }

  return registryReminder;
};

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} newJobFiles
 */
const getJobNameString = (newJobFiles) => {
  let jobNameString = '';
  const jobNameArray = newJobFiles.map((file) =>
    getJobNameFromFileName(file.filename)
  );
  if (jobNameArray.length === 1) {
    jobNameString = ' The name of the job is ' + jobNameArray[0] + '.';
  } else {
    jobNameString = ' The jobs are ' + jobNameArray.join(', ') + '.';
  }

  return jobNameString;
};

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} newJobFiles
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} changedFiles
 * @param {string} prAuthor - Author of the Pull Request
 */
const getCommentBody = (newJobFiles, changedFiles, prAuthor) => {
  const registryReminder = getRegistryReminder(newJobFiles, changedFiles);
  const jobNameString = getJobNameString(newJobFiles);
  const newLineFeed = '<br>';
  const serverJobsForm = 'server jobs form'.link(
    'https://goo.gl/forms/XIj00RJ2h5L55XzU2');

  // This function will never be called when there are no job files.
  if (newJobFiles.length === 1) {
    const serverAdminPing = 'Hi @' + SERVER_JOBS_ADMIN + ', PTAL at this PR, ' +
      'it adds a new server job.' + jobNameString;

    const prAuthorPing = 'Also @' + prAuthor + registryReminder +
    'please make sure to fill in the ' + serverJobsForm +
    ' for the new job to be tested on the backup server. ' +
    'This PR can be merged only after the test is successful.';

    return (serverAdminPing + newLineFeed + prAuthorPing +
      newLineFeed + 'Thanks!');
  } else {
    const serverAdminPing = 'Hi @' + SERVER_JOBS_ADMIN + ', PTAL at this PR, ' +
      'it adds new server jobs.' + jobNameString;

    const prAuthorPing = 'Also @' + prAuthor + registryReminder +
    'please make sure to fill in the ' + serverJobsForm +
    ' for the new jobs  to be tested on the backup server.' +
    ' This PR can be merged only after the test is successful.';

    return (serverAdminPing + newLineFeed + prAuthorPing +
      newLineFeed + 'Thanks!');
  }
};

/**
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const hasCriticalLabel = (pullRequest) => {
  const criticalLabel = pullRequest.labels.find(
    (label) => label.name.toLowerCase() === 'critical'
  );

  return Boolean(criticalLabel);
};

/**
 * @param {import('probot').Context} context
 */
const checkForNewJob = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;
  if (!hasCriticalLabel(pullRequest)) {
    const changedFiles = await getAllChangedFiles(context);

    // Get new jobs that were created in the PR.
    const newJobFiles = changedFiles.filter((file) => {
      return isJobFile(file) && isNewFile(file);
    });

    if (newJobFiles.length > 0) {
      const commentBody = getCommentBody(
        newJobFiles,
        changedFiles,
        pullRequest.user.login
      );

      const commentParams = context.repo({
        issue_number: pullRequest.number,
        body: commentBody,
      });

      await context.github.issues.createComment(commentParams);

      const labelParams = context.repo({
        issue_number: pullRequest.number,
        labels: ['critical']
      });
      await context.github.issues.addLabels(labelParams);

      const assigneeParams = context.repo({
        issue_number: pullRequest.number,
        assignees: [SERVER_JOBS_ADMIN]
      });
      await context.github.issues.addAssignees(assigneeParams);
    }
  }
};

module.exports = {
  checkForNewJob
};
