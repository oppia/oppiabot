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