require('dotenv').config();
const {createRobot} = require('probot');
var plugin = require('..');
var apiForSheetsModule = require('../lib/apiForSheets');
var checkForMergeConflicts = require('../lib/checkForMergeConflicts');
const pullRequestpayload = require('../fixtures/pullRequestPayload.json');

var apiForSheets = apiForSheetsModule.apiForSheets;
var authorize = apiForSheetsModule.authorize;
var checkClaSheet = apiForSheetsModule.checkClaSheet;

describe('Oppiabot\'s', () => {
  let robot;
  let github;

  beforeEach(() => {
    robot = createRobot();
    plugin(robot);
    spyOn(apiForSheetsModule, 'apiForSheets').and.callThrough();
    spyOn(apiForSheetsModule, 'authorize').and.callThrough();
    spyOn(apiForSheetsModule, 'checkClaSheet').and.callThrough();
    github = {
      issues: {
        createComment: jasmine.createSpy('createComment')
      }
    };
    robot.auth = () => Promise.resolve(github);
  });

  describe('apiForSheets function', () => {
    beforeEach(function (done) {
      robot.receive(pullRequestpayload);
      done();
    });

    it('is called', () => {
      expect(apiForSheets).toHaveBeenCalled();
    });

    it('is called once for the given payload', () => {
      expect(apiForSheets.calls.count()).toEqual(1);
    });

    it('is called with three arguments for the given payload', () => {
      expect(apiForSheets.calls.argsFor(0).length).toEqual(3);
    });

    it('is called with the correct username for the given payload', () => {
      expect(
        apiForSheets.calls.argsFor(0)[0])
        .toEqual('testuser7777');
    });

    it('is called for a pull request for the given payload', () => {
      expect(
        apiForSheets.calls.argsFor(0)[2])
        .toEqual(true);
    });

    it('calls the authorize function for the given payload', () => {
      expect(authorize).toHaveBeenCalled();
    });
  });
});
