// Copyright 2021 The Oppia Authors. All Rights Reserved.
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
  getAllChangedFiles,
  pingAndAssignUsers
} = require('./utils');
const constants = require('../constants');
const CRON_REGISTRY_FILENAME = 'main_cron.py';
const CRON_TEST_FILENAME = 'core/controllers/cron_test.py';
const CRON_JOB_FILE = 'core/controllers/cron.py';

/**
 * This function checks if the author has made some changes in the
 *  cron.py file.
 *
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} changedFiles
 */
const isCronFileChanged = (changedFiles) => {
  const file = (fileObject) => fileObject.filename === CRON_JOB_FILE;
  return changedFiles.some(file);
};

/**
 *This function checks if the author has added respective tests
 *and URL redirects for the new CRON job.
 *
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} changedFiles
 */
const hasAddedTests = (changedFiles) => {
  const file = (fileObject) =>
    (fileObject.filename === CRON_REGISTRY_FILENAME) ||
    (fileObject.filename === CRON_TEST_FILENAME);
  return changedFiles.some(file);
};

/**
 * This function adds a registryReminder to the comment, notifying
 * author for adding the respective tests and URL redirects.
 *
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} changedFiles
 */
const getRegistryReminder = (changedFiles) => {
  let registryReminder = '';
  if (!hasAddedTests(changedFiles)) {
    registryReminder +=
      ' please add the new test and URL redirects for the new CRON jobs';
  }
  return registryReminder;
};

/**
 * This function generates and returns the comment body
 * for a change in CRON files.
 *
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} changedFiles
 * @param {string} prAuthor - Author of the Pull Request
 */
const getCommentBody = (changedFiles, prAuthor) => {
  const registryReminder = getRegistryReminder(changedFiles);
  const newLineFeed = '<br>';
  const serverJobsForm = 'server jobs form'.link(
    'https://goo.gl/forms/XIj00RJ2h5L55XzU2');
  const wikiLinkText = 'this guide'.link(
    JOBS_AND_FETURES_TESTING_WIKI_LINK);

  const serverAdminPing = (
    'Hi @' + serverJobAdmins.join(', @') +
    ', PTAL at this PR, ' + 'it adds a new cron job.'
  );

  const prAuthorPing = (
    'Also @' + prAuthor + registryReminder + ' It seems you have added or ' +
    'edited a CRON job, if so please request a testing of this CRON job ' +
    'with this ' + serverJobsForm + ' Please refer to ' + wikiLinkText +
    ' for details.');
  return (
    serverAdminPing + newLineFeed + prAuthorPing + newLineFeed + 'Thanks!');
};

/**
 * This function checks if any new CRON job has been added.
 *
 * @param {import('probot').Context} context
 */
const checkForNewCronJob = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;
  const changedFiles = await getAllChangedFiles(context);
  const cronFileIsChanged = isCronFileChanged(changedFiles);
  const testsAreAdded = hasAddedTests(changedFiles);
  if (cronFileIsChanged || testsAreAdded) {
    const commentBody = getCommentBody(
      changedFiles,
      pullRequest.user.login
    );

    await pingAndAssignUsers(
      context,
      pullRequest,
      serverJobAdmins,
      commentBody
    );
  }
};

module.exports = {
  checkForNewCronJob,
};
