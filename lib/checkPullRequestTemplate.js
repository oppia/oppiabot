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

const { pingAndAssignUsers } = require('./utils');

/**
 * @fileoverview Handler to check that the pull request template is followed.
 */

const KARMA_LINTER = 'linter/karma';
const EXPLANATION_TEXT = '[Explain here what your PR does and why]';
const CHECKLIST_TEXT = '## Essential Checklist';
const PROOF_TEXT = '## Proof that changes are correct';
const UPLOADED_MEDIA_TEXT = 'http';
const PROOF_UNAVAILABLE_REGEX =
  /No\s*proof\s*of\s*changes\s*needed\s*because/mgi;
// Add the "\r\n" in the regex for every new line.
const PROOF_HTML_COMMENT = /<!--\r\n.*\r\n.*\r\n-->/;
const EDITS_FROM_MAINTAINERS_TEXT = 'allow edits from maintainers';
const UNCHECKED_CHECKLIST = '- [ ]';
const EXPLANATION_START = '2';
const HEADING_START = '## ';

/**
 * This function checks if the pull request's body contains the explanation
 * for the pull request, and returns an appropriate message if
 * the there is no explanation.
 *
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
      HEADING_START,
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
        'The body of this PR is missing the required description, ' +
        'please update the body with a description of what this PR does.'
      );
    }
    return '';
  } else {
    // There is no overview section in the body of the PR.
    return (
      'The body of this PR is missing the overview section, please ' +
      'update it to include the overview.'
    );
  }
};

/**
 * This function checks if the pull request's body contains the
 * checklist and returns an appropriate message if the required
 * checklist items are not checked.
 *
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
    - [x] The PR is made from a branch that's **not** called
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
      HEADING_START,
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
          'The karma and linter checklist has not been checked, ' +
          'please make sure to run the frontend tests and lint tests before ' +
          'pushing. ';
      }
      // Check if edits from maintainers check item is unchecked.
      if (item.toLowerCase().includes(EDITS_FROM_MAINTAINERS_TEXT)) {
        // Check if maintainer can actually modify the PR. This is because
        // it is possible for the maintainers to be able to modify the PR
        // but the PR author forgot to check it in the description.
        const isPrFromFork =
          pullRequest.head.repo.full_name === pullRequest.base.repo.full_name;
        if (!pullRequest.maintainer_can_modify && !isPrFromFork) {
          message +=
            'The allow edits from maintainers checklist needs to ' +
            'be ticked so that maintainers can rerun failed tests. ' +
            'Endeavour to add this by ticking on the check box. ';
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
 * This function checks if the pull request's body contains the
 * proof of changes and returns an appropriate message if the required
 * proofs are not provided.
 *
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const checkProofOfChanges = (pullRequest) => {
  /*
    A valid 'Proof that changes are correct' section would either:
      1. Contain a link to some image or video that contains the proof.
        ## Proof that changes are correct

        <!--
        Add videos/screenshots of the user-facing interface to demonstrate
        that the changes made in this PR work correctly.
        -->
        https://user-images.githubusercontent.com/30050862/test.mp4
      2. Contain a text saying 'No proof of changes needed because …'
        ## Proof that changes are correct

        <!--
        Add videos/screenshots of the user-facing interface to demonstrate
        that the changes made in this PR work correctly.
        -->
        No proof of changes needed because {{reason}}.
  */
  const proofOfChangesHeadingIndex = pullRequest.body.indexOf(PROOF_TEXT);

  if (proofOfChangesHeadingIndex === -1) {
    return (
      'The body of this PR is missing the proof that changes ' +
      'are correct section, please update it to include the section.'
    );
  }

  const nextHeadingIndex = pullRequest.body.indexOf(
    HEADING_START,
    proofOfChangesHeadingIndex + PROOF_TEXT.length
  );

  let proofOfChangesSection = pullRequest.body.substring(
    proofOfChangesHeadingIndex,
    nextHeadingIndex
  );

  const proofIsNotPossible = proofOfChangesSection.replace(
    PROOF_HTML_COMMENT, ''
  ).match(PROOF_UNAVAILABLE_REGEX);

  const proofLinks = proofOfChangesSection.includes(UPLOADED_MEDIA_TEXT);

  // Check if there are images/videos added in the section.
  if (!proofLinks && !proofIsNotPossible) {
    return (
      'The proof that changes are correct has not been provided, ' +
      'please make sure to upload a image/video showing that the changes ' +
      'are correct. Or include a sentence saying "No proof of changes ' +
      'needed because" and the reason why proof of changes ' +
      'cannot be provided.'
    );
  }
  return '';
};

/**
 * This function checks that a PR follows the appropriate template and
 * comments on the PR if key parts of the template is missing.
 *
 * @param {import('probot').Context} context
 */
const generateComment = (pullRequest) => {
  const explanationMessage = checkPRExplanation(pullRequest);
  const checklistMessage = checkEssentialChecklist(pullRequest);
  const proofOfChangesMessage = checkProofOfChanges(pullRequest);

  let count = 1;
  let commentBody = (
    'Hi @' + pullRequest.user.login + ', can you complete the following:\n');

  if (explanationMessage) {
    commentBody += count + '. ' + explanationMessage + '\n';
    count += 1;
  }

  if (checklistMessage) {
    commentBody += count + '. ' + checklistMessage + '\n';
    count += 1;
  }

  if (proofOfChangesMessage) {
    commentBody += count + '. ' + proofOfChangesMessage + '\n';
    count += 1;
  }

  // If there is no reason to produce the message do not return anything.
  if (count === 1) {
    return;
  }

  commentBody += 'Thanks!';
  return commentBody.trim();
};


/**
 * This function creates comments in the issue.
 *
 * @param {import('probot').Context} context
 */
const checkTemplate = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;
  const commentBody = generateComment(pullRequest);

  if (!commentBody) {
    return;
  }

  pingAndAssignUsers(
    context,
    pullRequest,
    [pullRequest.user.login],
    commentBody
  );
};

module.exports = {
  checkTemplate,
  generateComment,
};
