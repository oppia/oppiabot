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
 * @fileoverview Helper module.
 */

const { default: Axios } = require('axios');

const DATASTORE_LABEL = 'PR: Affects datastore layer';
// Labels here are excluded from codeowner assignment because the project
// owners need to review all pull requests with the label.
const LABELS_EXCLUDED_FROM_CODEOWNER_ASSIGNMENT = [
  'PR CHANGELOG: Angular Migration',
];
const CODE_OWNERS_FILE_URL =
  'https://raw.githubusercontent.com/oppia/oppia/develop/.github/CODEOWNERS';
const CHANGELOG_START = 'PR CHANGELOG';
const THREE_MINUTES = 60 * 1000 * 3;

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
 * Get new items from a file using the specified regex.
 * @param {import('probot').Octokit.PullsListFilesResponseItem} file
 * @param {RegExp} regex
 */
const getNewItemsFromFileByRegex = (regex, file) => {
  // This represents an new line added from the git diff.
  // This is done because classes can only be created in a new line.
  // '+' represents an addition while '-' represents a deletion.
  const newLine = '\n';
  const changesArray = file.patch.split(newLine);

  const newDefinitions = changesArray.filter((change) => {
    const matches = regex.exec(change);
    return matches !== null;
  });

  const newItems = newDefinitions.map((definition) => {
    const matches = regex.exec(definition);
    return matches.groups.name + matches.groups.suffix;
  });

  return newItems;
};

/**
 * Checks if a pull request has the datastore label.
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const hasDatastoreLabel = (pullRequest) => {
  const datastoreLabel = pullRequest.labels.find(
    (label) => label.name.toLowerCase() === DATASTORE_LABEL.toLowerCase()
  );

  return Boolean(datastoreLabel);
};

/**
 * Get singular and plural form of a response comment.
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} files
 * @param {RegExp} regex
 * @param {Object} itemName - Singular and plural variant of the item.
 */
const getNameString = (files, itemName, regex) => {
  let nameString = '';
  let totalNumberOfItems = 0;

  let itemNameArray = files.map((file) => {
    const itemNames = getNewItemsFromFileByRegex(regex, file);
    totalNumberOfItems += itemNames.length;
    return itemNames.join(', ').link(file.blob_url);
  });

  if (totalNumberOfItems === 1) {
    nameString =
      ' The name of the ' + itemName.singular + ' is ' + itemNameArray[0] + '.';
  } else {
    nameString =
      ' The ' + itemName.plural + ' are ' + itemNameArray.join(', ') + '.';
  }

  return nameString;
};

/**
 * This function returns a promise that resolves after a particular time.
 * @param {Number} ms - Sleep time.
 */
const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * This function is used to obtain the project owner from a changelog label.
 *
 * @param {String} changelogLabel
 */
const getProjectOwnerFromLabel = (changelogLabel) => {
  const USERNAME_IDENTIFIER = '@';
  const labelSubstrings = changelogLabel.split(USERNAME_IDENTIFIER);
  const projectOwner = labelSubstrings[labelSubstrings.length - 1].trim();
  return projectOwner;
};

/**
 * This function gets the changelog label from a pull request.
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const getChangelogLabelFromPullRequest = (pullRequest) => {
  const label = pullRequest.labels.find((label) =>
    label.name.toUpperCase().startsWith(CHANGELOG_START)
  );
  if (label) {
    return label.name.trim();
  }
};

/**
 * This function fetches data from codeowner file in oppia/develop branch.
 * @return {Promise<string>}
 */
const getMainCodeOwnerfile = async () => {
  const response = await Axios.get(CODE_OWNERS_FILE_URL);
  return response.data;
};

/**
 * This function returns true if a label is a changelog label and
 * false if otherwise.
 *
 * @param {string} label
 */
const isChangelogLabel = (label) => {
  return label.trim().toUpperCase().startsWith(CHANGELOG_START);
}

/**
 * This function retrieves github usernames from a text.
 *
 * @param {string} text
 * @returns {string[]}
 */
const getUsernamesFromText = (text) => {
  const regex = /(?<usernameIdentifier>@)(?<username>\w+)/gm;
  const matches = [...text.matchAll(regex)];
  const usernames = matches.map((match) => match.groups.username);
  return usernames;
};


module.exports = {
  LABELS_EXCLUDED_FROM_CODEOWNER_ASSIGNMENT,
  DATASTORE_LABEL,
  getAllChangedFiles,
  getNameString,
  getNewItemsFromFileByRegex,
  hasDatastoreLabel,
  sleep,
  getChangelogLabelFromPullRequest,
  getProjectOwnerFromLabel,
  getMainCodeOwnerfile,
  isChangelogLabel,
  getUsernamesFromText
};
