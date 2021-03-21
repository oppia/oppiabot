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
  DATASTORE_LABEL,
  getAllChangedFiles,
  hasDatastoreLabel,
  pingAndAssignUsers
} = require('./utils');
const CRON_REGISTRY_FILENAME = 'main_cron.py';
const CRON_TEST_FILENAME = 'core/controllers/cron_test.py';
const CRON_JOB_FILE = 'core/controllers/cron.py';

const cronFileIsChanged = (changedFiles) => {
  changedFiles.filter((file) => {
    if (file.filename === CRON_JOB_FILE) {
      return true;
    }
  });
};

const hasNotAddedTests = (changedFiles) => {
  changedFiles.filter((file) => {
    if (!(file.filename === CRON_REGISTRY_FILENAME ||
       file.filename === CRON_TEST_FILENAME)) {
      return true;
    }
  });
};

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} newJobFiles
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} changedFiles
 */
const getRegistryReminder = (changedFiles) => {
  let registryReminder = '';
  if (hasNotAddedTests(changedFiles)) {
    registryReminder +=
      'please add the new test and URL redirects for new cron jobs';
  }
  return registryReminder;
};

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} newJobFiles
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} changedFiles
 * @param {string} prAuthor - Author of the Pull Request
 */
const getCommentBody = (changedFiles, prAuthor) => {
  const registryReminder = getRegistryReminder(changedFiles);
  const newLineFeed = '<br>';
  const wikiLinkText = (
    'this guide'.link(
      'https://github.com/oppia/oppia/wiki/Running-jobs-in-production' +
      '#submitting-a-pr-with-a-new-job'));

  const serverAdminPing = (
    'Hi @' + serverJobAdmins.join(', @') +
          ', PTAL at this PR, ' + 'it adds a new cron job.'
  );

  const prAuthorPing = 'Also @' + prAuthor + registryReminder +
          'It seems you have added or edited a CRON job,' +
          'if so please request a testing of this CRON job ' +
          'with this ' + cronJobsForm +
          'Please refer to ' + wikiLinkText + ' for details.';

  return (serverAdminPing + newLineFeed + prAuthorPing +
          newLineFeed + 'Thanks!');
};

/**
 * @param {import('probot').Context} context
 */
const checkForNewCronJob = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;
  if (!hasDatastoreLabel(pullRequest)) {
    const changedFiles = await getAllChangedFiles(context);
    console.log(changedFiles);
    // Get new cron jobs that were created in the PR.


    if (cronFileIsChanged(changedFiles)) {
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

      const labelParams = context.repo({
        issue_number: pullRequest.number,
        labels: [DATASTORE_LABEL]
      });
      await context.github.issues.addLabels(labelParams);
    }
  }
};

module.exports = {
  checkForNewCronJob,
  hasDatastoreLabel,
  DATASTORE_LABEL
};
