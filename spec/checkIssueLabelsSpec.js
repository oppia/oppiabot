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
 * @fileoverview Spec for issue labeled handler.
 */

const github = require('@actions/github');
const core = require('@actions/core');
const payload = require('../fixtures/issues.labelled.json');
const whitelist = require('../userWhitelist.json');
const dispatcher = require('../actions/src/dispatcher');
const checkIssueLabelModule = require('../actions/src/issues/checkIssueLabels');

describe('Check Issue Labels Module', () => {
  /**
   * @type {import('@actions/github').GitHub} octokit
   */
  let octokit;

  beforeEach(async () => {
    github.context.eventName = 'issues';
    github.context.payload = payload;
    github.context.issue = payload.issue;

    octokit = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.resolveTo({}),
        removeLabel: jasmine.createSpy('removeLabel').and.resolveTo({}),
        addAssignees: jasmine.createSpy('addAssignees').and.resolveTo({}),
      },
    };

    spyOn(core, 'getInput').and.returnValue('sample-token');
    spyOnProperty(github.context, 'repo').and.returnValue({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
    });

    // Mock GitHub API.
    Object.setPrototypeOf(github.GitHub, function () {
      return octokit;
    });
    spyOn(checkIssueLabelModule, 'checkLabels').and.callThrough();
  });

  describe('called for only issue event and labeled action', () => {
    it('should not be called for non issue event', async () => {
      await dispatcher.dispatch('pull_request', 'labeled');
      expect(checkIssueLabelModule.checkLabels).not.toHaveBeenCalled();
    });

    it('should not be called for non labeled action', async () => {
      await dispatcher.dispatch('issues', 'opened');
      expect(checkIssueLabelModule.checkLabels).not.toHaveBeenCalled();
    });
  });

  describe('check for good first issue label by non whitelisted user', () => {
    beforeEach(async () => {
      await dispatcher.dispatch('issues', 'labeled');
    });

    it('should be called for the payload', () => {
      expect(checkIssueLabelModule.checkLabels).toHaveBeenCalled();
    });

    it('should create appropriate comment', () => {
      expect(octokit.issues.createComment).toHaveBeenCalled();
      const user = payload.sender.login;
      const body = (
        'Hi @' + user + ', thanks for proposing this as a good first issue. ' +
        'I am removing the label for now and looping in ' +
        '@' + whitelist.teamLeads.onboardingTeam + ' to approve the label. ' +
        'It will be added back if approved. Thanks!');

      expect(octokit.issues.createComment).toHaveBeenCalledWith({
        issue_number: payload.issue.number,
        body: body,
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
      });
    });

    it('should remove the label', () => {
      expect(octokit.issues.removeLabel).toHaveBeenCalled();
      expect(octokit.issues.removeLabel).toHaveBeenCalledWith({
        issue_number: payload.issue.number,
        name: 'good first issue',
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
      });
    });

    it('should assign team lead', () => {
      expect(octokit.issues.addAssignees).toHaveBeenCalled();
      expect(octokit.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: payload.issue.number,
        assignees: [whitelist.teamLeads.onboardingTeam],
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
      });
    });
  });

  describe('check for good first issue by whitelisted user', () => {
    beforeEach(async () => {
      payload.sender.login = 'seanlip';
      await dispatcher.dispatch('issues', 'labeled');
    });

    it('should be called for the payload', () => {
      expect(checkIssueLabelModule.checkLabels).toHaveBeenCalled();
    });

    it('should not comment on issue', () => {
      expect(octokit.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not remove the label', () => {
      expect(octokit.issues.removeLabel).not.toHaveBeenCalled();
    });

    it('should not assign team lead', () => {
      expect(octokit.issues.addAssignees).not.toHaveBeenCalled();
    });
  });

  describe('check for changelog labels', () => {
    beforeEach(async () => {
      payload.label.name = 'PR CHANGELOG: Server Errors -- @kevintab95';
      await dispatcher.dispatch('issues', 'labeled');
    });

    it('should be called for the payload', () => {
      expect(checkIssueLabelModule.checkLabels).toHaveBeenCalled();
    });

    it('should create appropriate comment', () => {
      expect(octokit.issues.createComment).toHaveBeenCalled();

      const user = payload.sender.login;
      const link = (
        'here'.link(
          'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#' +
        'labeling-issues-and-pull-requests')
      );
      const body = (
        'Hi @' + user + ', changelog labels should not be used on issues.' +
        ' I’m removing the label. You can learn more about labels ' + link +
        '. Thanks!');

      expect(octokit.issues.createComment).toHaveBeenCalledWith({
        issue_number: payload.issue.number,
        body: body,
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
      });
    });

    it('should remove the label', () => {
      expect(octokit.issues.removeLabel).toHaveBeenCalled();
      expect(octokit.issues.removeLabel).toHaveBeenCalledWith({
        issue_number: payload.issue.number,
        name: 'PR CHANGELOG: Server Errors -- @kevintab95',
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
      });
    });
  });

  describe('check for PR labels', () => {
    const testLabel = 'dependencies';
    beforeEach(async () => {
      payload.label.name = testLabel;
      await dispatcher.dispatch('issues', 'labeled');
    });

    it('should be called for the payload', () => {
      expect(checkIssueLabelModule.checkLabels).toHaveBeenCalled();
    });

    it('should create appropriate comment', () => {
      expect(octokit.issues.createComment).toHaveBeenCalled();

      const user = payload.sender.login;
      const link = (
        'here'.link(
          'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#' +
        'labeling-issues-and-pull-requests')
      );
      const body = (
        'Hi @' + user + ', the ' + testLabel + ' label should only be used ' +
        'in pull requests. I’m removing the label. You can learn more ' +
        'about labels ' + link + '. Thanks!');

      expect(octokit.issues.createComment).toHaveBeenCalledWith({
        issue_number: payload.issue.number,
        body: body,
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
      });
    });

    it('should remove the label', () => {
      expect(octokit.issues.removeLabel).toHaveBeenCalled();
      expect(octokit.issues.removeLabel).toHaveBeenCalledWith({
        issue_number: payload.issue.number,
        name: testLabel,
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
      });
    });
  });

  describe('check for issues labels', () => {
    const testLabel = 'code-health';
    beforeEach(async () => {
      payload.label.name = testLabel;
      await dispatcher.dispatch('issues', 'labeled');
    });

    it('should be called for the payload', () => {
      expect(checkIssueLabelModule.checkLabels).toHaveBeenCalled();
    });

    it('should not comment', () => {
      expect(octokit.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not remove the label', () => {
      expect(octokit.issues.removeLabel).not.toHaveBeenCalled();
    });
  });


  describe('check non whitelisted repo', () => {
    beforeEach(async () => {
      payload.repository.name = 'non-whitelisted-repo';
      await dispatcher.dispatch('issues', 'labeled');
    });

    it('should not be called for the payload', () => {
      expect(checkIssueLabelModule.checkLabels).not.toHaveBeenCalled();
    });

    it('should not comment on issue', () => {
      expect(octokit.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not remove the label', () => {
      expect(octokit.issues.removeLabel).not.toHaveBeenCalled();
    });

    it('should not assign team lead', () => {
      expect(octokit.issues.addAssignees).not.toHaveBeenCalled();
    });
  });
});
