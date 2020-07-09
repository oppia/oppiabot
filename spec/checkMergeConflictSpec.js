require('dotenv').config();
const { createProbot } = require('probot');
// The plugin refers to the actual app in index.js.
const oppiaBot = require('../index');
const checkMergeConflictModule = require('../lib/checkMergeConflicts');
const scheduler = require('../lib/scheduler');
const checkPullRequestJobModule = require('../lib/checkPullRequestJob');
const checkCriticalPullRequestModule = require('../lib/checkCriticalPullRequest');
let payloadData = JSON.parse(
  JSON.stringify(require('../fixtures/pullRequestPayload.json'))
);

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
      'https://api.github.com/repos/oppia/oppia/labels/' +
      "PR:%20don't%20merge%20-%20HAS%20MERGE%20CONFLICTS",
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
    spyOn(checkPullRequestJobModule, 'checkForNewJob').and.callFake(() => {});
    spyOn(checkCriticalPullRequestModule, 'checkIfCritical').and.callFake(() => {});
    spyOn(
      checkMergeConflictModule,
      'checkMergeConflictsInAllPullRequests'
    ).and.callThrough();
    spyOn(
      checkMergeConflictModule,
      'checkMergeConflictsInPullRequest'
    ).and.callThrough();
  });

  describe('pull request merge results in merge conflict', () => {
    beforeEach(async () => {
      // Simulate a merged pull request.
      payloadData.payload.pull_request.merged = true;
      payloadData.payload.action = 'closed';

      // Create new pull request from payload data.
      const pullRequestToBeChecked = { ...payloadData.payload.pull_request };
      pullRequestToBeChecked.merged = false;
      // Simulate merge conflict in new PR.
      pullRequestToBeChecked.mergeable = false;

      github.pulls = {
        get: jasmine.createSpy('get').and.resolveTo({
          data: pullRequestToBeChecked,
        }),
        list: jasmine.createSpy('list').and.resolveTo({
          data: [pullRequestToBeChecked],
        }),
      };

      await robot.receive(payloadData);
    });

    it('should check for merge conflict', () => {
      expect(
        checkMergeConflictModule.checkMergeConflictsInAllPullRequests
      ).toHaveBeenCalled();
      expect(
        checkMergeConflictModule.checkMergeConflictsInPullRequest
      ).toHaveBeenCalled();
    });

    it('pings pr author regarding merge conflict', () => {
      expect(github.issues.createComment).toHaveBeenCalled();

      const link = 'link'.link(
        'https://help.github.com/articles/resolving-a-merge' +
          '-conflict-using-the-command-line/'
      );
      const params = {
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        number: payloadData.payload.pull_request.number,
        body:
          'Hi @' +
          payloadData.payload.pull_request.user.login +
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
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        number: payloadData.payload.pull_request.number,
        labels: [mergeConflictLabel.name],
      };
      expect(github.issues.addLabels).toHaveBeenCalledWith(params);
    });
  });

  describe('pull request merge does not result in merge conflict', () => {
    beforeEach(async () => {
      // Simulate a merged pull request.
      payloadData.payload.pull_request.merged = true;
      payloadData.payload.action = 'closed';

      // Create new pull request from payload data.
      const pullRequestToBeChecked = { ...payloadData.payload.pull_request };
      pullRequestToBeChecked.merged = false;
      pullRequestToBeChecked.mergeable = true;

      github.pulls = {
        get: jasmine.createSpy('get').and.resolveTo({
          data: pullRequestToBeChecked,
        }),
        list: jasmine.createSpy('list').and.resolveTo({
          data: [pullRequestToBeChecked],
        }),
      };

      await robot.receive(payloadData);
    });

    it('checks for merge conflict', () => {
      expect(
        checkMergeConflictModule.checkMergeConflictsInAllPullRequests
      ).toHaveBeenCalled();
      expect(
        checkMergeConflictModule.checkMergeConflictsInPullRequest
      ).toHaveBeenCalled();
    });

    it('should not ping pr author', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
    it('should not add merge conflict label', () => {
      expect(github.issues.addLabels).not.toHaveBeenCalled();
    });
  });

  describe('pull request with resolved merge conflicts has merge conflict label', () => {
    beforeEach(async () => {
      // Set event to pull_request.synchronize.
      payloadData.payload.action = 'synchronize';

      // Create new pull request from payload data.
      const pullRequestToBeChecked = { ...payloadData.payload.pull_request };
      pullRequestToBeChecked.merged = false;
      pullRequestToBeChecked.mergeable = true;

      // Add merge conflict label to new pull request.
      pullRequestToBeChecked.labels.push(mergeConflictLabel);

      github.pulls = {
        get: jasmine.createSpy('get').and.resolveTo({
          data: pullRequestToBeChecked,
        }),
        list: jasmine.createSpy('list').and.resolveTo({
          data: [pullRequestToBeChecked],
        }),
      };

      await robot.receive(payloadData);
    });

    it('should check for merge conflict', () => {
      expect(
        checkMergeConflictModule.checkMergeConflictsInPullRequest
      ).toHaveBeenCalled();
    });

    it('should not ping pr author', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not add merge conflict label', () => {
      expect(github.issues.addLabels).not.toHaveBeenCalled();
    });

    it('removes merge conflict label', () => {
      expect(github.issues.removeLabel).toHaveBeenCalled();
      const params = {
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        number: payloadData.payload.pull_request.number,
        name: mergeConflictLabel.name,
      };
      expect(github.issues.removeLabel).toHaveBeenCalledWith(params);
    });
  });

  describe('pull request with unresolved merge conflicts has merge conflict label', () => {
    beforeEach(async () => {
      // Set event to pull_request.synchronize.
      payloadData.payload.action = 'synchronize';

      // Create new pull request from payload data.
      const pullRequestToBeChecked = { ...payloadData.payload.pull_request };
      pullRequestToBeChecked.merged = false;
      pullRequestToBeChecked.mergeable = false;

      // Add merge conflict label to new pull request.
      pullRequestToBeChecked.labels.push(mergeConflictLabel);

      github.pulls = {
        get: jasmine.createSpy('get').and.resolveTo({
          data: pullRequestToBeChecked,
        }),
        list: jasmine.createSpy('list').and.resolveTo({
          data: [pullRequestToBeChecked],
        }),
      };

      await robot.receive(payloadData);
    });

    it('should check for merge conflict', () => {
      expect(
        checkMergeConflictModule.checkMergeConflictsInPullRequest
      ).toHaveBeenCalled();
    });

    it('should not ping pr author', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not add merge conflict label', () => {
      expect(github.issues.addLabels).not.toHaveBeenCalled();
    });

    it('should not remove merge conflict label', () => {
      expect(github.issues.removeLabel).not.toHaveBeenCalled();
    });
  });
});
