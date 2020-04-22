require('dotenv').config();

const {createRobot} = require('probot');
// The plugin refers to the actual app in index.js.
const oppiaBotPlugin = require('../index');
const apiForSheetsModule = require('../lib/apiForSheets');
const checkMergeConflictsModule = require('../lib/checkMergeConflicts');
const pullRequestpayload = require('../fixtures/pullRequestPayload.json');
const scheduler = require('../lib/scheduler');

describe('Oppiabot\'s', () => {
  let robot;
  let github;

  beforeEach(function (done) {
    // Mock probot scheduler.
    spyOn(scheduler, 'createScheduler').and.callFake(() => { });

    robot = createRobot();
    oppiaBotPlugin(robot);

    github = {
      issues: {
        addLabels: jasmine.createSpy('addLabels').and.returnValue({
          params: {
            number: 5139,
            owner: 'oppia',
            repo: 'oppia',
            labels: [
              "PR: don't merge - NEEDS CLA"
            ]
          }
        }),
        createComment: jasmine.createSpy('createComment').and.returnValue({
          params: {
            number: 5139,
            owner: 'oppia',
            repo: 'oppia',
            body: 'Hi! @tester7777. Welcome to Oppia! ' +
              'Please could you follow the instructions' +
              '<a href=\"https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#setting-things-up\">here</a>' +
              "to get started ? You'll need to do this before" +
              'we can accept your PR. Thanks!'
          }
        }),
        getIssueLabels: jasmine.createSpy('getIssueLabels').and.returnValue({
          data:
            [
              {
                id: 248679580,
                node_id: 'MDU6TGFiZWwyNDg2Nzk1ODA=',
                url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20LGTM',
                name: 'PR: LGTM',
                color: '009800',
                'default': false
              },
              {
                id: 971968901,
                node_id: 'MDU6TGFiZWw5NzE5Njg5MDE=',
                url: "https://api.github.com/repos/oppia/oppia/labels/PR:%20don't%20merge%20-%20HAS%20MERGE%20CONFLICTS",
                name: "PR: don't merge - HAS MERGE CONFLICTS",
                color: 'd93f0b',
                'default': false
              },
              {
                id: 638838928,
                node_id: 'MDU6TGFiZWw2Mzg4Mzg5Mjg=',
                url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20for%20current%20release',
                name: 'PR: for current release',
                color: 'FF69B4',
                'default': false
              },
              {
                id: 638839900,
                node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
                url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
                name: 'PR: released',
                color: '00FF00',
                'default': false
              }
            ]
        }),
        removeLabel: jasmine.createSpy('removeLabel')
      }
    };
    robot.auth = () => Promise.resolve(github);
    done();
  });

  describe('apiForSheets', () => {
    beforeEach(function (done) {
      spyOn(apiForSheetsModule, 'checkClaStatus').and.callThrough();
      spyOn(apiForSheetsModule, 'authorize').and.callThrough();
      spyOn(apiForSheetsModule, 'checkClaSheet').and.callThrough();
      robot.receive(pullRequestpayload);
      done();
    });

    it('should be called for the given payload', () => {
      expect(apiForSheetsModule.checkClaStatus).toHaveBeenCalled();
    });

    it('should be called once for the given payload', () => {
      expect(apiForSheetsModule.checkClaStatus.calls.count()).toEqual(1);
    });

    it('should be called with one argument for the given payload', () => {
      expect(
        apiForSheetsModule.checkClaStatus.calls.argsFor(0).length).toEqual(1);
    });

    it('should be called with the correct username for the given payload',
      () => {
        const context = apiForSheetsModule.checkClaStatus.calls.argsFor(0)[0];
        expect(context.payload.pull_request.user.login).toEqual(
          'testuser7777');
      });

    it('should call authorize', () => {
      expect(apiForSheetsModule.authorize).toHaveBeenCalled();
    });

    it('should call authorize once', () => {
      expect(apiForSheetsModule.authorize.calls.count()).toEqual(1);
    });

    it('should call authorize with two arguments', () => {
      expect(
        apiForSheetsModule.authorize.calls.argsFor(0).length).toEqual(2);
    });

    it('should further call checkClaSheet', () => {
      expect(apiForSheetsModule.checkClaSheet).toHaveBeenCalled();
    });

    it('should further call checkClaSheet once', () => {
      expect(apiForSheetsModule.checkClaSheet.calls.count()).toEqual(1);
    });

    it('should further call checkClaSheet with one argument', () => {
      expect(
        apiForSheetsModule.checkClaSheet.calls.argsFor(0).length).toEqual(1);
    });

    it('should not remove any label for the given payload', async () => {
      var commentCreatedStatus = await apiForSheetsModule.generateOutput(
        [['apb7'], ['kevinlee12']],
        pullRequestpayload.payload.pull_request.number,
        pullRequestpayload.payload.pull_request);
      expect(
        github.issues.removeLabel).not.toHaveBeenCalled();
    });

    it('should add a relevant label for the given payload', async () => {
      var commentCreatedStatus = await apiForSheetsModule.generateOutput(
        [['apb7'], ['kevinlee12']],
        pullRequestpayload.payload.pull_request.number,
        pullRequestpayload.payload.pull_request);

      expect(
        github.issues.addLabels).toHaveBeenCalled();
    });

    it('should post a comment for the given payload', async () => {
      var commentCreatedStatus = await apiForSheetsModule.generateOutput(
        [['apb7'], ['kevinlee12']],
        pullRequestpayload.payload.pull_request.number,
        pullRequestpayload.payload.pull_request);
      expect(
        github.issues.createComment).toHaveBeenCalled();
      expect(commentCreatedStatus).toEqual(true);
    });
  });
});
