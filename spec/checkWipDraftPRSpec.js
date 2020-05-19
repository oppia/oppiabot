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
    github = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.resolveTo({}),
        update: jasmine.createSpy('update').and.resolveTo({})
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

  describe('WIP PRs', () => {
    beforeEach((done) => {
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

    it('creates comment for WIP PRs', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledTimes(1);

      // Comment on Pull Request.
      const link = 'here'.link(
        'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia' +
        '#wip--draft-pull-requests');
      const author = pullRequestEditedPayload.payload.pull_request.user.login;
      const commentBody = (
        'Hi @' + author + ', WIP/Draft PRs are highly discouraged. You can ' +
        'learn more about it ' + link + '. Do well to reopen it when it\'s ' +
        'ready to be reviewed and ensure that it is without any WIP text. ' +
        'Thanks!');

      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: pullRequestEditedPayload.payload.pull_request.number,
        owner: pullRequestEditedPayload.payload.repository.owner.login,
        repo: pullRequestEditedPayload.payload.repository.name,
        body: commentBody
      });
    });

    it('closes WIP PRs', () => {
      expect(github.issues.update).toHaveBeenCalled();
      expect(github.issues.update).toHaveBeenCalledTimes(1);

      expect(github.issues.update).toHaveBeenCalledWith({
        issue_number: pullRequestEditedPayload.payload.pull_request.number,
        owner: pullRequestEditedPayload.payload.repository.owner.login,
        repo: pullRequestEditedPayload.payload.repository.name,
        state: 'closed'
      });
    });
  });

  describe('Draft PRs', () => {
    beforeEach((done) => {
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

    it('calls with draft payload', () => {
      const args = checkWipDraftPRModule.checkWIP.calls.argsFor(0)[0];
      expect(args.payload.pull_request.draft).toBe(true);
      expect(args.payload.pull_request.title).toBe('Testing Draft');
    });

    it('creates comment for draft PRs', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledTimes(1);

      const link = 'here'.link(
        'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia' +
        '#wip--draft-pull-requests');
      const author = pullRequestEditedPayload.payload.pull_request.user.login;
      const commentBody = (
        'Hi @' + author + ', WIP/Draft PRs are highly discouraged. You can ' +
        'learn more about it ' + link + '. Do well to reopen it when it\'s ' +
        'ready to be reviewed and ensure that it is without any WIP text. ' +
        'Thanks!');

      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: pullRequestEditedPayload.payload.pull_request.number,
        owner: pullRequestEditedPayload.payload.repository.owner.login,
        repo: pullRequestEditedPayload.payload.repository.name,
        body: commentBody
      });
    });

    it('closes draft PRs', () => {
      expect(github.issues.update).toHaveBeenCalled();
      expect(github.issues.update).toHaveBeenCalledTimes(1);

      expect(github.issues.update).toHaveBeenCalledWith({
        issue_number: pullRequestEditedPayload.payload.pull_request.number,
        owner: pullRequestEditedPayload.payload.repository.owner.login,
        repo: pullRequestEditedPayload.payload.repository.name,
        state: 'closed'
      });
    });
  });

  describe('Neither Draft nor WIP PRs', () => {
    beforeEach((done) => {
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
    it('does not create a comment', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
    it('does not close the PR', ()=> {
      expect(github.issues.update).not.toHaveBeenCalled();
    });
  });
});
