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
              return { status: 404 };
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
      checkCriticalPullRequestModule,
      'checkIfPRAffectsDatastoreLayer').and.callFake(() => { });
    spyOn(
      checkPullRequestTemplateModule, 'checkTemplate').and.callFake(() => { });
  });

  describe('when pull request gets labeled', () => {
    describe('assigns a person based on changelog label', () => {
      const label = {
        id: 638839900,
        node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
        url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
        name: 'PR CHANGELOG: Server Errors -- @kevintab95',
        color: '00FF00',
      };
      const reviewers = [{ login: 'kevintab95' }];
      beforeEach(async () => {
        // Set the payload action and label which will simulate adding
        // the changelog label.
        payloadData.payload.action = 'labeled';
        payloadData.payload.label = label;
        payloadData.payload.pull_request.requested_reviewers = reviewers;
        payloadData.payload.pull_request.assignees = [];
        spyOn(checkPullRequestLabelModule, 'checkAssignee').and.callThrough();
        await robot.receive(payloadData);
      });

      it('should call pull request label module', () => {
        expect(checkPullRequestLabelModule.checkAssignee).toHaveBeenCalled();
      });

      it('should assign the project owner', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        const params = {
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          issue_number: payloadData.payload.number,
          assignees: ['kevintab95'],
        };
        expect(github.issues.addAssignees).toHaveBeenCalledWith(params);
      });

      it('should ping the project owner', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        const params = {
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          issue_number: payloadData.payload.number,
          body:
            'Assigning @kevintab95 for the first-pass review' +
            ' of this pull request. Thanks!',
        };
        expect(github.issues.createComment).toHaveBeenCalledWith(params);
      });

      afterAll(() => {
        payloadData.payload.pull_request.requested_reviewers = [];
      });
    });

    describe('when pr author is the project owner', () => {
      beforeEach(async () => {
        const label = {
          id: 638839900,
          node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
          url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
          name: 'PR CHANGELOG: Server Errors -- @kevintab95',
          color: '00FF00',
        };
        // Set the payload action and label which will simulate adding
        // the changelog label.
        payloadData.payload.action = 'labeled';
        payloadData.payload.label = label;
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

      it('should check changelog label', () => {
        expect(checkPullRequestLabelModule.checkAssignee).toHaveBeenCalled();
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

    describe('when pr author is project owner and the only codeowner', () => {
      beforeEach(async () => {
        const label = {
          id: 638839900,
          node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
          url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
          name: 'PR CHANGELOG: Server Errors -- @kevintab95',
          color: '00FF00',
        };
        // Set the payload action and label which will simulate adding
        // the changelog label.
        payloadData.payload.action = 'labeled';
        payloadData.payload.label = label;
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

    describe('when pr changelog is excluded from codeowner assignment', () => {
      const label = {
        id: 638839900,
        node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
        url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
        name: 'PR CHANGELOG: Angular Migration -- @kevintab95',
        color: '00FF00',
      };

      beforeEach(async () => {
        // Set the payload action and label which will simulate adding
        // the changelog label.
        payloadData.payload.action = 'labeled';
        payloadData.payload.label = label;
        payloadData.payload.pull_request.requested_reviewers = ['testuser'];
        payloadData.payload.pull_request.assignees = [];
        spyOn(checkPullRequestLabelModule, 'checkAssignee').and.callThrough();
        await robot.receive(payloadData);
      });

      it('should call pull request label module', () => {
        expect(checkPullRequestLabelModule.checkAssignee).toHaveBeenCalled();
      });

      it('should assign the project owner', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        const params = {
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          issue_number: payloadData.payload.number,
          assignees: ['kevintab95'],
        };
        expect(github.issues.addAssignees).toHaveBeenCalledWith(params);
      });

      it('should ping the project owner', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        const params = {
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          issue_number: payloadData.payload.number,
          body:
            'Assigning @kevintab95 for the first-pass review' +
            ' of this pull request. Thanks!',
        };
        expect(github.issues.createComment).toHaveBeenCalledWith(params);
      });

      afterAll(() => {
        payloadData.payload.pull_request.requested_reviewers = [];
      });
    });

    it('should not assign anyone if a user is already assigned', async () => {
      const label = {
        id: 638839900,
        node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
        url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
        name: 'PR CHANGELOG: Server Errors -- @testuser1',
        color: '00FF00',
      };
      // Set the payload action and label which will simulate adding
      // the changelog label.
      payloadData.payload.action = 'labeled';
      payloadData.payload.label = label;
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

    it('should not assign if a changelog label is not added', async () => {
      const label = {
        id: 638839900,
        node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
        url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
        name: 'dependencies',
        color: '00FF00',
      };
      // Set the payload action and label which will simulate adding
      // the changelog label.
      payloadData.payload.action = 'labeled';
      payloadData.payload.label = label;
      payloadData.payload.pull_request.assignees = [];
      spyOn(checkPullRequestLabelModule, 'checkAssignee').and.callThrough();
      await robot.receive(payloadData);

      expect(checkPullRequestLabelModule.checkAssignee).toHaveBeenCalled();
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not assign when invalid changelog is applied', async () => {
      const label = {
        id: 638839900,
        node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
        url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
        name: 'PR CHANGELOGS: Server Errors -- @kevintab95',
        color: '00FF00',
      };

      payloadData.payload.action = 'labeled';
      payloadData.payload.label = label;
      payloadData.payload.pull_request.assignees = [];
      spyOn(checkPullRequestLabelModule, 'checkAssignee').and.callThrough();
      await robot.receive(payloadData);

      expect(checkPullRequestLabelModule.checkAssignee).toHaveBeenCalled();
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not assign when there are review comments', async () => {
      const label = {
        id: 638839900,
        node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
        url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
        name: 'PR CHANGELOG: Server Errors -- @kevintab95',
        color: '00FF00',
      };

      payloadData.payload.action = 'labeled';
      payloadData.payload.label = label;
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

  describe('when an issue label gets added', () => {
    const label = {
      id: 638839900,
      node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
      url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
      name: 'good first issue',
      color: '00FF00',
    };

    beforeEach(async () => {
      payloadData.payload.action = 'labeled';
      payloadData.payload.label = label;
      spyOn(checkPullRequestLabelModule, 'checkForIssueLabel')
        .and.callThrough();
      await robot.receive(payloadData);
    });

    it('checks the label', () => {
      expect(checkPullRequestLabelModule.checkForIssueLabel).toHaveBeenCalled();
    });

    it('comments on the PR', () => {
      expect(github.issues.createComment).toHaveBeenCalled();

      const link = 'here'.link(
        'https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#' +
        'labeling-issues-and-pull-requests'
      );
      expect(github.issues.createComment).toHaveBeenCalledWith({
        body: 'Hi @' + payloadData.payload.sender.login + ', the good ' +
          'first issue label should only be used on issues, and I’m ' +
          'removing the label. You can learn more about ' +
          'labels ' + link + '. Thanks!',
        number: payloadData.payload.pull_request.number,
        owner: payloadData.payload.repository.owner.login,
        repo: payloadData.payload.repository.name
      });
    });

    it('removes the label', () => {
      expect(github.issues.removeLabel).toHaveBeenCalled();
      expect(github.issues.removeLabel).toHaveBeenCalledWith({
        name: 'good first issue',
        number: payloadData.payload.pull_request.number,
        owner: payloadData.payload.repository.owner.login,
        repo: payloadData.payload.repository.name
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
      spyOn(checkPullRequestLabelModule, 'checkForIssueLabel')
        .and.callThrough();
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
      spyOn(checkPullRequestLabelModule, 'checkCriticalLabel')
        .and.callThrough();
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
      spyOn(checkPullRequestLabelModule, 'checkCriticalLabel')
        .and.callThrough();
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
      spyOn(checkPullRequestLabelModule, 'checkCriticalLabel')
        .and.callThrough();
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

  describe('when pull request gets opened or reopened', () => {
    it('pings pr author when there is no changelog label', async () => {
      payloadData.payload.action = 'reopened';

      spyOn(
        checkPullRequestLabelModule,
        'checkChangelogLabel'
      ).and.callThrough();
      await robot.receive(payloadData);

      expect(
        checkPullRequestLabelModule.checkChangelogLabel
      ).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalled();
      const params = {
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        issue_number: payloadData.payload.number,
        body:
          'Hi, @' +
          payloadData.payload.pull_request.user.login +
          ', this pull request does not have a "CHANGELOG: ..." label ' +
          'as mentioned in the PR checkbox list. Assigning @ ' +
          payloadData.payload.pull_request.user.login +
          ' to add the required label. ' +
          'PRs without this label will not be merged. If you are unsure ' +
          'of which label to add, please ask the reviewers for ' +
          'guidance. Thanks!',
      };
      expect(github.issues.createComment).toHaveBeenCalledWith(params);

      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        issue_number: payloadData.payload.number,
        assignees: [payloadData.payload.pull_request.user.login]
      });
    });

    it(
      'adds a default label when pr author is not a collaborator and PR ' +
      'has one reviewer',
      async () => {
        payloadData.payload.action = 'reopened';
        payloadData.payload.pull_request.user.login = 'newuser';
        payloadData.payload.pull_request.requested_reviewers = [
          {
            login: 'reviewer',
          },
        ];

        spyOn(
          checkPullRequestLabelModule,
          'checkChangelogLabel'
        ).and.callThrough();
        await robot.receive(payloadData);

        expect(
          checkPullRequestLabelModule.checkChangelogLabel
        ).toHaveBeenCalled();
        expect(github.issues.addLabels).toHaveBeenCalled();
        const labelParams = {
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          issue_number: payloadData.payload.number,
          labels: ['REVIEWERS: Please add changelog label'],
        };
        expect(github.issues.addLabels).toHaveBeenCalledWith(labelParams);

        expect(github.issues.createComment).toHaveBeenCalled();
        const commentParams = {
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          issue_number: payloadData.payload.number,
          body:
            'Hi @reviewer, could you please add the appropriate ' +
            'changelog label to this pull request? Thanks!',
        };
        expect(github.issues.createComment).toHaveBeenCalledWith(commentParams);

        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          issue_number: payloadData.payload.number,
          assignees: ['reviewer']
        });
      }
    );

    it(
      'adds a default label when pr author is not a collaborator and PR ' +
      'reviewers are more than one',
      async () => {
        payloadData.payload.action = 'reopened';
        payloadData.payload.pull_request.user.login = 'newuser';
        payloadData.payload.pull_request.requested_reviewers = [
          {
            login: 'reviewer1',
          },
          {
            login: 'reviewer2',
          },
          {
            login: 'reviewer3',
          },
        ];

        spyOn(
          checkPullRequestLabelModule,
          'checkChangelogLabel'
        ).and.callThrough();
        await robot.receive(payloadData);

        expect(
          checkPullRequestLabelModule.checkChangelogLabel
        ).toHaveBeenCalled();
        expect(github.issues.addLabels).toHaveBeenCalled();
        const labelParams = {
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          issue_number: payloadData.payload.number,
          labels: ['REVIEWERS: Please add changelog label'],
        };
        expect(github.issues.addLabels).toHaveBeenCalledWith(labelParams);

        expect(github.issues.createComment).toHaveBeenCalled();
        const commentParams = {
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          issue_number: payloadData.payload.number,
          body:
            'Hi @reviewer1, @reviewer2 -- could one of you please add the ' +
            'appropriate changelog label to this pull request? Thanks!',
        };
        expect(github.issues.createComment).toHaveBeenCalledWith(commentParams);

        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          issue_number: payloadData.payload.number,
          assignees: ['reviewer1', 'reviewer2']
        });
      }
    );


    it('should not ping pr author if there is a changelog label', async () => {
      const label = {
        id: 638839900,
        node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
        url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
        name: 'PR CHANGELOG: Server Errors -- @kevintab95',
        color: '00FF00',
      };
      payloadData.payload.action = 'reopened';
      // Add changelog label.
      payloadData.payload.pull_request.labels.push(label);
      spyOn(
        checkPullRequestLabelModule,
        'checkChangelogLabel'
      ).and.callThrough();
      await robot.receive(payloadData);

      expect(
        checkPullRequestLabelModule.checkChangelogLabel
      ).toHaveBeenCalled();

      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('pings dev workflow team if changelog label is invalid', async () => {
      const label = {
        id: 638839900,
        node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
        url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
        name: 'PR CHANGELOGS: Server Errors -- @kevintab95',
        color: '00FF00',
      };

      payloadData.payload.action = 'reopened';
      payloadData.payload.pull_request.labels = [label];
      spyOn(
        checkPullRequestLabelModule,
        'checkChangelogLabel'
      ).and.callThrough();
      await robot.receive(payloadData);

      expect(
        checkPullRequestLabelModule.checkChangelogLabel
      ).toHaveBeenCalled();
      const params = {
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        number: payloadData.payload.number,
        body:
          'Hi, @oppia/dev-workflow-team.' +
          ' The changelog label on this pull request seems to be invalid.' +
          ' Can you please take a look at this pull request? Thanks!',
      };
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith(params);
    });

    it('does not ping dev workflow team for valid changelog label',
      async () => {
        const label = {
          id: 638839900,
          node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
          url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
          name: 'PR CHANGELOG: Server Errors -- @kevintab95',
          color: '00FF00',
        };

        payloadData.payload.action = 'reopened';

        payloadData.payload.pull_request.labels = [label];
        spyOn(
          checkPullRequestLabelModule,
          'checkChangelogLabel'
        ).and.callThrough();
        await robot.receive(payloadData);

        expect(
          checkPullRequestLabelModule.checkChangelogLabel
        ).toHaveBeenCalled();
        expect(github.issues.createComment).not.toHaveBeenCalled();
      });
  });
});
