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
 * @fileoverview File to handle checks when a new code owner gets added.
 */

const utilsModule = require('./utils');
const userWhitelist = require('../userWhitelist.json');
const { isChangelogLabel } = require('./utils');
const CODE_OWNER_FILE_NAME = '.github/CODEOWNERS';
const newAddition = '+';
const newCommentAddition = '+#';
const newLine = '\n';
const usernameDefiner = '@';
const errortodo = '+# TODO';

/**
 * This function returns true if new added line starts with '+'
 * and not as '+#' which is comment line and false if otherwise.
 *
 * @param {string} change
 */
const checkNewLineAddition = (change) => {
  return (
    change.startsWith(newAddition) && !change.startsWith(newCommentAddition) &&
      !change.startsWith(errortodo)
  );
};

/**
 * This function returns all the new codeowners added to the codeowners file.
 * @param {import('probot').Octokit.PullsListFilesResponseItem} file
 * @returns {string[]}
 */
const getNewCodeOwners = (file) => {
  const changesArray = file.patch.split(newLine);
  const newAdditions = changesArray.filter((change) => {
    return checkNewLineAddition(change);
  });

  /**
   * @type {string[]} addedCodeOwners
   */
  let addedCodeOwners = [];
  newAdditions.forEach((addition) => {
    const usernames = addition.split(usernameDefiner);
    // The first item of the array will be the path to the file, and should
    // be removed to get only the usernames.
    usernames.shift();
    addedCodeOwners.push(...usernames);
  });
  // Trim and add @ to the front of the username.
  addedCodeOwners = addedCodeOwners.map(
    (username) => usernameDefiner + username.trim()
  );

  // Remove all duplicates and return the array.
  return Array.from(new Set(addedCodeOwners));
};

/**
 * This function returns all the files added/modified to the codeowner file.
 * @param {import('probot').Octokit.PullsListFilesResponseItem} file
 * @returns {string[]}
 */
const getNewCodeOwnerFiles = (file) => {
  const changesArray = file.patch.split(newLine);
  const newAdditions = changesArray.filter((change) => {
    return checkNewLineAddition(change);
  });

  const addedFiles = newAdditions.map((addition) => {
    const additionArray = addition.split(usernameDefiner);
    // The first item of the array will be the path to the file, and should
    // be returned.
    const filePath = additionArray.shift().trim();
    // Remove '+' from the file path.
    return filePath.substring(1);
  });

  return addedFiles;
};

/**
 * This function checks if a new codeowner has been added to the codeowner
 * file and responds as required.
 *
 * @param {import('probot').Context} context
 */
const checkForNewCodeowner = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;

  const changedFiles = await utilsModule.getAllChangedFiles(context);

  const changedCodeOwnerFile = changedFiles.find(
    (file) => file.filename === CODE_OWNER_FILE_NAME
  );

  if (changedCodeOwnerFile) {
    const mainCodeOwnerFile = await utilsModule.getMainCodeOwnerfile();

    const newlyAddedCodeOwners = getNewCodeOwners(changedCodeOwnerFile);

    // Remove all exisiting codeowners.
    const newCodeOwners = newlyAddedCodeOwners.filter(
      (user) => !mainCodeOwnerFile.includes(user)
    );

    if (newCodeOwners.length > 0) {
      const changelogLabel = pullRequest.labels.find((label) =>
        isChangelogLabel(label.name)
      );

      let codeOwnerString = '';
      if (newCodeOwners.length > 1) {
        codeOwnerString =
          'the following new code owners ' + newCodeOwners.join(', ');
      } else {
        codeOwnerString = 'a new code owner, ' + newCodeOwners[0];
      }

      const filePaths = getNewCodeOwnerFiles(changedCodeOwnerFile);
      let codeOwnerFileString = '';
      if (filePaths.length > 1) {
        codeOwnerFileString = ' to the following files ' + filePaths.join(', ');
      } else {
        codeOwnerFileString = ' to ' + filePaths[0];
      }

      let commentBody = '';
      // Ping the code owner of CODEOWNERS file since we just want to flag
      // that a new code-owner is added and bring it to his attention.
      commentBody =
          'Hi @' +
          userWhitelist.codeOwnerFileReviewer +
          ', this PR adds ' +
          codeOwnerString +
          codeOwnerFileString +
          '. Please make sure the changes are ' +
          'verified by the previous codeowner(s) of the file. Thanks!';

      context.github.issues.createComment(
        context.repo({
          issue_number: pullRequest.number,
          body: commentBody,
        })
      );
    }
  }
};

module.exports = {
  checkForNewCodeowner,
  getNewCodeOwners
};
