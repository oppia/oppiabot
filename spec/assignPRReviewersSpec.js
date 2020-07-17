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
 * @fileoverview Assign PR Reviewers spec.
 */

require('dotenv').config();
const { createProbot } = require('probot');
// The plugin refers to the actual app in index.js.
const checkWipDraftPRModule = require('../lib/checkWipDraftPR');
const scheduler = require('../lib/scheduler');
const pullRequestPayload = require('../fixtures/pullRequestPayload.json');
const apiForSheetsModule = require('../lib/apiForSheets');
const checkPullRequestLabelsModule = require('../lib/checkPullRequestLabels');
const checkPullRequestBranchModule = require('../lib/checkPullRequestBranch');
const checkPullRequestJobModule = require('../lib/checkPullRequestJob');
const assignPRReviewersModule = require('../lib/assignPRReviewers');
const oppiabot = require('../index');
const { defaultReviewer } = require('../userWhitelist.json');

describe('Assign PR Reviewers', () => {
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

    // Spy on other modules that will be triggered by the payload.
    spyOn(apiForSheetsModule, 'checkClaStatus').and.callFake(() => {});
    spyOn(
      checkPullRequestLabelsModule,
      'checkChangelogLabel'
    ).and.callFake(() => {});
    spyOn(checkWipDraftPRModule, 'checkWIP').and.callFake(() => {});
    spyOn(checkPullRequestJobModule, 'checkForNewJob').and.callFake(() => {});
    spyOn(checkPullRequestBranchModule, 'checkBranch').and.callFake(() => {});

    github = {
      issues: {
        addAssignees: jasmine.createSpy('addAssignees').and.resolveTo({}),
        createComment: jasmine.createSpy('createComment').and.resolveTo({}),
      },
    };
    robot = createProbot({
      id: 1,
      cert: 'test',
      githubToken: 'test',
    });

    app = robot.load(oppiabot);
    spyOn(app, 'auth').and.resolveTo(github);
    spyOn(assignPRReviewersModule, 'assignAllCodeowners').and.callThrough();
  });

  describe('when a pull request is created', () => {
    const codeowners = [
      { login: 'reviewer1' },
      { login: 'reviewer2' },
      { login: 'reviewer3' }
    ];

    beforeEach(async () => {
      pullRequestPayload.payload.pull_request.requested_reviewers = codeowners;
      await robot.receive(pullRequestPayload);
    });

    it('should call assignAllCodeowners', () => {
      expect(assignPRReviewersModule.assignAllCodeowners).toHaveBeenCalled();
    });

    it('should assign all codeowners', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        owner: pullRequestPayload.payload.repository.owner.login,
        repo: pullRequestPayload.payload.repository.name,
        issue_number: pullRequestPayload.payload.pull_request.number,
        assignees: ['reviewer1', 'reviewer2', 'reviewer3'],
      });
    });

    it('should ping codeowners', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        owner: pullRequestPayload.payload.repository.owner.login,
        repo: pullRequestPayload.payload.repository.name,
        issue_number: pullRequestPayload.payload.pull_request.number,
        body:
          'Assigning @reviewer1, @reviewer2, @reviewer3 for the ' +
          'first pass review of this PR. Thanks!',
      });
    });
  });

  describe('when a pull request has no codeowners', () => {
    beforeEach(async () => {
      pullRequestPayload.payload.pull_request.requested_reviewers = [];
      await robot.receive(pullRequestPayload);
    });

    it('should call assignAllcodeowners', () => {
      expect(assignPRReviewersModule.assignAllCodeowners).toHaveBeenCalled();
    });

    it('should not attempt to assign', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        owner: pullRequestPayload.payload.repository.owner.login,
        repo: pullRequestPayload.payload.repository.name,
        issue_number: pullRequestPayload.payload.pull_request.number,
        assignees: [defaultReviewer]
      });
    });

    it('should not ping', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        owner: pullRequestPayload.payload.repository.owner.login,
        repo: pullRequestPayload.payload.repository.name,
        issue_number: pullRequestPayload.payload.pull_request.number,
        body:
          'Assigning @' + defaultReviewer + ' for the ' +
          'first pass review of this PR. Thanks!',
      });
    });
  });
});
