const { SERVER_JOBS_ADMIN } = require('../userWhitelist.json');
const REGISTRY_FILENAME = 'jobs_registry.py';
const JOB_FILE_FIX = '_jobs_';
const CRITICAL_LABEL = 'critical';
const TEST_DIR_PREFIX = 'core/tests/';

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem}
 */
const isJobFile = ({ filename }) => {
  return filename.includes(JOB_FILE_FIX) && !isInTestDir(filename);
};

/**
 * @param {string} filename
 */
const isInTestDir = (filename) => {
  return filename.startsWith(TEST_DIR_PREFIX);
}

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem}
 */
const isNewFile = ({ status }) => {
  return status === 'added';
};

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem} file
 */
const getNewJobsFromFile = (file) => {
  // This represents an new line added from the git diff.
  // This is done because classes can only be created in a new line.
  // '+' represents an addition while '-' represents a deletion.
  const newLineAdded = '\n+';
  const changesArray = file.patch.split(newLineAdded);
  const jobRegex = /(?<classDefinition>class\s)(?<jobName>[a-zA-Z]{2,256})(?<jobSuffix>OneOffJob)/;

  const newJobDefinitions = changesArray.filter(change => {
    const matches = jobRegex.exec(change);
    return matches !== null;
  });

  const newJobs = newJobDefinitions.map(definition => {
    const matches = jobRegex.exec(definition);
    return matches.groups.jobName + matches.groups.jobSuffix;
  });

  return newJobs;
};

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem} file
 */
const addsNewJob = (file) => {
  const newJobs = getNewJobsFromFile(file);
  return newJobs.length > 0;
};

/**
 * Returns the name of the job module from it's file name.
 * @param {string} filename
 *
 * @example
 * getJobModuleName('core/domain/user_jobs_one_off.py')
 * // returns user_jobs_one_off
 */
const getJobModuleName = (filename) => {
  // Filename is the relative path to the file, we need to
  // get the exact file name.
  const substrings = filename.split('/');
  const actualFileNameWithExtension = substrings[substrings.length - 1];
  const extensionIndex = actualFileNameWithExtension.indexOf('.py');

  return actualFileNameWithExtension.substring(0, extensionIndex);
};

/**
 * @param {string} job
 * @param {import('probot').Octokit.PullsListFilesResponse} files
 */
const isRegistryUpdated = (job, files) => {
  const registryFile = files.find(({filename}) => {
    return filename.includes(REGISTRY_FILENAME);
  });

  return registryFile && registryFile.patch.includes(job);
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
  // 100 is used here since that is the maximum files per
  // request that can be obtained from the API.
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
    (file) => {
      const jobs = getNewJobsFromFile(file);
      const jobModuleName = getJobModuleName(file.filename);
      return jobs.some((job) => !isRegistryUpdated(
        `${jobModuleName}.${job}`, changedFiles ));
    }
  );

  if (hasNotAddedFileToRegistry) {
    const jobText = newJobFiles.length > 1 ? 'jobs' : 'job';
    const jobRegistryFile = 'job registry'.link(
      'https://github.com/oppia/oppia/blob/develop/core/jobs_registry.py');
    registryReminder +=
      'please add the new ' + jobText + ' to the '+ jobRegistryFile +' and ';
  }

  return registryReminder;
};

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} newJobFiles
 */
const getJobNameString = (newJobFiles) => {
  let jobNameString = '';
  let totalNumberOfJobs = 0;

  let jobNameArray = newJobFiles.map(file => {
    const newJobNames = getNewJobsFromFile(file);
    totalNumberOfJobs += newJobNames.length;
    return (newJobNames.join(', ')).link(file.blob_url);
  });

  if (totalNumberOfJobs === 1) {
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
  const wikiLinkText = (
    'this guide'.link(
      'https://github.com/oppia/oppia/wiki/Running-jobs-in-production' +
      '#submitting-a-pr-with-a-new-job'));

  // This function will never be called when there are no job files.
  if (newJobFiles.length === 1) {
    const serverAdminPing = 'Hi @' + SERVER_JOBS_ADMIN + ', PTAL at this PR, ' +
      'it adds a new one off job.' + jobNameString;

    const prAuthorPing = 'Also @' + prAuthor + registryReminder +
    'please make sure to fill in the ' + serverJobsForm +
    ' for the new job to be tested on the backup server. ' +
    'This PR can be merged only after the test run is successful. ' +
    'Please refer to ' + wikiLinkText + ' for details.';

    return (serverAdminPing + newLineFeed + prAuthorPing +
      newLineFeed + 'Thanks!');
  } else {
    const serverAdminPing = 'Hi @' + SERVER_JOBS_ADMIN + ', PTAL at this PR, ' +
      'it adds new one off jobs.' + jobNameString;

    const prAuthorPing = 'Also @' + prAuthor + registryReminder +
    'please make sure to fill in the ' + serverJobsForm +
    ' for the new jobs to be tested on the backup server. ' +
    'This PR can be merged only after the test run is successful. ' +
    'Please refer to ' + wikiLinkText + ' for details.';

    return (serverAdminPing + newLineFeed + prAuthorPing +
      newLineFeed + 'Thanks!');
  }
};

/**
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const hasCriticalLabel = (pullRequest) => {
  const criticalLabel = pullRequest.labels.find(
    (label) => label.name.toLowerCase() === CRITICAL_LABEL
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
      return isJobFile(file) && (isNewFile(file) || addsNewJob(file));
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
        labels: [CRITICAL_LABEL]
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
  checkForNewJob,
  getNewJobsFromFile
};
