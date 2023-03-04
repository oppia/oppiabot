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
const checkPullRequestLabelModule = require('../lib/checkPullRequestLabels');
const checkPullRequestJobModule = require('../lib/checkPullRequestJob');
const checkCriticalPullRequestModule =
  require('../lib/checkCriticalPullRequest');
const checkPullRequestTemplateModule =
  require('../lib/checkPullRequestTemplate');
const scheduler = require('../lib/scheduler');
const OLD_BUILD_LABEL = "PR: don't merge - STALE BUILD";
const utilityModule = require('../lib/utils');
const github = require('@actions/github');
const core = require('@actions/core');
const actionPayload = require('../fixtures/pullRequest.labelled.json');
const dispatcher = require('../actions/src/dispatcher');
const pRLabelModule = require('../actions/src/pull_requests/labelCheck');

let payloadData = JSON.parse(
  JSON.stringify(require('../fixtures/pullRequestPayload.json'))
);

describe('Pull Request Label Check', () => {
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
    spyOn(scheduler, 'createScheduler').and.callFake(() => { });
    spyOn(utilityModule, 'sleep').and.callFake(() => { });

    github = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.returnValue({}),
        addAssignees: jasmine.createSpy('addAssignees').and.resolveTo({}),
        removeLabel: jasmine.createSpy('removeLabel').and.resolveTo({}),
        addLabels: jasmine.createSpy('addLabels').and.resolveTo({}),
      },
      repos: {
        checkCollaborator: jasmine.createSpy('checkCollaborator').and.callFake(
          (params) => {
            if (params.username === 'newuser') {
              throw new Error('User is not a collaborator.');
            }
            return { status: 204 };
          })
      }
    };

    robot = createProbot({
      id: 1,
      cert: 'test',
      githubToken: 'test',
    });

    app = robot.load(oppiaBot);
    spyOn(app, 'auth').and.resolveTo(github);
    spyOn(checkPullRequestJobModule, 'checkForNewJob').and.callFake(() => { });
    spyOn(
      checkCriticalPullRequestModule, 'checkIfPRAffectsDatastoreLayer'
    ).and.callFake(() => { });
    spyOn(
      checkPullRequestTemplateModule, 'checkTemplate'
    ).and.callFake(() => { });
  });

  describe('when pull request is created', () => {
    describe('when all codeowners should be assigned', () => {
      beforeEach(async () => {
        payloadData.payload.action = 'opened';
        payloadData.payload.pull_request.requested_reviewers = [
          { login: 'reviewer1' },
          { login: 'reviewer2' },
        ];
        payloadData.payload.pull_request.assignees = [];
        // Set project owner to be pr author.
        payloadData.payload.pull_request.user.login = 'kevintab95';
        spyOn(checkPullRequestLabelModule, 'checkAssignee').and.callThrough();
        await robot.receive(payloadData);
      });

      it('should not assign project owner', () => {
        const arg = github.issues.addAssignees.calls.argsFor(0)[0];
        expect(arg.assignees.includes('kevintab95')).toBe(false);
      });

      it('should assign all reviewers', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          issue_number: payloadData.payload.number,
          assignees: ['reviewer1', 'reviewer2'],
        });
      });

      afterAll(() => {
        payloadData.payload.pull_request.requested_reviewers = [];
      });
    });

    describe('when pr author is the only codeowner', () => {
      beforeEach(async () => {
        payloadData.payload.action = 'opened';
        payloadData.payload.pull_request.requested_reviewers = [];
        payloadData.payload.pull_request.assignees = [];
        // Set project owner to be pr author.
        payloadData.payload.pull_request.user.login = 'kevintab95';
        spyOn(checkPullRequestLabelModule, 'checkAssignee').and.callThrough();
        await robot.receive(payloadData);
      });

      it('should check changelog label', () => {
        expect(checkPullRequestLabelModule.checkAssignee).toHaveBeenCalled();
      });

      it('should assign pr author', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          issue_number: payloadData.payload.number,
          assignees: ['kevintab95'],
        });
      });

      it('should ping pr author', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          body:
            'Hi @' +
            payloadData.payload.pull_request.user.login +
            ' please assign the required reviewer(s) for this PR. Thanks!',
        });
      });
    });

    describe('when a pr label gets added', () => {
      const label = {
        id: 638839900,
        node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
        url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
        name: 'dependencies',
        color: '00FF00',
      };

      beforeEach(async () => {
        payloadData.payload.action = 'labeled';
        payloadData.payload.label = label;
        spyOn(
          checkPullRequestLabelModule, 'checkForIssueLabel'
        ).and.callThrough();
        await robot.receive(payloadData);
      });

      it('checks the label', () => {
        expect(checkPullRequestLabelModule.checkForIssueLabel).toHaveBeenCalled();
      });

      it('does not comment on the PR', () => {
        expect(github.issues.createComment).not.toHaveBeenCalled();
      });

      it('does not remove the label', () => {
        expect(github.issues.removeLabel).not.toHaveBeenCalled();
      });
    });

    it('should not assign anyone if a user is already assigned', async () => {
      payloadData.payload.action = 'opened';
      payloadData.payload.pull_request.requested_reviewers = [
        { login: 'testuser1' },
      ];
      payloadData.payload.pull_request.assignees = [{ login: 'testuser1' }];
      spyOn(checkPullRequestLabelModule, 'checkAssignee').and.callThrough();
      await robot.receive(payloadData);

      expect(checkPullRequestLabelModule.checkAssignee).toHaveBeenCalled();
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not assign when there are review comments', async () => {
      payloadData.payload.action = 'opened';
      payloadData.payload.pull_request.assignees = [];
      // Simulate when the payload alread has review comments.
      payloadData.payload.pull_request.review_comments = 2;
      spyOn(checkPullRequestLabelModule, 'checkAssignee').and.callThrough();
      await robot.receive(payloadData);

      expect(checkPullRequestLabelModule.checkAssignee).toHaveBeenCalled();
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

  });

  describe('when a issue label gets added', () => {
    const label = {
      id: 638839900,
      node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
      url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
      name: 'issue label',
      color: '00FF00',
    };

    beforeEach(async () => {
      payloadData.payload.action = 'labeled';
      payloadData.payload.sender = {'login': 'user'}
      payloadData.payload.label = label;
      spyOn(
        checkPullRequestLabelModule, 'checkForIssueLabel'
      ).and.callThrough();
      await robot.receive(payloadData);
    });

    it('checks the label', () => {
      expect(checkPullRequestLabelModule.checkForIssueLabel).toHaveBeenCalled();
    });

    it('comments on the PR', () => {
      expect(github.issues.createComment).toHaveBeenCalledWith({
        body:
          'Hi @user, the issue label label should only be used on ' +
          'issues, and I’m removing the label. You can learn more about ' +
          'labels <a href="https://github.com/oppia/oppia/wiki/Contributing' +
          '-code-to-Oppia#labeling-issues-and-pull-requests">here</a>. Thanks!',
        number: payloadData.payload.pull_request.number,
        owner: payloadData.payload.repository.owner.login,
        repo: payloadData.payload.repository.name
      });
    });

    it('removes the label', () => {
      expect(github.issues.removeLabel).toHaveBeenCalled();
    });
  });

  describe('when datastore label gets removed by non whitelisted user', () => {
    const label = {
      id: 638839900,
      node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
      url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
      name: 'PR: Affects datastore layer',
      color: '00FF00',
    };

    beforeEach(async () => {
      payloadData.payload.action = 'unlabeled';
      payloadData.payload.label = label;
      spyOn(
        checkPullRequestLabelModule, 'checkCriticalLabel'
      ).and.callThrough();
      await robot.receive(payloadData);
    });

    it('should check for datastore label', () => {
      expect(checkPullRequestLabelModule.checkCriticalLabel).toHaveBeenCalled();
    });

    it('should comment on PR', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        body:
          'Hi @' + payloadData.payload.sender.login +
          ', only members of the release team ' +
          '/cc @oppia/release-coordinators ' +
          'are allowed to remove PR: Affects datastore layer labels. ' +
          'I will be adding it back. Thanks!',
        number: payloadData.payload.pull_request.number,
        owner: payloadData.payload.repository.owner.login,
        repo: payloadData.payload.repository.name
      });
    });

    it('should add the datastore label', () => {
      expect(github.issues.addLabels).toHaveBeenCalled();
      expect(github.issues.addLabels).toHaveBeenCalledWith({
        labels: ['PR: Affects datastore layer'],
        number: payloadData.payload.pull_request.number,
        owner: payloadData.payload.repository.owner.login,
        repo: payloadData.payload.repository.name
      });
    });
  });

  describe('when datastore label gets removed by whitelisted user', () => {
    const label = {
      id: 638839900,
      node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
      url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
      name: 'PR: Affects datastore layer',
      color: '00FF00',
    };

    beforeEach(async () => {
      payloadData.payload.action = 'unlabeled';
      payloadData.payload.label = label;
      payloadData.payload.sender.login = 'seanlip';
      spyOn(
        checkPullRequestLabelModule, 'checkCriticalLabel'
      ).and.callThrough();
      await robot.receive(payloadData);
    });

    it('checks for datastore label', () => {
      expect(checkPullRequestLabelModule.checkCriticalLabel).toHaveBeenCalled();
    });

    it('does not add back the label', () => {
      expect(github.issues.addLabels).not.toHaveBeenCalled();
    });

    it('does not comment on the PR', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
  });

  describe('when stale build label gets removed before updating branch', () => {
    const label = {
      id: 638839900,
      node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
      url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
      name: "PR: don't merge - STALE BUILD",
      color: '00FF00',
    };

    beforeEach(async () => {
      payloadData.payload.action = 'unlabeled';
      payloadData.payload.label = label;
      spyOn(
        checkPullRequestLabelModule, 'checkStaleBuildLabelRemoved',
      ).and.callThrough();
      github.repos.getCommit = jasmine.createSpy('getCommit').and.resolveTo({
        data: {
          commit: {
            author: {
              date: '2021-04-12T18:33:45Z'
            }
          }
        }
      });
      await robot.receive(payloadData);
    });

    it('checks for stale build label', () => {
      expect(checkPullRequestLabelModule.checkStaleBuildLabelRemoved).
        toHaveBeenCalled();
    });

    it('check if pr is stale', () => {
      expect(github.repos.getCommit).toHaveBeenCalled();
      expect(github.repos.getCommit).toHaveBeenCalledWith({
        owner: 'oppia',
        repo: 'oppia',
        ref: payloadData.payload.pull_request.head.sha
      });
    });

    it('should comment on PR', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        number: payloadData.payload.pull_request.number,
        owner: payloadData.payload.repository.owner.login,
        repo: payloadData.payload.repository.name,
        body:
        'Hi @' + payloadData.payload.sender.login + ', the build of this' +
        ' PR is stale please do not remove \'' + OLD_BUILD_LABEL + '\'' +
        ' label. ',
      });
    });

    it('should add the stale build label', () => {
      expect(github.issues.addLabels).toHaveBeenCalled();
      expect(github.issues.addLabels).toHaveBeenCalledWith({
        labels: [OLD_BUILD_LABEL],
        number: payloadData.payload.pull_request.number,
        owner: payloadData.payload.repository.owner.login,
        repo: payloadData.payload.repository.name
      });
    });
  });

  describe('when stale build label removed after updating branch', () => {
    const label = {
      id: 638839900,
      node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
      url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
      name: "PR: don't merge - STALE BUILD",
      color: '00FF00',
    };

    beforeEach(async () => {
      payloadData.payload.action = 'unlabeled';
      payloadData.payload.label = label;
      payloadData.payload.sender.login = 'seanlip';
      spyOn(
        checkPullRequestLabelModule, 'checkStaleBuildLabelRemoved'
      ).and.callThrough();
      github.repos.getCommit = jasmine.createSpy('getCommit').and.resolveTo({
        data: {
          commit: {
            author: {
              date: (new Date).toString()
            }
          }
        }
      });
      await robot.receive(payloadData);
    });

    it('checks for stale build label', () => {
      expect(checkPullRequestLabelModule.checkStaleBuildLabelRemoved).
        toHaveBeenCalled();
    });

    it('check if pr is stale', () => {
      expect(github.repos.getCommit).toHaveBeenCalled();
      expect(github.repos.getCommit).toHaveBeenCalledWith({
        repo: 'oppia',
        owner: 'oppia',
        ref: payloadData.payload.pull_request.head.sha
      });
    });

    it('does not add back the label', () => {
      expect(github.issues.addLabels).not.toHaveBeenCalled();
    });

    it('does not comment on the PR', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
  });

  describe('when hotfix label gets added', () => {
    const label = {
      id: 638839900,
      node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
      url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
      name: 'PR: Needs to be hotfixed',
      color: '00FF00',
    };

    beforeEach(async () => {
      payloadData.payload.action = 'labeled';
      payloadData.payload.label = label;
      spyOn(checkPullRequestLabelModule, 'checkHotfixLabel').and.callThrough();
      await robot.receive(payloadData);
    });

    it('should check for hotfix label', () => {
      expect(checkPullRequestLabelModule.checkHotfixLabel).toHaveBeenCalled();
    });

    it('should comment on PR', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        body:
          'Hi, @oppia/release-coordinators flagging this pull request for ' +
          'for your attention since this is labelled as a hotfix PR. ' +
          'Please ensure that you add the "PR: for current release" ' +
          'label if the next release is in progress. Thanks!',
        number: payloadData.payload.pull_request.number,
        owner: payloadData.payload.repository.owner.login,
        repo: payloadData.payload.repository.name
      })
    })
  });

  describe('when another label gets removed', () => {
    const label = {
      id: 638839900,
      node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
      url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
      name: 'dependencies',
      color: '00FF00',
    };

    beforeEach(async () => {
      payloadData.payload.action = 'unlabeled';
      payloadData.payload.label = label;
      spyOn(
        checkPullRequestLabelModule, 'checkCriticalLabel'
      ).and.callThrough();
      await robot.receive(payloadData);
    });

    it('checks for datastore label', () => {
      expect(checkPullRequestLabelModule.checkCriticalLabel).toHaveBeenCalled();
    });

    it('does not add back the label', () => {
      expect(github.issues.addLabels).not.toHaveBeenCalled();
    });

    it('does not comment on the PR', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
  });
});

describe('Pull Request Label Action Check', () => {
  /**
   * @type {import('@actions/github').GitHub} octokit
   */
  let octokit;

  beforeEach(async () => {
    github.context.eventName = 'pull_request';
    github.context.payload = actionPayload;

    octokit = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.resolveTo({}),
        removeLabel: jasmine.createSpy('removeLabel').and.resolveTo({}),
        addAssignees: jasmine.createSpy('addAssignees').and.resolveTo({}),
      },
      pulls: {
        get: jasmine.createSpy('get').and.resolveTo(
          {data: actionPayload.pull_request}
        ),
      }
    };

    spyOn(core, 'getInput').and.returnValue('sample-token');
    spyOn(core, 'setFailed').and.callFake(() => {});
    spyOn(core, 'info').and.callFake(() => {});

    spyOnProperty(github.context, 'repo').and.returnValue({
      owner: actionPayload.repository.owner.login,
      repo: actionPayload.repository.name,
    });

    // Mock GitHub API.
    Object.setPrototypeOf(github.GitHub, function () {
      return octokit;
    });
    spyOn(pRLabelModule, 'checkLabels').and.callThrough();
    spyOn(pRLabelModule, 'checkUnLabeled').and.callThrough();
  });

  describe("when a don't merge label gets added to a pull request",
    () => {
      beforeEach(async () => {
        await dispatcher.dispatch('pull_request', 'labeled');
      });

      it('should check the label', () => {
        expect(pRLabelModule.checkLabels).toHaveBeenCalled();
      });
      it('should fail CI', () => {
        expect(core.setFailed).toHaveBeenCalled();
        expect(core.setFailed).toHaveBeenCalledWith(
          'This PR should not be merged because it has a ' +
          actionPayload.label.name + ' label.'
        );
      });
    }
  );

  describe("When a don't merge label gets removed", () => {
    let initialLabel;
    beforeEach(async () => {
      initialLabel = {...actionPayload.label};
      actionPayload.pull_request.labels = [];
      await dispatcher.dispatch('pull_request', 'unlabeled');
    });

    afterAll(() => {
      actionPayload.label = initialLabel;
    });

    it('should check the label', () => {
      expect(pRLabelModule.checkUnLabeled).toHaveBeenCalled();
    });
    it('should not fail CI', () => {
      expect(core.setFailed).not.toHaveBeenCalled();
      expect(core.info).toHaveBeenCalled();
      expect(core.info).toHaveBeenCalledWith(
        "This PR does not contain a PR don't merge label"
      );
    });
  });

  describe(
    "When a don't merge label gets removed but PR contains other don't " +
    'merge labels',
    () => {
      let initialLabel;
      beforeEach(async () => {
        initialLabel = {...actionPayload.label};
        actionPayload.pull_request.labels = [
          {name: "PR: don't merge - Rejected"}
        ];
        await dispatcher.dispatch('pull_request', 'unlabeled');
      });

      afterAll(() => {
        actionPayload.label = initialLabel;
      });

      it('should check the label', () => {
        expect(pRLabelModule.checkUnLabeled).toHaveBeenCalled();
      });
      it('should fail CI', () => {
        expect(core.setFailed).toHaveBeenCalled();
        expect(core.setFailed).toHaveBeenCalledWith(
          'This PR should not be merged because it has a ' +
          "PR: don't merge - Rejected label."
        );
      });
    });

  describe('When another label gets added to a pull request', () => {
    let initialLabel;
    beforeEach(async () => {
      initialLabel = {...actionPayload.label};
      actionPayload.label.name = 'random label';
      await dispatcher.dispatch('pull_request', 'labeled');
    });

    afterAll(() => {
      actionPayload.label = initialLabel;
    });

    it('should check the label', () => {
      expect(pRLabelModule.checkLabels).toHaveBeenCalled();
    });
    it('should not fail CI', () => {
      expect(core.setFailed).not.toHaveBeenCalled();
    });
  });

  describe('When another label gets removed from a pull request', () => {
    let initialLabel;
    beforeEach(async () => {
      initialLabel = {...actionPayload.label};
      actionPayload.label.name = 'random label';
      await dispatcher.dispatch('pull_request', 'unlabeled');
    });

    afterAll(() => {
      actionPayload.label = initialLabel;
    });

    it('should check the label', () => {
      expect(pRLabelModule.checkUnLabeled).toHaveBeenCalled();
    });
    it('should not fail CI', () => {
      expect(core.setFailed).not.toHaveBeenCalled();
    });
  });
});
