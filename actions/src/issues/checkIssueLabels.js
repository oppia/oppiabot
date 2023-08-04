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
 * @fileoverview File to handle checks when a issue is labeled.
 */

const core = require('@actions/core');
const { context, GitHub } = require('@actions/github');
const whitelist = require('../../../userWhitelist.json');
const GOOD_FIRST_LABEL = 'good first issue';
const prLabels = ['dependencies', 'stale'];

const checkLabels = async () => {
  core.info('Checking newly added label...');
  const token = core.getInput('repo-token');
  const label = context.payload.label;
  const octokit = new GitHub(token);
  const user = context.payload.sender.login;

  if (
    label.name === GOOD_FIRST_LABEL &&
    !whitelist.goodFirstIssue.includes(user)
  ) {
    core.info('Good first issue label got added by non whitelisted user.');
    await handleGoodFirstIssueLabel(octokit, user);
  } else if (prLabels.includes(label.name) || label.name.startsWith('PR')) {
    core.info('PR label got added on an issue');
    await handlePRLabel(octokit, label.name, user);
  }
};

/**
 * Handles cases when a good first issue gets added by a non whitelisted user.
 *
 * @param {import('@actions/github').GitHub} octokit
 * @param {String} user - Username of the user that added the label.
 */
const handleGoodFirstIssueLabel = async (octokit, user) => {
  const issueNumber = context.payload.issue.number;
  // Comment on the issue and ping the onboarding team lead.
  var commentBody = (
    'Hi @' + user + ', only certain users are allowed to add good ' +
    'first issue labels. Looping in @oppia/oppia-good-first-issue-labelers ' + 
    'to add the label.'
  );
  await octokit.issues.createComment(
    {
      body: commentBody,
      issue_number: issueNumber,
      owner: context.repo.owner,
      repo: context.repo.repo,
    }
  );
  // Remove the label.
  core.info('Removing the label.');
  await octokit.issues.removeLabel({
    issue_number: issueNumber,
    name: GOOD_FIRST_LABEL,
    owner: context.repo.owner,
    repo: context.repo.repo
  });
};

/**
 * Handles cases when a PR label gets added to an issue.
 *
 * @param {import('@actions/github').GitHub} octokit
 * @param {String} label - Name of label that got added.
 * @param {String} user - Username of the user that added the label.
 */
const handlePRLabel = async (octokit, label, user) => {
  const issueNumber = context.payload.issue.number;
  const linkText = 'here';
  // Add link to wiki.
  const link = linkText.link(
    'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#' +
    'labeling-issues-and-pull-requests');
  const commentBody = (
    'Hi @' + user + ', the ' + label + ' label should only be used in ' +
    'pull requests. I’m removing the label. You can learn more about ' +
    'labels ' + link + '. Thanks!'
  );
  await octokit.issues.createComment(
    {
      body: commentBody,
      issue_number: issueNumber,
      owner: context.repo.owner,
      repo: context.repo.repo,
    }
  );

  // Remove the label.
  core.info('Removing the label.');
  await octokit.issues.removeLabel({
    issue_number: issueNumber,
    name: label,
    owner: context.repo.owner,
    repo: context.repo.repo
  });
};

module.exports = {
  checkLabels,
};
