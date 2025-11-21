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

/**
 * @fileoverview Spec for CI Checks handler.
 */

require('dotenv').config();
const { createProbot } = require('probot');
const oppiaBot = require('../index');
const scheduler = require('../lib/scheduler');
const payloadData = require('../fixtures/checksuite.complete.json');
const ciCheckModule = require('../lib/ciChecks');

describe('CI Checks', () => {
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

  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = {
    number: 25,
    body: 'Sample Pull Request',
    user: {
      login: 'testUser'
    }
  };

  beforeEach(() => {
    spyOn(scheduler, 'createScheduler').and.callFake(() => {});

    github = {
      issues: {
        createComment: jasmine
          .createSpy('createComment')
          .and.callFake(() => {}),
        addAssignees: jasmine.createSpy('addAssignees').and.callFake(() => {}),
      },
      pulls: {
        get: jasmine.createSpy('get').and.resolveTo({
          data: pullRequest,
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
    spyOn(ciCheckModule, 'handleFailure').and.callThrough();
  });

  describe('When a PR fails the check suite', () => {
    beforeEach(async () => {
      await robot.receive(payloadData);
    });

    it('should call handle failure module', () => {
      expect(ciCheckModule.handleFailure).toHaveBeenCalled();
    });

    it('should fetch pull request data', () => {
      expect(github.pulls.get).toHaveBeenCalled();
      expect(github.pulls.get).toHaveBeenCalledWith({
        owner: payloadData.payload.repository.owner.login,
        repo: payloadData.payload.repository.name,
        pull_number: pullRequest.number,
      });
    });

    it('should comment on pull request', () => {
      expect(github.issues.createComment).toHaveBeenCalled();

      const prAuthor = pullRequest.user.login;
      expect(github.issues.createComment).toHaveBeenCalledWith({
        owner: payloadData.payload.repository.owner.login,
        repo: payloadData.payload.repository.name,
        issue_number: pullRequest.number,
        body:
          'Hi @' +
          prAuthor +
          ', there are some failing CI checks in your latest push. ' +
          'If you think this is due to a flake, please file an issue before ' +
          'restarting the tests (see [instructions](https://github.com/oppia' +
          '/oppia/wiki/If-CI-checks-fail-on-your-PR)). Thanks!',
      });
    });

    it('should assign PR author', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();

      const prAuthor = pullRequest.user.login;
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        owner: payloadData.payload.repository.owner.login,
        repo: payloadData.payload.repository.name,
        issue_number: pullRequest.number,
        assignees: [prAuthor]
      });
    });
  });

  describe('When a check suite is successful', () => {
    beforeEach(async () => {
      payloadData.payload.check_suite.conclusion = 'success';
      await robot.receive(payloadData);
    });

    it('should call handle failure module', () => {
      expect(ciCheckModule.handleFailure).toHaveBeenCalled();
    });


    it('should not comment on pull request', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not assign PR author', () => {
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
    });
  });

  describe('When a check suite is canceled', () => {
    beforeEach(async () => {
      payloadData.payload.check_suite.conclusion = 'canceled';
      await robot.receive(payloadData);
    });

    it('should call handle failure module', () => {
      expect(ciCheckModule.handleFailure).toHaveBeenCalled();
    });


    it('should not comment on pull request', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not assign PR author', () => {
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
    });
  });

  describe('When a non PR check suite failes', () => {
    beforeEach(async () => {
      payloadData.payload.check_suite.conclusion = 'failure';
      payloadData.payload.check_suite.pull_requests = [];
      await robot.receive(payloadData);
    });

    it('should call handle failure module', () => {
      expect(ciCheckModule.handleFailure).toHaveBeenCalled();
    });

    it('should not fetch pull request data', () => {
      expect(github.pulls.get).not.toHaveBeenCalled();
    });

    it('should not comment on pull request', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not assign PR author', () => {
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
    });
  });
});
