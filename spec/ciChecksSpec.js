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

const payloadData = require('../fixtures/checksuite.complete.json');
const github = require('@actions/github');
const core = require('@actions/core');
const ciCheckModule = require('../actions/src/pull_requests/ciChecks');
const dispatcher = require('../actions/src/dispatcher');

describe('CI Checks', () => {

  /**
   * @type {import('@actions/github').GitHub} octokit
   */
  let octokit;

  const pullRequest = {
    number: 25,
    body: 'Sample Pull Request',
    user: {
      login: 'testUser'
    }
  };

  beforeEach(async () => {

    github.context.eventName = payloadData.name;
    github.context.payload =payloadData.payload;
    github.context.pull_request =pullRequest;

    octokit = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.callFake(() => {}),
        addAssignees: jasmine.createSpy('addAssignees').and.callFake(() => {}),
      },
      pulls: {
        get: jasmine.createSpy('get').and.resolveTo({
          data: pullRequest,
        }),
      },
    };

    spyOn(core, 'getInput').and.returnValue('sample-token');

    // Mock GitHub API.
    Object.setPrototypeOf(github.GitHub, function () {
      return octokit;
    });

    spyOn(ciCheckModule, 'handleFailure').and.callThrough();
  });

  describe('When a PR fails the check suite', () => {
    beforeEach(async () => {
      await dispatcher.dispatch('check', 'completed');
    });

    it('should call handle failure module', () => {
      expect(ciCheckModule.handleFailure).toHaveBeenCalled();
    });

    it('should fetch pull request data', () => {
      expect(octokit.pulls.get).toHaveBeenCalled();
      expect(octokit.pulls.get).toHaveBeenCalledWith({
        owner: payloadData.payload.repository.owner.login,
        repo: payloadData.payload.repository.name,
        pull_number: pullRequest.number,
      });
    });

    it('should comment on pull request', () => {
      expect(octokit.issues.createComment).toHaveBeenCalled();

      const prAuthor = pullRequest.user.login;
      expect(octokit.issues.createComment).toHaveBeenCalledWith({
        owner: payloadData.payload.repository.owner.login,
        repo: payloadData.payload.repository.name,
        issue_number: pullRequest.number,
        body:
          'Hi @' +
          prAuthor +
          ', there are some failing CI checks in your latest push ' +
          ' If you think this is due to a flake, please file an issue ' +
          'before restarting the tests. Thanks!',
      });
    });

    it('should assign PR author', () => {
      expect(octokit.issues.addAssignees).toHaveBeenCalled();

      const prAuthor = pullRequest.user.login;
      expect(octokit.issues.addAssignees).toHaveBeenCalledWith({
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
      await dispatcher.dispatch('check', 'completed');
    });

    it('should call handle failure module', () => {
      expect(ciCheckModule.handleFailure).toHaveBeenCalled();
    });


    it('should not comment on pull request', () => {
      expect(octokit.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not assign PR author', () => {
      expect(octokit.issues.addAssignees).not.toHaveBeenCalled();
    });
  });

  describe('When a check suite is canceled', () => {
    beforeEach(async () => {
      payloadData.payload.check_suite.conclusion = 'canceled';
      await dispatcher.dispatch('check', 'completed');
    });

    it('should call handle failure module', () => {
      expect(ciCheckModule.handleFailure).toHaveBeenCalled();
    });


    it('should not comment on pull request', () => {
      expect(octokit.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not assign PR author', () => {
      expect(octokit.issues.addAssignees).not.toHaveBeenCalled();
    });
  });

  describe('When a non PR check suite failes', () => {
    beforeEach(async () => {
      payloadData.payload.check_suite.conclusion = 'failure';
      payloadData.payload.check_suite.pull_requests = [];
      await dispatcher.dispatch('check', 'completed');
    });

    it('should call handle failure module', () => {
      expect(ciCheckModule.handleFailure).toHaveBeenCalled();
    });

    it('should not fetch pull request data', () => {
      expect(octokit.pulls.get).not.toHaveBeenCalled();
    });

    it('should not comment on pull request', () => {
      expect(octokit.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not assign PR author', () => {
      expect(octokit.issues.addAssignees).not.toHaveBeenCalled();
    });
  });
});
