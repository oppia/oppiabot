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

const { 'default': Axios } = require('axios');

const DATASTORE_LABEL = 'PR: Affects datastore layer';
// Labels here are excluded from codeowner assignment because the project
// owners need to review all pull requests with the label.
const LABELS_EXCLUDED_FROM_CODEOWNER_ASSIGNMENT = [
  'PR CHANGELOG: Angular Migration',
];
const CODE_OWNERS_FILE_URL =
  'https://raw.githubusercontent.com/oppia/oppia/develop/.github/CODEOWNERS';
const CHANGELOG_START = 'PR CHANGELOG';
const SUCCESS_STATUS = 204;
const THREE_MINUTES = 60 * 1000 * 3;
let MIN_BUILD_DATE = new Date();
MIN_BUILD_DATE.setDate(MIN_BUILD_DATE.getDate() - 2); // 2 days prior.
const OLD_BUILD_LABEL = "PR: don't merge - STALE BUILD";

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

const checkPrIsStale = async (pullRequest, context) => {
  const {data: lastCommit} = await context.github.repos.getCommit(
    context.repo({
      ref: pullRequest.head.sha
    })
  );

  const lastCommitDate = new Date(lastCommit.commit.author.date);
  // Commit is older than 2 days
  return (MIN_BUILD_DATE > lastCommitDate);
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
 * Gets all the open pull requests
 * @param {import('probot').Context} context
 */
const getAllOpenPullRequests = async (context) => {
  const pullRequestsResponse = await context.github.pulls.list(
    context.repo({
      per_page: 60,
      state: 'open',
    })
  );

  return pullRequestsResponse.data;
};

/**
 * Check if a pull request has been approved by all reviewers.
 *
 * @param {import('probot').Context} context
 * @param {Number} pullRequestNumber
 */
const hasPullRequestBeenApproved = async (context, pullRequestNumber) => {
  const repoSearchString = `repo:${context.payload.repository.full_name}`;
  const reviewApprovedSearchString = 'review:approved';
  const searchResult = await context.github.search.issuesAndPullRequests(
    context.repo({
      q:
        repoSearchString +
        ' ' +
        reviewApprovedSearchString +
        ' ' +
        pullRequestNumber,
    })
  );

  // If no pull request is found after the search, searchResult.data.items
  // will be an empty array, hence the request has not been approved.
  return searchResult.data.items.length > 0;
};

/**
 * Check if a pull request has changes requested from any reviewer.
 *
 * @param {import('probot').Context} context
 * @param {Number} pullRequestNumber
 */
const doesPullRequestHaveChangesRequested = async (
    context,
    pullRequestNumber
) => {
  const repoSearchString = `repo:${context.payload.repository.full_name}`;
  const reviewApprovedSearchString = 'review:changes_requested';
  const searchResult = await context.github.search.issuesAndPullRequests(
    context.repo({
      q:
        repoSearchString +
        ' ' +
        reviewApprovedSearchString +
        ' ' +
        pullRequestNumber,
    })
  );

  // If no pull request is found after the search, searchResult.data.items
  // will be an empty array, hence the request has not been approved.
  return searchResult.data.items.length > 0;
};

/**
 * Check if the user is a member of the organisation.
 *
 * @param {import('probot').Context} context
 * @param {string} username
 */
const isUserAMemberOfTheOrganisation = async (context, username) => {
  try {
    const orgName = 'oppia';
    const membershipCheckResponse = await context.github.orgs.checkMembership({
      org: orgName,
      username: username,
    });
    return membershipCheckResponse.status === SUCCESS_STATUS;
  } catch (error) {
    // The Github API returns a 404 response if the user is not a
    // member and probot throws an error for 404 responses.
    return false;
  }
};

/**
 * Check if the user is a collaborator.
 *
 * @param {import('probot').Context} context
 * @param {string} username
 */
const isUserCollaborator = async (context, username) => {
  try {
    const collaboratorResponse = await context.github.repos.checkCollaborator({
      owner: context.repo().owner,
      repo: context.repo().repo,
      username: username
    });
    return collaboratorResponse.status === SUCCESS_STATUS;
  } catch (error) {
    // The Github API returns a 404 response if the user is not a
    // collaborator and probot throws an error for 404 responses.
    return false;
  }
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
};

/**
 * This functions gets the last review of a specific type from a pull request.
 * For example, if type is CHANGES REQUESTED, this function will return
 * the last review where the state was CHANGES REQUESTED.
 *
 * @param {import('probot').Context} context
 * @param {string} type
 */
const getLastReviewOfSpecificType = async (
    context,
    type,
    pullRequestNumber
) => {
  const { data: allReviews } = await context.github.pulls.listReviews(
    context.repo({
      pull_number: pullRequestNumber,
    })
  );
  const reviewOfType = allReviews.find((review) => {
    return review.state === type;
  });

  return reviewOfType;
};

/**
 * This function pings and assigns all pending reviewers to a pull request.
 * @param {import('probot').Context} context
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 * @param {string[]} assignees
 * @param {string} comment
 */
const pingAndAssignUsers = async (context, pullRequest, assignees, comment) => {
  await context.github.issues.createComment(
    context.repo({
      issue_number: pullRequest.number,
      body: comment,
    })
  );

  await context.github.issues.addAssignees(
    context.repo({
      issue_number: pullRequest.number,
      assignees: assignees,
    })
  );
};

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

/**
 * This function gets all the open issues in a repository.
 * @param {import('probot').Context} context
 */
const getAllOpenIssues = async (context) => {
  /**
   * @type {import('probot').Octokit.IssuesListResponse}
   */
  const openIssues = [];
  const maxAmountPerPage = 100;
  let currentAmountFetched = 0;
  let currentPage = 1;
  const pullRequestProp = 'pull_request';
  do {
    // This function returns both pull requests and issues.
    const issuesResponse = await context.github.issues.listForRepo(
      context.repo({
        per_page: maxAmountPerPage,
        state: 'open',
        page: currentPage,
      })
    );

    openIssues.push(...issuesResponse.data);
    currentAmountFetched = issuesResponse.data.length;
    currentPage++;
  } while (currentAmountFetched === maxAmountPerPage);

  // Pull requests are also returned from the api, hence we need to filter
  // them out.
  return openIssues.filter((issue) => pullRequestProp in issue === false);
};

/**
 *  This function checks if a pull request has pending reviews.
 *
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const hasPendingReviews = (pullRequest) => {
  return pullRequest.requested_reviewers.length > 0;
};

/**
 * This function gets all the project cards for a repository.
 * @param {import('probot').Context} context
 */
const getAllProjectCards = async (context) => {
  const { data: allProjects } = await context.github.projects.listForRepo(
    context.repo()
  );

  /**
   * @type {import('probot').Octokit.ProjectsListCardsResponse}
   */
  const allProjectCards = [];
  // The loops need to be cloaked in an async function so that all the await
  // in the body of the loop will actually pause the execution. Whithout this,
  // the loop will exit without all the promises getting resolved.
  await (async function () {
    for (let i = 0; i < allProjects.length; i++) {
      const project = allProjects[i];
      // Get all the columns in a project. For example in oppia/oppia, the
      // columns for each project are: High Priority, Medium Priority,
      // Low Priority, Done.
      const {
        data: projectColumns,
      } = await context.github.projects.listColumns({
        project_id: project.id,
      });

      await (async function () {
        for (let j = 0; j < projectColumns.length; j++) {
          const column = projectColumns[j];
          // Get all the cards in each column. For some reason, the only way
          // to get cards in a project is through it's column.
          const { data: allCards } = await context.github.projects.listCards({
            archived_state: 'not_archived',
            column_id: column.id,
          });
          allProjectCards.push(...allCards);
        }
      })();
    }
  })();

  return allProjectCards;
};

module.exports = {
  MIN_BUILD_DATE,
  THREE_MINUTES,
  LABELS_EXCLUDED_FROM_CODEOWNER_ASSIGNMENT,
  DATASTORE_LABEL,
  OLD_BUILD_LABEL,
  getAllChangedFiles,
  getNameString,
  getNewItemsFromFileByRegex,
  hasDatastoreLabel,
  getAllOpenPullRequests,
  hasPullRequestBeenApproved,
  doesPullRequestHaveChangesRequested,
  sleep,
  getChangelogLabelFromPullRequest,
  getProjectOwnerFromLabel,
  getMainCodeOwnerfile,
  isChangelogLabel,
  isUserAMemberOfTheOrganisation,
  isUserCollaborator,
  getLastReviewOfSpecificType,
  pingAndAssignUsers,
  getUsernamesFromText,
  getAllOpenIssues,
  getAllProjectCards,
  hasPendingReviews,
  checkPrIsStale
};
