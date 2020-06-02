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

  beforeEach(() => {
    spyOn(scheduler, 'createScheduler').and.callFake(() => {});

    github = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.returnValue({}),
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

  describe('When pull request modifies job file', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            {
              filename: 'core/domain/exp_jobs_one_off.py',
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

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should ping server jobs admin', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      const author = payloadData.payload.pull_request.user.login;
      const formText = 'server jobs form'.link(
        'https://goo.gl/forms/XIj00RJ2h5L55XzU2');

      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        body: 'Hi @' + SERVER_JOBS_ADMIN + ', PTAL at this PR, ' +
        'it adds/modifies a server job. Also @' + author + ', please ' +
        'endeavour to fill the ' + formText + ' for the new job ' +
        'to get tested on the test server. Thanks!',
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
      });
    });
  });

  describe('When pull request modifies job registry file', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            {
              filename: 'core/jobs_registry.py',
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

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should ping server jobs admin', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      const author = payloadData.payload.pull_request.user.login;
      const formText = 'server jobs form'.link(
        'https://goo.gl/forms/XIj00RJ2h5L55XzU2');

      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        body: 'Hi @' + SERVER_JOBS_ADMIN + ', PTAL at this PR, ' +
        'it adds/modifies a server job. Also @' + author + ', please ' +
        'endeavour to fill the ' + formText + ' for the new job ' +
        'to get tested on the test server. Thanks!',
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
      });
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

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should not ping server job admin', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
  });
});
