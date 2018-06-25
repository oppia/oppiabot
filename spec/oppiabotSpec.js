require('dotenv').config();
const {createRobot} = require('probot');
const plugin = require('..');
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

  describe('apiForSheets function', () => {
    beforeEach(function (done) {
      spyOn(apiForSheetsModule, 'apiForSheets').and.callThrough();
      spyOn(apiForSheetsModule, 'authorize').and.callThrough();
      spyOn(apiForSheetsModule, 'checkClaSheet');
      robot.receive(pullRequestpayload);
      done();
    });

    it('is called', () => {
      expect(apiForSheetsModule.apiForSheets).toHaveBeenCalled();
    });

    it('is called once for the given payload', () => {
      expect(apiForSheetsModule.apiForSheets.calls.count()).toEqual(1);
    });

    it('is called with three arguments for the given payload', () => {
      expect(
        apiForSheetsModule.apiForSheets.calls.argsFor(0).length).toEqual(3);
    });

    it('is called with the correct username for the given payload', () => {
      expect(
        apiForSheetsModule.apiForSheets.calls.argsFor(0)[0])
        .toEqual('testuser7777');
    });

    it('is called for a pull request for the given payload', () => {
      expect(
        apiForSheetsModule.apiForSheets.calls.argsFor(0)[2])
        .toEqual(true);
    });

    it('calls the authorize function', () => {
      expect(apiForSheetsModule.authorize).toHaveBeenCalled();
    });

    it('calls the authorize function once', () => {
      expect(apiForSheetsModule.authorize.calls.count()).toEqual(1);
    });

    it('calls the authorize function with two arguments', () => {
      expect(
        apiForSheetsModule.authorize.calls.argsFor(0).length).toEqual(2);
    });

    it('further calls the checkClaSheet function', () => {
      expect(apiForSheetsModule.checkClaSheet).toHaveBeenCalled();
    });

    it('further calls the checkClaSheet function once', () => {
      expect(apiForSheetsModule.checkClaSheet.calls.count()).toEqual(1);
    });

    it('further calls the checkClaSheet function with one argument', () => {
      expect(
        apiForSheetsModule.checkClaSheet.calls.argsFor(0).length).toEqual(1);
    });
  });
});
