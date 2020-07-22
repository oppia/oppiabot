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

const DATASTORE_LABEL = 'PR: Affects datastore layer';

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
 * Replaces a character from a position in a string with a new one.
 * @param {String} str The string to be modified
 * @param {Number} index The index of the string
 * @param {String} char The character to replace at index
 */
const swapCharInPlace = (str, index, char) => {
  return str.substring(0, index) + char + str.substring(index + 1);
};

module.exports = {
  DATASTORE_LABEL,
  getAllChangedFiles,
  getNameString,
  getNewItemsFromFileByRegex,
  hasDatastoreLabel,
  swapCharInPlace,
};
