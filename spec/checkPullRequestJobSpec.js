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

require('dotenv').config();
const { createProbot } = require('probot');
// The plugin refers to the actual app in index.js.
const oppiaBot = require('../index');
const checkPullRequestJobModule = require('../lib/checkPullRequestJob');
const apiForSheetsModule = require('../lib/apiForSheets');
const checkPullRequestLabelsModule = require('../lib/checkPullRequestLabels');
const checkPullRequestBranchModule = require('../lib/checkPullRequestBranch');
const checkWIPModule = require('../lib/checkWipDraftPR');
const checkCriticalPullRequestModule =
  require('../lib/checkCriticalPullRequest');
const checkPullRequestTemplateModule =

  require('../lib/checkPullRequestTemplate');
const newCodeOwnerModule = require('../lib/checkForNewCodeowner');
const scheduler = require('../lib/scheduler');

let payloadData = JSON.parse(
  JSON.stringify(require('../fixtures/pullRequestPayload.json'))
);
const { SERVER_JOBS_ADMIN } = require('../userWhitelist.json');

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

  const firstNewJobFileObj = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/domain/exp_jobs_one_off.py',
    status: 'added',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/exp_jobs_one_off.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/exp_jobs_one_off.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/' +
      'exp_jobs_one_off.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch: '@@ -0,0 +1 @@\n+class FirstTestOneOffJob(jobs.' +
    'BaseMapReduceOneOffJobManager):\n+    """One-off job for ' +
    'creating and populating UserContributionsModels for\n+    ' +
    'all registered users that have contributed.\n+    """\n+    ' +
    '@classmethod\n+    def entity_classes_to_map_over(cls)' +
    ':\n+        """Return a list of datastore class references ' +
    'to map over."""\n+        return [exp_models.' +
    'ExplorationSnapshotMetadataModel]\n+\n+    @staticmethod\n+    ' +
    'def map(item):\n+        """Implements the map function for this ' +
    'job."""\n+        yield (\n+            item.committer_id, ' +
    '{\n+                \'exploration_id\': item.' +
    'get_unversioned_instance_id(),\n+                ' +
    '\'version_string\': item.get_version_string(),\n+            ' +
    '})\n+\n+\n+    @staticmethod\n+    def reduce(key, ' +
    'version_and_exp_ids):\n+        """Implements the reduce ' +
    'function for this job."""\n+        created_exploration_ids = ' +
    'set()\n+        edited_exploration_ids = set()\n+\n+        ' +
    'edits = [ast.literal_eval(v) for v in version_and_exp_ids]' +
    '\n+\n+        for edit in edits:\n+            ' +
    'edited_exploration_ids.add(edit[\'exploration_id\'])' +
    '\n+            if edit[\'version_string\'] == \'1\'' +
    ':\n+                created_exploration_ids.add(edit' +
    '[\'exploration_id\'])\n+\n+        if user_services.' +
    'get_user_contributions(key, strict=False) is not None' +
    ':\n+            user_services.update_user_contributions' +
    '(\n+                key, list(created_exploration_ids), ' +
    'list(\n+                    edited_exploration_ids))\n+        ' +
    'else:\n+            user_services.create_user_contributions' +
    '(\n+                key, list(created_exploration_ids), list' +
    '(\n+                    edited_exploration_ids))\n',
  };

  const secondNewJobFileObj = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/domain/exp_jobs_oppiabot_off.py',
    status: 'added',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/' +
      'exp_jobs_oppiabot_off.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch: '@@ -0,0 +1 @@\n+class SecondTestOneOffJob(jobs.' +
    'BaseMapReduceOneOffJobManager):\n+    """One-off job ' +
    'for creating and populating UserContributionsModels for' +
    '\n+    all registered users that have contributed.\n+    ' +
    '"""\n+    @classmethod\n+    def entity_classes_to_map_over' +
    '(cls):\n+        """Return a list of datastore class references ' +
    'to map over."""\n+        return [exp_models.' +
    'ExplorationSnapshotMetadataModel]\n+\n+    @staticmethod\n+    ' +
    'def map(item):\n+        """Implements the map function for this ' +
    'job."""\n+        yield (\n+            item.committer_id, ' +
    '{\n+                \'exploration_id\': item.' +
    'get_unversioned_instance_id(),\n+                \'version_string\'' +
    ': item.get_version_string(),\n+            })\n+\n+\n+    ' +
    '@staticmethod\n+    def reduce(key, version_and_exp_ids)' +
    ':\n+        """Implements the reduce function for this job.' +
    '"""\n+        created_exploration_ids = set()\n+        ' +
    'edited_exploration_ids = set()\n+\n+        edits = ' +
    '[ast.literal_eval(v) for v in version_and_exp_ids]\n+\n+        ' +
    'for edit in edits:\n+            edited_exploration_ids.add' +
    '(edit[\'exploration_id\'])\n+            if edit' +
    '[\'version_string\'] == \'1\':\n+                ' +
    'created_exploration_ids.add(edit[\'exploration_id\'])' +
    '\n+\n+        if user_services.get_user_contributions' +
    '(key, strict=False) is not None:\n+            user_services.' +
    'update_user_contributions(\n+                key, list' +
    '(created_exploration_ids), list(\n+                    ' +
    'edited_exploration_ids))\n+        else:\n+            ' +
    'user_services.create_user_contributions(\n+                ' +
    'key, list(created_exploration_ids), list(\n+                    ' +
    'edited_exploration_ids))\n',
  };

  const modifiedExistingJobFileObj = {
    sha: 'f06a0d3ea104733080c4dad4a4e5aa7fb76d8f5d',
    filename: 'core/domain/user_jobs_one_off.py',
    status: 'modified',
    additions: 43,
    deletions: 0,
    changes: 43,
    blob_url:
      'https://github.com/oppia/oppia/blob/5b0e633fa1b9a00771a3b88302fa' +
      '3ff048d7240c/core/domain/user_jobs_one_off.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/5b0e633fa1b9a00771a3b88302fa' +
      '3ff048d7240c/core/domain/user_jobs_one_off.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/' +
      'user_jobs_one_off.py?ref=5b0e633fa1b9a00771a3b88302fa3ff048d7240c',
    patch:
      '@@ -80,6 +80,49 @@ def reduce(key, version_and_exp_ids)' +
      ':\n                     edited_exploration_ids))\n \n ' +
      '\n+class OppiabotContributionsOneOffJob(jobs.' +
      'BaseMapReduceOneOffJobManager):\n+    """One-off job ' +
      'for creating and populating UserContributionsModels for' +
      '\n+    all registered users that have contributed.\n+    ' +
      '"""\n+    @classmethod\n+    def entity_classes_to_map_over' +
      '(cls):\n+        """Return a list of datastore class ' +
      'references to map over."""\n+        return ' +
      '[exp_models.ExplorationSnapshotMetadataModel]\n+\n+    ' +
      '@staticmethod\n+    def map(item):\n+        """Implements ' +
      'the map function for this job."""\n+        yield ' +
      '(\n+            item.committer_id, {\n+                ' +
      '\'exploration_id\': item.get_unversioned_instance_id(),' +
      '\n+                \'version_string\': item.' +
      'get_version_string(),\n+            })\n+\n+\n+    ' +
      '@staticmethod\n+    def reduce(key, version_and_exp_ids)' +
      ':\n+        """Implements the reduce function for this ' +
      'job."""\n+        created_exploration_ids = set()' +
      '\n+        edited_exploration_ids = set()\n+\n+        ' +
      'edits = [ast.literal_eval(v) for v in version_and_exp_ids]' +
      '\n+\n+        for edit in edits:\n+            ' +
      'edited_exploration_ids.add(edit[\'exploration_id\'])' +
      '\n+            if edit[\'version_string\'] == \'1\'' +
      ':\n+                created_exploration_ids.add(edit' +
      '[\'exploration_id\'])\n+\n+        if user_services.' +
      'get_user_contributions(key, strict=False) is not None' +
      ':\n+            user_services.update_user_contributions' +
      '(\n+                key, list(created_exploration_ids), ' +
      'list(\n+                    edited_exploration_ids))' +
      '\n+        else:\n+            user_services.' +
      'create_user_contributions(\n+                key, ' +
      'list(created_exploration_ids), list(' +
      '\n+                    edited_exploration_ids))\n',
  };
  const modifiedExistingJobFileObjWithJobClassInPatch = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/domain/exp_jobs_oppiabot_off.py',
    status: 'modified',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/' +
      'exp_jobs_oppiabot_off.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch: '@@ -0,0 +1 @@class SecondTestOneOffJob(jobs.' +
      'BaseMapReduceOneOffJobManager)  def reduce(key, ' +
      'version_and_exp_ids):\n                     ' +
      'edited_exploration_ids))\n ',
  };

  const jobFileObjWithJobClassInPatchAndNewJob = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/domain/exp_jobs_oppiabot_off.py',
    status: 'modified',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a89413' +
      '0e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/' +
      'exp_jobs_oppiabot_off.py?ref=' +
      '67fb4a973b318882af3b5a894130e110d7e9833c',
    patch: '@@ -0,0 +1 @@class SecondTestOneOffJob(jobs.' +
      'BaseMapReduceOneOffJobManager)  def reduce(key, ' +
      'version_and_exp_ids):\n                     ' +
      'edited_exploration_ids))\n \n+class AnotherTestOneOffJob' +
      '(jobs.BaseMapReduceOneOffJobManager):\n+    """\n+    ' +
      '@classmethod\n+    def entity_classes_to_map_over ',
  };

  const jobFromTestDir = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/tests/linter_tests/exp_jobs_oppiabot_off.py',
    status: 'added',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/tests/linter_tests/exp_jobs_oppiabot_off.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/tests/linter_tests/exp_jobs_oppiabot_off.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/tests/' +
      'linter_tests/exp_jobs_oppiabot_off.py?ref=' +
      '67fb4a973b318882af3b5a894130e110d7e9833c',
    patch: '@@ -0,0 +1 @@\n+class LintTestOneOffJob(jobs.' +
      'BaseMapReduceOneOffJobManager):\n+    """One-off job ' +
      'for creating and populating UserContributionsModels for' +
      '\n+    all registered users that have contributed.\n+    ' +
      '"""\n+    @classmethod\n+    def entity_classes_to_map_over' +
      '(cls):\n+        """Return a list of datastore class ' +
      'references to map over."""\n+        return [exp_models.' +
      'ExplorationSnapshotMetadataModel]\n+\n+    @staticmethod' +
      '\n+    def map(item):\n+        """Implements the map function ' +
      'for this job."""\n+        yield (\n+            item.' +
      'committer_id, {\n+                \'exploration_id\': ' +
      'item.get_unversioned_instance_id(),\n+                ' +
      '\'version_string\': item.get_version_string(),\n+            ' +
      '})\n+\n+\n+    @staticmethod\n+    def reduce(key, ' +
      'version_and_exp_ids):\n+        """Implements the reduce ' +
      'function for this job."""\n+        created_exploration_ids ' +
      '= set()\n+        edited_exploration_ids = set()\n+\n+        ' +
      'edits = [ast.literal_eval(v) for v in version_and_exp_ids]' +
      '\n+\n+        for edit in edits:\n+            ' +
      'edited_exploration_ids.add(edit[\'exploration_id\'])' +
      '\n+            if edit[\'version_string\'] == \'1\'' +
      ':\n+                created_exploration_ids.add(edit' +
      '[\'exploration_id\'])\n+\n+        if user_services.' +
      'get_user_contributions(key, strict=False) is not None' +
      ':\n+            user_services.update_user_contributions' +
      '(\n+                key, list(created_exploration_ids), ' +
      'list(\n+                    edited_exploration_ids))\n+        ' +
      'else:\n+            user_services.create_user_contributions' +
      '(\n+                key, list(created_exploration_ids), list' +
      '(\n+                    edited_exploration_ids))\n',
  };

  const fileWithMultipleJobs = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/domain/exp_jobs_oppiabot_off.py',
    status: 'added',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/' +
      'exp_jobs_oppiabot_off.py?ref=' +
      '67fb4a973b318882af3b5a894130e110d7e9833c',
    patch: '@@ -0,0 +1 @@\n+class TestOneOffJob(jobs.BaseMapReduceOne' +
      'OffJobManager):\n+    """One-off job for creating and ' +
      'populating UserContributionsModels for \n+class ' +
      'AnotherTestOneOffJob(jobs.BaseMapReduceOneOffJobManager)' +
      ':\n+    """\n+    @classmethod\n+    def ' +
      'entity_classes_to_map_over(cls):\n+        """Return a list' +
      ' of datastore class references to map over."""\n+        ' +
      'return [exp_models.ExplorationSnapshotMetadataModel]\n+\n+    ' +
      '@staticmethod\n+    def map(item):\n+        """Implements ' +
      'the map function for this job."""\n+        yield ' +
      '(\n+            item.committer_id, {\n+                ' +
      '\'exploration_id\': item.get_unversioned_instance_id(),\n+' +
      '                \'version_string\': item.get_version_string(),' +
      '\n+            })\n+\n+\n+    @staticmethod\n+    ' +
      'def reduce(key, version_and_exp_ids):\n+        ' +
      '"""Implements the reduce function for this job."""\n+        ' +
      'created_exploration_ids = set()\n+        ' +
      'edited_exploration_ids = set()\n+\n+        edits = ' +
      '[ast.literal_eval(v) for v in version_and_exp_ids]' +
      '\n+\n+        for edit in edits:\n+            ' +
      'edited_exploration_ids.add(edit[\'exploration_id\'])' +
      '\n+            if edit[\'version_string\'] == \'1\':\n+' +
      '                created_exploration_ids.add(edit' +
      '[\'exploration_id\'])\n+\n+        if user_services.' +
      'get_user_contributions(key, strict=False) is not None' +
      ':\n+            user_services.update_user_contributions' +
      '(\n+                key, list(created_exploration_ids), ' +
      'list(\n+                    edited_exploration_ids))' +
      '\n+        else:\n+            user_services.' +
      'create_user_contributions(\n+                key, list(' +
      'created_exploration_ids), list(\n+                    ' +
      'edited_exploration_ids))\n',
  };

  const jobTestFile = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/domain/exp_jobs_oppiabot_off_test.py',
    status: 'added',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/' +
      'exp_jobs_oppiabot_off.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch: '@@ -0,0 +1 @@\n+class TestOneOffJobTests' +
      '(jobs.BaseMapReduceOneOffJobManager):\n+    """One-off job for ' +
      'creating and populating UserContributionsModels for ' +
      '\n+class AnotherTestOneOffJobTests(' +
      'jobs.BaseMapReduceOneOffJobManager):\n+    """\n+    ' +
      '@classmethod\n+    def entity_classes_to_map_over(cls):' +
      '\n+        """Return a list of datastore class references to ' +
      'map over."""\n+        return [exp_models.' +
      'ExplorationSnapshotMetadataModel]\n+\n+    @staticmethod\n+    ' +
      'def map(item):\n+        """Implements the map function for this ' +
      'job."""\n+        yield (\n+            item.committer_id, ' +
      '{\n+                \'exploration_id\': item.get_unversioned_' +
      'instance_id(),\n+                \'version_string\': item.' +
      'get_version_string(),\n+            })\n+\n+\n+    ' +
      '@staticmethod\n+    def reduce(key, version_and_exp_ids):\n+' +
      '        """Implements the reduce function for this job."""\n+' +
      '        created_exploration_ids = set()\n+        ' +
      'edited_exploration_ids = set()\n+\n+        edits ' +
      '= [ast.literal_eval(v) for v in version_and_exp_ids]\n+\n+        ' +
      'for edit in edits:\n+            edited_exploration_ids.add(edit' +
      '[\'exploration_id\'])\n+            if edit[\'version_string\'] == ' +
      '\'1\':\n+                created_exploration_ids.add(edit' +
      '[\'exploration_id\'])\n+\n+        if user_services.' +
      'get_user_contributions(key, strict=False) is not None:\n+            ' +
      'user_services.update_user_contributions(\n+                key, list' +
      '(created_exploration_ids), list(\n+                    ' +
      'edited_exploration_ids))\n+        else:\n+            ' +
      'user_services.create_user_contributions(\n+                ' +
      'key, list(created_exploration_ids), list(\n+                    ' +
      'edited_exploration_ids))\n',
  };

  const registryFileObjWithNewjob = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/jobs_registry.py',
    status: 'modified',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/' +
      'exp_jobs_oppiabot_off.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch: '@@ -0,0 +1 @@\n+# exp_jobs_oppiabot_off.SecondTestOneOffJob ' +
      'exp_jobs_one_off.FirstTestOneOffJob',
  };

  const nonJobFile = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/domain/exp_fetchers.py',
    status: 'added',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/exp_fetchers.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/exp_fetchers.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/' +
      'exp_fetchers.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch: '@@ -0,0 +1 @@\n+# def _migrate_states_schema' +
      '(versioned_exploration_states, exploration_id):',
  };

  beforeEach(() => {
    spyOn(scheduler, 'createScheduler').and.callFake(() => { });

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
    spyOn(apiForSheetsModule, 'checkClaStatus').and.callFake(() => { });
    spyOn(
      checkPullRequestLabelsModule,
      'checkChangelogLabel'
    ).and.callFake(() => { });
    spyOn(checkCriticalPullRequestModule, 'checkIfPRAffectsDatastoreLayer')
      .and.callFake(() => { });
    spyOn(checkPullRequestBranchModule, 'checkBranch').and.callFake(() => { });
    spyOn(checkWIPModule, 'checkWIP').and.callFake(() => { });
    spyOn(checkPullRequestTemplateModule, 'checkTemplate')
      .and.callFake(() => { });
    spyOn(newCodeOwnerModule, 'checkForNewCodeowner').and.callFake(() => { });
  });

  describe('When a new job file is created in a pull request', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            nonJobFile, firstNewJobFileObj
          ],
        }),
      };
      payloadData.payload.pull_request.changed_files = 2;
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
        'this guide'.link(
          'https://github.com/oppia/oppia/wiki/Running-jobs-in-production' +
          '#submitting-a-pr-with-a-new-job'));
      const jobRegistryLink = 'job registry'.link(
        'https://github.com/oppia/oppia/blob/develop/core/jobs_registry.py'
      );
      const jobNameLink = 'FirstTestOneOffJob'
        .link(firstNewJobFileObj.blob_url);

      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        body:
          'Hi @' + SERVER_JOBS_ADMIN + ', PTAL at this PR, ' +
          'it adds a new one off job. The name of the job is ' +
          jobNameLink + '.' + newLineFeed + 'Also @' + author +
          ', please add the new job ' + 'to the ' + jobRegistryLink +
          ' and please make sure to fill in the ' + formText +
          ' for the new job to be tested on the backup server. ' +
          'This PR can be merged only after the test run is successful. ' +
          'Please refer to ' + wikiLinkText + ' for details.' +
          newLineFeed + 'Thanks!',
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

    it('should add datastore label', () => {
      expect(github.issues.addLabels).toHaveBeenCalled();
      expect(github.issues.addLabels).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        labels: ['PR: Affects datastore layer']
      });
    });
  });

  describe('When multiple job files are created in a pull request', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            nonJobFile,
            firstNewJobFileObj,
            secondNewJobFileObj
          ],
        }),
      };

      payloadData.payload.pull_request.changed_files = 3;
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
        'this guide'.link(
          'https://github.com/oppia/oppia/wiki/Running-jobs-in-production' +
          '#submitting-a-pr-with-a-new-job'));
      const jobRegistryLink = 'job registry'.link(
        'https://github.com/oppia/oppia/blob/develop/core/jobs_registry.py');
      const firstJobNameLink = 'FirstTestOneOffJob'
        .link(firstNewJobFileObj.blob_url);
      const secondJobNameLink = 'SecondTestOneOffJob'
        .link(secondNewJobFileObj.blob_url);
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        body:
          'Hi @' + SERVER_JOBS_ADMIN + ', PTAL at this PR, ' +
          'it adds new one off jobs. The jobs are ' + firstJobNameLink +
          ', ' + secondJobNameLink + '.' + newLineFeed + 'Also @' +
          author + ', please add the new jobs ' + 'to the ' +
          jobRegistryLink + ' and please make sure to fill in the ' +
          formText + ' for the new jobs to be tested on the backup server. ' +
          'This PR can be merged only after the test run is successful. ' +
          'Please refer to ' + wikiLinkText + ' for details.' +
          newLineFeed + 'Thanks!',
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

    it('should add datastore label', () => {
      expect(github.issues.addLabels).toHaveBeenCalled();
      expect(github.issues.addLabels).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        labels: ['PR: Affects datastore layer']
      });
    });
  });

  describe('When a new job file is created and registry is ' +
    'updated in a pull request',
  () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            nonJobFile,
            firstNewJobFileObj,
            registryFileObjWithNewjob
          ],
        }),
      };
      payloadData.payload.pull_request.changed_files = 3;
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
        'this guide'.link(
          'https://github.com/oppia/oppia/wiki/Running-jobs-in-production' +
            '#submitting-a-pr-with-a-new-job'));
      const jobNameLink = 'FirstTestOneOffJob'
        .link(firstNewJobFileObj.blob_url);
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        body:
            'Hi @' + SERVER_JOBS_ADMIN + ', PTAL at this PR, ' +
            'it adds a new one off job. The name of the job is ' +
            jobNameLink + '.' + newLineFeed + 'Also @' + author +
            ', please make sure to fill in the ' + formText +
            ' for the new job to be tested on the backup server. ' +
            'This PR can be merged only after the test run is successful. ' +
            'Please refer to ' + wikiLinkText + ' for details.' +
            newLineFeed + 'Thanks!',
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

    it('should add datastore label', () => {
      expect(github.issues.addLabels).toHaveBeenCalled();
      expect(github.issues.addLabels).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        labels: ['PR: Affects datastore layer']
      });
    });
  }
  );

  describe('When a new job is added in an existing job file', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            modifiedExistingJobFileObj,
          ],
        }),
      };
      payloadData.payload.pull_request.changed_files = 1;
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
        'this guide'.link(
          'https://github.com/oppia/oppia/wiki/Running-jobs-in-production' +
          '#submitting-a-pr-with-a-new-job'));
      const jobRegistryLink = 'job registry'.link(
        'https://github.com/oppia/oppia/blob/develop/core/jobs_registry.py');
      const jobNameLink = 'OppiabotContributionsOneOffJob'.
        link(modifiedExistingJobFileObj.blob_url);
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        body:
          'Hi @' + SERVER_JOBS_ADMIN + ', PTAL at this PR, ' +
          'it adds a new one off job. The name of the job is ' + jobNameLink +
          '.' + newLineFeed + 'Also @' + author + ', please add the new job ' +
          'to the ' + jobRegistryLink + ' and please make sure to fill ' +
          'in the ' + formText + ' for the new job to be tested on the ' +
          'backup server. ' + 'This PR can be merged only after the test ' +
          'run is successful. ' + 'Please refer to ' + wikiLinkText +
          ' for details.' + newLineFeed + 'Thanks!',
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

    it('should add datastore label', () => {
      expect(github.issues.addLabels).toHaveBeenCalled();
      expect(github.issues.addLabels).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        labels: ['PR: Affects datastore layer']
      });
    });
  });

  describe('When an existing job file is modified with no new job', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            {
              ...firstNewJobFileObj,
              status: 'modified',
              patch: '\n+# No job files present in the changes',
            },
          ],
        }),
      };

      payloadData.payload.pull_request.changed_files = 1;
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
    it('should not add datastore label', () => {
      expect(github.issues.addLabels).not.toHaveBeenCalled();
    });
    it('should not assign server jobs admin', () => {
      expect(github.issues.addAssignees).not.toHaveBeenCalled();
    });
  });

  describe('When no job file is modified in a pull request', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            nonJobFile
          ],
        }),
      };

      payloadData.payload.pull_request.changed_files = 1;
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

  describe('Does not comment on job from test dir', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            jobFromTestDir
          ],
        }),
      };

      payloadData.payload.pull_request.changed_files = 1;
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

  describe('When job test file gets added', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            jobTestFile
          ],
        }),
      };

      payloadData.payload.pull_request.changed_files = 1;
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

  describe('When pull request has datastore label', () => {
    beforeEach(async () => {
      payloadData.payload.pull_request.labels =
        [{ name: 'PR: Affects datastore layer' }];
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            nonJobFile, firstNewJobFileObj
          ],
        }),
      };

      payloadData.payload.pull_request.changed_files = 2;
      await robot.receive(payloadData);
    });

    it('should check for jobs', () => {
      expect(checkPullRequestJobModule.checkForNewJob).toHaveBeenCalled();
    });

    it('should not get modified files', () => {
      expect(github.pulls.listFiles).not.toHaveBeenCalled();
    });

    it('should not ping server job admin', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
  });

  describe('Returns appropriate job name', () => {
    it('should return the correct job created in the file', () => {
      let jobs = checkPullRequestJobModule.getNewJobsFromFile(
        firstNewJobFileObj
      );
      expect(jobs.length).toBe(1);
      expect(jobs[0]).toBe('FirstTestOneOffJob');

      jobs = checkPullRequestJobModule.getNewJobsFromFile(secondNewJobFileObj);
      expect(jobs.length).toBe(1);
      expect(jobs[0]).toBe('SecondTestOneOffJob');

      jobs = checkPullRequestJobModule.getNewJobsFromFile(
        modifiedExistingJobFileObj
      );
      expect(jobs.length).toBe(1);
      expect(jobs[0]).toBe('OppiabotContributionsOneOffJob');

      jobs = checkPullRequestJobModule.getNewJobsFromFile(fileWithMultipleJobs);
      expect(jobs.length).toBe(2);
      expect(jobs[0]).toBe('TestOneOffJob');
      expect(jobs[1]).toBe('AnotherTestOneOffJob');

      jobs = checkPullRequestJobModule.getNewJobsFromFile(jobTestFile);
      expect(jobs.length).toBe(0);

      jobs = checkPullRequestJobModule.getNewJobsFromFile(
        modifiedExistingJobFileObjWithJobClassInPatch);
      expect(jobs.length).toBe(0);

      jobs = checkPullRequestJobModule.getNewJobsFromFile(
        jobFileObjWithJobClassInPatchAndNewJob);
      expect(jobs.length).toBe(1);
      expect(jobs[0]).toBe('AnotherTestOneOffJob');
    });
  });
});
