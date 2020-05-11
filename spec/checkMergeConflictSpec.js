require('dotenv').config();
const { createProbot } = require('probot');
// The plugin refers to the actual app in index.js.
const oppiaBot = require('../index');
const checkMergeConflictModule = require('../lib/checkMergeConflicts');
const scheduler = require('../lib/scheduler');
let payload = require('../fixtures/pullRequestPayload.json');

describe('Merge Conflict Check', () => {
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

  let mergeConflictLabel = {
    id: 971968901,
    node_id: 'MDU6TGFiZWw5NzE5Njg5MDE=',
    url:
      "https://api.github.com/repos/oppia/oppia/labels/PR:%20don't%20merge%20-%20HAS%20MERGE%20CONFLICTS",
    name: "PR: don't merge - HAS MERGE CONFLICTS",
    color: 'd93f0b',
    default: false,
  };
  beforeEach(() => {
    spyOn(scheduler, 'createScheduler').and.callFake(() => {});

    github = {
      issues: {
        addLabels: jasmine.createSpy('addLabels').and.resolveTo({}),
        addAssignees: jasmine.createSpy('addAssignees').and.resolveTo({}),
        createComment: jasmine.createSpy('createComment').and.resolveTo({}),
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
    spyOn(
      checkMergeConflictModule,
      'checkMergeConflictsInAllPullRequests'
    ).and.callThrough();
    spyOn(
      checkMergeConflictModule,
      'checkMergeConflictsInPullRequest'
    ).and.callThrough();
  });

  describe('when pull request gets merged', () => {
    beforeEach(async () => {
      // Simulate a merged conflict in pull request.
      payload.payload.pull_request.merged = true;
      payload.payload.action = 'closed';

      const pullRequest = { ...payload.payload.pull_request };
      pullRequest.merged = false;
      pullRequest.mergeable = false;

      github.pulls = {
        get: jasmine.createSpy('get').and.resolveTo({
          data: pullRequest,
        }),
        list: jasmine.createSpy('list').and.resolveTo({
          data: [pullRequest],
        }),
      };

      await robot.receive(payload);
    });

    it('should check for merge conflict', () => {
      expect(
        checkMergeConflictModule.checkMergeConflictsInAllPullRequests
      ).toHaveBeenCalled();
      expect(
        checkMergeConflictModule.checkMergeConflictsInPullRequest
      ).toHaveBeenCalled();
    });

    it('ping pr author regarding merge conflict', () => {
      expect(github.issues.createComment).toHaveBeenCalled();

      const link = 'link'.link(
        'https://help.github.com/articles/resolving-a-merge-conflict-using-the-command-line/'
      );
      const params = {
        repo: payload.payload.repository.name,
        owner: payload.payload.repository.owner.login,
        number: payload.payload.pull_request.number,
        body:
          'Hi @' +
          payload.payload.pull_request.user.login +
          '. Due to recent changes in the "develop" branch, ' +
          'this PR now has a merge conflict. ' +
          'Please follow this ' +
          link +
          ' if you need help resolving the conflict, ' +
          'so that the PR can be merged. Thanks!',
      };
      expect(github.issues.createComment).toHaveBeenCalledWith(params);
    });

    it('adds merge conflict label', () => {
      expect(github.issues.addLabels).toHaveBeenCalled();
      const params = {
        repo: payload.payload.repository.name,
        owner: payload.payload.repository.owner.login,
        number: payload.payload.pull_request.number,
        labels: [mergeConflictLabel.name],
      };
      expect(github.issues.addLabels).toHaveBeenCalledWith(params);
    });
  });

  describe("when pull request that doesn't cause merge conflict gets merged", () => {
    beforeEach(async () => {
      // Simulate a merged conflict in pull request.
      payload.payload.pull_request.merged = true;
      payload.payload.action = 'closed';

      const pullRequest = { ...payload.payload.pull_request };
      pullRequest.merged = false;
      pullRequest.mergeable = true;

      github.pulls = {
        get: jasmine.createSpy('get').and.resolveTo({
          data: pullRequest,
        }),
        list: jasmine.createSpy('list').and.resolveTo({
          data: [pullRequest],
        }),
      };

      await robot.receive(payload);
    });

    it('checks for merge conflict', () => {
      expect(
        checkMergeConflictModule.checkMergeConflictsInAllPullRequests
      ).toHaveBeenCalled();
      expect(
        checkMergeConflictModule.checkMergeConflictsInPullRequest
      ).toHaveBeenCalled();
    });

    it('does not ping pr author', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
    it('does not add merge conflict label', () => {
      expect(github.issues.addLabels).not.toHaveBeenCalled();
    });
  });

  describe('when pull request already has merge conflict label', () => {
    beforeEach(async () => {
      // Simulate a merged conflict in pull request.
      payload.payload.action = 'synchronize';

      const pullRequest = { ...payload.payload.pull_request };
      pullRequest.merged = false;
      pullRequest.mergeable = true;
      pullRequest.labels.push(mergeConflictLabel);

      github.pulls = {
        get: jasmine.createSpy('get').and.resolveTo({
          data: pullRequest,
        }),
        list: jasmine.createSpy('list').and.resolveTo({
          data: [pullRequest],
        }),
      };

      await robot.receive(payload);
    });

    it('should check for merge conflict', () => {
      expect(
        checkMergeConflictModule.checkMergeConflictsInPullRequest
      ).toHaveBeenCalled();
    });

    it('does not ping pr author', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('does not add merge conflict label', () => {
      expect(github.issues.addLabels).not.toHaveBeenCalled();
    });

    it('removes merge conflict label', () => {
      expect(github.issues.removeLabel).toHaveBeenCalled();
      const params = {
        repo: payload.payload.repository.name,
        owner: payload.payload.repository.owner.login,
        number: payload.payload.pull_request.number,
        name: mergeConflictLabel.name,
      };
      expect(github.issues.removeLabel).toHaveBeenCalledWith(params);
    });
  });

  // describe('when github stalls abit before synchronizing', () => {
  //   beforeEach(async () => {
  //     // Simulate a merged conflict in pull request.
  //     payload.payload.pull_request.merged = true;
  //     payload.payload.action = 'closed';

  //     const pullRequest = { ...payload.payload.pull_request };
  //     pullRequest.merged = false;
  //     pullRequest.mergeable = null;

  //     const pullRequest2 = { ...payload.payload.pull_request };
  //     pullRequest2.merged = false;
  //     pullRequest2.mergeable = false;
  //     const prGetter = () => {
  //       let count = 0;
  //       return () => {
  //         count++;
  //         if (count > 1) {
  //           return pullRequest2;
  //         }
  //         return pullRequest;
  //       };
  //     };
  //     github.pulls = {
  //       get: jasmine.createSpy('get').and.resolveTo({
  //         data: prGetter()(),
  //       }),
  //       list: jasmine.createSpy('list').and.resolveTo({
  //         data: [pullRequest],
  //       }),
  //     };

  //     await robot.receive(payload);
  //     github.pulls = {
  //       get: jasmine.createSpy('get').and.resolveTo({
  //         data: pullRequest2,
  //       }),
  //     };
  //   });

  //   it('should check for merge conflict', () => {
  //     expect(
  //       checkMergeConflictModule.checkMergeConflictsInAllPullRequests
  //     ).toHaveBeenCalled();
  //     expect(
  //       checkMergeConflictModule.checkMergeConflictsInPullRequest
  //     ).toHaveBeenCalled();
  //   });

  //   it('ping pr author regarding merge conflict', () => {
  //     expect(github.issues.createComment).toHaveBeenCalled();

  //     const link = 'link'.link(
  //       'https://help.github.com/articles/resolving-a-merge-conflict-using-the-command-line/'
  //     );
  //     const params = {
  //       repo: payload.payload.repository.name,
  //       owner: payload.payload.repository.owner.login,
  //       number: payload.payload.pull_request.number,
  //       body:
  //         'Hi @' +
  //         payload.payload.pull_request.user.login +
  //         '. Due to recent changes in the "develop" branch, ' +
  //         'this PR now has a merge conflict. ' +
  //         'Please follow this ' +
  //         link +
  //         ' if you need help resolving the conflict, ' +
  //         'so that the PR can be merged. Thanks!',
  //     };
  //     expect(github.issues.createComment).toHaveBeenCalledWith(params);
  //   });

  //   it('adds merge conflict label', () => {
  //     expect(github.issues.addLabels).toHaveBeenCalled();
  //     const params = {
  //       repo: payload.payload.repository.name,
  //       owner: payload.payload.repository.owner.login,
  //       number: payload.payload.pull_request.number,
  //       labels: [mergeConflictLabel.name],
  //     };
  //     expect(github.issues.addLabels).toHaveBeenCalledWith(params);
  //   });
  // });
});
