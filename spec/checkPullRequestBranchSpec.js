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

require('dotenv').config();
const { createProbot } = require('probot');
// The plugin refers to the actual app in index.js.
const oppiaBot = require('../index');
const checkWipDraftPRModule = require('../lib/checkWipDraftPR');
const scheduler = require('../lib/scheduler');
const pullRequestPayload = require('../fixtures/pullRequestPayload.json');
const apiForSheetsModule = require('../lib/apiForSheets');
const checkPullRequestLabelsModule = require('../lib/checkPullRequestLabels');
const checkPullRequestBranchModule = require('../lib/checkPullRequestBranch');
const checkPullRequestJobModule = require('../lib/checkPullRequestJob');
const checkCriticalPullRequestModule = require('../lib/checkCriticalPullRequest');

describe('Pull Request Branch Check', () => {
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
    spyOn(scheduler, 'createScheduler').and.callFake(() => {});

    // Spy on other modules that will be triggered by the payload.
    spyOn(apiForSheetsModule, 'checkClaStatus').and.callFake(() => {});
    spyOn(
      checkPullRequestLabelsModule,
      'checkChangelogLabel'
    ).and.callFake(() => {});
    spyOn(checkWipDraftPRModule, 'checkWIP').and.callFake(() => {});
    spyOn(checkPullRequestJobModule, 'checkForNewJob').and.callFake(() => {});
    spyOn(checkCriticalPullRequestModule, 'checkIfCritical').and.callFake(() => {});

    github = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.returnValue({}),
        update: jasmine.createSpy('update').and.resolveTo({}),
      },
    };

    robot = createProbot({
      id: 1,
      cert: 'test',
      githubToken: 'test',
    });

    app = robot.load(oppiaBot);
    spyOn(app, 'auth').and.resolveTo(github);
    spyOn(checkPullRequestBranchModule, 'checkBranch').and.callThrough();
  });

  describe('Invalid branch name', () => {
    describe('develop branch check', () => {
      beforeEach(async () => {
        pullRequestPayload.payload.pull_request.head.ref = 'develop';
        await app.receive(pullRequestPayload);
      });

      it('should call appropriate module', async () => {
        expect(checkPullRequestBranchModule.checkBranch).toHaveBeenCalled();
      });

      it('should create appropriate comment', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        const author = pullRequestPayload.payload.pull_request.user.login;
        const wiki = 'wiki'.link(
          'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#' +
            'instructions-for-making-a-code-change'
        );
        const commentBody =
          'Hi @' +
          author +
          ', PRs made from develop branch or from a ' +
          'branch whose name is prefixed with develop, release or test are ' +
          'not allowed. So this PR is being closed. Please make your changes ' +
          'in another branch and send in the PR. To learn more about ' +
          'contributing to Oppia, take a look at our ' +
          wiki +
          ' (Rule 1 specifically). Thanks!';
        expect(github.issues.createComment).toHaveBeenCalledWith({
          issue_number: pullRequestPayload.payload.pull_request.number,
          owner: pullRequestPayload.payload.repository.owner.login,
          repo: pullRequestPayload.payload.repository.name,
          body: commentBody,
        });
      });

      it('should close pull request', () => {
        expect(github.issues.update).toHaveBeenCalled();
        expect(github.issues.update).toHaveBeenCalledWith({
          issue_number: pullRequestPayload.payload.pull_request.number,
          owner: pullRequestPayload.payload.repository.owner.login,
          repo: pullRequestPayload.payload.repository.name,
          state: 'closed',
        });
      });
    });

    describe('release branch check', () => {
      beforeEach(async () => {
        pullRequestPayload.payload.pull_request.head.ref = 'release-2';
        await app.receive(pullRequestPayload);
      });

      it('should call appropriate module', async () => {
        expect(checkPullRequestBranchModule.checkBranch).toHaveBeenCalled();
      });

      it('should create appropriate comment', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        const author = pullRequestPayload.payload.pull_request.user.login;
        const wiki = 'wiki'.link(
          'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#' +
            'instructions-for-making-a-code-change'
        );
        const commentBody =
          'Hi @' +
          author +
          ', PRs made from develop branch or from a ' +
          'branch whose name is prefixed with develop, release or test are ' +
          'not allowed. So this PR is being closed. Please make your changes ' +
          'in another branch and send in the PR. To learn more about ' +
          'contributing to Oppia, take a look at our ' +
          wiki +
          ' (Rule 1 specifically). Thanks!';
        expect(github.issues.createComment).toHaveBeenCalledWith({
          issue_number: pullRequestPayload.payload.pull_request.number,
          owner: pullRequestPayload.payload.repository.owner.login,
          repo: pullRequestPayload.payload.repository.name,
          body: commentBody,
        });
      });

      it('should close pull request', () => {
        expect(github.issues.update).toHaveBeenCalled();
        expect(github.issues.update).toHaveBeenCalledWith({
          issue_number: pullRequestPayload.payload.pull_request.number,
          owner: pullRequestPayload.payload.repository.owner.login,
          repo: pullRequestPayload.payload.repository.name,
          state: 'closed',
        });
      });
    });

    describe('test branch check', () => {
      beforeEach(async () => {
        pullRequestPayload.payload.pull_request.head.ref = 'test-2';
        await app.receive(pullRequestPayload);
      });

      it('should call appropriate module', async () => {
        expect(checkPullRequestBranchModule.checkBranch).toHaveBeenCalled();
      });

      it('should create appropriate comment', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        const author = pullRequestPayload.payload.pull_request.user.login;
        const wiki = 'wiki'.link(
          'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#' +
            'instructions-for-making-a-code-change'
        );
        const commentBody =
          'Hi @' +
          author +
          ', PRs made from develop branch or from a ' +
          'branch whose name is prefixed with develop, release or test are ' +
          'not allowed. So this PR is being closed. Please make your changes ' +
          'in another branch and send in the PR. To learn more about ' +
          'contributing to Oppia, take a look at our ' +
          wiki +
          ' (Rule 1 specifically). Thanks!';
        expect(github.issues.createComment).toHaveBeenCalledWith({
          issue_number: pullRequestPayload.payload.pull_request.number,
          owner: pullRequestPayload.payload.repository.owner.login,
          repo: pullRequestPayload.payload.repository.name,
          body: commentBody,
        });
      });

      it('should close pull request', () => {
        expect(github.issues.update).toHaveBeenCalled();
        expect(github.issues.update).toHaveBeenCalledWith({
          issue_number: pullRequestPayload.payload.pull_request.number,
          owner: pullRequestPayload.payload.repository.owner.login,
          repo: pullRequestPayload.payload.repository.name,
          state: 'closed',
        });
      });
    });
  });

  describe('Valid branch name', () => {
    beforeEach(async () => {
      pullRequestPayload.payload.pull_request.head.ref = 'valid-branch';
      await app.receive(pullRequestPayload);
    });

    it('should call appropriate module', async () => {
      expect(checkPullRequestBranchModule.checkBranch).toHaveBeenCalled();
    });

    it('should not create comment', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not close pull request', () => {
      expect(github.issues.update).not.toHaveBeenCalled();
    });
  });
});
