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
 * @fileoverview Spec for periodic checks handler.
 */

require('dotenv').config();
const { createProbot } = require('probot');
const oppiaBot = require('../index');
const scheduler = require('../lib/scheduler');
const payloadData = require('../fixtures/periodicCheckPayload.json');
const periodicCheckModule = require('../lib/periodicChecks');
const mergeConflictModule = require('../lib/checkMergeConflicts');
const utils = require('../lib/utils');

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

  let pullRequests = {
    mergeConflictPR: {
      number: 1,
      assignees: [],
      user: {
        login: 'author1',
      },
      requested_reviewers: [],
      mergeable: false,
      labels: [],
    },

    pendingReviewPR: {
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

    hasChangesRequestedPR: {
      number: 3,
      assignees: [],
      user: {
        login: 'author3',
      },
      mergeable: true,
      requested_reviewers: [],
      labels: [],
    },

    approvedPR: {
      number: 4,
      assignees: [],
      user: {
        login: 'author4',
      },
      mergeable: true,
      requested_reviewers: [],
      labels: [],
    },

    approvedPRWithLabel: {
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

    unResolvablePR: {
      number: 6,
      assignees: [],
      user: {
        login: 'author6',
      },
      mergeable: true,
      requested_reviewers: [],
      labels: [],
    },

    assignedPullRequest: {
      number: 8,
      assignees: [
        {
          login: 'someone',
        },
      ],
    },

    prWithOldBuild: {
      number: 9,
      head: {
        sha: 'old-build-pr-sha',
      },
      labels: [],
      user: {
        login: 'testuser',
        id: 11153258,
        node_id: 'MDQ6VXNlcjExMTUzMjU4',
        avatar_url: 'https://avatars2.githubusercontent.com/u/11153258?v=4',
        gravatar_id: '',
        url: 'https://api.github.com/users/testuser',
        html_url: 'https://github.com/testuser',
        followers_url: 'https://api.github.com/users/testuser/followers',
        following_url:
          'https://api.github.com/users/testuser/following{/other_user}',
        gists_url: 'https://api.github.com/users/testuser/gists{/gist_id}',
        starred_url:
          'https://api.github.com/users/testuser/starred{/owner}{/repo}',
        subscriptions_url:
          'https://api.github.com/users/testuser/subscriptions',
        organizations_url: 'https://api.github.com/users/testuser/orgs',
        repos_url: 'https://api.github.com/users/testuser/repos',
        events_url:
          'https://api.github.com/users/testuser/events{/privacy}',
        received_events_url:
          'https://api.github.com/users/testuser/received_events',
        type: 'User',
        site_admin: false,
      },
    },

    prWithNewBuild: {
      number: 10,
      head: {
        sha: 'new-build-pr-sha',
      },
      labels: [],
      user: {
        login: 'testuser2',
        id: 11153258,
        node_id: 'MDQ6VXNlcjExMTUzMjU4',
        avatar_url: 'https://avatars2.githubusercontent.com/u/11153258?v=4',
        gravatar_id: '',
        url: 'https://api.github.com/users/testuser2',
        html_url: 'https://github.com/testuser2',
        followers_url: 'https://api.github.com/users/testuser2/followers',
        following_url:
          'https://api.github.com/users/testuser2/following{/other_user}',
        gists_url: 'https://api.github.com/users/testuser2/gists{/gist_id}',
        starred_url:
          'https://api.github.com/users/testuser2/starred{/owner}{/repo}',
        subscriptions_url:
          'https://api.github.com/users/testuser2/subscriptions',
        organizations_url: 'https://api.github.com/users/testuser2/orgs',
        repos_url: 'https://api.github.com/users/testuser2/repos',
        events_url:
          'https://api.github.com/users/testuser2/events{/privacy}',
        received_events_url:
          'https://api.github.com/users/testuser2/received_events',
        type: 'User',
        site_admin: false,
      },
    },
  };

  beforeEach(async () => {
    spyOn(scheduler, 'createScheduler').and.callFake(() => { });

    github = {
      issues: {
        createComment: jasmine
          .createSpy('createComment')
          .and.callFake(() => { }),
        addAssignees: jasmine.createSpy('addAssignees').and.callFake(() => { }),
        addLabels: jasmine.createSpy('addLabels').and.callFake(() => { }),
      },
      pulls: {
        get: jasmine.createSpy('get').and.callFake((params) => {
          const prData = Object.values(pullRequests).find(
            (pr) => pr.number === params.pull_number
          );
          return {
            data: prData,
          };
        }),
      },
      orgs: {
        checkMembership: jasmine
          .createSpy('checkMembership')
          .and.callFake((params) => {
            // pullRequests.approvedPR is the only user that has merging rights.
            if (params.username === pullRequests.approvedPR.user.login) {
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
            // This function checks if a PR has been approved by all reviewers
            // or has changes requested, so we need to return 204 for the
            // appropriate cases when called with the specific pull request
            // numbers.
            const approvedPRNumbers = [
              pullRequests.approvedPR.number,
              pullRequests.approvedPRWithLabel.number,
            ];
            const requestedChangesPRNumber =
              pullRequests.hasChangesRequestedPR.number;
            const isApproved = approvedPRNumbers.some((num) =>
              params.q.includes(num)
            );

            if (isApproved && params.q.includes('review:approved')) {
              return {
                status: 200,
                data: {
                  items: [pullRequests.approvedPR]
                }
              };
            }

            if (
              params.q.includes(requestedChangesPRNumber) &&
              params.q.includes('review:changes_requested')
            ) {
              return {
                status: 200,
                data: {
                  items: [pullRequests.hasChangesRequestedPR]
                }
              };
            }

            return {
              status: 200,
              data: {
                items: []
              }
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
  });

  describe('when pull request has merge conflict', () => {
    beforeEach(async () => {
      spyOn(
        periodicCheckModule, 'ensureAllPullRequestsAreAssigned'
      ).and.callThrough();
      spyOn(
        periodicCheckModule, 'ensureAllIssuesHaveProjects'
      ).and.callFake(() => { });
      spyOn(
        periodicCheckModule, 'checkAndTagPRsWithOldBuilds'
      ).and.callFake(() => { });
      const mergeConflictPR = pullRequests.mergeConflictPR;
      github.pulls.list = jasmine.createSpy('list').and.resolveTo({
        data: [mergeConflictPR, pullRequests.assignedPullRequest],
      });
      await robot.receive(payloadData);
    });
    it('should call periodic check module', () => {
      expect(
        periodicCheckModule.ensureAllPullRequestsAreAssigned
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
      const link = (
        'link'.link(
          'https://help.github.com/articles/resolving-a-merge' +
        '-conflict-using-the-command-line/')
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
      spyOn(
        periodicCheckModule, 'ensureAllPullRequestsAreAssigned'
      ).and.callThrough();
      spyOn(
        periodicCheckModule, 'ensureAllIssuesHaveProjects'
      ).and.callFake(() => { });
      spyOn(
        periodicCheckModule, 'checkAndTagPRsWithOldBuilds'
      ).and.callFake(() => { });
      const pendingReviewPR = pullRequests.pendingReviewPR;
      github.pulls.list = jasmine.createSpy('list').and.resolveTo({
        data: [pendingReviewPR, pullRequests.assignedPullRequest],
      });
      await robot.receive(payloadData);
    });

    it('should call periodic check module', () => {
      expect(
        periodicCheckModule.ensureAllPullRequestsAreAssigned
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
        body:
          'Assigning @reviewer1, @reviewer2 for code owner reviews. Thanks!',
      });
    });

    it('should not assign pr author', () => {
      expect(github.issues.addAssignees).not.toHaveBeenCalledWith({
        issue_number: 2,
        assignees: ['author2'],
        owner: 'oppia',
        repo: 'oppia',
      });
    });
  });

  describe('when pull request has changes requested', () => {
    beforeEach(async () => {
      spyOn(
        periodicCheckModule, 'ensureAllPullRequestsAreAssigned'
      ).and.callThrough();
      spyOn(
        periodicCheckModule, 'ensureAllIssuesHaveProjects'
      ).and.callFake(() => { });
      spyOn(
        periodicCheckModule, 'checkAndTagPRsWithOldBuilds'
      ).and.callFake(() => { });
      const changesRequestedPR = pullRequests.hasChangesRequestedPR;
      github.pulls.list = jasmine.createSpy('list').and.resolveTo({
        data: [changesRequestedPR, pullRequests.assignedPullRequest],
      });
      github.pulls.listReviews = jasmine
        .createSpy('listReviews')
        .and.resolveTo({
          data: [
            {
              id: 469398917,
              user: {
                login: 'reviewer1',
              },
              body: '',
              commit_id: 'd8c0f3e805d23389dffb18fde642445ab6740412',
              state: 'changes_requested',
            },
            {
              id: 469398919,
              user: {
                login: 'reviewer2',
              },
              body: '',
              commit_id: 'd8c0f3e805d23389dffb18fde642445ab6740412',
              state: 'approved',
            },
            {
              id: 469398919,
              user: {
                login: 'reviewer3',
              },
              body: '',
              commit_id: 'd8c0f3e805d23389dffb18fde642445ab6740412',
              state: 'changes_requested',
            },
          ],
        });

      await robot.receive(payloadData);
    });

    it('should call periodic check module', () => {
      expect(
        periodicCheckModule.ensureAllPullRequestsAreAssigned
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
          'Hi @author3, it looks like some changes were requested on this ' +
          'pull request by @reviewer1. PTAL. Thanks!',
      });
    });
  });

  describe(
    'when pull request has been approved and author has merging rights', () => {
      beforeEach(async () => {
        spyOn(
          periodicCheckModule, 'ensureAllPullRequestsAreAssigned'
        ).and.callThrough();
        spyOn(
          periodicCheckModule, 'ensureAllIssuesHaveProjects'
        ).and.callFake(() => { });
        spyOn(
          periodicCheckModule, 'checkAndTagPRsWithOldBuilds'
        ).and.callFake(() => { });
        const approvedPR = pullRequests.approvedPR;
        github.pulls.list = jasmine.createSpy('list').and.resolveTo({
          data: [approvedPR, pullRequests.assignedPullRequest],
        });

        await robot.receive(payloadData);
      });

      it('should call periodic check module', () => {
        expect(
          periodicCheckModule.ensureAllPullRequestsAreAssigned
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
            'Hi @author4, this PR is ready to be merged. Please address any ' +
            'remaining comments prior to merging, and feel free to merge ' +
            'this PR once the CI checks pass and you\'re happy with it. ' +
            'Thanks!',
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

  describe(
    'when pull request has been approved and has a changelog label but ' +
    'author does not have merging rights',
    () => {
      beforeEach(async () => {
        spyOn(
          periodicCheckModule, 'ensureAllPullRequestsAreAssigned'
        ).and.callThrough();
        spyOn(
          periodicCheckModule, 'ensureAllIssuesHaveProjects'
        ).and.callFake(() => { });
        spyOn(
          periodicCheckModule, 'checkAndTagPRsWithOldBuilds'
        ).and.callFake(() => { });
        const approvedPR = pullRequests.approvedPRWithLabel;
        github.pulls.list = jasmine.createSpy('list').and.resolveTo({
          data: [approvedPR, pullRequests.assignedPullRequest],
        });
        await robot.receive(payloadData);
      });

      it('should call periodic check module', () => {
        expect(
          periodicCheckModule.ensureAllPullRequestsAreAssigned
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
            'Hi @ankita240796, this PR is ready to be merged. Before you ' +
            'merge it, please make sure that there are no pending comments ' +
            "that require action from the author's end. Thanks!",
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

      it('should not assign author', () => {
        expect(github.issues.addAssignees).not.toHaveBeenCalledWith({
          issue_number: 5,
          owner: 'oppia',
          repo: 'oppia',
          assignees: ['author5'],
        });
      });
    }
  );

  describe('when pull request does not match any of the above cases', () => {
    beforeEach(async () => {
      spyOn(
        periodicCheckModule, 'ensureAllPullRequestsAreAssigned'
      ).and.callThrough();
      spyOn(
        periodicCheckModule, 'ensureAllIssuesHaveProjects'
      ).and.callFake(() => { });
      spyOn(
        periodicCheckModule, 'checkAndTagPRsWithOldBuilds'
      ).and.callFake(() => { });
      const approvedPR = pullRequests.unResolvablePR;
      github.pulls.list = jasmine.createSpy('list').and.resolveTo({
        data: [approvedPR, pullRequests.assignedPullRequest],
      });

      await robot.receive(payloadData);
    });

    it('should call periodic check module', () => {
      expect(
        periodicCheckModule.ensureAllPullRequestsAreAssigned
      ).toHaveBeenCalled();
    });

    it('should ping onboarding team lead', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: 6,
        owner: 'oppia',
        repo: 'oppia',
        body:
          'Hi @DubeySandeep, @oppia/core-maintainers -- flagging this PR ' +
          'since it needs some assistance. PTAL, thanks!',
      });
    });

    it('should assign onboarding team lead', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: 6,
        owner: 'oppia',
        repo: 'oppia',
        assignees: ['DubeySandeep'],
      });
    });
  });

  describe('Should ensure all issues have been assigned to a project', () => {
    const issues = {
      withoutProject: {
        number: 1,
        labels: [],
      },
      anotherWithoutProject: {
        number: 2,
        labels: [],
      },
      withProject: {
        number: 3,
        labels: [],
      },
      anotherWithProject: {
        number: 4,
        labels: [],
      },
    };

    const projects = [
      {
        id: 101,
        columns: [
          {
            id: 111,
            cards: [
              {
                content_url:
                  'https://api.github.com/repos/api-playground/' +
                  'projects-test/issues/3',
              },
              {
                content_url:
                  'https://api.github.com/repos/api-playground/' +
                  'projects-test/issues/4',
              },
            ],
          },
        ],
      },
      {
        id: 102,
        columns: [
          {
            id: 112,
            cards: [
              {
                content_url:
                  'https://api.github.com/repos/api-playground/' +
                  'projects-test/issues/30',
              },
            ],
          },
          {
            id: 113,
            cards: [],
          },
        ],
      },
    ];
    beforeEach(() => {
      spyOn(
        periodicCheckModule, 'checkAndTagPRsWithOldBuilds'
      ).and.callFake(() => {});
      spyOn(
        periodicCheckModule,
        'ensureAllPullRequestsAreAssigned'
      ).and.callFake(() => { });
      spyOn(
        periodicCheckModule,
        'ensureAllIssuesHaveProjects'
      ).and.callThrough();

      github.projects = {
        listForRepo: jasmine.createSpy('listForRepo').and.resolveTo({
          data: projects,
        }),

        listColumns: jasmine.createSpy('listColumns').and.callFake((params) => {
          const currentProject = projects.find(
            (project) => project.id === params.project_id
          );
          return {
            data: currentProject.columns,
          };
        }),

        listCards: jasmine.createSpy('listCards').and.callFake((params) => {
          const currentProject = projects.find((project) => {
            const columnIds = project.columns.map((column) => column.id);
            return columnIds.includes(params.column_id);
          });
          const currentColumn = currentProject.columns.find(
            (column) => column.id === params.column_id
          );
          return { data: currentColumn.cards };
        }),
      };
    });

    describe('When all issues have been added to a project', () => {
      beforeEach(async () => {
        github.issues.listForRepo = jasmine
          .createSpy('listForRepo')
          .and.resolveTo({
            data: [issues.withProject, issues.anotherWithProject],
          });
        await robot.receive(payloadData);
      });

      it('should call ensureAllIssuesHaveProjects function', () => {
        expect(
          periodicCheckModule.ensureAllIssuesHaveProjects
        ).toHaveBeenCalled();
      });

      it('should get all open issues', () => {
        expect(github.issues.listForRepo).toHaveBeenCalled();
        expect(github.issues.listForRepo).toHaveBeenCalledWith({
          owner: 'oppia',
          repo: 'oppia',
          per_page: 100,
          state: 'open',
          page: 1,
        });
      });

      it('should get all project cards', () => {
        expect(github.projects.listForRepo).toHaveBeenCalled();
        expect(github.projects.listForRepo).toHaveBeenCalledWith({
          repo: 'oppia',
          owner: 'oppia',
        });

        expect(github.projects.listColumns).toHaveBeenCalled();
        expect(github.projects.listColumns).toHaveBeenCalledTimes(2);
        expect(github.projects.listColumns).toHaveBeenCalledWith({
          project_id: 101,
        });
        expect(github.projects.listColumns).toHaveBeenCalledWith({
          project_id: 102,
        });

        expect(github.projects.listCards).toHaveBeenCalled();
        expect(github.projects.listCards).toHaveBeenCalledTimes(3);
        expect(github.projects.listCards).toHaveBeenCalledWith({
          archived_state: 'not_archived',
          column_id: 111,
        });
        expect(github.projects.listCards).toHaveBeenCalledWith({
          archived_state: 'not_archived',
          column_id: 112,
        });
        expect(github.projects.listCards).toHaveBeenCalledWith({
          archived_state: 'not_archived',
          column_id: 113,
        });
      });

      it('should not ping core maintainers', () => {
        expect(github.issues.createComment).not.toHaveBeenCalled();
      });
    });

    describe('When some issues have not been added to a project', () => {
      beforeEach(async () => {
        github.issues.listForRepo = jasmine
          .createSpy('listForRepo')
          .and.resolveTo({
            data: [
              issues.withProject,
              issues.anotherWithProject,
              issues.withoutProject,
            ],
          });
        await robot.receive(payloadData);
      });

      it('should call ensureAllIssuesHaveProjects function', () => {
        expect(
          periodicCheckModule.ensureAllIssuesHaveProjects
        ).toHaveBeenCalled();
      });

      it('should get all open issues', () => {
        expect(github.issues.listForRepo).toHaveBeenCalled();
        expect(github.issues.listForRepo).toHaveBeenCalledWith({
          owner: 'oppia',
          repo: 'oppia',
          per_page: 100,
          state: 'open',
          page: 1,
        });
      });

      it('should get all project cards', () => {
        expect(github.projects.listForRepo).toHaveBeenCalled();
        expect(github.projects.listForRepo).toHaveBeenCalledWith({
          repo: 'oppia',
          owner: 'oppia',
        });

        expect(github.projects.listColumns).toHaveBeenCalled();
        expect(github.projects.listColumns).toHaveBeenCalledTimes(2);
        expect(github.projects.listColumns).toHaveBeenCalledWith({
          project_id: 101,
        });
        expect(github.projects.listColumns).toHaveBeenCalledWith({
          project_id: 102,
        });

        expect(github.projects.listCards).toHaveBeenCalled();
        expect(github.projects.listCards).toHaveBeenCalledTimes(3);
        expect(github.projects.listCards).toHaveBeenCalledWith({
          archived_state: 'not_archived',
          column_id: 111,
        });
        expect(github.projects.listCards).toHaveBeenCalledWith({
          archived_state: 'not_archived',
          column_id: 112,
        });
        expect(github.projects.listCards).toHaveBeenCalledWith({
          archived_state: 'not_archived',
          column_id: 113,
        });
      });

      it('should ping core maintainers', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          owner: 'oppia',
          repo: 'oppia',
          issue_number: 1,
          body:
            'Hi @oppia/core-maintainers, this issue is not assigned ' +
            'to any project. Can you please update the same? Thanks!',
        });
      });
    });
  });

  describe('when pull request has an old build', () => {
    const oldBuildPRCommitData = {
      sha: 'old-build-pr-sha',
      node_id:
        'MDY6Q29tbWl0MTczMDA0MDIyOmViNjk3ZTU1YTNkYTMwODUzNjBkODQz' +
        'ZGZiMTUwZjAzM2FhMTdlNjE=',
      commit: {
        author: {
          name: 'James James',
          email: 'jamesjay4199@gmail.com',
          date: '2020-08-10T14:15:32Z',
        },
        committer: {
          name: 'James James',
          email: 'jamesjay4199@gmail.com',
          date: '2020-08-10T14:15:32Z',
        },
        message: 'changes',
        tree: {
          sha: 'f5f8be9b0e4ac9970f68d8945de3474581b20d03',
          url:
            'https://api.github.com/repos/jameesjohn/oppia/git/' +
            'trees/f5f8be9b0e4ac9970f68d8945de3474581b20d03',
        },
        url:
          'https://api.github.com/repos/jameesjohn/oppia/git/' +
          'commits/eb697e55a3da3085360d843dfb150f033aa17e61',
        comment_count: 0,
        verification: {},
      },
      url:
        'https://api.github.com/repos/oppia/oppia/commits/' +
        'eb697e55a3da3085360d843dfb150f033aa17e61',
      html_url:
        'https://github.com/oppia/oppia/commit/' +
        'eb697e55a3da3085360d843dfb150f033aa17e61',
      comments_url:
        'https://api.github.com/repos/oppia/oppia/commits/' +
        'eb697e55a3da3085360d843dfb150f033aa17e61/comments',
      author: {},
      committer: {},
      parents: [],
    };
    const newBuildPRCommitData = {
      sha: 'new-build-pr-sha',
      node_id:
        'MDY6Q29tbWl0MTczMDA0MDIyOjUyNWQ2MDU4YTYyNmI0NjE1NGVkMz' +
        'czMTE0MWE5NWU3MGViYjBhZWY=',
      commit: {
        author: {
          name: 'James James',
          email: 'jamesjay4199@gmail.com',
          date: '2020-08-13T13:43:24Z',
        },
        committer: {
          name: 'James James',
          email: 'jamesjay4199@gmail.com',
          date: '2020-08-13T13:43:24Z',
        },
        message: 'new additions',
        tree: {
          sha: 'b5bf5af6ec0592bf3776b23d4355ff200549f427',
          url:
            'https://api.github.com/repos/jameesjohn/oppia/git/' +
            'trees/b5bf5af6ec0592bf3776b23d4355ff200549f427',
        },
        url:
          'https://api.github.com/repos/jameesjohn/oppia/git/' +
          'commits/525d6058a626b46154ed3731141a95e70ebb0aef',
        comment_count: 0,
        verification: {
          verified: false,
          reason: 'unsigned',
          signature: null,
          payload: null,
        },
      },
      url:
        'https://api.github.com/repos/jameesjohn/oppia/commits/' +
        '525d6058a626b46154ed3731141a95e70ebb0aef',
      html_url:
        'https://github.com/jameesjohn/oppia/commit/' +
        '525d6058a626b46154ed3731141a95e70ebb0aef',
      comments_url:
        'https://api.github.com/repos/jameesjohn/oppia/' +
        'commits/525d6058a626b46154ed3731141a95e70ebb0aef/comments',
      author: [],
      committer: [],
      parents: [],
    };

    beforeEach(async () => {
      spyOn(
        periodicCheckModule,
        'checkAndTagPRsWithOldBuilds'
      ).and.callThrough();
      spyOn(
        periodicCheckModule,
        'ensureAllPullRequestsAreAssigned'
      ).and.callFake(() => {});
      spyOn(
        periodicCheckModule,
        'ensureAllIssuesHaveProjects'
      ).and.callFake(() => {});

      github.pulls.list = jasmine.createSpy('list').and.resolveTo({
        data: [pullRequests.prWithOldBuild, pullRequests.prWithNewBuild],
      });
      // Mocking the minumum build date.
      utils.MIN_BUILD_DATE = new Date('2020-08-12T14:15:32Z');

      github.repos = {
        getCommit: jasmine.createSpy('getCommit').and.callFake((params) => {
          if (params.ref === pullRequests.prWithOldBuild.head.sha) {
            return {
              data: oldBuildPRCommitData,
            };
          }
          return {
            data: newBuildPRCommitData,
          };
        }),
      };
      await robot.receive(payloadData);
    });

    it('should call periodic check module', () => {
      expect(
        periodicCheckModule.checkAndTagPRsWithOldBuilds
      ).toHaveBeenCalled();
    });

    it('should fetch all open pull requests', () => {
      expect(github.pulls.list).toHaveBeenCalled();
    });

    it('should ping author when build is old', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith(
        {
          owner: 'oppia',
          repo: 'oppia',
          issue_number: pullRequests.prWithOldBuild.number,
          body:
            'Hi @' + pullRequests.prWithOldBuild.user.login + ', the build ' +
            'of this PR is stale and this could result in tests failing in ' +
            'develop. Please update this pull request with the latest ' +
            'changes from develop, Thanks.',
        }
      );
    });

    it('should add old build label when build is old', () => {
      expect(github.issues.addLabels).toHaveBeenCalled();
      expect(github.issues.addLabels).toHaveBeenCalledWith(
        {
          owner: 'oppia',
          repo: 'oppia',
          issue_number: pullRequests.prWithOldBuild.number,
          labels: ["PR: don't merge - STALE BUILD"],
        }
      );
    });

    it('should not ping author when build is new', () => {
      expect(github.issues.createComment).not.toHaveBeenCalledWith(
        {
          owner: 'oppia',
          repo: 'oppia',
          issue_number: pullRequests.prWithNewBuild.number,
          body:
            'Hi @' + pullRequests.prWithNewBuild.user.login + ', the build ' +
            'of this PR is stale and this could result in tests failing in ' +
            'develop. Please update this pull request with the latest ' +
            'changes from develop, Thanks.',
        }
      );
    });

    describe('when pull request author has already been pinged', () => {
      let oldBuildPR;
      beforeAll(() => {
        // Add stale build label to PR.
        oldBuildPR = {...pullRequests.prWithOldBuild};
        oldBuildPR.labels.push({
          name: "PR: don't merge - STALE BUILD"
        });
      });
      beforeEach(() => {
        github.pulls.list = jasmine.createSpy('list').and.resolveTo({
          data: [oldBuildPR, pullRequests.prWithNewBuild],
        });
      });

      it('should not ping author', () => {
        expect(github.issues.createComment).not.toHaveBeenCalled();
        expect(github.issues.createComment).not.toHaveBeenCalledWith(
          {
            owner: 'oppia',
            repo: 'oppia',
            issue_number: oldBuildPR.number,
            body:
              'Hi @' + pullRequests.prWithNewBuild.user.login + ', the build ' +
              'of this PR is stale and this could result in tests failing in ' +
              'develop. Please update this pull request with the latest ' +
              'changes from develop, Thanks.',
          }
        );
      });

      it('should not add old build label', () => {
        expect(github.issues.addLabels).not.toHaveBeenCalled();
      });
    });
  });
});
