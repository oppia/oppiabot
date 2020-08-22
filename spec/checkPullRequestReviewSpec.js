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
 * @fileoverview Spec for pull request review module.
 */

require('dotenv').config();
const { createProbot } = require('probot');
const oppiaBot = require('../index');
const scheduler = require('../lib/scheduler');
const pullRequestReviewModule = require('../lib/checkPullRequestReview');
const payloadData = require('../fixtures/pullRequestReview.json');
const utilityModule = require('../lib/utils');

describe('Pull Request Review Module', () => {
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
        addAssignees: jasmine.createSpy('addAssignees').and.returnValue({}),
        removeAssignees: jasmine
          .createSpy('removeAssignees')
          .and.returnValue({}),
        addLabels: jasmine.createSpy('addLabels').and.returnValue({}),
      },
      pulls: {
        get: jasmine.createSpy('get').and.resolveTo({
          data: payloadData.payload.pull_request,
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
    spyOn(pullRequestReviewModule, 'handlePullRequestReview').and.callThrough();
    spyOn(utilityModule, 'sleep').and.callFake(() => {});
  });

  describe('A reviewer requests changes to the PR', () => {
    describe('when reviewer is assigned and pr author is not assigned', () => {
      beforeEach(async () => {
        await robot.receive(payloadData);
      });

      it('should check review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(180000);
      });

      it('should unassign reviewer', async () => {
        expect(github.issues.removeAssignees).toHaveBeenCalled();
        expect(github.issues.removeAssignees).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          assignees: [payloadData.payload.review.user.login],
        });

        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          body:
            'Unassigning @' +
            payloadData.payload.review.user.login +
            ' since the review is done.',
        });
      });

      it('should assign pr author', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          assignees: [payloadData.payload.pull_request.user.login],
        });
      });

      it('should ping pr author', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          body:
            'Assigning @' +
            payloadData.payload.pull_request.user.login +
            ' to respond to reviews from @' +
            payloadData.payload.review.user.login +
            '. Thanks!',
        });
      });
    });

    describe('when reviewer is assigned and pr author is assigned', () => {
      beforeAll(() => {
        payloadData.payload.pull_request.assignees = [
          ...payloadData.payload.pull_request.assignees,
          {
            login: 'testuser',
          },
        ];
      });
      beforeEach(async () => {
        await robot.receive(payloadData);
      });

      it('should check review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(180000);
      });

      it('should unassign reviewer', async () => {
        expect(github.issues.removeAssignees).toHaveBeenCalled();
        expect(github.issues.removeAssignees).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          assignees: [payloadData.payload.review.user.login],
        });

        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          body:
            'Unassigning @' +
            payloadData.payload.review.user.login +
            ' since the review is done.',
        });
      });

      it('should not assign pr author', () => {
        expect(github.issues.addAssignees).not.toHaveBeenCalled();
      });

      it('should not ping pr author', () => {
        expect(github.issues.createComment).not.toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          body:
            'Assigning @' +
            payloadData.payload.pull_request.user.login +
            ' to respond to reviews from @' +
            payloadData.payload.review.user.login +
            '. Thanks!',
        });
      });

      afterAll(() => {
        payloadData.payload.pull_request.assignees.pop();
      });
    });

    describe('when reviewer and author are not assigned', () => {
      const assignees = [...payloadData.payload.pull_request.assignees];
      beforeAll(() => {
        payloadData.payload.pull_request.assignees = [];
      });
      beforeEach(async () => {
        await robot.receive(payloadData);
      });

      it('should check review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(180000);
      });

      it('should not unassign reviewer', async () => {
        expect(github.issues.removeAssignees).not.toHaveBeenCalled();
      });

      it('should assign pr author', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          assignees: [payloadData.payload.pull_request.user.login],
        });
      });

      it('should ping pr author', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          body:
            'Assigning @' +
            payloadData.payload.pull_request.user.login +
            ' to respond to reviews from @' +
            payloadData.payload.review.user.login +
            '. Thanks!',
        });
      });

      afterAll(() => {
        payloadData.payload.pull_request.assignees = assignees;
      });
    });

    describe('when the pull request gets closed before 3 minutes delay is over', () => {
      const initalState = payloadData.payload.pull_request.state;
      beforeAll(() => {
        payloadData.payload.pull_request.state = 'closed';
      });
      beforeEach(async () => {
        await robot.receive(payloadData);
      });

      it('should check review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(180000);
      });

      it('should not unassign reviewer', async () => {
        expect(github.issues.removeAssignees).not.toHaveBeenCalled();
      });

      it('should not assign pr author', () => {
        expect(github.issues.addAssignees).not.toHaveBeenCalled();
      });

      it('should not ping pr author', () => {
        expect(github.issues.createComment).not.toHaveBeenCalled();
      });

      afterAll(() => {
        payloadData.payload.pull_request.state = initalState;
      });
    });
  });

  describe('A reviewer approves the PR', () => {
    beforeAll(() => {
      payloadData.payload.review.state = 'approved';
    });
    describe('when other reviewers are yet to review and are not assigned', () => {
      const initialReviewers = [
        ...payloadData.payload.pull_request.requested_reviewers,
      ];
      beforeAll(() => {
        payloadData.payload.pull_request.requested_reviewers = [
          ...payloadData.payload.pull_request.requested_reviewers,
          { login: 'reviewer2' },
          { login: 'reviewer3' },
        ];
      });
      beforeEach(async () => {
        github.search = {
          issuesAndPullRequests: jasmine
            .createSpy('issuesAndPullRequests')
            .and.resolveTo({
              data: {
                items: [],
              },
            }),
        };
        await robot.receive(payloadData);
      });

      it('should check review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(180000);
      });

      it('should unassign reviewer', async () => {
        expect(github.issues.removeAssignees).toHaveBeenCalled();
        expect(github.issues.removeAssignees).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          assignees: [payloadData.payload.review.user.login],
        });
      });

      it('should check if all reviewers have approved the PR', () => {
        expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
        expect(github.search.issuesAndPullRequests).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          q: `repo:oppia/oppia review:approved ${payloadData.payload.pull_request.number}`,
        });
      });

      it('should assign remaining reviewers', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          assignees: ['reviewer2', 'reviewer3'],
        });
      });

      it('should ping remaining reviewers', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          body:
            'Assigning @reviewer2, @reviewer3 for code owner reviews' +
            ', Thanks!',
        });
      });

      afterAll(() => {
        payloadData.payload.pull_request.requested_reviewers = initialReviewers;
      });
    });

    describe('when other reviewers are yet to review and are assigned', () => {
      const initialReviewers = [
        ...payloadData.payload.pull_request.requested_reviewers,
      ];
      const initialAssignees = [...payloadData.payload.pull_request.assignees];
      beforeAll(() => {
        payloadData.payload.pull_request.requested_reviewers = [
          ...payloadData.payload.pull_request.requested_reviewers,
          { login: 'reviewer2' },
          { login: 'reviewer3' },
        ];

        payloadData.payload.pull_request.assignees = [
          ...payloadData.payload.pull_request.assignees,
          { login: 'reviewer2' },
          { login: 'reviewer3' },
        ];
      });
      beforeEach(async () => {
        github.search = {
          issuesAndPullRequests: jasmine
            .createSpy('issuesAndPullRequests')
            .and.resolveTo({
              data: {
                items: [],
              },
            }),
        };
        await robot.receive(payloadData);
      });

      it('should check review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(180000);
      });

      it('should unassign reviewer', async () => {
        expect(github.issues.removeAssignees).toHaveBeenCalled();
        expect(github.issues.removeAssignees).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          assignees: [payloadData.payload.review.user.login],
        });

        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          body:
            'Unassigning @' +
            payloadData.payload.review.user.login +
            ' since the PR is approved.',
        });
      });

      it('should check if all reviewers have approved the PR', () => {
        expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
        expect(github.search.issuesAndPullRequests).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          q: `repo:oppia/oppia review:approved ${payloadData.payload.pull_request.number}`,
        });
      });

      it('should not assign remaining reviewers', () => {
        expect(github.issues.addAssignees).not.toHaveBeenCalled();
      });

      it('should not ping remaining reviewers', () => {
        expect(github.issues.createComment).not.toHaveBeenCalledTimes(2);
      });

      afterAll(() => {
        payloadData.payload.pull_request.assignees = initialAssignees;
        payloadData.payload.pull_request.requested_reviewers = initialReviewers;
      });
    });

    describe('when other reviewers are yet to review and some are assigned', () => {
      const initialAssignees = [...payloadData.payload.pull_request.assignees];
      const initialReviewers = [
        ...payloadData.payload.pull_request.requested_reviewers,
      ];
      beforeAll(() => {
        payloadData.payload.pull_request.requested_reviewers = [
          ...payloadData.payload.pull_request.requested_reviewers,
          { login: 'reviewer2' },
          { login: 'reviewer3' },
        ];

        payloadData.payload.pull_request.assignees = [
          ...payloadData.payload.pull_request.assignees,
          { login: 'reviewer2' },
        ];
      });
      beforeEach(async () => {
        github.search = {
          issuesAndPullRequests: jasmine
            .createSpy('issuesAndPullRequests')
            .and.resolveTo({
              data: {
                items: [],
              },
            }),
        };
        await robot.receive(payloadData);
      });

      it('should check review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(180000);
      });

      it('should unassign reviewer', async () => {
        expect(github.issues.removeAssignees).toHaveBeenCalled();
        expect(github.issues.removeAssignees).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          assignees: [payloadData.payload.review.user.login],
        });
      });

      it('should check if all reviewers have approved the PR', () => {
        expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
        expect(github.search.issuesAndPullRequests).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          q: `repo:oppia/oppia review:approved ${payloadData.payload.pull_request.number}`,
        });
      });

      it('should assign remaining reviewer', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          assignees: ['reviewer3'],
        });
      });

      it('should ping remaining reviewers', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          body: 'Assigning @reviewer3 for code owner reviews' + ', Thanks!',
        });
      });

      afterAll(() => {
        payloadData.payload.pull_request.requested_reviewers = initialReviewers;
        payloadData.payload.pull_request.assignees = initialAssignees;
      });
    });

    describe('when reviewer already unassigns themselves', () => {
      // Note that when the reviewer is the last reviewer, the list of
      // requested reviewers will be empty.
      const initialReviewers = [
        ...payloadData.payload.pull_request.requested_reviewers,
      ];
      const initialAssignees = [...payloadData.payload.pull_request.assignees];
      beforeAll(() => {
        payloadData.payload.pull_request.requested_reviewers = [];
        payloadData.payload.pull_request.assignees = [];
      });
      beforeEach(async () => {
        github.search = {
          issuesAndPullRequests: jasmine
            .createSpy('issuesAndPullRequests')
            .and.resolveTo({
              data: {
                items: [payloadData.payload.pull_request],
              },
            }),
        };
        github.orgs = {
          checkMembership: jasmine.createSpy('checkMembership').and.resolveTo({
            status: 404,
          }),
        };
        await robot.receive(payloadData);
      });

      it('should check review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(180000);
      });

      it('should not unassign reviewer', async () => {
        expect(github.issues.removeAssignees).not.toHaveBeenCalled();
      });

      it('should check if all reviewers have approved the PR', () => {
        expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
        expect(github.search.issuesAndPullRequests).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          q: `repo:oppia/oppia review:approved ${payloadData.payload.pull_request.number}`,
        });
      });

      it('should add LGTM label', () => {
        expect(github.issues.addLabels).toHaveBeenCalled();
        expect(github.issues.addLabels).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          labels: ['PR: LGTM'],
        });
      });

      it('should check if author can merge', () => {
        expect(github.orgs.checkMembership).toHaveBeenCalled();
        expect(github.orgs.checkMembership).toHaveBeenCalledWith({
          org: payloadData.payload.organization.login,
          username: payloadData.payload.pull_request.user.login,
        });
      });

      it('should assign one of the reviewers', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          assignees: ['reviewer'],
        });
      });

      it('should ping one of the reviewers to merge', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          body: 'Hi @reviewer, this PR is ready to be merged, PTAL. Thanks!',
        });
      });

      afterAll(() => {
        payloadData.payload.pull_request.requested_reviewers = initialReviewers;
        payloadData.payload.pull_request.assignees = initialAssignees;
      });
    });

    describe('when reviewer is the last reviewer and pr author can not merge', () => {
      // Note that when the reviewer is the last reviewer, the list of
      // requested reviewers will be empty.
      const initialReviewers = [
        ...payloadData.payload.pull_request.requested_reviewers,
      ];
      beforeAll(() => {
        payloadData.payload.pull_request.requested_reviewers = [];
      });
      beforeEach(async () => {
        github.search = {
          issuesAndPullRequests: jasmine
            .createSpy('issuesAndPullRequests')
            .and.resolveTo({
              data: {
                items: [payloadData.payload.pull_request],
              },
            }),
        };
        github.orgs = {
          checkMembership: jasmine.createSpy('checkMembership').and.resolveTo({
            status: 404,
          }),
        };
        await robot.receive(payloadData);
      });

      it('should check review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(180000);
      });

      it('should unassign reviewer', async () => {
        expect(github.issues.removeAssignees).toHaveBeenCalled();
        expect(github.issues.removeAssignees).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          assignees: [payloadData.payload.review.user.login],
        });
      });

      it('should check if all reviewers have approved the PR', () => {
        expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
        expect(github.search.issuesAndPullRequests).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          q: `repo:oppia/oppia review:approved ${payloadData.payload.pull_request.number}`,
        });
      });

      it('should add LGTM label', () => {
        expect(github.issues.addLabels).toHaveBeenCalled();
        expect(github.issues.addLabels).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          labels: ['PR: LGTM'],
        });
      });

      it('should check if author can merge', () => {
        expect(github.orgs.checkMembership).toHaveBeenCalled();
        expect(github.orgs.checkMembership).toHaveBeenCalledWith({
          org: payloadData.payload.organization.login,
          username: payloadData.payload.pull_request.user.login,
        });
      });

      it('should assign one of the reviewers', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          assignees: ['reviewer'],
        });
      });

      it('should ping one of the reviewers to merge', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          body: 'Hi @reviewer, this PR is ready to be merged, PTAL. Thanks!',
        });
      });

      afterAll(() => {
        payloadData.payload.pull_request.requested_reviewers = initialReviewers;
      });
    });

    describe('when reviewer is the last reviewer and pr author can merge', () => {
      // Note that when the reviewer is the last reviewer, the list of
      // requested reviewers will be empty.
      const initialReviewers = [
        ...payloadData.payload.pull_request.requested_reviewers,
      ];
      beforeAll(() => {
        payloadData.payload.pull_request.requested_reviewers = [];
      });
      beforeEach(async () => {
        github.search = {
          issuesAndPullRequests: jasmine
            .createSpy('issuesAndPullRequests')
            .and.resolveTo({
              data: {
                items: [payloadData.payload.pull_request],
              },
            }),
        };
        github.orgs = {
          checkMembership: jasmine.createSpy('checkMembership').and.resolveTo({
            status: 204,
          }),
        };
        await robot.receive(payloadData);
      });

      it('should check review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(180000);
      });

      it('should unassign reviewer', async () => {
        expect(github.issues.removeAssignees).toHaveBeenCalled();
        expect(github.issues.removeAssignees).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          assignees: [payloadData.payload.review.user.login],
        });
      });

      it('should check if all reviewers have approved the PR', () => {
        expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
        expect(github.search.issuesAndPullRequests).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          q: `repo:oppia/oppia review:approved ${payloadData.payload.pull_request.number}`,
        });
      });

      it('should add LGTM label', () => {
        expect(github.issues.addLabels).toHaveBeenCalled();
        expect(github.issues.addLabels).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          labels: ['PR: LGTM'],
        });
      });

      it('should check if author can merge', () => {
        expect(github.orgs.checkMembership).toHaveBeenCalled();
        expect(github.orgs.checkMembership).toHaveBeenCalledWith({
          org: payloadData.payload.organization.login,
          username: payloadData.payload.pull_request.user.login,
        });
      });

      it('should assign pr author', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          assignees: [payloadData.payload.pull_request.user.login],
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
            ', this PR is ready to be merged, PTAL. Thanks!',
        });
      });

      afterAll(() => {
        payloadData.payload.pull_request.requested_reviewers = initialReviewers;
      });
    });

    describe('when reviewer is last reviewer and already adds the lgtm label', () => {
      // Note that when the reviewer is the last reviewer, the list of
      // requested reviewers will be empty.
      const initialReviewers = [
        ...payloadData.payload.pull_request.requested_reviewers,
      ];
      const initialLabels = [...payloadData.payload.pull_request.labels];

      beforeAll(() => {
        payloadData.payload.pull_request.requested_reviewers = [];
        payloadData.payload.pull_request.labels = [
          ...payloadData.payload.pull_request.labels,
          { name: 'PR: LGTM' },
        ];
      });

      beforeEach(async () => {
        github.search = {
          issuesAndPullRequests: jasmine
            .createSpy('issuesAndPullRequests')
            .and.resolveTo({
              data: {
                items: [payloadData.payload.pull_request],
              },
            }),
        };
        github.orgs = {
          checkMembership: jasmine.createSpy('checkMembership').and.resolveTo({
            status: 204,
          }),
        };
        await robot.receive(payloadData);
      });

      it('should check review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(180000);
      });

      it('should unassign reviewer', async () => {
        expect(github.issues.removeAssignees).toHaveBeenCalled();
        expect(github.issues.removeAssignees).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          issue_number: payloadData.payload.pull_request.number,
          assignees: [payloadData.payload.review.user.login],
        });
      });

      it('should check if all reviewers have approved the PR', () => {
        expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
        expect(github.search.issuesAndPullRequests).toHaveBeenCalledWith({
          owner: payloadData.payload.repository.owner.login,
          repo: payloadData.payload.repository.name,
          q: `repo:oppia/oppia review:approved ${payloadData.payload.pull_request.number}`,
        });
      });

      it('should not add LGTM label', () => {
        expect(github.issues.addLabels).not.toHaveBeenCalled();
      });

      it('should not check if author can merge', () => {
        expect(github.orgs.checkMembership).not.toHaveBeenCalled();
      });

      it('should not assign pr author', () => {
        expect(github.issues.addAssignees).not.toHaveBeenCalled();
      });

      afterAll(() => {
        payloadData.payload.pull_request.requested_reviewers = initialReviewers;
        payloadData.payload.pull_request.labels = initialLabels;
      });
    });

    describe('when the pull request gets closed / merged before 3 minutes delay is over', () => {
      const initalState = payloadData.payload.pull_request.state;
      beforeAll(() => {
        payloadData.payload.pull_request.state = 'closed';
      });
      beforeEach(async () => {
        await robot.receive(payloadData);
      });

      it('should check review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(180000);
      });

      it('should not unassign reviewer', async () => {
        expect(github.issues.removeAssignees).not.toHaveBeenCalled();
      });

      it('should not add LGTM label', () => {
        expect(github.issues.addLabels).not.toHaveBeenCalled();
      });

      it('should not assign pr author', () => {
        expect(github.issues.addAssignees).not.toHaveBeenCalled();
      });

      afterAll(() => {
        payloadData.payload.pull_request.state = initalState;
      });
    });
  });

  describe('A reviewer comments on the PR', () => {
    const initalState = payloadData.payload.review.state;
    beforeAll(() => {
      payloadData.payload.review.state = 'commented';
    });

    beforeEach(async () => {
      await robot.receive(payloadData);
    });

    it('should check review', () => {
      expect(
        pullRequestReviewModule.handlePullRequestReview
      ).toHaveBeenCalled();
    });

    it('should not wait for 3 minutes before performing any action', () => {
      expect(utilityModule.sleep).not.toHaveBeenCalled();
    });

    it('should not unassign reviewer', async () => {
      expect(github.issues.removeAssignees).not.toHaveBeenCalled();
    });

    it('should not add LGTM label', () => {
      expect(github.issues.addLabels).not.toHaveBeenCalled();
    });

    it('should not assign pr author', () => {
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
    });

    afterAll(() => {
      payloadData.payload.pull_request.state = initalState;
    });
  });
});
