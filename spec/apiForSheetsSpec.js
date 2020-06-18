require('dotenv').config();
const { createProbot } = require('probot');
// The plugin refers to the actual app in index.js.
const oppiaBot = require('../index');
const constants = require('../constants');
const apiForSheetsModule = require('../lib/apiForSheets');
const checkPullRequestLabelsModule = require('../lib/checkPullRequestLabels');
const checkPullRequestBranchModule = require('../lib/checkPullRequestBranch');
const checkWipModule = require('../lib/checkWipDraftPR');
const scheduler = require('../lib/scheduler');
const pullRequestPayload = JSON.parse(
  JSON.stringify(require('../fixtures/pullRequestPayload.json'))
);
const checkPullRequestJobModule = require('../lib/checkPullRequestJob');
const {google} = require('googleapis');
const {OAuth2Client} = require('google-auth-library');

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
    spyOn(scheduler, 'createScheduler').and.callFake(() => {});
    spyOn(checkPullRequestJobModule, 'checkForNewJob').and.callFake(() => {});

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
      spyOn(checkPullRequestLabelsModule, 'checkChangelogLabel').and.callThrough();
      spyOn(checkPullRequestBranchModule, 'checkBranch').and.callThrough();
      spyOn(checkWipModule, 'checkWIP').and.callThrough();
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.callFake(async (obj, cb) => {
              await cb(null, {
                data : {values: [['test']]},
              });
            }),
          },
        },
      });
      robot.receive(pullRequestPayload);
      done();
    });

    it('should call other checks', () => {
      expect(
        checkPullRequestLabelsModule.checkChangelogLabel).toHaveBeenCalled();
      expect(checkPullRequestBranchModule.checkBranch).toHaveBeenCalled();
      expect(checkWipModule.checkWIP).toHaveBeenCalled();
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

    it('should be called with the correct username for the given payload', () => {
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
      pullRequestPayload.payload.pull_request.labels.push({
        name: 'PR CHANGELOG: Server Errors -- @kevintab95',
      });
      spyOn(apiForSheetsModule, 'checkClaStatus').and.callThrough();
      spyOn(apiForSheetsModule, 'authorize').and.callFake(() => ({}));
      spyOn(apiForSheetsModule, 'checkClaSheet').and.callFake(() => {});
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

    it('should not close the PR if user has signed cla', async () => {
      // Add username to CLA sheet.
      await apiForSheetsModule.generateOutput(
        [...claData, ['testuser7777']],
        pullRequestPayload.payload.pull_request.number,
        pullRequestPayload.payload.pull_request
      );
      expect(github.issues.createComment).not.toHaveBeenCalled();
      expect(github.issues.update).not.toHaveBeenCalled();
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
      spyOn(checkPullRequestLabelsModule, 'checkChangelogLabel').and.callThrough();
      spyOn(checkPullRequestBranchModule, 'checkBranch').and.callThrough();
      spyOn(checkWipModule, 'checkWIP').and.callThrough();
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.callFake(async (obj, cb) => {
              await cb(null, {
                data : {values: [['test']]},
              });
            }),
          },
        },
      });
      spyOn(constants, 'getChecksWhitelist').and.returnValue({
        'oppia': {
          'opened': ['cla-check']
        }
      });
      robot.receive(pullRequestPayload);
      done();
    });

    it('should not call non whitelisted checks', () => {
      expect(
        checkPullRequestLabelsModule.checkChangelogLabel).not.toHaveBeenCalled();
      expect(checkPullRequestBranchModule.checkBranch).not.toHaveBeenCalled();
      expect(checkWipModule.checkWIP).not.toHaveBeenCalled();
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

    it('should be called with the correct username for the given payload', () => {
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

  describe('no checks are run for a non whitelisted repo', () => {
    beforeEach(function (done) {
      spyOn(apiForSheetsModule, 'checkClaStatus').and.callThrough();
      spyOn(apiForSheetsModule, 'authorize').and.callThrough({});
      spyOn(apiForSheetsModule, 'checkClaSheet').and.callThrough();
      spyOn(checkPullRequestLabelsModule, 'checkChangelogLabel').and.callThrough();
      spyOn(checkPullRequestBranchModule, 'checkBranch').and.callThrough();
      spyOn(checkWipModule, 'checkWIP').and.callThrough();
      spyOn(constants, 'getChecksWhitelist').and.returnValue({
        'oppia-test': {
          'opened': ['cla-check']
        }
      });
      robot.receive(pullRequestPayload);
      done();
    });

    it('should not call any checks', () => {
      expect(
        checkPullRequestLabelsModule.checkChangelogLabel).not.toHaveBeenCalled();
      expect(checkPullRequestBranchModule.checkBranch).not.toHaveBeenCalled();
      expect(checkWipModule.checkWIP).not.toHaveBeenCalled();
      expect(apiForSheetsModule.checkClaStatus).not.toHaveBeenCalled();
    });
  });
});
