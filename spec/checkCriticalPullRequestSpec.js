require('dotenv').config();
const { createProbot } = require('probot');
// The plugin refers to the actual app in index.js.
const oppiaBot = require('../index');
const checkPullRequestJobModule = require('../lib/checkPullRequestJob');
const apiForSheetsModule = require('../lib/apiForSheets');
const checkPullRequestLabelsModule = require('../lib/checkPullRequestLabels');
const checkPullRequestBranchModule = require('../lib/checkPullRequestBranch');
const checkWIPModule = require('../lib/checkWipDraftPR');
const checkCriticalPullRequestModule = require('../lib/checkCriticalPullRequest');
const scheduler = require('../lib/scheduler');
const { teamLeads } = require('../userWhitelist.json');
let payloadData = JSON.parse(
  JSON.stringify(require('../fixtures/pullRequestPayload.json'))
);

describe('Critical Pull Request Spec', () => {
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

  const newModelFileObj = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/storage/skill/gae_models.py',
    status: 'added',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130e110d7e9833c/core/storage/skill/gae_models.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130e110d7e9833c/core/storage/skill/gae_models.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/storage/skill/gae_models.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch:
      '@@ -353,6 +353,11 @@ def export_data(user_id):\r\n         }\r\n \r\n \r\n+class OppiabotTestActivitiesModel(base_models.BaseModel):\r\n+    "Does some things right"\r\n+    pass\r\n+\r\n+\r\n class IncompleteActivitiesModel(base_models.BaseModel):\r\n     """Keeps track of all the activities currently being completed by the\r\n     learner.\r\n',
  };

  const modifiedModelFileObj = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/storage/skill/gae_models.py',
    status: 'modified',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130e110d7e9833c/core/storage/skill/gae_models.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130e110d7e9833c/core/storage/skill/gae_models.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/storage/skill/gae_models.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch:
      '@@ -39,6 +39,20 @@ class SkillSnapshotContentModel(base_models.BaseSnapshotContentModel):\r\n     pass\r\n \r\n \r\n+class OppiabotSnapshotContentModel(base_models.BaseSnapshotContentModel):\r\n+    """Oppiabot testing."""\r\n+\r\n+    pass\r\n+\r\n+\r\n+class OppiabotSnapshotTestingModel(base_models.BaseSnapshotContentModel):\r\n+    """Another Oppiabot model."""\r\n+\r\n+    pass\r\n+\r\n+\r\n+\r\n+\r\n class SkillModel(base_models.VersionedModel):\r\n     """Model for storing Skills.\r\n',
  };

  const modelTestFileObj = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/storage/skill/gae_models_test.py',
    status: 'modified',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130e110d7e9833c/core/storage/skill/gae_models_test.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130e110d7e9833c/core/storage/skill/gae_models_test.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/storage/skill/gae_models_test.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch:
      '@@ -46,6 +46,18 @@ def test_has_reference_to_user_id(self):\r\n             skill_models.SkillModel.has_reference_to_user_id(\'x_id\'))\r\n \r\n \r\n+class OppiabotSnapshotContentModelTest(base_models.BaseSnapshotContentModel):\r\n+    """Another Oppiabot model."""\r\n+\r\n+    pass\r\n+\r\n+\r\n+class OppiabotSnapshotTestingModelTest(base_models.BaseSnapshotContentModel):\r\n+    """Another Oppiabot model."""\r\n+\r\n+    pass\r\n+\r\n+\r\n class SkillCommitLogEntryModelUnitTests(test_utils.GenericTestBase):\r\n     """Tests the SkillCommitLogEntryModel class."""',
  };

  const modifiedModelFileWithNoNewModel = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: '/core/storage/suggestion/gae_models_test.py',
    status: 'modified',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130e110d7e9833c/core/storage/skill/gae_models_test.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130e110d7e9833c/core/storage/skill/gae_models_test.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/storage/skill/gae_models_test.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch:
      "@@ -41,6 +41,7 @@ def setUp(self):\r\n         super(SuggestionModelUnitTests, self).setUp()\r\n         suggestion_models.GeneralSuggestionModel.create(\r\n             suggestion_models.SUGGESTION_TYPE_EDIT_STATE_CONTENT,\r\n+            suggestion_models.CONTENT_MENT,\r\n             suggestion_models.TARGET_TYPE_EXPLORATION,\r\n             self.target_id, self.target_version_at_submission,\r\n             suggestion_models.STATUS_IN_REVIEW, 'author_1',",
  };

  const nonModelFile = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/domain/exp_fetchers.py',
    status: 'added',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130e110d7e9833c/core/domain/exp_fetchers.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130e110d7e9833c/core/domain/exp_fetchers.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/exp_fetchers.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch:
      '@@ -0,0 +1 @@\n+# def _migrate_states_schema(versioned_exploration_states, exploration_id):',
  };

  beforeEach(() => {
    spyOn(scheduler, 'createScheduler').and.callFake(() => {});

    github = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.returnValue({}),
        addLabels: jasmine.createSpy('addLabels').and.returnValue({}),
        addAssignees: jasmine.createSpy('addAssignees').and.returnValue({}),
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
    spyOn(apiForSheetsModule, 'checkClaStatus').and.callFake(() => {});
    spyOn(
      checkPullRequestLabelsModule,
      'checkChangelogLabel'
    ).and.callFake(() => {});
    spyOn(checkPullRequestBranchModule, 'checkBranch').and.callFake(() => {});
    spyOn(checkWIPModule, 'checkWIP').and.callFake(() => {});

    spyOn(checkCriticalPullRequestModule, 'checkIfCritical').and.callThrough();
  });

  describe('When a new model is created in a pull request', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [newModelFileObj],
        }),
      };
      payloadData.payload.pull_request.changed_files = 1;
      await robot.receive(payloadData);
    });

    it('should check for models', () => {
      expect(checkCriticalPullRequestModule.checkIfCritical).toHaveBeenCalled();
    });

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should ping release coordinator', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      const firstModel = 'OppiabotTestActivitiesModel'.link(
        newModelFileObj.blob_url
      );
      expect(github.issues.createComment).toHaveBeenCalledWith({
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        issue_number: payloadData.payload.pull_request.number,
        body:
          'Hi @' +
          teamLeads.releaseTeam +
          ', PTAL at this PR, ' +
          'it adds a model. The name of the model is ' +
          firstModel +
          '.<br>Thanks!',
      });
    });

    it('should assign the release coordinator', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        issue_number: payloadData.payload.pull_request.number,
        assignees: [teamLeads.releaseTeam],
      });
    });

    it('should add critical label', () => {
      expect(github.issues.addLabels).toHaveBeenCalled();
      expect(github.issues.addLabels).toHaveBeenCalledWith({
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        issue_number: payloadData.payload.pull_request.number,
        labels: ['critical'],
      });
    });
  });

  describe('When multiple models are created in a pull request', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [newModelFileObj, modifiedModelFileObj],
        }),
      };
      payloadData.payload.pull_request.changed_files = 1;
      await robot.receive(payloadData);
    });

    it('should check for models', () => {
      expect(checkCriticalPullRequestModule.checkIfCritical).toHaveBeenCalled();
    });

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should ping release coordinator', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      const firstModel = 'OppiabotTestActivitiesModel'.link(
        newModelFileObj.blob_url
      );
      const secondModels = 'OppiabotSnapshotContentModel, OppiabotSnapshotTestingModel'.link(
        modifiedModelFileObj.blob_url
      );
      expect(github.issues.createComment).toHaveBeenCalledWith({
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        issue_number: payloadData.payload.pull_request.number,
        body:
          'Hi @' +
          teamLeads.releaseTeam +
          ', PTAL at this PR, it adds ' +
          'new models. The models are ' +
          firstModel +
          ', ' +
          secondModels +
          '.<br>Thanks!',
      });
    });

    it('should assign the release coordinator', () => {
      expect(github.issues.addAssignees).toHaveBeenCalled();
      expect(github.issues.addAssignees).toHaveBeenCalledWith({
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        issue_number: payloadData.payload.pull_request.number,
        assignees: [teamLeads.releaseTeam],
      });
    });

    it('should add critical label', () => {
      expect(github.issues.addLabels).toHaveBeenCalled();
      expect(github.issues.addLabels).toHaveBeenCalledWith({
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        issue_number: payloadData.payload.pull_request.number,
        labels: ['critical'],
      });
    });
  });

  describe('When pull request does not add a new model', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [modifiedModelFileWithNoNewModel],
        }),
      };

      payloadData.payload.pull_request.changed_files = 1;
      await robot.receive(payloadData);
    });

    it('should check for models', () => {
      expect(checkCriticalPullRequestModule.checkIfCritical).toHaveBeenCalled();
    });

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should not ping release coordinator', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not assign release coordinator', () => {
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
    });
  });

  describe('When pull request modifies a model test', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [modelTestFileObj],
        }),
      };

      payloadData.payload.pull_request.changed_files = 1;
      await robot.receive(payloadData);
    });

    it('should check for models', () => {
      expect(checkCriticalPullRequestModule.checkIfCritical).toHaveBeenCalled();
    });

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should not ping release coordinator', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not assign release coordinator', () => {
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
    });
  });

  describe('When pull request does not modify a model file', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [nonModelFile],
        }),
      };

      payloadData.payload.pull_request.changed_files = 1;
      await robot.receive(payloadData);
    });

    it('should check for models', () => {
      expect(checkCriticalPullRequestModule.checkIfCritical).toHaveBeenCalled();
    });

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should not ping release coordinator', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not assign release coordinator', () => {
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
    });
  });

  describe('When pull request already has critical label', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [newModelFileObj, modifiedModelFileObj],
        }),
      };
      payloadData.payload.pull_request.labels = [
        {
          name: 'critical',
        },
      ];
      payloadData.payload.pull_request.changed_files = 2;
      await robot.receive(payloadData);
    });

    it('should check for models', () => {
      expect(checkCriticalPullRequestModule.checkIfCritical).toHaveBeenCalled();
    });

    it('should not get modified files', () => {
      expect(github.pulls.listFiles).not.toHaveBeenCalled();
    });

    it('should not ping release coordinator', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not assign release coordinator', () => {
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
    });
  });
});
