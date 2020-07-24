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
const checkWipDraftPRModule = require('../lib/checkWipDraftPR');
const scheduler = require('../lib/scheduler');
const pullRequestEditedPayload = require('../fixtures/pullRequest.edited.json');
const apiForSheetsModule = require('../lib/apiForSheets');
const checkPullRequestLabelsModule = require('../lib/checkPullRequestLabels');
const checkPullRequestJobModule = require('../lib/checkPullRequestJob');
const checkCriticalPullRequestModule = require('../lib/checkCriticalPullRequest');

describe('Oppiabot\'s', () => {
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

  beforeEach((done) => {
    spyOn(scheduler, 'createScheduler').and.callFake(() => {});

    // Spy on other modules that will be triggered by the payload.
    spyOn(apiForSheetsModule, 'checkClaStatus').and.callFake(() => {});
    spyOn(
      checkPullRequestLabelsModule, 'checkChangelogLabel')
      .and.callFake(() => {});
    spyOn(checkPullRequestJobModule, 'checkForNewJob').and.callFake(() => {});
    spyOn(checkCriticalPullRequestModule, 'checkIfPRAffectsDatastoreLayer').and.callFake(() => {});

    github = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.resolveTo({}),
        addAssignees: jasmine.createSpy('addAssignees').and.resolveTo({}),
      }
    };

    robot = createProbot({
      id: 1,
      cert: 'test',
      githubToken: 'test',
    });

    app = robot.load(oppiaBot);
    spyOn(app, 'auth').and.resolveTo(github);

    done();
  });

  describe('WIP PRs without skip prefix', () => {
    beforeEach((done) => {
      github.git = {
        getCommit: jasmine.createSpy('getCommit').and.resolveTo({
          data: {
            message: 'commit without skip prefix'
          }
        })
      };
      spyOn(checkWipDraftPRModule, 'checkWIP').and.callThrough();
      robot.receive(pullRequestEditedPayload);
      done();
    });

    it('calls checkWIP function', () =>{
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalled();
    });

    it('calls checkWIP once', () =>{
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalledTimes(1);
    });

    it('calls get commit', () => {
      expect(github.git.getCommit).toHaveBeenCalled();
      expect(github.git.getCommit).toHaveBeenCalledTimes(1);
      expect(github.git.getCommit).toHaveBeenCalledWith({
        owner: pullRequestEditedPayload.payload.repository.owner.login,
        repo: pullRequestEditedPayload.payload.repository.name,
        commit_sha: pullRequestEditedPayload.payload.pull_request.head.sha
      });
    });

    it('assigns PR author', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      const params = {
        repo: pullRequestEditedPayload.payload.repository.name,
        owner: pullRequestEditedPayload.payload.repository.owner.login,
        number: pullRequestEditedPayload.payload.pull_request.number,
        assignees: ['testuser7777'],
      };
      expect(github.issues.addAssignees).toHaveBeenCalledWith(params);
    });

    it('creates comment for WIP PRs', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledTimes(1);

      // Comment on Pull Request.
      const link = 'here'.link(
        'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia' +
        '#wip--draft-pull-requests');
      const author = pullRequestEditedPayload.payload.pull_request.user.login;
      const commentBody = (
        'Hi @' + author + ', when creating WIP/Draft PRs, ensure that ' +
        'your commit messages are prefixed with **[ci skip]** or ' +
        '**[skip ci]** to prevent CI checks from running. ' +
        'You can learn more about it ' + link + '.');

      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: pullRequestEditedPayload.payload.pull_request.number,
        owner: pullRequestEditedPayload.payload.repository.owner.login,
        repo: pullRequestEditedPayload.payload.repository.name,
        body: commentBody
      });
    });
  });

  describe('WIP PRs with skip prefix', () => {
    beforeEach((done) => {
      github.git = {
        getCommit: jasmine.createSpy('getCommit').and.resolveTo({
          data: {
            message: '[ci skip] commit with skip prefix'
          }
        })
      };
      spyOn(checkWipDraftPRModule, 'checkWIP').and.callThrough();
      robot.receive(pullRequestEditedPayload);
      done();
    });

    it('calls checkWIP function', () =>{
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalled();
    });

    it('calls checkWIP once', () =>{
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalledTimes(1);
    });

    it('calls get commit', () => {
      expect(github.git.getCommit).toHaveBeenCalled();
      expect(github.git.getCommit).toHaveBeenCalledTimes(1);
      expect(github.git.getCommit).toHaveBeenCalledWith({
        owner: pullRequestEditedPayload.payload.repository.owner.login,
        repo: pullRequestEditedPayload.payload.repository.name,
        commit_sha: pullRequestEditedPayload.payload.pull_request.head.sha
      });
    });

    it('does not assign PR author', () => {
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
    });

    it('does not create comment for WIP PRs', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
  });

  describe('Checks when PR is opened or reopened', () => {
    it('should check when PR is opened', async () => {
      github.git = {
        getCommit: jasmine.createSpy('getCommit').and.resolveTo({
          data: {
            message: 'changes'
          }
        })
      };
      spyOn(checkWipDraftPRModule, 'checkWIP').and.callThrough();
      // Trigger pull_request.opened event.
      pullRequestEditedPayload.payload.action = 'opened';
      await robot.receive(pullRequestEditedPayload);

      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalled();
      expect(github.git.getCommit).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledTimes(1);
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledTimes(1);
    });

    it('should check when PR is reopnend', async() => {
      spyOn(checkWipDraftPRModule, 'checkWIP').and.callThrough();
      github.git = {
        getCommit: jasmine.createSpy('getCommit').and.resolveTo({
          data: {
            message: 'commit without skip prefix'
          }
        })
      };
      // Trigger pull_request.opened event.
      pullRequestEditedPayload.payload.action = 'reopened';
      await robot.receive(pullRequestEditedPayload);

      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalled();
      expect(github.git.getCommit).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledTimes(1);
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledTimes(1);
    });
  });

  describe('Draft PRs', () => {
    beforeEach((done) => {
      github.git = {
        getCommit: jasmine.createSpy('getCommit').and.resolveTo({
          data: {
            message: 'commit without skip prefix'
          }
        })
      };
      spyOn(checkWipDraftPRModule, 'checkWIP').and.callThrough();
      // Receive a draft payload and remove WIP from title.
      pullRequestEditedPayload.payload.pull_request.draft = true;
      pullRequestEditedPayload.payload.pull_request.title = 'Testing Draft';
      robot.receive(pullRequestEditedPayload);
      done();
    });

    it('calls checkWIP function', () => {
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalled();
    });

    it('calls get commit', () => {
      expect(github.git.getCommit).toHaveBeenCalled();
      expect(github.git.getCommit).toHaveBeenCalledTimes(1);
      expect(github.git.getCommit).toHaveBeenCalledWith({
        owner: pullRequestEditedPayload.payload.repository.owner.login,
        repo: pullRequestEditedPayload.payload.repository.name,
        commit_sha: pullRequestEditedPayload.payload.pull_request.head.sha
      });
    });

    it('calls checkWIP once', () => {
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalledTimes(1);
    });

    it('calls with draft payload', () => {
      const args = checkWipDraftPRModule.checkWIP.calls.argsFor(0)[0];
      expect(args.payload.pull_request.draft).toBe(true);
      expect(args.payload.pull_request.title).toBe('Testing Draft');
    });


    it('assigns PR author', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      const params = {
        repo: pullRequestEditedPayload.payload.repository.name,
        owner: pullRequestEditedPayload.payload.repository.owner.login,
        number: pullRequestEditedPayload.payload.pull_request.number,
        assignees: ['testuser7777'],
      };
      expect(github.issues.addAssignees).toHaveBeenCalledWith(params);
    });

    it('creates comment for draft PRs', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledTimes(1);

      const link = 'here'.link(
        'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia' +
        '#wip--draft-pull-requests');
      const author = pullRequestEditedPayload.payload.pull_request.user.login;
      const commentBody = (
        'Hi @' + author + ', when creating WIP/Draft PRs, ensure that ' +
        'your commit messages are prefixed with **[ci skip]** or ' +
        '**[skip ci]** to prevent CI checks from running. ' +
        'You can learn more about it ' + link + '.');

      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: pullRequestEditedPayload.payload.pull_request.number,
        owner: pullRequestEditedPayload.payload.repository.owner.login,
        repo: pullRequestEditedPayload.payload.repository.name,
        body: commentBody
      });
    });
  });

  describe('Draft PRs with skip prefix', () => {
    beforeEach((done) => {
      github.git = {
        getCommit: jasmine.createSpy('getCommit').and.resolveTo({
          data: {
            message: '[skip ci] commit with skip prefix'
          }
        })
      };
      spyOn(checkWipDraftPRModule, 'checkWIP').and.callThrough();
      // Receive a draft payload and remove WIP from title.
      pullRequestEditedPayload.payload.pull_request.draft = true;
      pullRequestEditedPayload.payload.pull_request.title = 'Testing Draft';
      robot.receive(pullRequestEditedPayload);
      done();
    });

    it('calls checkWIP function', () => {
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalled();
    });

    it('calls checkWIP once', () => {
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalledTimes(1);
    });

    it('calls get commit', () => {
      expect(github.git.getCommit).toHaveBeenCalled();
      expect(github.git.getCommit).toHaveBeenCalledTimes(1);
      expect(github.git.getCommit).toHaveBeenCalledWith({
        owner: pullRequestEditedPayload.payload.repository.owner.login,
        repo: pullRequestEditedPayload.payload.repository.name,
        commit_sha: pullRequestEditedPayload.payload.pull_request.head.sha
      });
    });

    it('calls with draft payload', () => {
      const args = checkWipDraftPRModule.checkWIP.calls.argsFor(0)[0];
      expect(args.payload.pull_request.draft).toBe(true);
      expect(args.payload.pull_request.title).toBe('Testing Draft');
    });

    it('does not assign PR author', () => {
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
    });

    it('does not create comment for draft PRs', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
  });

  describe('Neither Draft nor WIP PRs', () => {
    beforeEach((done) => {
      github.git = {
        getCommit: jasmine.createSpy('getCommit').and.resolveTo({
          data: {
            message: '[skip ci] commit with skip prefix'
          }
        })
      };
      spyOn(checkWipDraftPRModule, 'checkWIP').and.callThrough();
      // Receive a neither draft nor WIP payload.
      pullRequestEditedPayload.payload.pull_request.draft = false;
      pullRequestEditedPayload.payload.pull_request.title = 'Testing';
      robot.receive(pullRequestEditedPayload);
      done();
    });

    it('calls checkWIP function', () => {
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalled();
    });

    it('does not call get commit', () => {
      expect(github.git.getCommit).not.toHaveBeenCalled();
    });

    it('does not assign PR author', () => {
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
    });

    it('does not create a comment', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
  });
});
