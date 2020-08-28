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
 * @fileoverview Spec for CI Checks handler.
 */

require('dotenv').config();
const { createProbot } = require('probot');
const oppiaBot = require('../index');
const scheduler = require('../lib/scheduler');
const payloadData = require('../fixtures/periodicCheckPayload.json');
const periodicCheckModule = require('../lib/periodicChecks');
const mergeConflictModule = require('../lib/checkMergeConflicts');

describe('Periodic Checks Module', () => {
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

  /**
   * @type {import('probot').Octokit.PullsGetResponse[]} pullRequests
   */
  let pullRequests = [
    // Merge Conflict PR.
    {
      number: 1,
      assignees: [],
      user: {
        login: 'author1',
      },
      requested_reviewers: [],
      mergeable: false,
      labels: [],
    },
    // Has Pending reviewers
    {
      number: 2,
      assignees: [],
      user: {
        login: 'author2',
      },
      mergeable: true,
      requested_reviewers: [
        {
          login: 'reviewer1',
        },
        {
          login: 'reviewer2',
        },
      ],
      labels: [],
    },
    // Has Changes Requested.
    {
      number: 3,
      assignees: [],
      user: {
        login: 'author3',
      },
      mergeable: true,
      requested_reviewers: [],
      labels: [],
    },
    // Has been approved.
    {
      number: 4,
      assignees: [],
      user: {
        login: 'author4',
      },
      mergeable: true,
      requested_reviewers: [],
      labels: [],
    },
    {
      number: 5,
      assignees: [],
      user: {
        login: 'author5',
      },
      mergeable: true,
      requested_reviewers: [],
      labels: [
        {
          name: 'PR CHANGELOG: Miscellaneous -- @ankita240796',
        },
      ],
    },
    {
      number: 6,
      assignees: [],
      user: {
        login: 'author6',
      },
      mergeable: true,
      requested_reviewers: [],
      labels: [],
    },
    {
      number: 7,
      assignees: [],
      user: {
        login: 'author7',
      },
      mergeable: true,
      requested_reviewers: [],
      labels: [],
    },
    {
      number: 8,
      assignees: [
        {
          login: 'someone',
        },
      ],
    },
  ];

  /**
   * @type {import('probot').Octokit.PullsGetResponse} assignedPullRequest
   */
  let assignedPullRequest = pullRequests[7];
  beforeEach(async () => {
    spyOn(scheduler, 'createScheduler').and.callFake(() => {});

    github = {
      issues: {
        createComment: jasmine
          .createSpy('createComment')
          .and.callFake(() => {}),
        addAssignees: jasmine.createSpy('addAssignees').and.callFake(() => {}),
        addLabels: jasmine.createSpy('addLabels').and.callFake(() => {}),
      },
      orgs: {
        checkMembership: jasmine
          .createSpy('checkMembership')
          .and.callFake((params) => {
            if (params.username.includes('4')) {
              return {
                status: 204,
              };
            }
            return {
              status: 404,
            };
          }),
      },
      search: {
        issuesAndPullRequests: jasmine
          .createSpy('issuesAndPullRequests')
          .and.callFake((params) => {
            const approvedPRNumbers = [4, 5, 6];
            const requestedChangesPRNumber = 3;
            const isApproved = approvedPRNumbers.some((num) =>
              params.q.includes(num)
            );

            if (isApproved && params.q.includes('review:approved')) {
              return {
                status: 204,
              };
            }

            if (
              params.q.includes(requestedChangesPRNumber) &&
              params.q.includes('review:changes_requested')
            ) {
              return {
                status: 204,
              };
            }

            return {
              status: 404,
            };
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
    spyOn(
      mergeConflictModule,
      'checkMergeConflictsInPullRequest'
    ).and.callThrough();
    spyOn(periodicCheckModule, 'ensurePullRequestIsAssigned').and.callThrough();
  });

  describe('when pull request has merge conflict', () => {
    beforeEach(async () => {
      const mergeConflictPR = pullRequests[0];
      github.pulls = {
        get: jasmine.createSpy('get').and.callFake((params) => {
          return {
            data: pullRequests[params.pull_number - 1],
          };
        }),
        list: jasmine.createSpy('list').and.resolveTo({
          data: [mergeConflictPR, assignedPullRequest],
        }),
      };
      await robot.receive(payloadData);
    });
    it('should call periodic check module', () => {
      expect(
        periodicCheckModule.ensurePullRequestIsAssigned
      ).toHaveBeenCalled();
    });

    it('should call merge conflict module', () => {
      expect(
        mergeConflictModule.checkMergeConflictsInPullRequest
      ).toHaveBeenCalled();
    });

    it('should add merge conflict label', () => {
      expect(github.issues.addLabels).toHaveBeenCalled();
      expect(github.issues.addLabels).toHaveBeenCalledWith({
        issue_number: 1,
        labels: ["PR: don't merge - HAS MERGE CONFLICTS"],
        owner: 'oppia',
        repo: 'oppia',
      });
    });

    it('should assign pr author', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: 1,
        assignees: ['author1'],
        owner: 'oppia',
        repo: 'oppia',
      });
    });

    it('should ping pr author', () => {
      const link = 'link'.link(
        'https://help.github.com/articles/resolving-a-merge' +
          '-conflict-using-the-command-line/'
      );

      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: 1,
        body:
          'Hi @author1. Due to recent changes in the "develop" branch, ' +
          'this PR now has a merge conflict. Please follow this ' +
          link +
          ' if you need help resolving the conflict, ' +
          'so that the PR can be merged. Thanks!',
        owner: 'oppia',
        repo: 'oppia',
      });
    });
  });

  describe('when pull request has pending reviews', () => {
    beforeEach(async () => {
      const pendingReviewPR = pullRequests[1];
      github.pulls = {
        get: jasmine.createSpy('get').and.callFake((params) => {
          return {
            data: pullRequests[params.pull_number - 1],
          };
        }),
        list: jasmine.createSpy('list').and.resolveTo({
          data: [pendingReviewPR, assignedPullRequest],
        }),
      };

      await robot.receive(payloadData);
    });

    it('should call periodic check module', () => {
      expect(
        periodicCheckModule.ensurePullRequestIsAssigned
      ).toHaveBeenCalled();
    });

    it('should assign remaining reviewers', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: 2,
        assignees: ['reviewer1', 'reviewer2'],
        owner: 'oppia',
        repo: 'oppia',
      });
    });

    it('should ping remaining reviewers', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: 2,
        owner: 'oppia',
        repo: 'oppia',
        body: 'Assigning @reviewer1, @reviewer2 for codeowner reviews. Thanks!',
      });
    });
  });

  describe('when pull request has changes requested', () => {
    beforeEach(async () => {
      const changesRequestedPR = pullRequests[2];
      github.pulls = {
        get: jasmine.createSpy('get').and.callFake((params) => {
          return {
            data: pullRequests[params.pull_number - 1],
          };
        }),
        list: jasmine.createSpy('list').and.resolveTo({
          data: [changesRequestedPR, assignedPullRequest],
        }),
      };

      await robot.receive(payloadData);
    });

    it('should call periodic check module', () => {
      expect(
        periodicCheckModule.ensurePullRequestIsAssigned
      ).toHaveBeenCalled();
    });

    it('should ping pr author', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: 3,
        assignees: ['author3'],
        owner: 'oppia',
        repo: 'oppia',
      });
    });

    it('should assign pr author', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: 3,
        owner: 'oppia',
        repo: 'oppia',
        body:
          'Hi @author3, changes was requested on this pull request, PTAL. Thanks!',
      });
    });
  });

  describe('when pull request has been approved and author has merging rights', () => {
    beforeEach(async () => {
      const approvedPR = pullRequests[3];
      github.pulls = {
        get: jasmine.createSpy('get').and.callFake((params) => {
          return {
            data: pullRequests[params.pull_number - 1],
          };
        }),
        list: jasmine.createSpy('list').and.resolveTo({
          data: [approvedPR, assignedPullRequest],
        }),
      };

      await robot.receive(payloadData);
    });

    it('should call periodic check module', () => {
      expect(
        periodicCheckModule.ensurePullRequestIsAssigned
      ).toHaveBeenCalled();
    });

    it('should check if pr author has merging rights', () => {
      expect(github.orgs.checkMembership).toHaveBeenCalled();
      expect(github.orgs.checkMembership).toHaveBeenCalledWith({
        org: 'oppia',
        username: 'author4',
      });
    });

    it('should ping pr author', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: 4,
        owner: 'oppia',
        repo: 'oppia',
        body:
          'Hi @author4, this PR is ready to be merged. Please make sure ' +
          'there are no pending comments before merge. Thanks!',
      });
    });

    it('should assign pr author', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: 4,
        owner: 'oppia',
        repo: 'oppia',
        assignees: ['author4'],
      });
    });
  });

  describe('when pull request has been approved and has a changelog label but author does not have merging rights', () => {
    beforeEach(async () => {
      const approvedPR = pullRequests[4];
      github.pulls = {
        get: jasmine.createSpy('get').and.callFake((params) => {
          return {
            data: pullRequests[params.pull_number - 1],
          };
        }),
        list: jasmine.createSpy('list').and.resolveTo({
          data: [approvedPR, assignedPullRequest],
        }),
      };

      await robot.receive(payloadData);
    });

    it('should call periodic check module', () => {
      expect(
        periodicCheckModule.ensurePullRequestIsAssigned
      ).toHaveBeenCalled();
    });

    it('should check if pr author has merging rights', () => {
      expect(github.orgs.checkMembership).toHaveBeenCalled();
      expect(github.orgs.checkMembership).toHaveBeenCalledWith({
        org: 'oppia',
        username: 'author5',
      });
    });

    it('should ping project owner', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: 5,
        owner: 'oppia',
        repo: 'oppia',
        body:
          'Hi @ankita240796, this PR is ready to be merged. Please make sure ' +
          "there are no pending comments from the author's end before merge. " +
          'Thanks!',
      });
    });

    it('should assign project owner', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: 5,
        owner: 'oppia',
        repo: 'oppia',
        assignees: ['ankita240796'],
      });
    });
  });

  describe('when pull request does not match any above case', () => {
    beforeEach(async () => {
      const approvedPR = pullRequests[6];
      github.pulls = {
        get: jasmine.createSpy('get').and.callFake((params) => {
          return {
            data: pullRequests[params.pull_number - 1],
          };
        }),
        list: jasmine.createSpy('list').and.resolveTo({
          data: [approvedPR, assignedPullRequest],
        }),
      };

      await robot.receive(payloadData);
    });

    it('should call periodic check module', () => {
      expect(
        periodicCheckModule.ensurePullRequestIsAssigned
      ).toHaveBeenCalled();
    });

    it('should ping welfare team lead', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: 7,
        owner: 'oppia',
        repo: 'oppia',
        body:
          'Hi @Showtim3, this pull request needs some assistance, PTAL. Thanks!',
      });
    });

    it('should assign welfare team lead', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: 7,
        owner: 'oppia',
        repo: 'oppia',
        assignees: ['Showtim3'],
      });
    });
  });
});
