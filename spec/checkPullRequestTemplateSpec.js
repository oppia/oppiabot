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
 * @fileoverview Spec for pull request template handler.
 */
require('dotenv').config();
const { createProbot } = require('probot');
const oppiaBot = require('../index');
const checkPullRequestTemplateModule =
  require('../lib/checkPullRequestTemplate');
const checkPullRequestJobModule = require('../lib/checkPullRequestJob');
const checkCronJobModule = require('../lib/checkNewCronJobs');
const apiForSheetsModule = require('../lib/apiForSheets');
const checkPullRequestLabelsModule = require('../lib/checkPullRequestLabels');
const checkPullRequestBranchModule = require('../lib/checkPullRequestBranch');
const checkCriticalPullRequestModule =
  require('../lib/checkCriticalPullRequest');
const newCodeOwnerModule = require('../lib/checkForNewCodeowner');
const scheduler = require('../lib/scheduler');
const payloadData = JSON.parse(
  JSON.stringify(require('../fixtures/pullRequestPayload.json'))
);

describe('Pull Request Template', () => {
  const bodyWithInvalidTemplate =
    '## Overview\r\n' +
    '1. This PR fixes or fixes part of #[fill_in_number_here].\r\n' +
    '2. This PR does the following: [Explain here what your PR ' +
    'does and why]\r\n\r\n' +
    '## Essential Checklist\r\n\r\n' +
    '- [ ] The PR title starts with "Fix #bugnum: ", followed by a short' +
    ', clear summary of the changes. (If this PR fixes part of an issue, ' +
    'prefix the title with "Fix part of #bugnum: ...".)\r\n' +
    '- [ ] The linter/Karma presubmit checks have passed locally on ' +
    'your machine.\r\n' +
    '- [ ] "Allow edits from maintainers" is checked. (See [here]' +
    '(https://help.github.com/en/github/collaborating-with-issues-and' +
    '-pull-requests/allowing-changes-to-a-pull-request-branch-created-' +
    'from-a-fork) for instructions on how to enable it.)\r\n  - This ' +
    'lets reviewers restart your CircleCI tests for you.\r\n' +
    "- [ ] The PR is made from a branch that's **not** called " +
    '"develop".\r\n\r\n' +
    '## Proof that changes are correct\r\n\r\n' +
    '## PR Pointers\r\n\r\n' +
    '- Oppiabot will ' +
    "notify you when you don't add a PR_CHANGELOG label.";

  const bodyWithNoOverview =
    '## Essential Checklist\r\n\r\n' +
    '- [ ] The PR title starts with "Fix #bugnum: ", followed by a short' +
    ', clear summary of the changes. (If this PR fixes part of an issue, ' +
    'prefix the title with "Fix part of #bugnum: ...".)\r\n' +
    '- [ ] The linter/Karma presubmit checks have passed locally on ' +
    'your machine.\r\n' +
    '- [ ] "Allow edits from maintainers" is checked. (See [here]' +
    '(https://help.github.com/en/github/collaborating-with-issues-and' +
    '-pull-requests/allowing-changes-to-a-pull-request-branch-created-' +
    'from-a-fork) for instructions on how to enable it.)\r\n  - This ' +
    'lets reviewers restart your CircleCI tests for you.\r\n' +
    "- [ ] The PR is made from a branch that's **not** called " +
    '"develop".\r\n\r\n' +
    '## Proof that changes are correct\r\n\r\n' +
    '## PR Pointers\r\n\r\n' +
    '- Oppiabot will ' +
    "notify you when you don't add a PR_CHANGELOG label.";

  const bodyWithNoChecklistSection =
    '## Overview\r\n' +
    '1. This PR fixes or fixes part of #[fill_in_number_here].\r\n' +
    '2. This PR does the following: [Explain here what your PR ' +
    'does and why]\r\n\r\n' +
    '## Proof that changes are correct\r\n\r\n' +
    '## PR Pointers\r\n\r\n' +
    '- Oppiabot will ' +
    "notify you when you don't add a PR_CHANGELOG label.";

  const bodyWithNoProofOfChangesSection =
  '## Overview\r\n' +
    '1. This PR fixes or fixes part of #[fill_in_number_here].\r\n' +
    '2. This PR does the following: [Explain here what your PR ' +
    'does and why]\r\n\r\n' +
    '## Essential Checklist\r\n\r\n' +
    '- [ ] The PR title starts with "Fix #bugnum: ", followed by a short' +
    ', clear summary of the changes. (If this PR fixes part of an issue, ' +
    'prefix the title with "Fix part of #bugnum: ...".)\r\n' +
    '- [ ] The linter/Karma presubmit checks have passed locally on ' +
    'your machine.\r\n' +
    '- [ ] "Allow edits from maintainers" is checked. (See [here]' +
    '(https://help.github.com/en/github/collaborating-with-issues-and' +
    '-pull-requests/allowing-changes-to-a-pull-request-branch-created-' +
    'from-a-fork) for instructions on how to enable it.)\r\n  - This ' +
    'lets reviewers restart your CircleCI tests for you.\r\n' +
    "- [ ] The PR is made from a branch that's **not** called " +
    '"develop".\r\n\r\n' +
    '## PR Pointers\r\n\r\n' +
    '- Oppiabot will ' +
    "notify you when you don't add a PR_CHANGELOG label.";

  const bodyWithExplanation =
    '## Overview\r\n' +
    '1. This PR fixes or fixes part of #[fill_in_number_here].\r\n' +
    '2. This PR does the following: This PR does a bunch of things. ' +
    '\r\n\r\n' +
    '## Essential Checklist\r\n\r\n' +
    '- [ ] The PR title starts with "Fix #bugnum: ", followed by a short' +
    ', clear summary of the changes. (If this PR fixes part of an issue, ' +
    'prefix the title with "Fix part of #bugnum: ...".)\r\n' +
    '- [ ] The linter/Karma presubmit checks have passed locally on ' +
    'your machine.\r\n' +
    '- [ ] "Allow edits from maintainers" is checked. (See [here]' +
    '(https://help.github.com/en/github/collaborating-with-issues-and' +
    '-pull-requests/allowing-changes-to-a-pull-request-branch-created-' +
    'from-a-fork) for instructions on how to enable it.)\r\n  - This ' +
    'lets reviewers restart your CircleCI tests for you.\r\n' +
    "- [ ] The PR is made from a branch that's **not** called " +
    '"develop".\r\n\r\n' +
    '## Proof that changes are correct\r\n\r\n' +
    '## PR Pointers\r\n\r\n' +
    '- Oppiabot will ' +
    "notify you when you don't add a PR_CHANGELOG label.";

  const bodyWithExplanationAndLint =
    '## Overview\r\n' +
    '1. This PR fixes or fixes part of #[fill_in_number_here].\r\n' +
    '2. This PR does the following: This PR does a bunch of things. ' +
    '\r\n\r\n' +
    '## Essential Checklist\r\n\r\n' +
    '- [ ] The PR title starts with "Fix #bugnum: ", followed by a short' +
    ', clear summary of the changes. (If this PR fixes part of an issue, ' +
    'prefix the title with "Fix part of #bugnum: ...".)\r\n' +
    '- [x] The linter/Karma presubmit checks have passed locally on ' +
    'your machine.\r\n' +
    '- [ ] "Allow edits from maintainers" is checked. (See [here]' +
    '(https://help.github.com/en/github/collaborating-with-issues-and' +
    '-pull-requests/allowing-changes-to-a-pull-request-branch-created-' +
    'from-a-fork) for instructions on how to enable it.)\r\n  - This ' +
    'lets reviewers restart your CircleCI tests for you.\r\n' +
    "- [ ] The PR is made from a branch that's **not** called " +
    '"develop".\r\n\r\n' +
    '## Proof that changes are correct\r\n\r\n' +
    '## PR Pointers\r\n\r\n' +
    '- Oppiabot will ' +
    "notify you when you don't add a PR_CHANGELOG label.";

  const bodyWithExplanationAndChecklist =
  ' ## Overview\r\n' +
    '1. This PR fixes or fixes part of #[fill_in_number_here].\r\n' +
    '2. This PR does the following: This PR does a bunch of things. ' +
    '\r\n\r\n' +
    '## Essential Checklist\r\n\r\n' +
    '- [ ] The PR title starts with "Fix #bugnum: ", followed by a short' +
    ', clear summary of the changes. (If this PR fixes part of an issue, ' +
    'prefix the title with "Fix part of #bugnum: ...".)\r\n' +
    '- [x] The linter/Karma presubmit checks have passed locally on ' +
    'your machine.\r\n' +
    '- [x] "Allow edits from maintainers" is checked. (See [here]' +
    '(https://help.github.com/en/github/collaborating-with-issues-and' +
    '-pull-requests/allowing-changes-to-a-pull-request-branch-created-' +
    'from-a-fork) for instructions on how to enable it.)\r\n  - This ' +
    'lets reviewers restart your CircleCI tests for you.\r\n' +
    "- [ ] The PR is made from a branch that's **not** called " +
    '"develop".\r\n\r\n' +
    '## Proof that changes are correct\r\n\r\n' +
    '## PR Pointers\r\n\r\n' +
    '- Oppiabot will ' +
    "notify you when you don't add a PR_CHANGELOG label.";

  const bodyWithValidChecklistButNoDescription =
    '## Overview\r\n' +
    '1. This PR fixes or fixes part of #[fill_in_number_here].\r\n' +
    '2. This PR does the following: [Explain here what your PR ' +
    'does and why]\r\n\r\n' +
    '## Essential Checklist\r\n\r\n' +
    '- [ ] The PR title starts with "Fix #bugnum: ", followed by a short' +
    ', clear summary of the changes. (If this PR fixes part of an issue, ' +
    'prefix the title with "Fix part of #bugnum: ...".)\r\n' +
    '- [x] The linter/Karma presubmit checks have passed locally on ' +
    'your machine.\r\n' +
    '- [x] "Allow edits from maintainers" is checked. (See [here]' +
    '(https://help.github.com/en/github/collaborating-with-issues-and' +
    '-pull-requests/allowing-changes-to-a-pull-request-branch-created-' +
    'from-a-fork) for instructions on how to enable it.)\r\n  - This ' +
    'lets reviewers restart your CircleCI tests for you.\r\n' +
    "- [ ] The PR is made from a branch that's **not** called " +
    '"develop".\r\n\r\n' +
    '## Proof that changes are correct\r\n\r\n' +
    '## PR Pointers\r\n\r\n' +
    '- Oppiabot will ' +
    "notify you when you don't add a PR_CHANGELOG label.";

  const validBody =
    '## Overview\r\n' +
    '1. This PR fixes or fixes part of #[fill_in_number_here].\r\n' +
    '2. This PR does the following: This PR does a bunch of things. ' +
    '\r\n\r\n' +
    '## Essential Checklist\r\n\r\n' +
    '- [ ] The PR title starts with "Fix #bugnum: ", followed by a short' +
    ', clear summary of the changes. (If this PR fixes part of an issue, ' +
    'prefix the title with "Fix part of #bugnum: ...".)\r\n' +
    '- [x] The linter/Karma presubmit checks have passed locally on ' +
    'your machine.\r\n' +
    '- [x] "Allow edits from maintainers" is checked. (See [here]' +
    '(https://help.github.com/en/github/collaborating-with-issues-and' +
    '-pull-requests/allowing-changes-to-a-pull-request-branch-created-' +
    'from-a-fork) for instructions on how to enable it.)\r\n  - This ' +
    'lets reviewers restart your CircleCI tests for you.\r\n' +
    "- [ ] The PR is made from a branch that's **not** called " +
    '"develop".\r\n\r\n' +
    '## Proof that changes are correct\r\n\r\n' +
    'https://user-images.githubusercontent.com/30050862/test.mp4' +
    '## PR Pointers\r\n\r\n' +
    '- Oppiabot will ' +
    "notify you when you don't add a PR_CHANGELOG label.";

  const incompleteOverviewSection =
    'The body of this PR is missing the required description, ' +
    'please update the body with a description of what this PR does.';

  const absentOverviewSection =
    'The body of this PR is missing the overview section, please ' +
    'update it to include the overview.';

  const incompleteChecklistSection = {
    karma_linter: 'The karma and linter checklist has not been checked, ' +
      'please make sure to run the frontend tests and lint tests before ' +
      'pushing. ',
    maintainers_text: 'The allow edits from maintainers checklist needs to ' +
      'be ticked so that maintainers can rerun failed tests. ' +
      'Endeavour to add this by ticking on the check box. '
  };

  const absentChecklistSection =
    'The body of this PR is missing the checklist section, please ' +
    'update it to include the checklist.';

  const incompleteProofOfChangesSection =
    'The proof that changes are correct has not been provided, ' +
    'please make sure to upload a image/video showing that the changes ' +
    'are correct. Or include a sentence saying "No proof of changes ' +
    'needed because" and the reason why proof of changes ' +
    'cannot be provided.';

  const absentProofOfChangesSection =
    'The body of this PR is missing the proof that changes ' +
    'are correct section, please update it to include the section.';

  /**
   * @type {import('probot').Probot} robot
   */
  let robot;

  /**
   * @type {import('probot').Octokit} github
   */
  let github;

  /**
   * @type {import('probot').Application} app
   */
  let app;

  beforeEach(() => {
    spyOn(scheduler, 'createScheduler').and.callFake(() => { });

    github = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.returnValue({}),
        addAssignees: jasmine.createSpy('addAssignees').and.returnValue({}),
      },
    };

    robot = createProbot({
      id: 1,
      cert: 'test',
      githubToken: 'test',
    });

    app = robot.load(oppiaBot);
    spyOn(app, 'auth').and.resolveTo(github);
    spyOn(
      checkPullRequestJobModule, 'checkForModificationsToFiles'
    ).and.callFake(() => { });
    spyOn(checkCronJobModule, 'checkForNewCronJob').and.callFake(() => { });
    spyOn(apiForSheetsModule, 'checkClaStatus').and.callFake(() => { });
    spyOn(
      checkCriticalPullRequestModule,
      'checkIfPRAffectsDatastoreLayer'
    ).and.callFake(() => { });
    spyOn(checkPullRequestBranchModule, 'checkBranch').and.callFake(() => { });
    spyOn(checkPullRequestTemplateModule, 'checkTemplate').and.callThrough();
    spyOn(newCodeOwnerModule, 'checkForNewCodeowner').and.callFake(() => { });
  });

  describe('when pull request with invalid template is created', () => {
    beforeEach(async () => {
      payloadData.payload.pull_request.body = bodyWithInvalidTemplate;
      payloadData.payload.pull_request.maintainer_can_modify = false;
      await robot.receive(payloadData);
    });

    it('should check the template', () => {
      expect(checkPullRequestTemplateModule.checkTemplate).toHaveBeenCalled();
    });

    it('should ping PR author', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        body:
          'Hi @' +
          payloadData.payload.pull_request.user.login +
          ', can you complete the following:' + '\n' +
          '1. ' + incompleteOverviewSection + '\n' +
          '2. ' + incompleteChecklistSection.karma_linter +
          incompleteChecklistSection.maintainers_text + '\n' +
          '3. ' + incompleteProofOfChangesSection + '\nThanks!',
      });
    });

    it('should assign PR author', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        assignees: [payloadData.payload.pull_request.user.login],
      });
    });
  });

  describe('when pull request with no overview is created', () => {
    beforeEach(async () => {
      payloadData.payload.pull_request.body = bodyWithNoOverview;
      payloadData.payload.pull_request.maintainer_can_modify = false;
      await robot.receive(payloadData);
    });

    it('should check the template', () => {
      expect(checkPullRequestTemplateModule.checkTemplate).toHaveBeenCalled();
    });

    it('should ping PR author', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        body:
          'Hi @' +
          payloadData.payload.pull_request.user.login +
          ', can you complete the following:' + '\n' +
          '1. ' + absentOverviewSection + '\n' +
          '2. ' + incompleteChecklistSection.karma_linter +
          incompleteChecklistSection.maintainers_text + '\n' +
          '3. ' + incompleteProofOfChangesSection + '\nThanks!',
      });
    });

    it('should assign PR author', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        assignees: [payloadData.payload.pull_request.user.login],
      });
    });
  });

  describe('when pull request with no checklist section is created', () => {
    beforeEach(async () => {
      payloadData.payload.pull_request.body = bodyWithNoChecklistSection;
      payloadData.payload.pull_request.maintainer_can_modify = false;
      await robot.receive(payloadData);
    });

    it('should check the template', () => {
      expect(checkPullRequestTemplateModule.checkTemplate).toHaveBeenCalled();
    });

    it('should ping PR author', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        body:
        'Hi @' +
        payloadData.payload.pull_request.user.login +
        ', can you complete the following:' + '\n' +
        '1. ' + incompleteOverviewSection + '\n' +
        '2. ' + absentChecklistSection +
        '\n' + '3. ' + incompleteProofOfChangesSection + '\nThanks!',
      });
    });

    it('should assign PR author', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        assignees: [payloadData.payload.pull_request.user.login],
      });
    });
  });

  describe('when pull request with no Proof of changes section ' +
  'is created', () => {
    beforeEach(async () => {
      payloadData.payload.pull_request.body = bodyWithNoProofOfChangesSection;
      payloadData.payload.pull_request.maintainer_can_modify = false;
      await robot.receive(payloadData);
    });

    it('should check the template', () => {
      expect(checkPullRequestTemplateModule.checkTemplate).toHaveBeenCalled();
    });

    it('should ping PR author', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        body:
        'Hi @' +
        payloadData.payload.pull_request.user.login +
        ', can you complete the following:' + '\n' +
        '1. ' + incompleteOverviewSection + '\n' +
        '2. ' + incompleteChecklistSection.karma_linter +
        incompleteChecklistSection.maintainers_text + '\n' +
        '3. ' + absentProofOfChangesSection + '\nThanks!',
      });
    });

    it('should assign PR author', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        assignees: [payloadData.payload.pull_request.user.login],
      });
    });
  });

  describe('when linter/karma checks aren\'t checked.', () => {
    beforeEach(async () => {
      payloadData.payload.pull_request.body = bodyWithExplanation;
      payloadData.payload.pull_request.maintainer_can_modify = false;
      await robot.receive(payloadData);
    });

    it('should check the template', () => {
      expect(checkPullRequestTemplateModule.checkTemplate).toHaveBeenCalled();
    });

    it('should ping PR author', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        body:
        'Hi @' +
        payloadData.payload.pull_request.user.login +
        ', can you complete the following:' + '\n' +
        '1. ' + incompleteChecklistSection.karma_linter +
        incompleteChecklistSection.maintainers_text + '\n' +
        '2. ' + incompleteProofOfChangesSection + '\nThanks!',
      });
    });

    it('should assign PR author', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        assignees: [payloadData.payload.pull_request.user.login],
      });
    });
  });

  describe('when pull request contains description and filled karma/lint check',
    () => {
      beforeEach(async () => {
        payloadData.payload.pull_request.body = bodyWithExplanationAndLint;
        payloadData.payload.pull_request.maintainer_can_modify = false;
        await robot.receive(payloadData);
      });

      it('should check the template', () => {
        expect(checkPullRequestTemplateModule.checkTemplate).toHaveBeenCalled();
      });

      it('should ping PR author', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          issue_number: payloadData.payload.pull_request.number,
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          body:
          'Hi @' +
          payloadData.payload.pull_request.user.login +
          ', can you complete the following:' + '\n' +
          '1. ' + incompleteChecklistSection.maintainers_text +
          '\n' + '2. ' + incompleteProofOfChangesSection + '\nThanks!',
        });
      });

      it('should assign PR author', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          issue_number: payloadData.payload.pull_request.number,
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          assignees: [payloadData.payload.pull_request.user.login],
        });
      });
    });

  describe('when pull request contains description and filled Checklist',
    () => {
      beforeEach(async () => {
        payloadData.payload.pull_request.body = bodyWithExplanationAndChecklist;
        payloadData.payload.pull_request.maintainer_can_modify = false;
        await robot.receive(payloadData);
      });

      it('should check the template', () => {
        expect(checkPullRequestTemplateModule.checkTemplate).toHaveBeenCalled();
      });

      it('should ping PR author', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          issue_number: payloadData.payload.pull_request.number,
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          body:
          'Hi @' +
          payloadData.payload.pull_request.user.login +
          ', can you complete the following:' + '\n' +
          '1. ' + incompleteProofOfChangesSection + '\nThanks!',
        });
      });

      it('should assign PR author', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          issue_number: payloadData.payload.pull_request.number,
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          assignees: [payloadData.payload.pull_request.user.login],
        });
      });
    });

  describe('when pull request contains filled checklist without description',
    () => {
      beforeEach(async () => {
        payloadData.payload.pull_request.body =
          bodyWithValidChecklistButNoDescription;
        payloadData.payload.pull_request.maintainer_can_modify = true;
        await robot.receive(payloadData);
      });

      it('should check the template', () => {
        expect(checkPullRequestTemplateModule.checkTemplate).toHaveBeenCalled();
      });

      it('should ping PR author', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          issue_number: payloadData.payload.pull_request.number,
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          body:
          'Hi @' +
          payloadData.payload.pull_request.user.login +
          ', can you complete the following:' + '\n' +
          '1. ' + incompleteOverviewSection +
          '\n' + '2. ' + incompleteProofOfChangesSection + '\nThanks!',
        });
      });

      it('should assign PR author', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          issue_number: payloadData.payload.pull_request.number,
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          assignees: [payloadData.payload.pull_request.user.login],
        });
      });
    });

  describe('when pull request contains a valid body', () => {
    beforeEach(async () => {
      payloadData.payload.pull_request.body = validBody;
      payloadData.payload.pull_request.maintainer_can_modify = true;
      await robot.receive(payloadData);
    });

    it('should check the template', () => {
      expect(checkPullRequestTemplateModule.checkTemplate).toHaveBeenCalled();
    });

    it('should not ping PR author', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not assign PR author', () => {
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
    });
  });

  describe('when pull request head and base are from the same repository.' +
  'and inter/karma checks aren\'t checked.', () => {
    beforeEach(async () => {
      payloadData.payload.pull_request.head.repo.full_name = 'oppia/oppia';
      payloadData.payload.pull_request.body = bodyWithExplanation;
      payloadData.payload.pull_request.maintainer_can_modify = false;
      await robot.receive(payloadData);
    });

    it('should check the template', () => {
      expect(checkPullRequestTemplateModule.checkTemplate).toHaveBeenCalled();
    });

    it('should not comment about maintainers checklist', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        body:
        'Hi @' +
        payloadData.payload.pull_request.user.login +
        ', can you complete the following:' + '\n' +
        '1. ' + incompleteChecklistSection.karma_linter +
        '\n' + '2. ' + incompleteProofOfChangesSection + '\nThanks!',
      });
    });
  });

  describe('testing generateComment function with bodyWithInvalidTemplate',
    () => {
      it('should return comment for bodyWithInvalidTemplate', () => {
        const payloadData = JSON.parse(
          JSON.stringify(require('../fixtures/pullRequestPayload.json'))
        );
        payloadData.payload.pull_request.body = bodyWithInvalidTemplate;
        payloadData.payload.pull_request.maintainer_can_modify = false;
        spyOn(checkPullRequestTemplateModule, 'generateComment')
          .and.callThrough();
        expect(
          checkPullRequestTemplateModule.generateComment(
            payloadData.payload.pull_request)).toBe(
          'Hi @' +
          payloadData.payload.pull_request.user.login +
          ', can you complete the following:' + '\n' +
          '1. ' + incompleteOverviewSection + '\n' +
          '2. ' + incompleteChecklistSection.karma_linter +
          incompleteChecklistSection.maintainers_text + '\n' +
          '3. ' + incompleteProofOfChangesSection + '\nThanks!');
      });
    });

  describe('testing generateComment function with bodyWithInvalidTemplate',
    () => {
      it('should return comment for bodyWithInvalidTemplate', () => {
        const payloadData = JSON.parse(
          JSON.stringify(require('../fixtures/pullRequestPayload.json'))
        );
        payloadData.payload.pull_request.body = bodyWithNoOverview;
        payloadData.payload.pull_request.maintainer_can_modify = false;
        spyOn(checkPullRequestTemplateModule, 'generateComment')
          .and.callThrough();
        expect(
          checkPullRequestTemplateModule.generateComment(
            payloadData.payload.pull_request)).toBe(
          'Hi @' +
          payloadData.payload.pull_request.user.login +
          ', can you complete the following:' + '\n' +
          '1. ' + absentOverviewSection + '\n' +
          '2. ' + incompleteChecklistSection.karma_linter +
          incompleteChecklistSection.maintainers_text + '\n' +
          '3. ' + incompleteProofOfChangesSection + '\nThanks!');
      });
    });
});
