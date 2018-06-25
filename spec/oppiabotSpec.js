require('dotenv').config();
const {createRobot} = require('probot');
// The plugin refers to the actual app in index.js.
const plugin = require('../index');
const apiForSheetsModule = require('../lib/apiForSheets');
const checkMergeConflictsModule = require('../lib/checkMergeConflicts');
const pullRequestpayload = require('../fixtures/pullRequestPayload.json');

describe('Oppiabot\'s', () => {
  let robot;
  let github;

  beforeEach(function (done) {
    robot = createRobot();
    plugin(robot);

    github = {
      issues: {
        createComment: jasmine.createSpy('createComment')
      }
    };
      robot.auth = () => Promise.resolve(github);
    done();
  });

  describe('apiForSheets', () => {
    beforeEach(function (done) {
      spyOn(apiForSheetsModule, 'apiForSheets').and.callThrough();
      spyOn(apiForSheetsModule, 'authorize').and.callThrough();
      spyOn(apiForSheetsModule, 'checkClaSheet');
      robot.receive(pullRequestpayload);
      done();
    });

    it('should be called', () => {
      expect(apiForSheetsModule.apiForSheets).toHaveBeenCalled();
    });

    it('should be called once for the given payload', () => {
      expect(apiForSheetsModule.apiForSheets.calls.count()).toEqual(1);
    });

    it('should be called with three arguments for the given payload', () => {
      expect(
        apiForSheetsModule.apiForSheets.calls.argsFor(0).length).toEqual(3);
    });

    it('should be called with the correct username for the given payload', () => {
      expect(
        apiForSheetsModule.apiForSheets.calls.argsFor(0)[0])
        .toEqual('testuser7777');
    });

    it('should be called for a pull request for the given payload', () => {
      expect(
        apiForSheetsModule.apiForSheets.calls.argsFor(0)[2])
        .toEqual(true);
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

    it('should further call checkClaSheet', () => {
      expect(apiForSheetsModule.checkClaSheet.calls.count()).toEqual(1);
    });

    it('should further call checkClaSheet with one argument', () => {
      expect(
        apiForSheetsModule.checkClaSheet.calls.argsFor(0).length).toEqual(1);
    });
  });
});
