require('dotenv').config();
const { createProbot } = require('probot');
// The plugin refers to the actual app in index.js.
const oppiaBot = require('../index');
const checkPullRequestJobModule = require('../lib/checkPullRequestJob');
const apiForSheetsModule = require('../lib/apiForSheets');
const checkPullRequestLabelsModule = require('../lib/checkPullRequestLabels');
const checkPullRequestBranchModule = require('../lib/checkPullRequestBranch');
const checkWIPModule = require('../lib/checkWipDraftPR');
const scheduler = require('../lib/scheduler');

let payloadData = JSON.parse(
  JSON.stringify(require('../fixtures/pullRequestPayload.json'))
);
const {SERVER_JOBS_ADMIN} = require('../userWhitelist.json');

describe('Pull Request Job Spec', () => {
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

  const newJobFileObj = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/domain/exp_jobs_one_off.py',
    status: 'added',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130e110d7e9833c/core/domain/exp_jobs_one_off.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130e110d7e9833c/core/domain/exp_jobs_one_off.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/exp_jobs_one_off.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch: '@@ -0,0 +1 @@\n+# Testing job pushes',
  };

  const secondNewJobFileObj = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/domain/exp_jobs_oppiabot_off.py',
    status: 'added',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/exp_jobs_oppiabot_off.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch: '@@ -0,0 +1 @@\n+# Testing job pushes',
  };

  const registryFileObj = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/jobs_registry.py',
    status: 'modified',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/exp_jobs_oppiabot_off.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch: '@@ -0,0 +1 @@\n+# exp_jobs_oppiabot_off exp_jobs_one_off',
  }

  beforeEach(() => {
    spyOn(scheduler, 'createScheduler').and.callFake(() => {});

    github = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.returnValue({}),
        addLabels: jasmine.createSpy('addLabels').and.returnValue({}),
        addAssignees: jasmine.createSpy('addAssignees').and.returnValue({})
      },
    };

    robot = createProbot({
      id: 1,
      cert: 'test',
      githubToken: 'test',
    });

    app = robot.load(oppiaBot);
    spyOn(app, 'auth').and.resolveTo(github);
    spyOn(checkPullRequestJobModule, 'checkForNewJob').and.callThrough();
    spyOn(apiForSheetsModule, 'checkClaStatus').and.callFake(() => {});
    spyOn(
      checkPullRequestLabelsModule,
      'checkChangelogLabel'
    ).and.callFake(() => {});
    spyOn(checkPullRequestBranchModule, 'checkBranch').and.callFake(() => {});
    spyOn(checkWIPModule, 'checkWIP').and.callFake(() => {});
  });

  describe('When pull request creates a new job file', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            {
              filename: 'core/templates/App.ts',
            }, newJobFileObj
          ],
        }),
      };

      await robot.receive(payloadData);
    });

    it('should check for jobs', () => {
      expect(checkPullRequestJobModule.checkForNewJob).toHaveBeenCalled();
    });

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should ping server jobs admin', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      const author = payloadData.payload.pull_request.user.login;
      const formText = 'server jobs form'.link(
        'https://goo.gl/forms/XIj00RJ2h5L55XzU2');
      const newLineFeed = '<br>';
      const wikiLinkText = (
        'This PR can be merged only after the test is successful'.link(
          'https://github.com/oppia/oppia/wiki/Running-jobs-in-production' +
          '#submitting-a-pr-with-a-new-job'));

      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        body: 'Hi @' + SERVER_JOBS_ADMIN + ', PTAL at this PR, ' +
        'it adds a new one off job. The name of the job is exp_jobs_one_off.' +
        newLineFeed + 'Also @' + author + ', please add the new job ' +
        'file to the job registry and please make sure to fill in the ' +
        formText + ' for the new job to be tested on the backup server. ' +
        wikiLinkText + '.' + newLineFeed + 'Thanks!',
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
      });
    });

    it('should assign server jobs admin', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        assignees: [SERVER_JOBS_ADMIN]
      });
    });

    it('should add critical label', () => {
      expect(github.issues.addLabels).toHaveBeenCalled();
      expect(github.issues.addLabels).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        labels: ['critical']
      });
    });
  });

  describe('When pull request creates multiple job files', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            {
              filename: 'core/templates/App.ts',
            },
            newJobFileObj,
            secondNewJobFileObj
          ],
        }),
      };

      await robot.receive(payloadData);
    });

    it('should check for jobs', () => {
      expect(checkPullRequestJobModule.checkForNewJob).toHaveBeenCalled();
    });

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should ping server jobs admin', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      const author = payloadData.payload.pull_request.user.login;
      const formText = 'server jobs form'.link(
        'https://goo.gl/forms/XIj00RJ2h5L55XzU2');
      const newLineFeed = '<br>';
      const wikiLinkText = (
        'This PR can be merged only after the test is successful'.link(
          'https://github.com/oppia/oppia/wiki/Running-jobs-in-production' +
          '#submitting-a-pr-with-a-new-job'));

      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        body: 'Hi @' + SERVER_JOBS_ADMIN + ', PTAL at this PR, ' +
        'it adds new one off jobs. The jobs are exp_jobs_one_off, exp_jobs_oppiabot_off.' +
        newLineFeed + 'Also @' + author + ', please add the new job ' +
        'files to the job registry and please make sure to fill in the ' +
        formText + ' for the new jobs  to be tested on the backup server. ' +
        wikiLinkText + '.' + newLineFeed + 'Thanks!',
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
      });
    });

    it('should assign server jobs admin', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        assignees: [SERVER_JOBS_ADMIN]
      });
    });

    it('should add critical label', () => {
      expect(github.issues.addLabels).toHaveBeenCalled();
      expect(github.issues.addLabels).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        labels: ['critical']
      });
    });
  });

  describe('When pull request creates a new job file and updates registry', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            {
              filename: 'core/templates/App.ts',
            },
            newJobFileObj,
            registryFileObj
          ],
        }),
      };

      await robot.receive(payloadData);
    });

    it('should check for jobs', () => {
      expect(checkPullRequestJobModule.checkForNewJob).toHaveBeenCalled();
    });

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should ping server jobs admin', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      const author = payloadData.payload.pull_request.user.login;
      const formText = 'server jobs form'.link(
        'https://goo.gl/forms/XIj00RJ2h5L55XzU2');
      const newLineFeed = '<br>';
      const wikiLinkText = (
        'This PR can be merged only after the test is successful'.link(
          'https://github.com/oppia/oppia/wiki/Running-jobs-in-production' +
          '#submitting-a-pr-with-a-new-job'));

      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        body: 'Hi @' + SERVER_JOBS_ADMIN + ', PTAL at this PR, ' +
        'it adds a new one off job. The name of the job is exp_jobs_one_off.' +
        newLineFeed + 'Also @' + author + ', please make sure to fill in the ' +
        formText + ' for the new job to be tested on the backup server. ' +
        wikiLinkText + '.' + newLineFeed + 'Thanks!',
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
      });
    });

    it('should assign server jobs admin', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        assignees: [SERVER_JOBS_ADMIN]
      });
    });

    it('should add critical label', () => {
      expect(github.issues.addLabels).toHaveBeenCalled();
      expect(github.issues.addLabels).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        labels: ['critical']
      });
    });
  });

  describe('When pull request modifies an existing job file', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            {...newJobFileObj, status: 'modified'},
          ],
        }),
      };

      await robot.receive(payloadData);
    });

    it('should check for jobs', () => {
      expect(checkPullRequestJobModule.checkForNewJob).toHaveBeenCalled();
    });

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });


    it('should not ping server jobs admin', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
    it('should not add critical label', () => {
      expect(github.issues.addLabels).not.toHaveBeenCalled();
    });
    it('should not assign server jobs admin', () => {
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
    });
  });

  describe('when pull request does not modify job file', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            {
              filename: 'core/domain/exp_fetchers.py',
            },
            {
              filename: 'core/templates/App.ts',
            },
          ],
        }),
      };

      await robot.receive(payloadData);
    });

    it('should check for jobs', () => {
      expect(checkPullRequestJobModule.checkForNewJob).toHaveBeenCalled();
    });

    it('should not get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should not ping server job admin', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
  });

  describe('When pull request has critical label', () => {
    beforeEach(async () => {
      payloadData.payload.pull_request.labels = [{ name: 'critical' }];
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            {
              filename: 'core/templates/App.ts',
            }, newJobFileObj
          ],
        }),
      };

      await robot.receive(payloadData);
    });

    it('should not check for jobs', () => {
      expect(checkPullRequestJobModule.checkForNewJob).toHaveBeenCalled();
    });

    it('should not get modified files', () => {
      expect(github.pulls.listFiles).not.toHaveBeenCalled();
    });

    it('should not ping server job admin', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
  });

});
