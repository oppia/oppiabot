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
 * @fileoverview Handler to check that the pull request template is followed.
 */

const { swapCharInPlace } = require('./utils');
const KARMA_LINTER = 'linter/karma';

/**
 * Checks that the pull request's body contains the explanation.
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const checkPRExplanation = (pullRequest) => {
  // Restrict search to the overview section.
  const overviewText = '## Overview';
  const overviewHeadingIndex = pullRequest.body.indexOf(overviewText);

  // Checks that there is an overview.
  if (overviewHeadingIndex !== -1) {
    // Get the index of the next heading after the overview.
    const nextHeadingIndex = pullRequest.body.indexOf(
      '## ',
      overviewHeadingIndex + overviewText.length
    );

    const overviewSection = pullRequest.body.substring(
      overviewHeadingIndex,
      nextHeadingIndex
    );

    let explanation = overviewSection.split('\n').find((line) => {
      return line.startsWith('2');
    });

    const explanationText = '[Explain here what your PR does and why]';
    if (explanation.includes(explanationText)) {
      // The user has not added the explanation.
      return (
        'the body of this PR is missing the required description, ' +
        'please update the body with a description of what this PR does.'
      );
    }
    return '';
  } else {
    // There is no overview section in the body of the PR.
    return (
      'the body of this PR is missing the overview section, please ' +
      'update it to include the overview.'
    );
  }
};

/**
 * Checks that the pull request's body contains the explanation.
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const checkEssentialChecklist = (pullRequest) => {
  const checklistText = '## Essential Checklist';
  const checklistHeadingIndex = pullRequest.body.indexOf(checklistText);

  if (checklistHeadingIndex !== -1) {
    const nextHeadingIndex = pullRequest.body.indexOf(
      '## ',
      checklistHeadingIndex + checklistText.length
    );

    let checklistSection = pullRequest.body.substring(
      checklistHeadingIndex,
      nextHeadingIndex
    );
    const uncheckedItems = checklistSection.split('\n').filter((list) => {
      return list.startsWith('- [ ]');
    });

    let message = '';

    uncheckedItems.forEach((item) => {
      if (item.toLowerCase().includes(KARMA_LINTER)) {
        // Karma and linter is unchecked.

        message +=
          'The karma and linter checklist has not been checked, ' +
          'please make sure to run the frontend tests and lint tests before ' +
          'pushing. ';
      }
      if (item.toLowerCase().includes('allow edits from maintainers')) {
        if (!pullRequest.maintainer_can_modify) {
          message +=
            'The allow edits from maintainers checklist needs to ' +
            'be ticked so that maintainers can rerun failed tests. Endeavour ' +
            'to add this by ticking on the check box. ';
        }
      }
    });

    return message;
  } else {
    return (
      'The body of this PR is missing the checklist section, please ' +
      'update it to include the checklist.'
    );
  }
};

/**
 * @param {import('probot').Context} context
 */
const checkTemplate = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;

  const explanationMessage = checkPRExplanation(pullRequest);
  const checklistMessage = checkEssentialChecklist(pullRequest);
  let commentBody = '';
  if (explanationMessage && checklistMessage) {
    commentBody =
      'Hi @' +
      pullRequest.user.login +
      ', ' +
      explanationMessage +
      '<br>Also, ' +
      swapCharInPlace(
        checklistMessage,
        0,
        checklistMessage[0].toLowerCase()
      ).trim() +
      ' Thanks!';
  } else if (explanationMessage) {
    commentBody =
      'Hi @' +
      pullRequest.user.login +
      ', ' +
      swapCharInPlace(
        explanationMessage,
        0,
        explanationMessage[0].toLowerCase()
      ) +
      ' Thanks!';
  } else if (checklistMessage) {
    commentBody =
      'Hi @' +
      pullRequest.user.login +
      ', ' +
      swapCharInPlace(
        checklistMessage,
        0,
        checklistMessage[0].toLowerCase()
      ).trim() +
      ' Thanks!';
  } else {
    return;
  }

  const commentParams = context.repo({
    issue_number: pullRequest.number,
    body: commentBody,
  });
  context.github.issues.createComment(commentParams);

  const assigneeParams = context.repo({
    issue_number: pullRequest.number,
    assignees: [pullRequest.user.login],
  });
  context.github.issues.addAssignees(assigneeParams);
};

module.exports = {
  checkTemplate,
};
