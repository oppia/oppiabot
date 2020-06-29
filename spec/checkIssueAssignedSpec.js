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
 * @fileoverview Spec for issue assigned handler.
 */

require('dotenv').config();
const { createProbot } = require('probot');
const oppiaBot = require('../index');
const payloadData = require('../fixtures/issues.assigned.json');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const checkIssueAssigneeModule = require('../lib/checkIssueAssignee');
const apiForSheetsModule = require('../lib/apiForSheets');
const scheduler = require('../lib/scheduler');

describe('Check Issue Assignee Module', () => {
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

  beforeEach(async () => {
    spyOn(scheduler, 'createScheduler').and.callFake(() => {});

    github = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.resolveTo({}),
        removeAssignees: jasmine.createSpy('removeAssignees').and.resolveTo({}),
      },
    };

    robot = createProbot({
      id: 1,
      cert: 'test',
      githubToken: 'test',
    });

    app = robot.load(oppiaBot);
    spyOn(app, 'auth').and.resolveTo(github);

    // Mock google auth
    Object.setPrototypeOf(OAuth2Client, function () {
      return {};
    });
    spyOn(apiForSheetsModule, 'authorize').and.callThrough();
    spyOn(checkIssueAssigneeModule, 'checkAssignees').and.callThrough();
  });

  describe('check when user has not signed cla', () => {
    beforeEach(async () => {
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.resolveTo({
              data: { values: [['other_user']] },
            }),
          },
        },
      });

      await app.receive(payloadData);
    });

    it('should call checkAssignees', () => {
      expect(checkIssueAssigneeModule.checkAssignees).toHaveBeenCalled();
    });

    it('should be authorized', () => {
      expect(apiForSheetsModule.authorize).toHaveBeenCalled();
    });

    it('should check the spreadsheet', () => {
      expect(google.sheets).toHaveBeenCalled();
    });

    it('should comment on issue', () => {
      const linkToCla = 'here'.link(
        'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#setting-things-up'
      );
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.issue.number,
        owner: payloadData.payload.repository.owner.login,
        repo: payloadData.payload.repository.name,
        body:
          'Hi @' +
          payloadData.payload.assignee.login +
          ', you need to sign the ' +
          'CLA before you can get assigned to issues. Follow the instructions ' +
          linkToCla + ' to get started. I am unassigning you for now, feel ' +
          'free to assign yourself once you have signed the CLA. Thanks!'
      });
    });

    it('should unassign user', () => {
      expect(github.issues.removeAssignees).toHaveBeenCalled();
      expect(github.issues.removeAssignees).toHaveBeenCalledWith({
        issue_number: payloadData.payload.issue.number,
        owner: payloadData.payload.repository.owner.login,
        repo: payloadData.payload.repository.name,
        assignees: [payloadData.payload.assignee.login],
      });
    });
  });

  describe('check when user has signed cla', () => {
    beforeEach(async () => {
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.resolveTo({
              data: { values: [['test_user']] },
            }),
          },
        },
      });

      await app.receive(payloadData);
    });

    it('should call checkAssignees', () => {
      expect(checkIssueAssigneeModule.checkAssignees).toHaveBeenCalled();
    });

    it('should check the spreadsheet', () => {
      expect(google.sheets).toHaveBeenCalled();
    });

    it('should not comment on issue', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not unassign user', () => {
      expect(github.issues.removeAssignees).not.toHaveBeenCalled();
    });
  });

  describe('when sheets api throws error', () => {
    beforeEach(async () => {
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine
              .createSpy('get')
              .and.throwError('Unable to get sheet.'),
          },
        },
      });

      await app.receive(payloadData);
    });

    it('should call checkAssignees', () => {
      expect(checkIssueAssigneeModule.checkAssignees).toHaveBeenCalled();
    });

    it('should be authorized', () => {
      expect(apiForSheetsModule.authorize).toHaveBeenCalled();
    });

    it('should check the spreadsheet', () => {
      expect(google.sheets).toHaveBeenCalled();
    });

    it('should not comment on issue', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not unassign user', () => {
      expect(github.issues.removeAssignees).not.toHaveBeenCalled();
    });
  });

  describe('check non whitelisted repo', () => {
    beforeEach(async () => {
      payloadData.payload.repository.name = 'non-whitelisted-repo';
      await app.receive(payloadData);
    });

    it('should not be called for the payload', () => {
      expect(checkIssueAssigneeModule.checkAssignees).not.toHaveBeenCalled();
    });

    it('should not comment on issue', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not unassign user', () => {
      expect(github.issues.removeAssignees).not.toHaveBeenCalled();
    });
  });
});
