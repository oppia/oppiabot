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
const constants = require('../constants');
const apiForSheetsModule = require('../lib/apiForSheets');
const checkPullRequestLabelsModule = require('../lib/checkPullRequestLabels');
const checkPullRequestBranchModule = require('../lib/checkPullRequestBranch');
const scheduler = require('../lib/scheduler');
const pullRequestPayload = JSON.parse(
  JSON.stringify(require('../fixtures/pullRequestPayload.json')));
const commitsData = JSON.parse(
  JSON.stringify(require('../fixtures/commits.json')));
const checkPullRequestJobModule = require('../lib/checkPullRequestJob');
const checkCriticalPullRequestModule =
  require('../lib/checkCriticalPullRequest');
const checkPullRequestTemplateModule =
  require('../lib/checkPullRequestTemplate');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

describe('Api For Sheets Module', () => {
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

  beforeEach(function (done) {
    spyOn(scheduler, 'createScheduler').and.callFake(() => { });
    spyOn(
      checkPullRequestJobModule, 'checkForModificationsToFiles'
    ).and.callFake(() => { });
    spyOn(checkPullRequestBranchModule, 'checkBranch').and.callFake(() => { });
    spyOn(checkCriticalPullRequestModule, 'checkIfPRAffectsDatastoreLayer')
      .and.callFake(() => { });
    spyOn(checkPullRequestTemplateModule, 'checkTemplate')
      .and.callFake(() => { });

    github = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.returnValue({
          params: {
            number: 5139,
            owner: 'oppia',
            repo: 'oppia',
            body:
              'Hi! @tester7777. Welcome to Oppia! ' +
              'Please could you follow the instructions' +
              '<a href="https://github.com/oppia/oppia/wiki/' +
              'Contributing-code-to-Oppia#setting-things-up">here</a>' +
              "to get started ? You'll need to do this before" +
              'we can accept your PR. Thanks!',
          },
        }),
        update: jasmine.createSpy('update').and.resolveTo({}),
      },
      pulls: {
        listCommits: jasmine.createSpy('listCommits').and.returnValue({
          data: commitsData
        }),
      },
    };

    robot = createProbot({
      id: 1,
      cert: 'test',
      githubToken: 'test',
    });

    app = robot.load(oppiaBot);
    spyOn(app, 'auth').and.resolveTo(github);
    // Mock google auth
    Object.setPrototypeOf(OAuth2Client, function () {
      return {};
    });
    done();
  });

  describe('cla check without any errors', () => {
    beforeEach(function (done) {
      spyOn(apiForSheetsModule, 'checkClaStatus').and.callThrough();
      spyOn(apiForSheetsModule, 'authorize').and.callThrough({});
      spyOn(apiForSheetsModule, 'checkClaSheet').and.callThrough();
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.callFake(async (obj, cb) => {
              await cb(null, {
                data: {
                  values: [['test']]
                },
              });
            }),
          },
        },
      });
      robot.receive(pullRequestPayload);
      done();
    });

    it('should call other checks', () => {
      expect(checkPullRequestBranchModule.checkBranch).toHaveBeenCalled();
      expect(
        checkPullRequestJobModule.checkForModificationsToFiles
      ).toHaveBeenCalled();
    });

    it('should be called for the given payload', () => {
      expect(apiForSheetsModule.checkClaStatus).toHaveBeenCalled();
    });

    it('should be called once for the given payload', () => {
      expect(apiForSheetsModule.checkClaStatus.calls.count()).toEqual(1);
    });

    it('should be called with one argument for the given payload', () => {
      expect(apiForSheetsModule.checkClaStatus.calls.argsFor(0).length).toEqual(
        1
      );
    });

    it('should be called with the correct username for the given payload',
      () => {
        const context = apiForSheetsModule.checkClaStatus.calls.argsFor(0)[0];
        expect(context.payload.pull_request.user.login).toEqual('testuser7777');
      });

    it('should call authorize', () => {
      expect(apiForSheetsModule.authorize).toHaveBeenCalled();
    });

    it('should call authorize once', () => {
      expect(apiForSheetsModule.authorize.calls.count()).toEqual(1);
    });

    it('should call authorize with one argument', () => {
      expect(apiForSheetsModule.authorize.calls.argsFor(0).length).toEqual(1);
    });

    it('should call checkClaSheet', () => {
      expect(apiForSheetsModule.checkClaSheet).toHaveBeenCalled();
    });

    it('should call checkClaSheet once', () => {
      expect(apiForSheetsModule.checkClaSheet.calls.count()).toEqual(1);
    });

    it('should call checkClaSheet with one argument', () => {
      expect(apiForSheetsModule.checkClaSheet.calls.argsFor(0).length).toEqual(
        1
      );
    });
  });

  describe('cla check with error in fetching data from sheets', () => {
    beforeEach((done) => {
      spyOn(apiForSheetsModule, 'checkClaStatus').and.callThrough();
      spyOn(apiForSheetsModule, 'authorize').and.callFake(() => ({}));
      spyOn(apiForSheetsModule, 'checkClaSheet').and.callThrough();
      spyOn(apiForSheetsModule, 'generateOutput').and.callThrough();
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.callFake(async (obj, cb) => {
              // Throw a mock error while accessing sheets.
              await cb(true, { values: [['test']] });
            }),
          },
        },
      });
      robot.receive(pullRequestPayload);
      done();
    });

    it('should be called for the given payload', () => {
      expect(apiForSheetsModule.checkClaStatus).toHaveBeenCalled();
      expect(apiForSheetsModule.authorize).toHaveBeenCalled();
      expect(apiForSheetsModule.checkClaSheet).toHaveBeenCalled();
    });

    it('should not generate output', () => {
      expect(apiForSheetsModule.generateOutput).not.toHaveBeenCalled();
    });
  });

  describe('output generation', () => {
    const claData = [['abp'], ['kevinlee']];
    beforeEach(function (done) {
      spyOn(apiForSheetsModule, 'checkClaStatus').and.callThrough();
      spyOn(apiForSheetsModule, 'authorize').and.callFake(() => ({}));
      spyOn(apiForSheetsModule, 'checkClaSheet').and.callFake(() => { });
      robot.receive(pullRequestPayload);
      done();
    });
    it('should close the PR if cla is not signed', async () => {
      await apiForSheetsModule.generateOutput(
        claData,
        pullRequestPayload.payload.pull_request.number,
        pullRequestPayload.payload.pull_request
      );
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.update).toHaveBeenCalledWith({
        issue_number: pullRequestPayload.payload.pull_request.number,
        owner: pullRequestPayload.payload.repository.owner.login,
        repo: pullRequestPayload.payload.repository.name,
        state: 'closed',
      });
    });

    it('should not close the PR if all users have signed cla', async () => {
      // Add username to CLA sheet.
      await apiForSheetsModule.generateOutput(
        [...claData, ['testuser7777'], ['testuser7778']],
        pullRequestPayload.payload.pull_request.number,
        pullRequestPayload.payload.pull_request
      );
      expect(github.issues.createComment).not.toHaveBeenCalled();
      expect(github.issues.update).not.toHaveBeenCalled();
    });

    it('should close the PR if atleast one user has not signed cla and' +
    ' pull request is at oppia repository',
    async () => {
      // Add username to CLA sheet.
      await apiForSheetsModule.generateOutput(
        [...claData, ['testuser7777']],
        pullRequestPayload.payload.pull_request.number,
        pullRequestPayload.payload.pull_request,
        pullRequestPayload.payload.repository.name
      );

      var linkText = 'here';
      var linkResult = linkText.link(
        'https://github.com/oppia/oppia/wiki/Contributing-code-to-' +
          'Oppia#setting-things-up'
      );

      expect(github.issues.createComment).toHaveBeenCalledWith({
        owner: pullRequestPayload.payload.repository.owner.login,
        repo: pullRequestPayload.payload.repository.name,
        number: pullRequestPayload.payload.pull_request.number,
        body: 'Hi! ' + '@testuser7778,' +
        ' Welcome to Oppia! Please could you follow the instructions ' +
        linkResult + ' to get started ? You\'ll need to do this' +
        ' before we can accept your PR. I am closing this PR  for' +
        ' now. Feel free to re-open it once you are done the' +
        ' above instructions. Thanks!',
      });
      expect(github.issues.update).toHaveBeenCalledWith({
        issue_number: pullRequestPayload.payload.pull_request.number,
        owner: pullRequestPayload.payload.repository.owner.login,
        repo: pullRequestPayload.payload.repository.name,
        state: 'closed',
      });
    });

    describe('when pull request created at oppia-android repository', () => {
      beforeEach(function (done) {
        pullRequestPayload.payload.repository.name = 'oppia-android';
        done();
      });

      afterEach(function (done) {
        pullRequestPayload.payload.repository.name = 'oppia';
        done();
      });

      it('should close the PR if atleast one user has not signed cla',
        async () => {
        // Add username to CLA sheet.
          await apiForSheetsModule.generateOutput(
            [...claData, ['testuser7777']],
            pullRequestPayload.payload.pull_request.number,
            pullRequestPayload.payload.pull_request,
            pullRequestPayload.payload.repository.name
          );

          var oppiaAndroidLinkText = 'here';
          var linkOppiaAndroid = oppiaAndroidLinkText.link(
            'https://github.com/oppia/oppia-android/wiki#' +
            'onboarding-instructions'
          );

          expect(github.issues.createComment).toHaveBeenCalledWith({
            owner: pullRequestPayload.payload.repository.owner.login,
            repo: pullRequestPayload.payload.repository.name,
            number: pullRequestPayload.payload.pull_request.number,
            body: 'Hi! ' + '@testuser7778,' +
            ' Welcome to Oppia! Please could you follow the instructions ' +
            linkOppiaAndroid + ' to get started with oppia-android? ' +
            'You\'ll need to do this before we can accept your PR. I am ' +
            'closing this PR for now. Feel free to re-open it once you ' +
            'are done with the above instructions. Thanks!',
          });
          expect(github.issues.update).toHaveBeenCalledWith({
            issue_number: pullRequestPayload.payload.pull_request.number,
            owner: pullRequestPayload.payload.repository.owner.login,
            repo: pullRequestPayload.payload.repository.name,
            state: 'closed',
          });
        });
    });

    it('should do nothing if no data is obtained from sheet', async () => {
      await apiForSheetsModule.generateOutput(
        [],
        pullRequestPayload.payload.pull_request.number,
        pullRequestPayload.payload.pull_request
      );
      expect(github.issues.createComment).not.toHaveBeenCalled();
      expect(github.issues.createComment).not.toHaveBeenCalledWith({});
      expect(github.issues.update).not.toHaveBeenCalled();
    });
  });

  describe('only whitelisted checks are run for a repo', () => {
    beforeEach(function (done) {
      spyOn(apiForSheetsModule, 'checkClaStatus').and.callThrough();
      spyOn(apiForSheetsModule, 'authorize').and.callThrough({});
      spyOn(apiForSheetsModule, 'checkClaSheet').and.callThrough();
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.callFake(async (obj, cb) => {
              await cb(null, {
                data: {
                  values: [['test']]
                },
              });
            }),
          },
        },
      });
      spyOn(constants, 'getChecksWhitelist').and.returnValue({
        oppia: {
          opened: ['cla-check']
        }
      });
      robot.receive(pullRequestPayload);
      done();
    });

    it('should not call non whitelisted checks', () => {
      expect(checkPullRequestBranchModule.checkBranch).not.toHaveBeenCalled();
    });

    it('should be called for the given payload', () => {
      expect(apiForSheetsModule.checkClaStatus).toHaveBeenCalled();
    });

    it('should be called once for the given payload', () => {
      expect(apiForSheetsModule.checkClaStatus.calls.count()).toEqual(1);
    });

    it('should be called with one argument for the given payload', () => {
      expect(apiForSheetsModule.checkClaStatus.calls.argsFor(0).length).toEqual(
        1
      );
    });

    it('should be called with the correct username for the given payload',
      () => {
        const context = apiForSheetsModule.checkClaStatus.calls.argsFor(0)[0];
        expect(
          context.payload.pull_request.user.login
        ).toEqual('testuser7777');
      });

    it('should call authorize', () => {
      expect(apiForSheetsModule.authorize).toHaveBeenCalled();
    });

    it('should call authorize once', () => {
      expect(apiForSheetsModule.authorize.calls.count()).toEqual(1);
    });

    it('should call authorize with one argument', () => {
      expect(apiForSheetsModule.authorize.calls.argsFor(0).length).toEqual(1);
    });

    it('should call checkClaSheet', () => {
      expect(apiForSheetsModule.checkClaSheet).toHaveBeenCalled();
    });

    it('should call checkClaSheet once', () => {
      expect(apiForSheetsModule.checkClaSheet.calls.count()).toEqual(1);
    });

    it('should call checkClaSheet with one argument', () => {
      expect(apiForSheetsModule.checkClaSheet.calls.argsFor(0).length).toEqual(
        1
      );
    });
  });

  describe('no checks are run for a non whitelisted repo', () => {
    beforeEach(function (done) {
      spyOn(apiForSheetsModule, 'checkClaStatus').and.callThrough();
      spyOn(apiForSheetsModule, 'authorize').and.callThrough({});
      spyOn(apiForSheetsModule, 'checkClaSheet').and.callThrough();
      spyOn(constants, 'getChecksWhitelist').and.returnValue({
        'oppia-test': {
          opened: ['cla-check']
        }
      });
      robot.receive(pullRequestPayload);
      done();
    });

    it('should not call any checks', () => {
      expect(checkPullRequestBranchModule.checkBranch).not.toHaveBeenCalled();
      expect(apiForSheetsModule.checkClaStatus).not.toHaveBeenCalled();
      expect(
        checkPullRequestJobModule.checkForModificationsToFiles
      ).not.toHaveBeenCalled();
    });
  });

  describe('should not run checks for a blacklisted author', () => {
    beforeEach(function (done) {
      spyOn(apiForSheetsModule, 'checkClaStatus').and.callThrough();
      spyOn(apiForSheetsModule, 'authorize').and.callThrough({});
      spyOn(apiForSheetsModule, 'checkClaSheet').and.callThrough();
      spyOn(constants, 'getBlacklistedAuthors').and.returnValue([
        'testuser7777']);
      robot.receive(pullRequestPayload);
      done();
    });

    it('should not call any checks', () => {
      expect(checkPullRequestBranchModule.checkBranch).not.toHaveBeenCalled();
      expect(apiForSheetsModule.checkClaStatus).not.toHaveBeenCalled();
      expect(
        checkPullRequestJobModule.checkForModificationsToFiles
      ).not.toHaveBeenCalled();
    });
  });
});
