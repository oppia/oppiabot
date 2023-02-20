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
const github = require('@actions/github');
const core = require('@actions/core');
const checkWipDraftPRModule = require(
  '../actions/src/pull_requests/checkWipDraftPR');
const pullRequestEditedPayload = require('../fixtures/pullRequest.edited.json');
const dispatcher = require('../actions/src/dispatcher');

describe("Oppiabot's", () => {
  /**
   * @type {import('@actions/github').GitHub} octokit
   */
  let octokit;

  beforeEach(async () => {
    github.context.eventName = 'pull_request';
    github.context.payload = pullRequestEditedPayload;
    github.context.pull_request = pullRequestEditedPayload.pull_request;

    octokit = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.resolveTo({}),
        addAssignees: jasmine.createSpy('addAssignees').and.resolveTo({}),
      },
    };

    spyOn(core, 'getInput').and.returnValue('sample-token');

    spyOnProperty(github.context, 'repo').and.returnValue({
      owner: pullRequestEditedPayload.repository.owner.login,
      repo: pullRequestEditedPayload.repository.name,
    });

    // Mock GitHub API.
    Object.setPrototypeOf(github.GitHub, function () {
      return octokit;
    });
    spyOn(checkWipDraftPRModule, 'checkWIP').and.callThrough();
  });

  describe('WIP PRs without skip prefix', () => {
    beforeEach(async () => {
      octokit.git = {
        getCommit: jasmine.createSpy('getCommit').and.resolveTo({
          data: {
            message: 'commit without skip prefix',
          },
        }),
      };

      await dispatcher.dispatch('pull_request', 'edited');
    });

    it('calls checkWIP function', () => {
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalled();
    });

    it('calls checkWIP once', () => {
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalledTimes(1);
    });

    it('calls get commit', () => {
      expect(octokit.git.getCommit).toHaveBeenCalled();
      expect(octokit.git.getCommit).toHaveBeenCalledTimes(1);
      expect(octokit.git.getCommit).toHaveBeenCalledWith({
        owner: pullRequestEditedPayload.repository.owner.login,
        repo: pullRequestEditedPayload.repository.name,
        commit_sha: pullRequestEditedPayload.pull_request.head.sha,
      });
    });

    it('assigns PR author', () => {
      expect(octokit.issues.addAssignees).toHaveBeenCalled();
      const params = {
        repo: pullRequestEditedPayload.repository.name,
        owner: pullRequestEditedPayload.repository.owner.login,
        issue_number: pullRequestEditedPayload.pull_request.number,
        assignees: ['testuser7777'],
      };
      expect(octokit.issues.addAssignees).toHaveBeenCalledWith(params);
    });

    it('creates comment for WIP PRs', () => {
      expect(octokit.issues.createComment).toHaveBeenCalled();
      expect(octokit.issues.createComment).toHaveBeenCalledTimes(1);

      // Comment on Pull Request.
      const link = 'here'.link(
        'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia' +
          '#wip--draft-pull-requests'
      );
      const author = pullRequestEditedPayload.pull_request.user.login;
      const commentBody =
        'Hi @' +
        author +
        ', when creating WIP/Draft PRs, ensure that ' +
        'your commit messages are prefixed with **[ci skip]** or ' +
        '**[skip ci]** to prevent CI checks from running. ' +
        'You can learn more about it ' +
        link +
        '.';

      expect(octokit.issues.createComment).toHaveBeenCalledWith({
        issue_number: pullRequestEditedPayload.pull_request.number,
        owner: pullRequestEditedPayload.repository.owner.login,
        repo: pullRequestEditedPayload.repository.name,
        body: commentBody,
      });
    });
  });

  describe('WIP PRs with skip prefix', () => {
    beforeEach(async () => {
      octokit.git = {
        getCommit: jasmine.createSpy('getCommit').and.resolveTo({
          data: {
            message: '[ci skip] commit with skip prefix',
          },
        }),
      };

      await dispatcher.dispatch('pull_request_target', 'edited');
    });

    it('calls checkWIP function', () => {
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalled();
    });

    it('calls checkWIP once', () => {
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalledTimes(1);
    });

    it('calls get commit', () => {
      expect(octokit.git.getCommit).toHaveBeenCalled();
      expect(octokit.git.getCommit).toHaveBeenCalledTimes(1);
      expect(octokit.git.getCommit).toHaveBeenCalledWith({
        owner: pullRequestEditedPayload.repository.owner.login,
        repo: pullRequestEditedPayload.repository.name,
        commit_sha: pullRequestEditedPayload.pull_request.head.sha,
      });
    });

    it('does not assign PR author', () => {
      expect(octokit.issues.addAssignees).not.toHaveBeenCalled();
    });

    it('does not create comment for WIP PRs', () => {
      expect(octokit.issues.createComment).not.toHaveBeenCalled();
    });
  });

  describe('Checks when PR is opened or reopened', () => {
    it('should check when PR is opened', async () => {
      octokit.git = {
        getCommit: jasmine.createSpy('getCommit').and.resolveTo({
          data: {
            message: 'changes',
          },
        }),
      };
      // Trigger pull_request.reopened event.
      pullRequestEditedPayload.action = 'reopened';
      await dispatcher.dispatch('pull_request_target', 'reopened');

      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalled();
      expect(octokit.git.getCommit).toHaveBeenCalled();
      expect(octokit.issues.addAssignees).toHaveBeenCalled();
      expect(octokit.issues.addAssignees).toHaveBeenCalledTimes(1);
      expect(octokit.issues.createComment).toHaveBeenCalled();
      expect(octokit.issues.createComment).toHaveBeenCalledTimes(1);
    });

    it('should check when PR is reopened', async () => {
      octokit.git = {
        getCommit: jasmine.createSpy('getCommit').and.resolveTo({
          data: {
            message: 'commit without skip prefix',
          },
        }),
      };
      // Trigger pull_request.opened event.
      pullRequestEditedPayload.action = 'reopened';
      await dispatcher.dispatch('pull_request_target', 'reopened');

      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalled();
      expect(octokit.git.getCommit).toHaveBeenCalled();
      expect(octokit.issues.addAssignees).toHaveBeenCalled();
      expect(octokit.issues.addAssignees).toHaveBeenCalledTimes(1);
      expect(octokit.issues.createComment).toHaveBeenCalled();
      expect(octokit.issues.createComment).toHaveBeenCalledTimes(1);
    });
  });

  describe('Draft PRs', () => {
    beforeEach(async () => {
      octokit.git = {
        getCommit: jasmine.createSpy('getCommit').and.resolveTo({
          data: {
            message: 'commit without skip prefix',
          },
        }),
      };
      // Receive a draft payload and remove WIP from title.
      pullRequestEditedPayload.pull_request.draft = true;
      pullRequestEditedPayload.pull_request.title = 'Testing Draft';
      await dispatcher.dispatch('pull_request_target', 'opened');
    });

    it('calls checkWIP function', () => {
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalled();
    });

    it('calls get commit', () => {
      expect(octokit.git.getCommit).toHaveBeenCalled();
      expect(octokit.git.getCommit).toHaveBeenCalledTimes(1);
      expect(octokit.git.getCommit).toHaveBeenCalledWith({
        owner: pullRequestEditedPayload.repository.owner.login,
        repo: pullRequestEditedPayload.repository.name,
        commit_sha: pullRequestEditedPayload.pull_request.head.sha,
      });
    });

    it('calls checkWIP once', () => {
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalledTimes(1);
    });

    it('assigns PR author', () => {
      expect(octokit.issues.addAssignees).toHaveBeenCalled();
      const params = {
        repo: pullRequestEditedPayload.repository.name,
        owner: pullRequestEditedPayload.repository.owner.login,
        issue_number: pullRequestEditedPayload.pull_request.number,
        assignees: ['testuser7777'],
      };
      expect(octokit.issues.addAssignees).toHaveBeenCalledWith(params);
    });

    it('creates comment for draft PRs', () => {
      expect(octokit.issues.createComment).toHaveBeenCalled();
      expect(octokit.issues.createComment).toHaveBeenCalledTimes(1);

      const link = 'here'.link(
        'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia' +
          '#wip--draft-pull-requests'
      );
      const author = pullRequestEditedPayload.pull_request.user.login;
      const commentBody =
        'Hi @' +
        author +
        ', when creating WIP/Draft PRs, ensure that ' +
        'your commit messages are prefixed with **[ci skip]** or ' +
        '**[skip ci]** to prevent CI checks from running. ' +
        'You can learn more about it ' +
        link +
        '.';

      expect(octokit.issues.createComment).toHaveBeenCalledWith({
        issue_number: pullRequestEditedPayload.pull_request.number,
        owner: pullRequestEditedPayload.repository.owner.login,
        repo: pullRequestEditedPayload.repository.name,
        body: commentBody,
      });
    });
  });

  describe('Draft PRs with skip prefix', () => {
    beforeEach(async () => {
      octokit.git = {
        getCommit: jasmine.createSpy('getCommit').and.resolveTo({
          data: {
            message: '[skip ci] commit with skip prefix',
          },
        }),
      };
      // Receive a draft payload and remove WIP from title.
      pullRequestEditedPayload.pull_request.draft = true;
      pullRequestEditedPayload.pull_request.title = 'Testing Draft';
      await dispatcher.dispatch('pull_request_target', 'opened');
    });

    it('calls checkWIP function', () => {
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalled();
    });

    it('calls checkWIP once', () => {
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalledTimes(1);
    });

    it('calls get commit', () => {
      expect(octokit.git.getCommit).toHaveBeenCalled();
      expect(octokit.git.getCommit).toHaveBeenCalledTimes(1);
      expect(octokit.git.getCommit).toHaveBeenCalledWith({
        owner: pullRequestEditedPayload.repository.owner.login,
        repo: pullRequestEditedPayload.repository.name,
        commit_sha: pullRequestEditedPayload.pull_request.head.sha,
      });
    });

    it('does not assign PR author', () => {
      expect(octokit.issues.addAssignees).not.toHaveBeenCalled();
    });

    it('does not create comment for draft PRs', () => {
      expect(octokit.issues.createComment).not.toHaveBeenCalled();
    });
  });

  describe('Neither Draft nor WIP PRs', () => {
    beforeEach(async () => {
      octokit.git = {
        getCommit: jasmine.createSpy('getCommit').and.resolveTo({
          data: {
            message: '[skip ci] commit with skip prefix',
          },
        }),
      };
      // Receive a neither draft nor WIP payload.
      pullRequestEditedPayload.pull_request.draft = false;
      pullRequestEditedPayload.pull_request.title = 'Testing';
      await dispatcher.dispatch('pull_request_target', 'opened');
    });

    it('calls checkWIP function', () => {
      expect(checkWipDraftPRModule.checkWIP).toHaveBeenCalled();
    });

    it('does not call get commit', () => {
      expect(octokit.git.getCommit).not.toHaveBeenCalled();
    });

    it('does not assign PR author', () => {
      expect(octokit.issues.addAssignees).not.toHaveBeenCalled();
    });

    it('does not create a comment', () => {
      expect(octokit.issues.createComment).not.toHaveBeenCalled();
    });
  });
});
