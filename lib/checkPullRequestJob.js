// Copyright 2020 The Oppia Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const {
  serverJobAdmins
} = require('../userWhitelist.json');
const {
  JOBS_AND_FETURES_TESTING_WIKI_LINK,
  DATASTORE_LABEL,
  getAllChangedFiles,
  getNameString,
  getNewItemsFromFileByRegex,
  hasDatastoreLabel,
  pingAndAssignUsers
} = require('./utils');
const REGISTRY_FILENAME = 'jobs_registry.py';
const TEST_DIR_PREFIX = 'core/tests/';
const JOB_REGEX = new RegExp(
  [
    '(?<addition>\\+)(?<classDefinition>class\\s)',
    '(?<name>[a-zA-Z]{2,256})(?<suffix>OneOffJob)(?<funDef>\\()'
  ].join('')
);

/**
 * @param {string} filename
 */
const isInTestDir = (filename) => {
  return filename.startsWith(TEST_DIR_PREFIX);
};

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem} file
 */
const getNewJobsFromFile = (file) => {
  return getNewItemsFromFileByRegex(JOB_REGEX, file);
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
  const registryFile = files.find(({ filename }) => {
    return filename.includes(REGISTRY_FILENAME);
  });

  return registryFile && registryFile.patch.includes(job);
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
        `${jobModuleName}.${job}`, changedFiles));
    }
  );

  if (hasNotAddedFileToRegistry) {
    const jobText = newJobFiles.length > 1 ? 'jobs' : 'job';
    const jobRegistryFile = 'job registry'.link(
      'https://github.com/oppia/oppia/blob/develop/core/jobs_registry.py');
    registryReminder +=
      'please add the new ' + jobText + ' to the ' + jobRegistryFile + ' and ';
  }

  return registryReminder;
};

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} newJobFiles
 */
const getJobNameString = (newJobFiles) => {
  return getNameString(
    newJobFiles,
    {
      singular: 'job',
      plural: 'jobs'
    },
    JOB_REGEX
  );
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
  const wikiLinkText = 'this guide'.link(
    JOBS_AND_FETURES_TESTING_WIKI_LINK);

  // This function will never be called when there are no job files.
  if (newJobFiles.length === 1) {
    const serverAdminPing = (
      'Hi @' + serverJobAdmins.join(', @') +
      ', PTAL at this PR, ' + 'it adds a new one off job.' + jobNameString
    );

    const prAuthorPing = 'Also @' + prAuthor + registryReminder +
      'please make sure to fill in the ' + serverJobsForm +
      ' for the new job to be tested on the backup server. ' +
      'This PR can be merged only after the test run is successful. ' +
      'Please refer to ' + wikiLinkText + ' for details.';

    return (serverAdminPing + newLineFeed + prAuthorPing +
      newLineFeed + 'Thanks!');
  } else {
    const serverAdminPing = (
      'Hi @' + serverJobAdmins.join(', @') +
      ', PTAL at this PR, ' + 'it adds new one off jobs.' + jobNameString);

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
 * @param {import('probot').Context} context
 */
const checkForNewJob = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;
  if (!hasDatastoreLabel(pullRequest)) {
    const changedFiles = await getAllChangedFiles(context);

    // Get new jobs that were created in the PR.
    const newJobFiles = changedFiles.filter((file) => {
      return !isInTestDir(file.filename) && addsNewJob(file);
    });

    if (newJobFiles.length > 0) {
      const commentBody = getCommentBody(
        newJobFiles,
        changedFiles,
        pullRequest.user.login
      );

      await pingAndAssignUsers(
        context,
        pullRequest,
        serverJobAdmins,
        commentBody
      );

      const labelParams = context.repo({
        issue_number: pullRequest.number,
        labels: [DATASTORE_LABEL]
      });
      await context.github.issues.addLabels(labelParams);
    }
  }
};

module.exports = {
  checkForNewJob,
  getNewJobsFromFile,
  hasDatastoreLabel,
  DATASTORE_LABEL
};
