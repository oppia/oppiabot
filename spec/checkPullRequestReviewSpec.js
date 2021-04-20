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
const reviewPayloadData = require('../fixtures/pullRequestReview.json');
const commentPayloadData = require('../fixtures/pullRequestComment.json');
const utilityModule = require('../lib/utils');
let payloadData = JSON.parse(
  JSON.stringify(require('../fixtures/pullRequestPayload.json'))
);

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
    spyOn(scheduler, 'createScheduler').and.callFake(() => { });

    github = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.returnValue({}),
        addAssignees: jasmine.createSpy('addAssignees').and.returnValue({}),
        removeAssignees: jasmine
          .createSpy('removeAssignees')
          .and.returnValue({}),
        addLabels: jasmine.createSpy('addLabels').and.returnValue({}),
        removeLabel: jasmine.createSpy('removeLabel').and.resolveTo({}),
      },
    };

    robot = createProbot({
      id: 1,
      cert: 'test',
      githubToken: 'test',
    });

    app = robot.load(oppiaBot);
    spyOn(app, 'auth').and.resolveTo(github);
    spyOn(pullRequestReviewModule, 'handlePullRequestReview').
      and.callThrough();
    spyOn(pullRequestReviewModule, 'handleResponseToReview').and.callThrough();
    spyOn(utilityModule, 'sleep').and.callFake(() => { });
  });

  describe('A reviewer requests changes to the PR', () => {
    beforeEach(() => {
      github.pulls = {
        get: jasmine.createSpy('get').and.resolveTo({
          data: reviewPayloadData.payload.pull_request,
        }),
      };
    });

    describe('When reviewer requests changes and LGTM label' +
     'was already added to the pull request.', ()=>{
      beforeEach(async () => {
        const label = {
          id: 248679580,
          node_id: 'MDU6TGFiZWwyNDg2Nzk1ODA=',
          url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20LGTM',
          name: 'PR: LGTM',
          color: '009800',
        };
        // Set the payload action and label which will simulate removing
        // the LGTM label.
        payloadData.payload.label = label;
        payloadData.payload.pull_request.requested_reviewers = [
          { login: 'reviewer1' },
          { login: 'reviewer2' },
        ];
        payloadData.payload.pull_request.assignees = [];
        // Set project owner to be pr author.
        payloadData.payload.pull_request.user.login = 'kevintab95';
        reviewPayloadData.payload.pull_request.labels.push(label);
        await robot.receive(reviewPayloadData);
      });

      it('should check type of review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(
          utilityModule.THREE_MINUTES);
      });

      it('Should comment on PR', () => {
        expect(github.issues.createComment)
          .toHaveBeenCalled();
      });

      it('Should Remove the LGTM Label', () => {
        expect(github.issues.removeLabel).toHaveBeenCalled();
      });
    });

    describe('When reviewer requests changes' +
          'and there is no label', () => {
      it('Should Remove the LGTM Label', () => {
        expect(github.issues.removeLabel).not.toHaveBeenCalled();
      });
    });
    describe('when reviewer is assigned and pr author is not assigned', () => {
      beforeEach(async () => {
        await robot.receive(reviewPayloadData);
      });

      it('should check type of review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(
          utilityModule.THREE_MINUTES);
      });

      it('should unassign reviewer', async () => {
        expect(github.issues.removeAssignees).toHaveBeenCalled();
        expect(github.issues.removeAssignees).toHaveBeenCalledWith({
          owner: reviewPayloadData.payload.repository.owner.login,
          repo: reviewPayloadData.payload.repository.name,
          issue_number: reviewPayloadData.payload.pull_request.number,
          assignees: [reviewPayloadData.payload.review.user.login],
        });

        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: reviewPayloadData.payload.repository.owner.login,
          repo: reviewPayloadData.payload.repository.name,
          issue_number: reviewPayloadData.payload.pull_request.number,
          body:
            'Unassigning @' +
            reviewPayloadData.payload.review.user.login +
            ' since the review is done.',
        });
      });

      it('should assign pr author', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          owner: reviewPayloadData.payload.repository.owner.login,
          repo: reviewPayloadData.payload.repository.name,
          issue_number: reviewPayloadData.payload.pull_request.number,
          assignees: [reviewPayloadData.payload.pull_request.user.login],
        });

        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: reviewPayloadData.payload.repository.owner.login,
          repo: reviewPayloadData.payload.repository.name,
          issue_number: reviewPayloadData.payload.pull_request.number,
          body:
            'Hi @' +
            reviewPayloadData.payload.pull_request.user.login +
            ', it looks like some changes were requested on this pull' +
            ' request by @' + reviewPayloadData.payload.review.user.login +
            '. PTAL. Thanks!',
        });
      });
    });

    describe('when reviewer is assigned and pr author is assigned', () => {
      beforeAll(() => {
        reviewPayloadData.payload.pull_request.assignees = [
          ...reviewPayloadData.payload.pull_request.assignees,
          {
            login: 'testuser',
          },
        ];
      });
      beforeEach(async () => {
        await robot.receive(reviewPayloadData);
      });

      it('should check type of review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(
          utilityModule.THREE_MINUTES);
      });

      it('should unassign reviewer', async () => {
        expect(github.issues.removeAssignees).toHaveBeenCalled();
        expect(github.issues.removeAssignees).toHaveBeenCalledWith({
          owner: reviewPayloadData.payload.repository.owner.login,
          repo: reviewPayloadData.payload.repository.name,
          issue_number: reviewPayloadData.payload.pull_request.number,
          assignees: [reviewPayloadData.payload.review.user.login],
        });

        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: reviewPayloadData.payload.repository.owner.login,
          repo: reviewPayloadData.payload.repository.name,
          issue_number: reviewPayloadData.payload.pull_request.number,
          body:
            'Unassigning @' +
            reviewPayloadData.payload.review.user.login +
            ' since the review is done.',
        });
      });

      it('should not assign pr author', () => {
        expect(github.issues.addAssignees).not.toHaveBeenCalled();
      });

      it('should not ping pr author', () => {
        expect(github.issues.createComment).not.toHaveBeenCalledWith({
          owner: reviewPayloadData.payload.repository.owner.login,
          repo: reviewPayloadData.payload.repository.name,
          issue_number: reviewPayloadData.payload.pull_request.number,
          body:
            'Hi @' +
            reviewPayloadData.payload.pull_request.user.login +
            ', it looks like some changes were requested on this ' +
            'pull request by @' +
            reviewPayloadData.payload.review.user.login +
            '. PTAL. Thanks!',
        });
      });

      afterAll(() => {
        reviewPayloadData.payload.pull_request.assignees.pop();
      });
    });

    describe('when reviewer and author are not assigned', () => {
      const assignees = [...reviewPayloadData.payload.pull_request.assignees];
      beforeAll(() => {
        reviewPayloadData.payload.pull_request.assignees = [];
      });
      beforeEach(async () => {
        await robot.receive(reviewPayloadData);
      });

      it('should check type of review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(
          utilityModule.THREE_MINUTES);
      });

      it('should not unassign reviewer', async () => {
        expect(github.issues.removeAssignees).not.toHaveBeenCalled();
      });

      it('should assign pr author', () => {
        expect(github.issues.addAssignees).toHaveBeenCalled();
        expect(github.issues.addAssignees).toHaveBeenCalledWith({
          owner: reviewPayloadData.payload.repository.owner.login,
          repo: reviewPayloadData.payload.repository.name,
          issue_number: reviewPayloadData.payload.pull_request.number,
          assignees: [reviewPayloadData.payload.pull_request.user.login],
        });

        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: reviewPayloadData.payload.repository.owner.login,
          repo: reviewPayloadData.payload.repository.name,
          issue_number: reviewPayloadData.payload.pull_request.number,
          body:
            'Hi @' +
            reviewPayloadData.payload.pull_request.user.login +
            ', it looks like some changes were requested on this ' +
            'pull request by @' +
            reviewPayloadData.payload.review.user.login +
            '. PTAL. Thanks!',
        });
      });

      afterAll(() => {
        reviewPayloadData.payload.pull_request.assignees = assignees;
      });
    });

    describe('when reviewer is not assigned but author is assigned', () => {
      const assignees = [...reviewPayloadData.payload.pull_request.assignees];
      beforeAll(() => {
        reviewPayloadData.payload.pull_request.assignees = [
          {
            login: 'testuser',
          },
        ];
      });
      beforeEach(async () => {
        await robot.receive(reviewPayloadData);
      });

      it('should check type of review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(
          utilityModule.THREE_MINUTES);
      });

      it('should not unassign reviewer', async () => {
        expect(github.issues.removeAssignees).not.toHaveBeenCalled();
      });

      it('should not assign pr author', () => {
        expect(github.issues.addAssignees).not.toHaveBeenCalled();
        expect(github.issues.createComment).not.toHaveBeenCalled();
      });

      afterAll(() => {
        reviewPayloadData.payload.pull_request.assignees = assignees;
      });
    });

    describe(
      'when the pull request gets closed before 3 minutes delay is ' +
      'over', () => {
        const initalState = reviewPayloadData.payload.pull_request.state;
        beforeAll(() => {
          reviewPayloadData.payload.pull_request.state = 'closed';
        });
        beforeEach(async () => {
          await robot.receive(reviewPayloadData);
        });

        it('should check type of review', () => {
          expect(
            pullRequestReviewModule.handlePullRequestReview
          ).toHaveBeenCalled();
        });

        it('should wait for 3 minutes before performing any action', () => {
          expect(utilityModule.sleep).toHaveBeenCalled();
          expect(utilityModule.sleep).toHaveBeenCalledWith(
            utilityModule.THREE_MINUTES);
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
          reviewPayloadData.payload.pull_request.state = initalState;
        });
      });
  });

  describe('A reviewer approves the PR', () => {
    beforeAll(() => {
      reviewPayloadData.payload.review.state = 'approved';
    });
    beforeEach(() => {
      github.pulls = {
        get: jasmine.createSpy('get').and.resolveTo({
          data: reviewPayloadData.payload.pull_request,
        }),
      };
    });
    describe(
      'when other reviewers are yet to review and are not assigned', () => {
        const initialReviewers = [
          ...reviewPayloadData.payload.pull_request.requested_reviewers,
        ];
        beforeAll(() => {
          reviewPayloadData.payload.pull_request.requested_reviewers = [
            ...reviewPayloadData.payload.pull_request.requested_reviewers,
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
          await robot.receive(reviewPayloadData);
        });

        it('should check type of review', () => {
          expect(
            pullRequestReviewModule.handlePullRequestReview
          ).toHaveBeenCalled();
        });

        it('should wait for 3 minutes before performing any action', () => {
          expect(utilityModule.sleep).toHaveBeenCalled();
          expect(utilityModule.sleep).toHaveBeenCalledWith(
            utilityModule.THREE_MINUTES);
        });

        it('should unassign reviewer', async () => {
          expect(github.issues.removeAssignees).toHaveBeenCalled();
          expect(github.issues.removeAssignees).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            assignees: [reviewPayloadData.payload.review.user.login],
          });
        });

        it('should check if all reviewers have approved the PR', () => {
          expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
          expect(github.search.issuesAndPullRequests).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            q:
              'repo:oppia/oppia review:approved ' +
              reviewPayloadData.payload.pull_request.number,
          });
        });

        it('should assign remaining reviewers', () => {
          expect(github.issues.addAssignees).toHaveBeenCalled();
          expect(github.issues.addAssignees).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            assignees: ['reviewer2', 'reviewer3'],
          });
        });

        it('should ping remaining reviewers', () => {
          expect(github.issues.createComment).toHaveBeenCalled();
          expect(github.issues.createComment).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            body:
              'Assigning @reviewer2, @reviewer3 for code owner reviews' +
              '. Thanks!',
          });
        });

        it('should not assign pr author', () => {
          expect(github.issues.addAssignees).not.toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            assignees: [reviewPayloadData.payload.pull_request.user.login],
          });
        });

        afterAll(() => {
          reviewPayloadData.payload.pull_request.requested_reviewers = (
            initialReviewers
          );
        });
      });

    describe('when other reviewers are yet to review and are assigned', () => {
      const initialReviewers = [
        ...reviewPayloadData.payload.pull_request.requested_reviewers,
      ];
      const initialAssignees = [
        ...reviewPayloadData.payload.pull_request.assignees,
      ];
      beforeAll(() => {
        reviewPayloadData.payload.pull_request.requested_reviewers = [
          ...reviewPayloadData.payload.pull_request.requested_reviewers,
          { login: 'reviewer2' },
          { login: 'reviewer3' },
        ];

        reviewPayloadData.payload.pull_request.assignees = [
          ...reviewPayloadData.payload.pull_request.assignees,
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
        await robot.receive(reviewPayloadData);
      });

      it('should check type of review', () => {
        expect(
          pullRequestReviewModule.handlePullRequestReview
        ).toHaveBeenCalled();
      });

      it('should wait for 3 minutes before performing any action', () => {
        expect(utilityModule.sleep).toHaveBeenCalled();
        expect(utilityModule.sleep).toHaveBeenCalledWith(
          utilityModule.THREE_MINUTES);
      });

      it('should unassign reviewer', async () => {
        expect(github.issues.removeAssignees).toHaveBeenCalled();
        expect(github.issues.removeAssignees).toHaveBeenCalledWith({
          owner: reviewPayloadData.payload.repository.owner.login,
          repo: reviewPayloadData.payload.repository.name,
          issue_number: reviewPayloadData.payload.pull_request.number,
          assignees: [reviewPayloadData.payload.review.user.login],
        });

        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: reviewPayloadData.payload.repository.owner.login,
          repo: reviewPayloadData.payload.repository.name,
          issue_number: reviewPayloadData.payload.pull_request.number,
          body:
            'Unassigning @' +
            reviewPayloadData.payload.review.user.login +
            ' since they have already approved the PR.',
        });
      });

      it('should check if all reviewers have approved the PR', () => {
        expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
        expect(github.search.issuesAndPullRequests).toHaveBeenCalledWith({
          owner: reviewPayloadData.payload.repository.owner.login,
          repo: reviewPayloadData.payload.repository.name,
          q:
            'repo:oppia/oppia review:approved ' +
            reviewPayloadData.payload.pull_request.number,
        });
      });

      it('should not assign remaining reviewers', () => {
        expect(github.issues.addAssignees).not.toHaveBeenCalled();
        expect(github.issues.createComment).not.toHaveBeenCalledTimes(2);
      });

      it('should not assign pr author', () => {
        expect(github.issues.addAssignees).not.toHaveBeenCalled();
        expect(github.issues.addAssignees).not.toHaveBeenCalledWith({
          owner: reviewPayloadData.payload.repository.owner.login,
          repo: reviewPayloadData.payload.repository.name,
          issue_number: reviewPayloadData.payload.pull_request.number,
          assignees: [reviewPayloadData.payload.pull_request.user.login],
        });
      });

      afterAll(() => {
        reviewPayloadData.payload.pull_request.assignees = initialAssignees;
        reviewPayloadData.payload.pull_request.requested_reviewers = (
          initialReviewers
        );
      });
    });

    describe(
      'when other reviewers are yet to review and some are assigned', () => {
        const initialAssignees = [
          ...reviewPayloadData.payload.pull_request.assignees,
        ];
        const initialReviewers = [
          ...reviewPayloadData.payload.pull_request.requested_reviewers,
        ];
        beforeAll(() => {
          reviewPayloadData.payload.pull_request.requested_reviewers = [
            ...reviewPayloadData.payload.pull_request.requested_reviewers,
            { login: 'reviewer2' },
            { login: 'reviewer3' },
          ];

          reviewPayloadData.payload.pull_request.assignees = [
            ...reviewPayloadData.payload.pull_request.assignees,
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
          await robot.receive(reviewPayloadData);
        });

        it('should check type of review', () => {
          expect(
            pullRequestReviewModule.handlePullRequestReview
          ).toHaveBeenCalled();
        });

        it('should wait for 3 minutes before performing any action', () => {
          expect(utilityModule.sleep).toHaveBeenCalled();
          expect(utilityModule.sleep).toHaveBeenCalledWith(
            utilityModule.THREE_MINUTES);
        });

        it('should unassign reviewer', async () => {
          expect(github.issues.removeAssignees).toHaveBeenCalled();
          expect(github.issues.removeAssignees).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            assignees: [reviewPayloadData.payload.review.user.login],
          });
        });

        it('should check if all reviewers have approved the PR', () => {
          expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
          expect(github.search.issuesAndPullRequests).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            q:
              'repo:oppia/oppia review:approved ' +
              reviewPayloadData.payload.pull_request.number,
          });
        });

        it('should assign remaining reviewers', () => {
          expect(github.issues.addAssignees).toHaveBeenCalled();
          expect(github.issues.addAssignees).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            assignees: ['reviewer3'],
          });
        });

        it('should ping remaining reviewers', () => {
          expect(github.issues.createComment).toHaveBeenCalled();
          expect(github.issues.createComment).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            body: 'Assigning @reviewer3 for code owner reviews' + '. Thanks!',
          });
        });

        it('should not assign pr author', () => {
          expect(github.issues.addAssignees).not.toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            assignees: [reviewPayloadData.payload.pull_request.user.login],
          });
        });

        afterAll(() => {
          reviewPayloadData.payload.pull_request.requested_reviewers = (
            initialReviewers
          );
          reviewPayloadData.payload.pull_request.assignees = initialAssignees;
        });
      });

    describe(
      'when all reviewers have approved and none are assigned and pr author ' +
      'cannot merge.', () => {
        // Note that when the last reviewer approves, the list of
        // requested reviewers will be empty.
        const initialReviewers = [
          ...reviewPayloadData.payload.pull_request.requested_reviewers,
        ];
        const initialLabels = [
          ...reviewPayloadData.payload.pull_request.labels
        ];
        const changelogLabel = {
          name: 'PR CHANGELOG: Server Errors -- @kevintab95'
        };
        const initialAssignees = [
          ...reviewPayloadData.payload.pull_request.assignees
        ];
        beforeAll(() => {
          reviewPayloadData.payload.pull_request.requested_reviewers = [];
          reviewPayloadData.payload.pull_request.assignees = [];
          reviewPayloadData.payload.pull_request.labels = [changelogLabel];
        });
        beforeEach(async () => {
          spyOn(
            utilityModule, 'doesPullRequestHaveChangesRequested'
          ).and.resolveTo(false);
          github.search = {
            issuesAndPullRequests: jasmine
              .createSpy('issuesAndPullRequests')
              .and.resolveTo({
                data: {
                  items: [reviewPayloadData.payload.pull_request],
                },
              }),
          };
          github.orgs = {
            checkMembership: jasmine
              .createSpy('checkMembership')
              .and.callFake(() => {
                throw new Error(
                  'User does not exist or is not a public member of ' +
                  'the organization.'
                );
              }),
          };
          await robot.receive(reviewPayloadData);
        });

        it('should check type of review', () => {
          expect(
            pullRequestReviewModule.handlePullRequestReview
          ).toHaveBeenCalled();
        });

        it('should wait for 3 minutes before performing any action', () => {
          expect(utilityModule.sleep).toHaveBeenCalled();
          expect(utilityModule.sleep).toHaveBeenCalledWith(
            utilityModule.THREE_MINUTES);
        });

        it('should not unassign reviewer', async () => {
          expect(github.issues.removeAssignees).not.toHaveBeenCalled();
        });

        it('should check if all reviewers have approved the PR', () => {
          expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
          expect(github.search.issuesAndPullRequests).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            q:
              'repo:oppia/oppia review:approved ' +
              reviewPayloadData.payload.pull_request.number,
          });
        });

        it('should add LGTM label', () => {
          expect(github.issues.addLabels).toHaveBeenCalled();
          expect(github.issues.addLabels).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            labels: ['PR: LGTM'],
          });
        });

        it('should check if author can merge', () => {
          expect(github.orgs.checkMembership).toHaveBeenCalled();
          expect(github.orgs.checkMembership).toHaveBeenCalledWith({
            org: reviewPayloadData.payload.organization.login,
            username: reviewPayloadData.payload.pull_request.user.login,
          });
        });

        it('should assign one of the reviewers', () => {
          expect(github.issues.addAssignees).toHaveBeenCalled();
          expect(github.issues.addAssignees).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            assignees: ['kevintab95'],
          });
        });

        it('should ping one of the reviewers to merge', () => {
          expect(github.issues.createComment).toHaveBeenCalled();
          expect(github.issues.createComment).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            body:
              'Hi @kevintab95, this PR is ready to be merged. ' +
              'Author of this PR does not have permissions ' +
              'to merge this PR. Before you ' +
              'merge it, please make sure that there are no pending comments ' +
              'that require action from the author\'s end. Thanks!',
          });
        });

        afterAll(() => {
          reviewPayloadData.payload.pull_request.requested_reviewers = (
            initialReviewers
          );
          reviewPayloadData.payload.pull_request.assignees = initialAssignees;
          reviewPayloadData.payload.pull_request.labels = initialLabels;
        });
      });

    describe(
      'when reviewer is the last reviewer and pr author can merge', () => {
        // Note that when the reviewer is the last reviewer, the list of
        // requested reviewers will be empty.
        const initialReviewers = [
          ...reviewPayloadData.payload.pull_request.requested_reviewers,
        ];
        beforeAll(() => {
          reviewPayloadData.payload.pull_request.requested_reviewers = [];
        });
        beforeEach(async () => {
          spyOn(
            utilityModule, 'doesPullRequestHaveChangesRequested'
          ).and.resolveTo(false);

          github.search = {
            issuesAndPullRequests: jasmine
              .createSpy('issuesAndPullRequests')
              .and.resolveTo({
                data: {
                  items: [reviewPayloadData.payload.pull_request],
                },
              }),
          };
          github.orgs = {
            checkMembership: jasmine.createSpy('checkMembership')
              .and.resolveTo({
                status: 204,
              }),
          };
          await robot.receive(reviewPayloadData);
        });

        it('should check type of review', () => {
          expect(
            pullRequestReviewModule.handlePullRequestReview
          ).toHaveBeenCalled();
        });

        it('should wait for 3 minutes before performing any action', () => {
          expect(utilityModule.sleep).toHaveBeenCalled();
          expect(utilityModule.sleep).toHaveBeenCalledWith(
            utilityModule.THREE_MINUTES);
        });

        it('should unassign reviewer', async () => {
          expect(github.issues.removeAssignees).toHaveBeenCalled();
          expect(github.issues.removeAssignees).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            assignees: [reviewPayloadData.payload.review.user.login],
          });
        });

        it('should check if all reviewers have approved the PR', () => {
          expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
          expect(github.search.issuesAndPullRequests).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            q:
              'repo:oppia/oppia review:approved ' +
              reviewPayloadData.payload.pull_request.number,
          });
        });

        it('should add LGTM label', () => {
          expect(github.issues.addLabels).toHaveBeenCalled();
          expect(github.issues.addLabels).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            labels: ['PR: LGTM'],
          });
        });

        it('should check if author can merge', () => {
          expect(github.orgs.checkMembership).toHaveBeenCalled();
          expect(github.orgs.checkMembership).toHaveBeenCalledWith({
            org: reviewPayloadData.payload.organization.login,
            username: reviewPayloadData.payload.pull_request.user.login,
          });
        });

        it('should assign pr author', () => {
          expect(github.issues.addAssignees).toHaveBeenCalled();
          expect(github.issues.addAssignees).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            assignees: [reviewPayloadData.payload.pull_request.user.login],
          });
        });

        it('should ping pr author', () => {
          expect(github.issues.createComment).toHaveBeenCalled();
          expect(github.issues.createComment).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            body:
              'Hi @' + reviewPayloadData.payload.pull_request.user.login +
              ', this PR is ready to be merged. Please address any remaining ' +
              'comments prior to merging, and feel free to merge this PR ' +
              "once the CI checks pass and you're happy with it. Thanks!",
          });
        });

        afterAll(() => {
          reviewPayloadData.payload.pull_request.requested_reviewers = (
            initialReviewers
          );
        });
      });

    describe(
      'when reviewer is last reviewer and already adds the lgtm label', () => {
        // Note that when the reviewer is the last reviewer, the list of
        // requested reviewers will be empty.
        const initialReviewers = [
          ...reviewPayloadData.payload.pull_request.requested_reviewers,
        ];
        const initialLabels =
          [...reviewPayloadData.payload.pull_request.labels];

        beforeAll(() => {
          reviewPayloadData.payload.pull_request.requested_reviewers = [];
          reviewPayloadData.payload.pull_request.labels = [
            ...reviewPayloadData.payload.pull_request.labels,
            { name: 'PR: LGTM' },
          ];
        });

        beforeEach(async () => {
          spyOn(
            utilityModule, 'doesPullRequestHaveChangesRequested'
          ).and.resolveTo(false);
          github.search = {
            issuesAndPullRequests: jasmine
              .createSpy('issuesAndPullRequests')
              .and.resolveTo({
                data: {
                  items: [reviewPayloadData.payload.pull_request],
                },
              }),
          };
          github.orgs = {
            checkMembership: jasmine.createSpy('checkMembership')
              .and.resolveTo({
                status: 204,
              }),
          };
          await robot.receive(reviewPayloadData);
        });

        it('should check type of review', () => {
          expect(
            pullRequestReviewModule.handlePullRequestReview
          ).toHaveBeenCalled();
        });

        it('should wait for 3 minutes before performing any action', () => {
          expect(utilityModule.sleep).toHaveBeenCalled();
          expect(utilityModule.sleep).toHaveBeenCalledWith(
            utilityModule.THREE_MINUTES);
        });

        it('should unassign reviewer', async () => {
          expect(github.issues.removeAssignees).toHaveBeenCalled();
          expect(github.issues.removeAssignees).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            assignees: [reviewPayloadData.payload.review.user.login],
          });
        });

        it('should check if all reviewers have approved the PR', () => {
          expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
          expect(github.search.issuesAndPullRequests).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            q:
              'repo:oppia/oppia review:approved ' +
              reviewPayloadData.payload.pull_request.number,
          });
        });

        it('should not add LGTM label', () => {
          expect(github.issues.addLabels).not.toHaveBeenCalled();
        });

        it('should check if author can merge', () => {
          expect(github.orgs.checkMembership).toHaveBeenCalled();
          expect(github.orgs.checkMembership).toHaveBeenCalledWith({
            org: reviewPayloadData.payload.organization.login,
            username: reviewPayloadData.payload.pull_request.user.login,
          });
        });

        it('should assign pr author', () => {
          expect(github.issues.addAssignees).toHaveBeenCalled();
          expect(github.issues.addAssignees).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            assignees: [reviewPayloadData.payload.pull_request.user.login],
          });
        });

        afterAll(() => {
          reviewPayloadData.payload.pull_request.requested_reviewers = (
            initialReviewers
          );
          reviewPayloadData.payload.pull_request.labels = initialLabels;
        });
      });

    describe(
      'when the last reviewer approves but the pull request already ' +
      'has changes requested',
      () => {
        // Note that when the reviewer is the last reviewer, the list of
        // requested reviewers will be empty.
        const initialReviewers = [
          ...reviewPayloadData.payload.pull_request.requested_reviewers,
        ];
        beforeAll(() => {
          reviewPayloadData.payload.pull_request.requested_reviewers = [];
        });
        beforeEach(async () => {
          spyOn(
            utilityModule,
            'doesPullRequestHaveChangesRequested'
          ).and.callThrough();
          github.search = {
            // This function will be called by the utility module when checking
            // if the pull request has changes requested.
            issuesAndPullRequests: jasmine
              .createSpy('issuesAndPullRequests')
              .and.resolveTo({
                data: {
                  items: [reviewPayloadData.payload.pull_request],
                },
              }),
          };
          github.orgs = {
            checkMembership: jasmine
              .createSpy('checkMembership')
              .and.resolveTo({
                status: 204,
              }),
          };
          await robot.receive(reviewPayloadData);
        });

        it('should check type of review', () => {
          expect(
            pullRequestReviewModule.handlePullRequestReview
          ).toHaveBeenCalled();
        });

        it('should wait for 3 minutes before performing any action', () => {
          expect(utilityModule.sleep).toHaveBeenCalled();
          expect(utilityModule.sleep).toHaveBeenCalledWith(
            utilityModule.THREE_MINUTES
          );
        });

        it('should unassign reviewer', async () => {
          expect(github.issues.removeAssignees).toHaveBeenCalled();
          expect(github.issues.removeAssignees).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            issue_number: reviewPayloadData.payload.pull_request.number,
            assignees: [reviewPayloadData.payload.review.user.login],
          });
        });

        it('should check if pull request has changes requested', () => {
          expect(
            utilityModule.doesPullRequestHaveChangesRequested
          ).toHaveBeenCalled();
          expect(github.search.issuesAndPullRequests).toHaveBeenCalled();
          expect(github.search.issuesAndPullRequests).toHaveBeenCalledWith({
            owner: reviewPayloadData.payload.repository.owner.login,
            repo: reviewPayloadData.payload.repository.name,
            q:
              'repo:oppia/oppia review:approved ' +
              reviewPayloadData.payload.pull_request.number,
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
          reviewPayloadData.payload.pull_request.requested_reviewers =
            initialReviewers;
        });
      }
    );

    describe(
      'when the pull request gets closed / merged before 3 minutes delay ' +
      'is over',
      () => {
        const initalState = reviewPayloadData.payload.pull_request.state;
        beforeAll(() => {
          reviewPayloadData.payload.pull_request.state = 'closed';
        });
        beforeEach(async () => {
          await robot.receive(reviewPayloadData);
        });

        it('should check type of review', () => {
          expect(
            pullRequestReviewModule.handlePullRequestReview
          ).toHaveBeenCalled();
        });

        it('should wait for 3 minutes before performing any action', () => {
          expect(utilityModule.sleep).toHaveBeenCalled();
          expect(utilityModule.sleep).toHaveBeenCalledWith(
            utilityModule.THREE_MINUTES);
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
          reviewPayloadData.payload.pull_request.state = initalState;
        });
      }
    );
  });

  describe('A reviewer comments on the PR', () => {
    const initalState = reviewPayloadData.payload.review.state;
    beforeAll(() => {
      reviewPayloadData.payload.review.state = 'commented';
    });

    beforeEach(async () => {
      github.pulls = {
        get: jasmine.createSpy('get').and.resolveTo({
          data: reviewPayloadData.payload.pull_request,
        }),
      };

      await robot.receive(reviewPayloadData);
    });

    it('should check type of review', () => {
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
      reviewPayloadData.payload.pull_request.state = initalState;
    });
  });

  describe('Pull request author comments on PR', () => {
    beforeEach(() => {
      github.pulls = {
        get: jasmine.createSpy('get').and.resolveTo({
          data: commentPayloadData.payload.issue,
        }),
      };
    });

    describe(
      'when author asks reviewer to ptal and does not assign them and author ' +
      'is assigned', () => {
        const initialAssignees = commentPayloadData.payload.issue.assignees;
        beforeAll(() => {
          commentPayloadData.payload.issue.assignees = [
            {
              login: commentPayloadData.payload.issue.user.login
            }
          ];
        });

        beforeEach(async () => {
          await robot.receive(commentPayloadData);
        });

        it('should check call response to review method', () => {
          expect(
            pullRequestReviewModule.handleResponseToReview
          ).toHaveBeenCalled();
        });

        it('should wait for 3 minutes before performing any action', () => {
          expect(utilityModule.sleep).toHaveBeenCalled();
          expect(utilityModule.sleep).toHaveBeenCalledWith(
            utilityModule.THREE_MINUTES);
        });

        it('should get the updated version of the pull request', () => {
          expect(github.pulls.get).toHaveBeenCalled();
          expect(github.pulls.get).toHaveBeenCalledWith({
            repo: commentPayloadData.payload.repository.name,
            owner: commentPayloadData.payload.repository.owner.login,
            pull_number: commentPayloadData.payload.issue.number,
          });
        });

        it('should assign reviewers', () => {
          expect(github.issues.addAssignees).toHaveBeenCalled();
          expect(github.issues.addAssignees).toHaveBeenCalledWith({
            repo: commentPayloadData.payload.repository.name,
            owner: commentPayloadData.payload.repository.owner.login,
            issue_number: commentPayloadData.payload.issue.number,
            assignees: ['reviewer1', 'reviewer2'],
          });
        });

        it('should unassign author', () => {
          expect(github.issues.removeAssignees).toHaveBeenCalled();
          expect(github.issues.removeAssignees).toHaveBeenCalledWith({
            repo: commentPayloadData.payload.repository.name,
            owner: commentPayloadData.payload.repository.owner.login,
            issue_number: commentPayloadData.payload.issue.number,
            assignees: [commentPayloadData.payload.issue.user.login],
          });

          expect(github.issues.createComment).toHaveBeenCalled();
          expect(github.issues.createComment).toHaveBeenCalledWith({
            repo: commentPayloadData.payload.repository.name,
            owner: commentPayloadData.payload.repository.owner.login,
            issue_number: commentPayloadData.payload.issue.number,
            body:
              'Unassigning @testuser since a re-review was requested. ' +
              '@testuser, please make sure you have addressed all review ' +
              'comments. Thanks!',
          });
        });

        afterAll(() => {
          commentPayloadData.payload.issue.assignees = initialAssignees;
        });
      }
    );

    describe(
      'when author asks reviewer to ptal and assigns some of them ' +
      'already', () => {
        const initialAssignees = commentPayloadData.payload.issue.assignees;
        beforeAll(() => {
          commentPayloadData.payload.issue.assignees = [
            {
              login: 'reviewer1',
            },
          ];
        });
        beforeEach(async () => {
          await robot.receive(commentPayloadData);
        });

        it('should check call response to review method', () => {
          expect(
            pullRequestReviewModule.handleResponseToReview
          ).toHaveBeenCalled();
        });

        it('should wait for 3 minutes before performing any action', () => {
          expect(utilityModule.sleep).toHaveBeenCalled();
          expect(utilityModule.sleep).toHaveBeenCalledWith(
            utilityModule.THREE_MINUTES);
        });

        it('should get the updated version of the pull request', () => {
          expect(github.pulls.get).toHaveBeenCalled();
          expect(github.pulls.get).toHaveBeenCalledWith({
            repo: commentPayloadData.payload.repository.name,
            owner: commentPayloadData.payload.repository.owner.login,
            pull_number: commentPayloadData.payload.issue.number,
          });
        });

        it('should assign remaining reviewers', () => {
          expect(github.issues.addAssignees).toHaveBeenCalled();
          expect(github.issues.addAssignees).toHaveBeenCalledWith({
            repo: commentPayloadData.payload.repository.name,
            owner: commentPayloadData.payload.repository.owner.login,
            issue_number: commentPayloadData.payload.issue.number,
            assignees: ['reviewer2'],
          });
        });

        afterAll(() => {
          commentPayloadData.payload.issue.assignees = initialAssignees;
        });
      }
    );

    describe(
      'when author asks reviewer to ptal and assigns them already', () => {
        const initialAssignees = commentPayloadData.payload.issue.assignees;
        beforeAll(() => {
          commentPayloadData.payload.issue.assignees = [
            {
              login: 'reviewer1',
            },
            {
              login: 'reviewer2',
            },
          ];
        });
        beforeEach(async () => {
          await robot.receive(commentPayloadData);
        });

        it('should check call response to review method', () => {
          expect(
            pullRequestReviewModule.handleResponseToReview
          ).toHaveBeenCalled();
        });

        it('should wait for 3 minutes before performing any action', () => {
          expect(utilityModule.sleep).toHaveBeenCalled();
          expect(utilityModule.sleep).toHaveBeenCalledWith(
            utilityModule.THREE_MINUTES);
        });

        it('should get the updated version of the pull request', () => {
          expect(github.pulls.get).toHaveBeenCalled();
          expect(github.pulls.get).toHaveBeenCalledWith({
            repo: commentPayloadData.payload.repository.name,
            owner: commentPayloadData.payload.repository.owner.login,
            pull_number: commentPayloadData.payload.issue.number,
          });
        });

        it('should not assign reviewers', () => {
          expect(github.issues.addAssignees).not.toHaveBeenCalled();
          expect(github.issues.addAssignees).not.toHaveBeenCalledWith({
            repo: commentPayloadData.payload.repository.name,
            owner: commentPayloadData.payload.repository.owner.login,
            issue_number: commentPayloadData.payload.issue.number,
            assignees: ['reviewer1', 'reviewer2'],
          });
        });

        afterAll(() => {
          commentPayloadData.payload.issue.assignees = initialAssignees;
        });
      }
    );

    describe('when author does not ask reviewer to ptal', () => {
      const initialAssignees = commentPayloadData.payload.issue.assignees;
      const initalCommentBody = commentPayloadData.payload.comment.body;
      beforeAll(() => {
        commentPayloadData.payload.issue.assignees = [];
        commentPayloadData.payload.comment.body =
          'Hi @reviewer, I wanted you to know that I can create pull ' +
          'requests. Thanks!';
      });
      beforeEach(async () => {
        await robot.receive(commentPayloadData);
      });

      it('should check call response to review method', () => {
        expect(
          pullRequestReviewModule.handleResponseToReview
        ).toHaveBeenCalled();
      });

      it('should not wait for 3 minutes', () => {
        expect(utilityModule.sleep).not.toHaveBeenCalled();
        expect(utilityModule.sleep).not.toHaveBeenCalledWith(
          utilityModule.THREE_MINUTES);
      });

      it('should not get the updated version of the pull request', () => {
        expect(github.pulls.get).not.toHaveBeenCalled();
        expect(github.pulls.get).not.toHaveBeenCalledWith({
          repo: commentPayloadData.payload.repository.name,
          owner: commentPayloadData.payload.repository.owner.login,
          pull_number: commentPayloadData.payload.issue.number,
        });
      });

      it('should not assign reviewers', () => {
        expect(github.issues.addAssignees).not.toHaveBeenCalled();
        expect(github.issues.addAssignees).not.toHaveBeenCalledWith({
          repo: commentPayloadData.payload.repository.name,
          owner: commentPayloadData.payload.repository.owner.login,
          issue_number: commentPayloadData.payload.issue.number,
          assignees: ['reviewer1', 'reviewer2'],
        });
      });

      afterAll(() => {
        commentPayloadData.payload.issue.assignees = initialAssignees;
        commentPayloadData.payload.comment.body = initalCommentBody;
      });
    });

    describe('when another user comments on pr', () => {
      const initialAssignees = commentPayloadData.payload.issue.assignees;
      const initalCommentBody = commentPayloadData.payload.comment.body;
      const initialCommenter = { ...commentPayloadData.payload.comment.user };
      const initialSender = { ...commentPayloadData.payload.sender };
      beforeAll(() => {
        commentPayloadData.payload.issue.assignees = [];
        commentPayloadData.payload.comment.body =
          'Hi @author, I will be reviewing this PR in a few minutes.';
        commentPayloadData.payload.sender = {
          login: 'sample_sender',
        };
        commentPayloadData.payload.comment.user = {
          login: 'sample_sender',
        };
      });
      beforeEach(async () => {
        await robot.receive(commentPayloadData);
      });

      it('should check call response to review method', () => {
        expect(
          pullRequestReviewModule.handleResponseToReview
        ).toHaveBeenCalled();
      });

      it('should not wait for 3 minutes', () => {
        expect(utilityModule.sleep).not.toHaveBeenCalled();
        expect(utilityModule.sleep).not.toHaveBeenCalledWith(
          utilityModule.THREE_MINUTES);
      });

      it('should not get the updated version of the pull request', () => {
        expect(github.pulls.get).not.toHaveBeenCalled();
        expect(github.pulls.get).not.toHaveBeenCalledWith({
          repo: commentPayloadData.payload.repository.name,
          owner: commentPayloadData.payload.repository.owner.login,
          pull_number: commentPayloadData.payload.issue.number,
        });
      });

      it('should not assign reviewers', () => {
        expect(github.issues.addAssignees).not.toHaveBeenCalled();
        expect(github.issues.addAssignees).not.toHaveBeenCalledWith({
          repo: commentPayloadData.payload.repository.name,
          owner: commentPayloadData.payload.repository.owner.login,
          issue_number: commentPayloadData.payload.issue.number,
          assignees: ['reviewer1', 'reviewer2'],
        });
      });

      afterAll(() => {
        commentPayloadData.payload.issue.assignees = initialAssignees;
        commentPayloadData.payload.comment.body = initalCommentBody;
        commentPayloadData.payload.sender = initialSender;
        commentPayloadData.payload.comment.user = initialCommenter;
      });
    });

    describe(
      'when the comment is on an issue and not a pull request', () => {
        const pullRequestInfo = commentPayloadData.payload.issue.pull_request;
        beforeAll(() => {
          delete commentPayloadData.payload.issue.pull_request;
        });
        beforeEach(async () => {
          await robot.receive(commentPayloadData);
        });

        it('should check call response to review method', () => {
          expect(
            pullRequestReviewModule.handleResponseToReview
          ).toHaveBeenCalled();
        });

        it('should not wait for 3 minutes', () => {
          expect(utilityModule.sleep).not.toHaveBeenCalled();
          expect(utilityModule.sleep).not.toHaveBeenCalledWith(
            utilityModule.THREE_MINUTES);
        });

        it('should not get the updated version of the pull request', () => {
          expect(github.pulls.get).not.toHaveBeenCalled();
          expect(github.pulls.get).not.toHaveBeenCalledWith({
            repo: commentPayloadData.payload.repository.name,
            owner: commentPayloadData.payload.repository.owner.login,
            pull_number: commentPayloadData.payload.issue.number,
          });
        });

        it('should not assign reviewers', () => {
          expect(github.issues.addAssignees).not.toHaveBeenCalled();
          expect(github.issues.addAssignees).not.toHaveBeenCalledWith({
            repo: commentPayloadData.payload.repository.name,
            owner: commentPayloadData.payload.repository.owner.login,
            issue_number: commentPayloadData.payload.issue.number,
            assignees: ['reviewer1', 'reviewer2'],
          });
        });

        afterAll(() => {
          commentPayloadData.payload.issue.pull_request = pullRequestInfo;
        });
      }
    );
  });
});
