require('dotenv').config();
const { createProbot } = require('probot');
const oppiaBot = require('../index');
const scheduler = require('../lib/scheduler');
const periodicCheckModule = require('../lib/periodicChecks');
const staleBuildModule = require('../lib/staleBuildChecks');
const periodicCheckPayload = require('../fixtures/periodicCheckPayload.json');
const utils = require('../lib/utils');
const mergeConflictCheckModule = require('../lib/checkMergeConflicts');
const jobCheckModule = require('../lib/checkPullRequestJob');
const criticalPullRequestModule = require('../lib/checkCriticalPullRequest');
const newCodeOwnerModule = require('../lib/checkForNewCodeowner');
const checkBranchPushModule = require('../lib/checkBranchPush');
const pullRequestPayload = require('../fixtures/pullRequestPayload.json');

describe('Stale build check', () => {
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
    spyOn(mergeConflictCheckModule, 'checkMergeConflictsInPullRequest')
      .and
      .callFake(() => { });
    spyOn(jobCheckModule, 'checkForNewJob').and.callFake(() => { });
    spyOn(criticalPullRequestModule, 'checkIfPRAffectsDatastoreLayer')
      .and
      .callFake(() => { });
    spyOn(newCodeOwnerModule, 'checkForNewCodeowner').and.callFake(() => { });

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


    github = {
      issues: {
        createComment: jasmine
          .createSpy('createComment')
          .and.callFake(() => { }),
        addLabels: jasmine.createSpy('addLabels').and.callFake(() => { }),
        removeLabel: jasmine.createSpy('removeLabel').and.callFake(() => { }),
      },
      search:{
        issuesAndPullRequests: jasmine
          .createSpy('issuesAndPullRequests')
          .and.resolveTo({
            data: {
              items: [pullRequestPayload.payload.pull_request],
            },
          })
      },
      repos: {
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
      }
    };

    robot = createProbot({
      id: 1,
      cert: 'test',
      githubToken: 'test',
    });

    app = robot.load(oppiaBot);
    spyOn(app, 'auth').and.resolveTo(github);
  });

  describe('when pull request has an old build', () => {
    beforeEach(async () => {
      spyOn(
        staleBuildModule,
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

      github.pulls = {
        list:  jasmine.createSpy('list').and.resolveTo({
          data: [pullRequests.prWithOldBuild, pullRequests.prWithNewBuild],
        })
      };
      // Mocking the minimum build date.
      utils.MIN_BUILD_DATE = new Date('2020-08-12T14:15:32Z');

      await robot.receive(periodicCheckPayload);
    });

    it('should call periodic check module', () => {
      expect(
        staleBuildModule.checkAndTagPRsWithOldBuilds
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
            'changes from develop. Thanks!',
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
            'changes from develop. Thanks!',
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
      beforeEach(async () => {
        github.pulls.list = jasmine.createSpy('list').and.resolveTo({
          data: [oldBuildPR, pullRequests.prWithNewBuild],
        });

        await robot.receive(periodicCheckPayload);
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
              'changes from develop. Thanks!',
          }
        );
      });

      it('should not add old build label', () => {
        expect(github.issues.addLabels).not.toHaveBeenCalled();
      });
    });
  });

  describe('when a pull request with an old build gets updated', () => {
    const originalPayloadLabels = (
      pullRequestPayload.payload.pull_request.labels
    );
    const originalSha = pullRequestPayload.payload.pull_request.head.sha;
    beforeAll(() => {
      // Add Old build label to PR.
      pullRequestPayload.payload.pull_request.labels = [
        {name: utils.OLD_BUILD_LABEL}
      ];
      pullRequestPayload.payload.pull_request.head.sha = 'new-build-pr-sha';
    });

    afterAll(() =>{
      pullRequestPayload.payload.pull_request.labels = originalPayloadLabels;
      pullRequestPayload.payload.pull_request.head.sha = originalSha;
    });

    beforeEach(async() => {
      spyOn(staleBuildModule, 'removeOldBuildLabel').and.callThrough();
      // Set payload action to synchronize.
      pullRequestPayload.payload.action = 'synchronize';
      await robot.receive(pullRequestPayload);
    });

    it('should check if pull request contains old build label', () => {
      expect(staleBuildModule.removeOldBuildLabel).toHaveBeenCalled();
    });

    it('should remove old build label', () => {
      expect(github.issues.removeLabel).toHaveBeenCalled();
      expect(github.issues.removeLabel).toHaveBeenCalledWith({
        issue_number: pullRequestPayload.payload.pull_request.number,
        name: utils.OLD_BUILD_LABEL,
        owner: pullRequestPayload.payload.repository.owner.login,
        repo: pullRequestPayload.payload.repository.name
      });
    });
  });

  describe('when a pull request without an old build gets updated', () => {
    const originalSha = pullRequestPayload.payload.pull_request.head.sha;
    beforeAll(() => {
      pullRequestPayload.payload.pull_request.head.sha = 'new-build-pr-sha';
    });

    afterAll(() =>{
      pullRequestPayload.payload.pull_request.head.sha = originalSha;
    });

    beforeEach(async() => {
      spyOn(staleBuildModule, 'removeOldBuildLabel').and.callThrough();
      // Set payload action to synchronize.
      pullRequestPayload.payload.action = 'synchronize';
      await robot.receive(pullRequestPayload);
    });

    it('should check if pull request contains old build label', () => {
      expect(staleBuildModule.removeOldBuildLabel).toHaveBeenCalled();
    });

    it('should not remove old build label', () => {
      expect(github.issues.removeLabel).not.toHaveBeenCalled();
    });
  });

  describe('when develop branch gets updated', () => {
    const originalPayloadLabels = (
      pullRequestPayload.payload.pull_request.labels
    );
    const originalSha = pullRequestPayload.payload.pull_request.head.sha;
    beforeAll(() => {
      // Add Old build label to PR.
      pullRequestPayload.payload.pull_request.labels = [
        {name: utils.OLD_BUILD_LABEL}
      ];
      pullRequestPayload.payload.pull_request.head.sha = 'old-build-pr-sha';
    });

    afterAll(() =>{
      pullRequestPayload.payload.pull_request.labels = originalPayloadLabels;
      pullRequestPayload.payload.pull_request.head.sha = originalSha;
    });

    beforeEach(async() => {
      spyOn(staleBuildModule, 'removeOldBuildLabel').and.callThrough();
      // Set payload action to synchronize.
      pullRequestPayload.payload.action = 'synchronize';
      await robot.receive(pullRequestPayload);
    });

    it('should check if pull request contains old build label', () => {
      expect(staleBuildModule.removeOldBuildLabel).toHaveBeenCalled();
    });

    it('should not remove old build label', () => {
      expect(github.issues.removeLabel).not.toHaveBeenCalled();
    });
  });
});
