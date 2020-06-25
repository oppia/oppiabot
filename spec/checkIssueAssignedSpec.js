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

const github = require('@actions/github');
const core = require('@actions/core');
const payload = require('../fixtures/issues.assigned.json');
const { google } = require('googleapis');
const dispatcher = require('../actions/src/dispatcher');
const checkIssueAssigneeModule = require('../actions/src/issues/checkIssueAssignee');
const checkIssueLabelModule = require('../actions/src/issues/checkIssueLabels');

describe('Check Issue Assignee Module', () => {
  /**
   * @type {import('@actions/github').GitHub} octokit
   */
  let octokit;

  beforeEach(async () => {
    github.context.eventName = 'issues';
    github.context.payload = payload;
    github.context.issue = payload.issue;
    github.context.repo = {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
    };

    octokit = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.resolveTo({}),
        removeAssignees: jasmine.createSpy('removeAssignees').and.resolveTo({}),
      },
    };

    spyOn(core, 'getInput').and.returnValue('sample-token');

    // Mock GitHub API.
    Object.setPrototypeOf(github.GitHub, function () {
      return octokit;
    });
    spyOn(checkIssueAssigneeModule, 'checkAssignees').and.callThrough();
    spyOn(checkIssueLabelModule, 'checkLabels').and.callFake(() => {});
  });

  describe('called for only issue event and assigned action', () => {
    it('should not be called for non issue event', async () => {
      await dispatcher.dispatch('pull_request', 'assigned');
      expect(checkIssueAssigneeModule.checkAssignees).not.toHaveBeenCalled();
    });

    it('should not be called for non assigned action', async () => {
      await dispatcher.dispatch('issues', 'opened');
      expect(checkIssueAssigneeModule.checkAssignees).not.toHaveBeenCalled();

      await dispatcher.dispatch('issues', 'labeled');
      expect(checkIssueAssigneeModule.checkAssignees).not.toHaveBeenCalled();
    });
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

      await dispatcher.dispatch('issues', 'assigned');
    });

    it('should call checkAssignees', () => {
      expect(checkIssueAssigneeModule.checkAssignees).toHaveBeenCalled();
    });

    it('should check the spreadsheet', () => {
      expect(google.sheets).toHaveBeenCalled();
    });

    it('should comment on issue', () => {
      const linkToCla = 'here'.link(
        'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#setting-things-up');
      expect(octokit.issues.createComment).toHaveBeenCalled();
      expect(octokit.issues.createComment).toHaveBeenCalledWith({
        issue_number: payload.issue.number,
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        body: 'Hi @' + payload.assignee.login + ', you need to sign the ' +
        'CLA before you can get assigned to issues. Follow the instructions ' +
        linkToCla + ' to get started. Thanks!',
      });
    });

    it('should unassign user', () => {
      expect(octokit.issues.removeAssignees).toHaveBeenCalled();
      expect(octokit.issues.removeAssignees).toHaveBeenCalledWith({
        issue_number: payload.issue.number,
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        assignees: [payload.assignee.login],
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

      await dispatcher.dispatch('issues', 'assigned');
    });

    it('should call checkAssignees', () => {
      expect(checkIssueAssigneeModule.checkAssignees).toHaveBeenCalled();
    });

    it('should check the spreadsheet', () => {
      expect(google.sheets).toHaveBeenCalled();
    });

    it('should not comment on issue', () => {
      expect(octokit.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not unassign user', () => {
      expect(octokit.issues.removeAssignees).not.toHaveBeenCalled();
    });
  });


  describe('when sheets api throws error', () => {
    beforeEach(async () => {
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.throwError('Unable to get sheet.'),
          },
        },
      });
      spyOn(core, 'setFailed').and.callThrough();

      await dispatcher.dispatch('issues', 'assigned');
    });

    it('should call checkAssignees', () => {
      expect(checkIssueAssigneeModule.checkAssignees).toHaveBeenCalled();
    });

    it('should check the spreadsheet', () => {
      expect(google.sheets).toHaveBeenCalled();
    });

    it('should fail the check', () =>{
      expect(core.setFailed).toHaveBeenCalled();
    });

    it('should not comment on issue', () => {
      expect(octokit.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not unassign user', () => {
      expect(octokit.issues.removeAssignees).not.toHaveBeenCalled();
    });
  });

  describe('check non whitelisted repo', () => {
    beforeEach(async () => {
      payload.repository.name = 'non-whitelisted-repo'
      await dispatcher.dispatch('issues', 'assigned');
    });

    it('should not be called for the payload', () => {
      expect(checkIssueAssigneeModule.checkAssignees).not.toHaveBeenCalled();
    });

    it('should not comment on issue', () => {
      expect(octokit.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not unassign user', () => {
      expect(octokit.issues.removeAssignees).not.toHaveBeenCalled();
    });
  })
});
