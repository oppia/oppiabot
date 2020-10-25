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
const { createProbot } = require('probot');
// The plugin refers to the actual app in index.js.
const oppiaBot = require('../index');
const scheduler = require('../lib/scheduler');
const pushPayload = require('../fixtures/push.json');
const pullRequestPayload = require('../fixtures/pullRequestPayload.json');
const checkBranchPushModule = require('../lib/checkBranchPush');

describe('Force Push Check', () => {
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

  beforeEach(() => {
    spyOn(scheduler, 'createScheduler').and.callFake(() => {});
    github = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.returnValue({}),
        update: jasmine.createSpy('update').and.resolveTo({}),
      },
      search: {
        issuesAndPullRequests: jasmine
          .createSpy('issuesAndPullRequests')
          .and.resolveTo({
            data: {
              items: [pullRequestPayload.payload.pull_request],
            },
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
    spyOn(checkBranchPushModule, 'handleForcePush').and.callThrough();
  });

  describe('when a user force pushes', () => {
    beforeEach(async () => {
      await robot.receive(pushPayload);
    });

    it('should check for force push', () => {
      expect(checkBranchPushModule.handleForcePush).toHaveBeenCalled();
    });

    it('should search for pull request', () => {
      expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
    });

    it('should comment on pull request', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      const link = 'here (point 5)'.link(
        'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia' +
        '#instructions-for-making-a-code-change');
      expect(github.issues.createComment).toHaveBeenCalledWith({
        repo: pushPayload.payload.repository.name,
        owner: pushPayload.payload.repository.owner.login,
        issue_number: pullRequestPayload.payload.pull_request.number,
        body: 'Hi @' + pushPayload.payload.sender.login +
        ', force pushing is not allowed as it makes code reviews hard. ' +
        'You can learn more about this ' + link + '. I’ll be closing this, ' +
        'please make a new PR with the required changes. Thanks!',
      });
    });

    it('should close the pull request', () => {
      expect(github.issues.update).toHaveBeenCalled();
      expect(github.issues.update).toHaveBeenCalledWith({
        repo: pushPayload.payload.repository.name,
        owner: pushPayload.payload.repository.owner.login,
        issue_number: pullRequestPayload.payload.pull_request.number,
        state: 'closed'
      });
    });
  });

  describe('when a user does not force push', () => {
    beforeEach(async () => {
      pushPayload.payload.forced = false;
      await robot.receive(pushPayload);
    });

    it('should check for force push', () => {
      expect(checkBranchPushModule.handleForcePush).toHaveBeenCalled();
    });

    it('should not search for pull request', () => {
      expect(github.search.issuesAndPullRequests).not.toHaveBeenCalled();
    });

    it('should not comment on pull request', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not close the pull request', () => {
      expect(github.issues.update).not.toHaveBeenCalled();
    });
  });

  describe('when a push is made from develop branch', () => {
    beforeEach(async () => {
      pushPayload.payload.ref = 'refs/heads/develop';
      pushPayload.payload.forced = true;
      await robot.receive(pushPayload);
    });

    it('should check for force push', () => {
      expect(checkBranchPushModule.handleForcePush).toHaveBeenCalled();
    });

    it('should not search for pull request', () => {
      expect(github.search.issuesAndPullRequests).not.toHaveBeenCalled();
    });

    it('should not comment on pull request', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not close the pull request', () => {
      expect(github.issues.update).not.toHaveBeenCalled();
    });
  });

  describe('when a push is made from release branch', () => {
    beforeEach(async () => {
      pushPayload.payload.ref = 'refs/heads/release-1.234';
      pushPayload.payload.forced = true;
      await robot.receive(pushPayload);
    });

    it('should check for force push', () => {
      expect(checkBranchPushModule.handleForcePush).toHaveBeenCalled();
    });

    it('should not search for pull request', () => {
      expect(github.search.issuesAndPullRequests).not.toHaveBeenCalled();
    });

    it('should not comment on pull request', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not close the pull request', () => {
      expect(github.issues.update).not.toHaveBeenCalled();
    });
  });

  describe('when a push is made from a branch without a pr', () => {
    beforeEach(async () => {
      pushPayload.payload.ref = 'refs/heads/some-weird-branch';
      pushPayload.payload.forced = true;
      github.search = {
        issuesAndPullRequests: jasmine
          .createSpy('issuesAndPullRequests')
          .and.resolveTo({
            data: {
              // Return an empty payload since PR can't be found.
              items: [],
            },
          }),
      };
      await robot.receive(pushPayload);
    }, 20000);

    it('should check for force push', () => {
      expect(checkBranchPushModule.handleForcePush).toHaveBeenCalled();
    });

    it('should search for pull request', () => {
      expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
    });

    it('should not comment on pull request', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not close the pull request', () => {
      expect(github.issues.update).not.toHaveBeenCalled();
    });
  });
});
