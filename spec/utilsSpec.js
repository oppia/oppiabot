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
 * @fileoverview Tests for the helper module.
 */
const { default: Axios } = require('axios');
const utilityModule = require('../lib/utils');
const pullRequest = require('../fixtures/pullRequestPayload.json').payload
  .pull_request;
const CODE_OWNERS_FILE_URL =
  'https://raw.githubusercontent.com/oppia/oppia/develop/.github/CODEOWNERS';

describe('Utility module tests', () => {
  const firstModelFileObj = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/storage/skill/gae_models.py',
    status: 'added',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/storage/skill/gae_models.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130e' +
      '110d7e9833c/core/storage/skill/gae_models.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/storage/s' +
      'kill/gae_models.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch:
      '@@ -353,6 +353,11 @@ def export_data(user_id):\r\n         }\r\n ' +
      '\r\n \r\n+class OppiabotTestActivitiesModel(base_models.BaseModel):' +
      '\r\n+    "Does some things right"\r\n+    pass\r\n+\r\n+\r\n class ' +
      'IncompleteActivitiesModel(base_models.BaseModel):\r\n     """Keeps ' +
      'track of all the activities currently being completed by the\r\n   ' +
      'learner.\r\n',
  };

  const firstJobFileObj = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/domain/exp_jobs_one_off.py',
    status: 'added',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130e11' +
      '0d7e9833c/core/domain/exp_jobs_one_off.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130e110d' +
      '7e9833c/core/domain/exp_jobs_one_off.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/exp_job' +
      's_one_off.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch:
      '@@ -0,0 +1 @@\n+class FirstTestOneOffJob(jobs.BaseMapReduceOneOffJobM' +
      ') for v in version_and_exp_ids]\n+\n+        for edit in edits:\n+   ',
  };

  const secondModelFileObj = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/storage/skill/gae_models.py',
    status: 'modified',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130e110' +
      'd7e9833c/core/storage/skill/gae_models.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130e110d' +
      '7e9833c/core/storage/skill/gae_models.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/storage/skill/' +
      'gae_models.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch:
      '@@ -39,6 +39,20 @@ class SkillSnapshotContentModel(base_models.BaseSn' +
      'apshotContentModel):\r\n     pass\r\n \r\n \r\n+class OppiabotSnapsho' +
      'tContentModel(base_models.BaseSnapshotContentModel):\r\n+    """Oppia' +
      'bot testing."""\r\n+\r\n+    pass\r\n+\r\n+\r\n+class OppiabotSnapsho' +
      'tTestingModel(base_models.BaseSnapshotContentModel):\r\n+    """Anoth' +
      'er Oppiabot model."""\r\n+\r\n+    pass\r\n+\r\n+\r\n+\r\n+\r\n class' +
      ' SkillModel(base_models.VersionedModel):\r\n     """Model for storing' +
      ' Skills.\r\n',
  };

  const secondJobFileObj = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/domain/exp_jobs_oppiabot_off.py',
    status: 'added',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130e11' +
      '0d7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130e110' +
      'd7e9833c/core/domain/exp_jobs_oppiabot_off.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/exp_jo' +
      'bs_oppiabot_off.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch:
      '@@ -0,0 +1 @@\n+class SecondTestOneOffJob(jobs.BaseMapReduceOneOffJob' +
      'Manager):\n+    """One-off job for creating and populating UserContri' +
      'butionsModels for\n+    all registered users that have contributed.\n' +
      '+    """\n+    @classmethod\n+    def entity_classes_to_map_over(cls)' +
      ':\n+        """Return a list of datastore class references to map ove' +
      'r."""\n+        return [exp_models.ExplorationSnapshotMetadataModel]\n+',
  };

  const jobRegex = new RegExp(
    [
      '(?<addition>\\+)(?<classDefinition>class\\s)',
      '(?<name>[a-zA-Z]{2,256})(?<suffix>OneOffJob)(?<funDef>\\()',
    ].join('')
  );

  const modelRegex = new RegExp(
    [
      '(?<addition>\\+)(?<classDefinition>class\\s)',
      '(?<name>[a-zA-Z]{2,256})(?<suffix>Model)(?<funDef>\\()',
    ].join('')
  );

  it('should check for datastore labels', () => {
    let result = utilityModule.hasDatastoreLabel(pullRequest);
    expect(result).toBe(false);

    result = utilityModule.hasDatastoreLabel({
      ...pullRequest,
      labels: [{ name: 'PR: Affects datastore layer' }],
    });
    expect(result).toBe(true);
  });

  it('should return appropriate name string', () => {
    let result = utilityModule.getNameString(
      [firstModelFileObj],
      {
        singular: 'model',
        plural: 'models',
      },
      modelRegex
    );
    let itemLink = 'OppiabotTestActivitiesModel'.link(
      firstModelFileObj.blob_url
    );
    expect(result).toBe(' The name of the model is ' + itemLink + '.');

    result = utilityModule.getNameString(
      [firstModelFileObj, secondModelFileObj],
      {
        singular: 'model',
        plural: 'models',
      },
      modelRegex
    );
    firstItemLink = 'OppiabotTestActivitiesModel'.link(
      firstModelFileObj.blob_url
    );
    let secondItemLink = 'OppiabotSnapshotContentModel, OppiabotSnapshotTestingModel'.link(
      secondModelFileObj.blob_url
    );
    expect(result).toBe(
      ' The models are ' + itemLink + ', ' + secondItemLink + '.'
    );

    result = utilityModule.getNameString(
      [firstJobFileObj],
      {
        singular: 'job',
        plural: 'jobs',
      },
      jobRegex
    );
    itemLink = 'FirstTestOneOffJob'.link(firstJobFileObj.blob_url);
    expect(result).toBe(' The name of the job is ' + itemLink + '.');

    result = utilityModule.getNameString(
      [firstJobFileObj, secondJobFileObj],
      {
        singular: 'job',
        plural: 'jobs',
      },
      jobRegex
    );
    itemLink = 'FirstTestOneOffJob'.link(firstJobFileObj.blob_url);
    secondItemLink = 'SecondTestOneOffJob'.link(secondJobFileObj.blob_url);
    expect(result).toBe(
      ' The jobs are ' + itemLink + ', ' + secondItemLink + '.'
    );
  });

  it('should return appropriate items by regex', () => {
    let result = utilityModule.getNewItemsFromFileByRegex(
      modelRegex,
      firstModelFileObj
    );
    expect(result.length).toBe(1);
    expect(result[0]).toBe('OppiabotTestActivitiesModel');

    result = utilityModule.getNewItemsFromFileByRegex(
      modelRegex,
      secondModelFileObj
    );
    expect(result.length).toBe(2);
    expect(result[0]).toBe('OppiabotSnapshotContentModel');
    expect(result[1]).toBe('OppiabotSnapshotTestingModel');

    result = utilityModule.getNewItemsFromFileByRegex(
      jobRegex,
      firstJobFileObj
    );
    expect(result.length).toBe(1);
    expect(result[0]).toBe('FirstTestOneOffJob');

    result = utilityModule.getNewItemsFromFileByRegex(
      jobRegex,
      secondJobFileObj
    );
    expect(result.length).toBe(1);
    expect(result[0]).toBe('SecondTestOneOffJob');
  });

  it('should get all changed files', async () => {
    const context = {
      repo: (obj) => {
        return {
          ...obj,
          repo: 'oppia',
          owner: 'oppia'
        }
      },
      payload: {
        pull_request: { ...pullRequest, changed_files: 2 },
      },
      github: {
        pulls: {
          listFiles: () => {
            return {
              data: [firstModelFileObj, firstJobFileObj],
            };
          },
        },
      },
    };

    const result = await utilityModule.getAllChangedFiles(context);
    expect(result.length).toBe(2);
    expect(result).toEqual([firstModelFileObj, firstJobFileObj]);
  });

  it('should get main code owner file from develop', async () => {
    spyOn(Axios, 'get').and.resolveTo({
      data: 'Contents of code owner file.'
    });
    const response = await utilityModule.getMainCodeOwnerfile();
    expect(Axios.get).toHaveBeenCalled();
    expect(Axios.get).toHaveBeenCalledWith(CODE_OWNERS_FILE_URL)
    expect(response).toBe('Contents of code owner file.');
  });
});
