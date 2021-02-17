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
const UPLOADED_MEDIA = 'user-images.githubusercontent.com';
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
          'the karma and linter checklist has not been checked, ' +
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
          if (message) {
            message +=
              'The allow edits from maintainers checklist needs to ' +
              'be ticked so that maintainers can rerun failed tests. ' +
              'Endeavour to add this by ticking on the check box. ';
          } else {
            message +=
              'the allow edits from maintainers checklist needs to ' +
              'be ticked so that maintainers can rerun failed tests. ' +
              'Endeavour to add this by ticking on the check box. ';
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
 * This function checks if the pull request's body contains the
 * checklist and returns an appropriate message if the required
 * checklist items are not checked.
 *
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */
const checkProofThatChangesAreCorrect = (pullRequest) => {
  /*
    A valid Proof that changes are correct section would look like:
    ## Proof that changes are correct

    <!--
    Add videos/screenshots of the user-facing interface to demonstrate
    that the changes made in this PR work correctly.
    -->
    ![oppiabot-test](https://user-images.githubusercontent.com/30050862/
      107972472-e970c400-6fd9-11eb-8f49-e6e2701adf1e.gif)
    (or)
    https://user-images.githubusercontent.com/30050862/
      107972497-ef66a500-6fd9-11eb-861e-da566cfeb658.mp4
      */
  const proofOfChcangesHeadingIndex = pullRequest.body.indexOf(PROOF_TEXT);

  if (proofOfChcangesHeadingIndex !== -1) {
    const nextHeadingIndex = pullRequest.body.indexOf(
      HEADING_START,
      proofOfChcangesHeadingIndex + PROOF_TEXT.length
    );

    let proofOfChangesSection = pullRequest.body.substring(
      proofOfChcangesHeadingIndex,
      nextHeadingIndex
    );

    console.log(proofOfChangesSection.includes(UPLOADED_MEDIA));

    var proofLinks = proofOfChangesSection.includes(UPLOADED_MEDIA);
    console.log(proofLinks);
    let message = '';

    if (!proofLinks){
      message +=
          'The proof that changes are correct has not been provided, ' +
          'please make sure to upload a image/video showing that the changes ' +
          'are correct. ';
      console.log(message);
    }

    return message;
  } else {
    return (
      'the body of this PR is missing the proof that changes ' +
      'are correct section, please update it to include the section.'
    );
  }
};


/**
 * This function checks that a PR follows the appropriate template and
 * comments on the PR if key parts of the template is missing.
 *
 * @param {import('probot').Context} context
 */
const checkTemplate = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;

  const explanationMessage = checkPRExplanation(pullRequest);
  const checklistMessage = checkEssentialChecklist(pullRequest);
  const proofOfChangesMessage = checkProofThatChangesAreCorrect(pullRequest);
  let commentBody = '';
  // if (explanationMessage && checklistMessage && proofOfChangesMessage) {
  //   commentBody =
  //     'Hi @' +
  //     pullRequest.user.login +
  //     ', ' +
  //     explanationMessage +
  //     '<br>Also, ' +
  //     proofOfChangesMessage.trim() +
  //     '<br>Also, ' +
  //     checklistMessage.trim() +
  //     ' Thanks!';
  // } else if (explanationMessage) {
  //   commentBody =
  //     'Hi @' +
  //     pullRequest.user.login +
  //     ', ' +
  //     explanationMessage +
  //     ' Thanks!';
  // } else if (checklistMessage) {
  //   commentBody =
  //     'Hi @' +
  //     pullRequest.user.login +
  //     ', ' +
  //     checklistMessage.trim() +
  //     ' Thanks!';
  // } else if (proofOfChangesMessage){
  //   'Hi @' +
  //     pullRequest.user.login +
  //     ', ' +
  //     proofOfChangesMessage +
  //     ' Thanks!';
  // } else {
  //   return;
  // }

  count = 1;

  commentBodybasic = commentBody =
      'Hi @' +
      pullRequest.user.login +
      ', can you complete the following:\n';

  if (explanationMessage) {
    commentBody += count.toString() +
    '. ' + explanationMessage + '\n';
    count += 1;
  }

  if (checklistMessage) {
    commentBody += count.toString() +
    '. ' + checklistMessage + '\n';
    count += 1;
  }

  if (proofOfChangesMessage) {
    commentBody += count.toString() +
    '. ' + proofOfChangesMessage + '\n';
  }

  if (commentBody === commentBodybasic){
    return;
  }

  commentBody = commentBody.trim();
  pingAndAssignUsers(
    context,
    pullRequest,
    [pullRequest.user.login],
    commentBody
  );
};

module.exports = {
  checkTemplate,
};
