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
  JOBS_AND_FEATURES_TESTING_WIKI_LINK,
  DATASTORE_LABEL,
  getAllChangedFiles,
  hasDatastoreLabel,
  pingAndAssignUsers
} = require('./utils');
const JOBS_DIR_PREFIX = 'core/jobs/';
const PLATFORM_DIR_PREFIX = 'core/platform/';

/**
 * @param {string} filename
 */
const fileChangesShouldBeVerified = (filename) => {
  return (
    (
      filename.startsWith(JOBS_DIR_PREFIX) || 
      filename.startsWith(PLATFORM_DIR_PREFIX)
    ) &&
    !filename.endsWith('test.py')
  );
};

/**
 * @param {string} prAuthor - Author of the Pull Request
 */
const getCommentBody = (prAuthor) => {
  const newLineFeed = '<br>';
  const serverJobsForm = 'server jobs form'.link(
    'https://goo.gl/forms/XIj00RJ2h5L55XzU2');
  const wikiLinkText = 'this guide'.link(
    JOBS_AND_FEATURES_TESTING_WIKI_LINK);

  const serverAdminPing = (
    'Hi @' + serverJobAdmins.join(', @') +
    ', PTAL at this PR, it modifies files in jobs or platform folders.'
  );
  const prAuthorPing = (
    'Also @' + prAuthor + ', ' +
    'please make sure to fill in the ' + serverJobsForm + ' ' +
    'for the new job or feature to be tested on the backup server. ' +
    'This PR can be merged only after the test run is successful. ' +
    'Please refer to ' + wikiLinkText + ' for details.'
  );
  return (
    serverAdminPing + newLineFeed + prAuthorPing + newLineFeed + 'Thanks!'
  );
};


/**
 * @param {import('probot').Context} context
 */
const checkForModificationsToFiles = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;
  if (!hasDatastoreLabel(pullRequest)) {
    const changedFiles = await getAllChangedFiles(context);

    // Get new jobs that were created in the PR.
    const modifiedFilesToBeTested = changedFiles.filter((file) => {
      return fileChangesShouldBeVerified(file.filename);
    });

    if (modifiedFilesToBeTested.length > 0) {
      const commentBody = getCommentBody(pullRequest.user.login);

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
  checkForModificationsToFiles,
  hasDatastoreLabel,
  DATASTORE_LABEL
};
