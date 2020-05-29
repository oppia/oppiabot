require('dotenv').config();
const { createProbot } = require('probot');
// The plugin refers to the actual app in index.js.
const oppiaBot = require('../index');
const apiForSheetsModule = require('../lib/apiForSheets');
const checkPullRequestLabelsModule = require('../lib/checkPullRequestLabels');
const checkPullRequestBranchModule = require('../lib/checkPullRequestBranch');
const checkWIPModule = require('../lib/checkWipDraftPR');
const scheduler = require('../lib/scheduler');
const pullRequestpayload = JSON.parse(
  JSON.stringify(require('../fixtures/pullRequestPayload.json'))
);
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

    github = {
      issues: {
        addLabels: jasmine.createSpy('addLabels').and.returnValue({
          params: {
            number: 5139,
            owner: 'oppia',
            repo: 'oppia',
            labels: ["PR: don't merge - NEEDS CLA"],
          },
        }),
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
        listLabelsOnIssue: jasmine
          .createSpy('listLabelsOnIssue')
          .and.returnValue({
            data: [
              {
                id: 248679580,
                node_id: 'MDU6TGFiZWwyNDg2Nzk1ODA=',
                url:
                  'https://api.github.com/repos/oppia/oppia/labels/PR:%20LGTM',
                name: 'PR: LGTM',
                color: '009800',
              },
              {
                id: 971968901,
                node_id: 'MDU6TGFiZWw5NzE5Njg5MDE=',
                url:
                  "https://api.github.com/repos/oppia/oppia/labels/PR:%20don't%20merge%20-%20HAS%20MERGE%20CONFLICTS",
                name: "PR: don't merge - HAS MERGE CONFLICTS",
                color: 'd93f0b',
              },
              {
                id: 638838928,
                node_id: 'MDU6TGFiZWw2Mzg4Mzg5Mjg=',
                url:
                  'https://api.github.com/repos/oppia/oppia/labels/PR:%20for%20current%20release',
                name: 'PR: for current release',
                color: 'FF69B4',
              },
              {
                id: 638839900,
                node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
                url:
                  'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
                name: 'PR: released',
                color: '00FF00',
              },
            ],
          }),
        removeLabel: jasmine.createSpy('removeLabel').and.returnValue({}),
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
      spyOn(checkWIPModule, 'checkWIP').and.callThrough();
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
      robot.receive(pullRequestpayload);
      done();
    });

    it('should not call other checks', () => {
      expect(
        checkPullRequestLabelsModule.checkChangelogLabel).toHaveBeenCalled();
      expect(checkPullRequestBranchModule.checkBranch).toHaveBeenCalled();
      expect(checkWIPModule.checkWIP).toHaveBeenCalled();
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
      robot.receive(pullRequestpayload);
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
    describe('output generation without cla label', () => {
      beforeEach(function (done) {
        pullRequestpayload.payload.pull_request.labels.push({
          name: 'PR CHANGELOG: Server Errors -- @kevintab95',
        });
        spyOn(apiForSheetsModule, 'checkClaStatus').and.callThrough();
        spyOn(apiForSheetsModule, 'authorize').and.callFake(() => ({}));
        spyOn(apiForSheetsModule, 'checkClaSheet').and.callFake(() => {});
        robot.receive(pullRequestpayload);
        done();
      });
      it('should not remove any label for the given payload', async () => {
        await apiForSheetsModule.generateOutput(
          claData,
          pullRequestpayload.payload.pull_request.number,
          pullRequestpayload.payload.pull_request
        );
        expect(github.issues.removeLabel).not.toHaveBeenCalled();
      });

      it('should add a relevant label for the given payload', async () => {
        await apiForSheetsModule.generateOutput(
          claData,
          pullRequestpayload.payload.pull_request.number,
          pullRequestpayload.payload.pull_request
        );

        expect(github.issues.addLabels).toHaveBeenCalled();
      });

      it('should post a comment for the given payload', async () => {
        await apiForSheetsModule.generateOutput(
          claData,
          pullRequestpayload.payload.pull_request.number,
          pullRequestpayload.payload.pull_request
        );
        expect(github.issues.createComment).toHaveBeenCalled();
      });

      it('should not add label if user has signed cla', async () => {
        // Add username to CLA sheet.
        await apiForSheetsModule.generateOutput(
          [...claData, ['testuser7777']],
          pullRequestpayload.payload.pull_request.number,
          pullRequestpayload.payload.pull_request
        );
        expect(github.issues.createComment).not.toHaveBeenCalled();
        expect(github.issues.addLabels).not.toHaveBeenCalled();
      });

      it('should do nothing if no data is obtained from sheet', async () => {
        await apiForSheetsModule.generateOutput(
          [],
          pullRequestpayload.payload.pull_request.number,
          pullRequestpayload.payload.pull_request
        );
        expect(github.issues.createComment).not.toHaveBeenCalled();
        expect(github.issues.createComment).not.toHaveBeenCalledWith({});
        expect(github.issues.addLabels).not.toHaveBeenCalled();
      });
    });

    describe('output generation with cla label', () => {
      beforeEach(function (done) {
        pullRequestpayload.payload.pull_request.labels.push(
          {
            name: 'PR CHANGELOG: Server Errors -- @kevintab95',
          }, {
            name: "PR: don't merge - NEEDS CLA",
          }
        );
        spyOn(apiForSheetsModule, 'checkClaStatus').and.callThrough();
        spyOn(apiForSheetsModule, 'authorize').and.callFake(() => ({}));
        spyOn(apiForSheetsModule, 'checkClaSheet').and.callFake(() => {});
        robot.receive(pullRequestpayload);
        done();
      });

      it('should not add label', async () => {
        await apiForSheetsModule.generateOutput(
          claData,
          pullRequestpayload.payload.pull_request.number,
          pullRequestpayload.payload.pull_request
        );
        expect(github.issues.addLabels).not.toHaveBeenCalled();
      });

      it('should remove label is user has signed cla', async () => {
        await apiForSheetsModule.generateOutput(
          [...claData, ['testuser7777']],
          pullRequestpayload.payload.pull_request.number,
          pullRequestpayload.payload.pull_request
        );
        expect(github.issues.addLabels).not.toHaveBeenCalled();
      });
    });
  });

  describe('cla check for only cla check enabled repos', () => {
    beforeEach(function (done) {
      spyOn(apiForSheetsModule, 'checkClaStatus').and.callThrough();
      spyOn(apiForSheetsModule, 'authorize').and.callThrough({});
      spyOn(apiForSheetsModule, 'checkClaSheet').and.callThrough();
      spyOn(checkPullRequestLabelsModule, 'checkChangelogLabel').and.callThrough();
      spyOn(checkPullRequestBranchModule, 'checkBranch').and.callThrough();
      spyOn(checkWIPModule, 'checkWIP').and.callThrough();
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
      pullRequestpayload.payload.repository.name = 'oppia-android';
      robot.receive(pullRequestpayload);
      done();
    });

    it('should not call other checks', () => {
      expect(
        checkPullRequestLabelsModule.checkChangelogLabel).not.toHaveBeenCalled();
      expect(checkPullRequestBranchModule.checkBranch).not.toHaveBeenCalled();
      expect(checkWIPModule.checkWIP).not.toHaveBeenCalled();
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
});
