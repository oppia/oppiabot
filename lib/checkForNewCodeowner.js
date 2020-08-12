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
const { oppiaMaintainers } = require('../userWhitelist.json');
const CODE_OWNER_FILE_NAME = '.github/CODEOWNERS';

/**
 * This function returns all the new codeowners added to the codeowners file.
 * @param {import('probot').Octokit.PullsListFilesResponseItem} file
 * @returns {string[]}
 */
const getNewCodeOwners = (file) => {
  const newLine = '\n';
  const newAddition = '+';
  const changesArray = file.patch.split(newLine);
  const newAdditions = changesArray.filter((change) => {
    return change.startsWith(newAddition);
  });

  /**
   * @type {string[]} addedCodeOwners
   */
  let addedCodeOwners = [];
  newAdditions.forEach((addition) => {
    const usernames = addition.split('@');
    // The first item of the array will be the path to the file, and should
    // be removed to get only the usernames.
    usernames.shift();
    addedCodeOwners.push(...usernames);
  });
  // Trim and add @ to the front of the username.
  addedCodeOwners = addedCodeOwners.map((username) => '@' + username.trim());

  // Remove all duplicates and return the array.
  return Array.from(new Set(addedCodeOwners));
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
    console.log({
      newlyAddedCodeOwners,
      newCodeOwners
    })
    if (newCodeOwners.length > 0) {
      const changelogLabel = pullRequest.labels.find((label) =>
        label.name.toUpperCase().startsWith('PR CHANGELOG')
      );

      let codeOwnerString = '';
      if (newCodeOwners.length > 1) {
        codeOwnerString =
          'the following new code owners ' + newCodeOwners.join(', ');
      } else {
        codeOwnerString = 'a new code owner, ' + newCodeOwners[0];
      }

      let commentBody = '';
      if (changelogLabel !== undefined) {
        // Ping project owner.
        const projectOwner = utilsModule.getProjectOwnerFromLabel(
          changelogLabel.name.trim()
        );

        commentBody =
          'Hi @' +
          projectOwner +
          ', this PR adds ' +
          codeOwnerString +
          '. Please take a look /cc @' +
          oppiaMaintainers +
          '. Thanks!';
      } else {
        const reviewer = pullRequest.requested_reviewers[0].login;

        commentBody =
          'Hi @' +
          reviewer +
          ', this PR adds ' +
          codeOwnerString +
          '. Please take a look /cc @' +
          oppiaMaintainers +
          '. Thanks!';
      }

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
};
