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

/**
 * @fileoverview File to handle checks when a PR adds/modifies the data storage layer.
 */

const {
  DATASTORE_LABEL,
  getAllChangedFiles,
  getNameString,
  getNewItemsFromFileByRegex,
  hasDatastoreLabel
} = require('./utils');

const { teamLeads, oppiaMaintainers, SERVER_JOBS_ADMIN } = require('../userWhitelist.json');
const STORAGE_DIR_PREFIX = 'core/storage/';
const MODEL_REGEX = new RegExp(
  [
    '(?<addition>\\+)(?<classDefinition>class\\s)',
    '(?<name>[a-zA-Z]{2,256})(?<suffix>Model)(?<funDef>\\()',
  ].join('')
);

/**
 * Get all new models from a file.
 * @param {import('probot').Octokit.PullsListFilesResponseItem} file
 */
const getNewModelsFromFile = (file) => {
  return getNewItemsFromFileByRegex(MODEL_REGEX, file);
};

/**
 * Checks if a file has new models.
 * @param {import('probot').Octokit.PullsListFilesResponseItem} file
 */
const checkForNewModelsInFile = (file) => {
  const newModels = getNewModelsFromFile(file);
  return newModels.length > 0;
};

/**
 * Get name string for models.
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} newModelFiles
 */
const getModelNameString = (newModelFiles) => {
  return getNameString(
    newModelFiles,
    {
      singular: 'model',
      plural: 'models'
    },
     MODEL_REGEX
  );
};

/**
 * Check if file is in the storage directory.
 * @param {string} filename
 */
const isInStorageDir = (filename) => {
  return filename.startsWith(STORAGE_DIR_PREFIX);
};


/**
 * Get the body of the comment to ping the user.
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} newModelFiles
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} changedFiles
 * @param {string} prAuthor - Author of the Pull Request
 */
const getCommentBody = (newModelFiles) => {
  const modelNameString = getModelNameString(newModelFiles);
  const newLineFeed = '<br>';

  // This function will never be called when there are no model files.
  if (newModelFiles.length === 1) {
    const message = 'Hi @' + SERVER_JOBS_ADMIN + ' and @' +
      teamLeads.releaseTeam + ', PTAL at this PR, it adds a model that ' +
      'needs to be validated.' + modelNameString + newLineFeed +'Thanks!';

    return message;
  } else {
    const message = 'Hi @' + SERVER_JOBS_ADMIN + ' and @' +
      teamLeads.releaseTeam + ', PTAL at this PR, it adds new models that ' +
      'need to be validated.' + modelNameString + newLineFeed +'Thanks!';

    return message;
  }
};


/**
 * Check for critical PRs.
 * @param {import('probot').Context} context
 */
const checkIfPRAffectsDatastoreLayer = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;

  if (!hasDatastoreLabel(pullRequest)) {
    const changedFiles = await getAllChangedFiles(context);

    // Get new models that were created in the PR.
    const newModelFiles = changedFiles.filter((file) => {
      return isInStorageDir(file.filename) && checkForNewModelsInFile(file);
    });

    if (newModelFiles.length > 0) {
      const commentBody = getCommentBody(
        newModelFiles
      );

      const commentParams = context.repo({
        issue_number: pullRequest.number,
        body: commentBody,
      });
      await context.github.issues.createComment(commentParams);

      const labelParams = context.repo({
        issue_number: pullRequest.number,
        labels: [DATASTORE_LABEL],
      });
      await context.github.issues.addLabels(labelParams);

      const assigneeParams = context.repo({
        issue_number: pullRequest.number,
        assignees: [teamLeads.releaseTeam, SERVER_JOBS_ADMIN],
      });
      await context.github.issues.addAssignees(assigneeParams);
    }
  }
};

module.exports = {
  checkIfPRAffectsDatastoreLayer
}
