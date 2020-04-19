require('dotenv').config();

const { createRobot } = require('probot');
const payload = require('../fixtures/periodicCheckPayload.json');
// The plugin refers to the actual app in index.js.
const oppiaBotPlugin = require('../index');
const periodicChecksModule = require('../lib/periodicChecks');

describe('Oppiabot\'s', () => {
  let robot;
  let github;

  beforeEach((done) => {
    github = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.resolveTo({
        }),
        addAssigneesToIssue: jasmine.createSpy(
          'addAssigneesToIssue').and.resolveTo({})
      },
      pullRequests: {
        getAll: jasmine.createSpy('getAll').and.resolveTo({
          data: [payload.payload.pull_request]
        })
      }
    };
    robot = createRobot();
    robot.auth = () => Promise.resolve(github);
    oppiaBotPlugin(robot);
    done();
  });
  describe('periodic checks', () => {
    beforeEach((done) => {
      robot.receive(payload);
      spyOn(periodicChecksModule, 'assignReviewers').and.callThrough();
      done();
    });

    it('should be called for payload', () => {
      expect(periodicChecksModule.assignReviewers).toHaveBeenCalled();
    });

    it('should fetch all the pull requests from github', () => {
      expect(github.pullRequests.getAll).toHaveBeenCalled();
    });

    it('should assign the appropriate reviewers', () => {
      expect(github.issues.addAssigneesToIssue).toHaveBeenCalled();
      const assigneeParam = (
        github.issues.addAssigneesToIssue.calls.argsFor(0)[0]);
      expect(assigneeParam.assignees).toEqual(['testuser1234', 'testuser1212']);
    });

    it('should ping the appropriate reviewers', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      const commentParam = (
        github.issues.createComment.calls.argsFor(0)[0]);
      expect(commentParam.body).toBe('Hi @testuser1234, @testuser1212,' +
        ' this PR is waiting for your review, can you PTAL? Thanks!');
    });
  });

  describe('periodic checks when PR author is assigned', () => {
    beforeEach((done) => {
      // Assigning the PR Author
      payload.payload.pull_request.assignees.push({
        login: 'testuser7777'
      });

      robot.receive(payload);
      spyOn(periodicChecksModule, 'assignReviewers').and.callThrough();
      done();
    });

    it('should not assign any new reviewer', () => {
      expect(github.issues.addAssigneesToIssue).toHaveBeenCalledTimes(0);
    });

    it('should not create a comment', () => {
      expect(github.issues.createComment).toHaveBeenCalledTimes(0);
    });
  });
});