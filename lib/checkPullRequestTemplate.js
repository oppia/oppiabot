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
const EXPLANATION_TEXT = '[Explain here what your PR does and why]';
const CHECKLIST_TEXT = '## Essential Checklist';
const EDITS_FROM_MAINTAINERS_TEXT = 'allow edits from maintainers';
const UNCHECKED_CHECKLIST = '- [ ]';
const EXPLANATION_START = '2';

/**
 * Checks that the pull request's body contains the explanation.
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const checkPRExplanation = (pullRequest) => {
  /*
    A valid overview section should look like:
    ## Overview
    1. This PR fixes or fixes part of #[fill_in_number_here].
    2. This PR does the following: This PR does a bunch of things.

    An invalid overview section would look like:
    ## Overview
    1. This PR fixes or fixes part of #[fill_in_number_here].
    2. This PR does the following: [Explain here what your PR does and why].
  */

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

    // The overview section is the section between the overview heading
    // and another heading (usually the essential checklist heading).
    const overviewSection = pullRequest.body.substring(
      overviewHeadingIndex,
      nextHeadingIndex
    );

    // The PR explanaion is the second item in the overview section hence,
    // should start with "2".
    let explanation = overviewSection.split('\n').find((line) => {
      return line.startsWith(EXPLANATION_START);
    });

    if (explanation.includes(EXPLANATION_TEXT)) {
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
  /*
    A valid checklist section would look like:
    ## Essential Checklist
    - [ ] The PR title starts with "Fix #bugnum: ", followed by a short
    , clear summary of the changes. (If this PR fixes part of an issue,
    prefix the title with "Fix part of #bugnum: ...".)
    - [x] The linter/Karma presubmit checks have passed locally on
    your machine.' +
    - [x] "Allow edits from maintainers" is checked. (See [here]
    (https://help.github.com/en/github/collaborating-with-issues-and
    -pull-requests/allowing-changes-to-a-pull-request-branch-created-
    from-a-fork) for instructions on how to enable it.)  - This
    lets reviewers restart your CircleCI tests for you.
    - [ ] The PR is made from a branch that's **not** called
    "develop".

    An invalid checklist section would look like:
    ## Essential Checklist
    - [ ] The PR title starts with "Fix #bugnum: ", followed by a short
    , clear summary of the changes. (If this PR fixes part of an issue,
    prefix the title with "Fix part of #bugnum: ...".)
    - [ ] The linter/Karma presubmit checks have passed locally on
    your machine.' +
    - [ ] "Allow edits from maintainers" is checked. (See [here]
    (https://help.github.com/en/github/collaborating-with-issues-and
    -pull-requests/allowing-changes-to-a-pull-request-branch-created-
    from-a-fork) for instructions on how to enable it.)  - This
    lets reviewers restart your CircleCI tests for you.
    - [ ] The PR is made from a branch that's **not** called
    "develop".
  */
  const checklistHeadingIndex = pullRequest.body.indexOf(CHECKLIST_TEXT);

  if (checklistHeadingIndex !== -1) {
    const nextHeadingIndex = pullRequest.body.indexOf(
      '## ',
      checklistHeadingIndex + CHECKLIST_TEXT.length
    );

    let checklistSection = pullRequest.body.substring(
      checklistHeadingIndex,
      nextHeadingIndex
    );

    // Get all unchecked items: they should start with "-[ ]".
    const uncheckedItems = checklistSection.split('\n').filter((list) => {
      return list.startsWith(UNCHECKED_CHECKLIST);
    });

    let message = '';

    uncheckedItems.forEach((item) => {
      // Check if karma/linter check item is unchecked.
      if (item.toLowerCase().includes(KARMA_LINTER)) {
        // Karma and linter is unchecked.

        message +=
          'the karma and linter checklist has not been checked, ' +
          'please make sure to run the frontend tests and lint tests before ' +
          'pushing. ';
      }
      // Check if edits from maintainers check item is unchecked.
      if (item.toLowerCase().includes(EDITS_FROM_MAINTAINERS_TEXT)) {
        // Check if maintainer can actually modify the PR. This is because
        // it is possible for the maintainers to be able to modify the PR
        // but the PR author forgot to check it in the description.
        if (!pullRequest.maintainer_can_modify) {
          if (message) {
            message +=
              'The allow edits from maintainers checklist needs to ' +
              'be ticked so that maintainers can rerun failed tests. Endeavour ' +
              'to add this by ticking on the check box. ';
          } else {
            message +=
              'the allow edits from maintainers checklist needs to ' +
              'be ticked so that maintainers can rerun failed tests. Endeavour ' +
              'to add this by ticking on the check box. ';
          }
        }
      }
    });

    return message;
  } else {
    return (
      'the body of this PR is missing the checklist section, please ' +
      'update it to include the checklist.'
    );
  }
};

/**
 * Check that a PR has appropriate template.
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
      checklistMessage.trim() +
      ' Thanks!';
  } else if (explanationMessage) {
    commentBody =
      'Hi @' +
      pullRequest.user.login +
      ', ' +
      explanationMessage +
      ' Thanks!';
  } else if (checklistMessage) {
    commentBody =
      'Hi @' +
      pullRequest.user.login +
      ', ' +
      checklistMessage.trim() +
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
