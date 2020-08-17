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
 * @fileoverview Spec for new code owner checks.
 */

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
const checkPullRequestTemplateModule = require('../lib/checkPullRequestTemplate');
const newCodeOwnerModule = require('../lib/checkForNewCodeowner');
const utils = require('../lib/utils');
const scheduler = require('../lib/scheduler');
let payloadData = JSON.parse(
  JSON.stringify(require('../fixtures/pullRequestPayload.json'))
);

describe('check for new code owner', () => {
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

  const mainCodeOwnerFile = `# Speed Improvement team.
    /app_dev.yaml @vojtechjelinek
    /core/templates/google-analytics.initializer.ts @jameesjohn @vojtechjelinek
    /core/templates/base-components/ @jameesjohn @vojtechjelinek
    /core/templates/pages/Base.ts @jameesjohn @vojtechjelinek
    /core/templates/pages/oppia_footer_directive.html @jameesjohn @vojtechjelinek
    /core/templates/pages/OppiaFooterDirective.ts @jameesjohn @vojtechjelinek
    /core/templates/pages/footer_js_libs.html @jameesjohn @vojtechjelinek
    /core/templates/pages/header_css_libs.html @jameesjohn @vojtechjelinek
    /core/templates/services/csrf-token.service*.ts @jameesjohn @vojtechjelinek
    /core/templates/third-party-imports/ @nishantwrp @vojtechjelinek
    /jinja_utils*.py @jameesjohn @vojtechjelinek
    /.lighthouserc.json @jimbyo @jameesjohn @vojtechjelinek
    /puppeteer-login-script.js @jimbyo
    /scripts/run_lighthouse_tests.py @jameesjohn @vojtechjelinek
    /webpack.common.config.ts @jameesjohn @vojtechjelinek
    /webpack.common.macros.ts @jameesjohn @vojtechjelinek
    /webpack.dev.config.ts @jameesjohn @vojtechjelinek
    /webpack.prod.config.ts @jameesjohn @vojtechjelinek
    /webpack.terser.config.ts @nishantwrp @vojtechjelinek`;

  const nonCodeOwnerFile = {
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
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130e' +
      '110d7e9833c/core/domain/exp_fetchers.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/exp' +
      '_fetchers.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch:
      '@@ -0,0 +1 @@\n+# def _migrate_states_schema(versioned_exploration' +
      '_states, exploration_id):',
  };

  const codeOwnerFileWithNewUser = {
    sha: '6911619e95dfcb11eb2204fba88987e5abf02352',
    filename: '.github/CODEOWNERS',
    status: 'modified',
    additions: 2,
    deletions: 0,
    changes: 2,
    blob_url:
      'https://github.com/oppia/oppia/blob/c876111ec9c743179483d7ca75e348' +
      'b8680b13ec/.github/CODEOWNERS',
    raw_url:
      'https://github.com/oppia/oppia/raw/c876111ec9c743179483d7ca75e348b8' +
      '680b13ec/.github/CODEOWNERS',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/.github/CODEOWNERS' +
      '?ref=c876111ec9c743179483d7ca75e348b8680b13ec',
    patch:
      '@@ -523,7 +523,9 @@\n' +
      ' /core/templates/pages/pending-account-deletion-page/ @jameesjohn @vojtechjelinek\n' +
      ' /core/templates/pages/preferences-page/ @jameesjohn @vojtechjelinek\n' +
      ' /core/templates/pages/signup-page/ @jameesjohn @vojtechjelinek\n' +
      '+/core/templates/pages/signup-page/ @testuser @vojtechjelinek\n' +
      ' /core/templates/pages/splash-page/ @jameesjohn @vojtechjelinek\n' +
      '+/core/templates/pages/signup-page/ @testuser @jameesjohn\n' +
      ' /core/templates/pages/teach-page/ @jameesjohn @vojtechjelinek\n' +
      ' /core/templates/pages/thanks-page/ @jameesjohn @vojtechjelinek\n' +
      ' ',
  };

  const codeOwnerFileWithMultipleNewUsers = {
    sha: '6911619e95dfcb11eb2204fba88987e5abf02352',
    filename: '.github/CODEOWNERS',
    status: 'modified',
    additions: 2,
    deletions: 0,
    changes: 2,
    blob_url:
      'https://github.com/oppia/oppia/blob/c876111ec9c743179483d7ca75e348b' +
      '8680b13ec/.github/CODEOWNERS',
    raw_url:
      'https://github.com/oppia/oppia/raw/c876111ec9c743179483d7ca75e348b8' +
      '680b13ec/.github/CODEOWNERS',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/.github/CODEOWNERS' +
      '?ref=c876111ec9c743179483d7ca75e348b8680b13ec',
    patch:
      '@@ -523,7 +523,9 @@\n' +
      ' /core/templates/pages/pending-account-deletion-page/ @jameesjohn @vojtechjelinek\n' +
      ' /core/templates/pages/preferences-page/ @jameesjohn @vojtechjelinek\n' +
      ' /core/templates/pages/signup-page/ @jameesjohn @vojtechjelinek\n' +
      '+/core/templates/pages/signup-page/ @testuser @vojtechjelinek\n' +
      ' /core/templates/pages/splash-page/ @jameesjohn @vojtechjelinek\n' +
      '+/core/templates/pages/signup-page/ @testuser2 @jameesjohn\n' +
      ' /core/templates/pages/teach-page/ @jameesjohn @vojtechjelinek\n' +
      ' /core/templates/pages/thanks-page/ @jameesjohn @vojtechjelinek\n' +
      ' ',
  };

  const codeOwnerFileWithNewExistingUser = {
    sha: '6911619e95dfcb11eb2204fba88987e5abf02352',
    filename: '.github/CODEOWNERS',
    status: 'modified',
    additions: 2,
    deletions: 0,
    changes: 2,
    blob_url:
      'https://github.com/oppia/oppia/blob/c876111ec9c743179483d7ca75e348b86' +
      '80b13ec/.github/CODEOWNERS',
    raw_url:
      'https://github.com/oppia/oppia/raw/c876111ec9c743179483d7ca75e348b868' +
      '0b13ec/.github/CODEOWNERS',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/.github/CODEOWNERS' +
      '?ref=c876111ec9c743179483d7ca75e348b8680b13ec',
    patch:
      '@@ -523,7 +523,9 @@\n' +
      ' /core/templates/pages/pending-account-deletion-page/ @jameesjohn @vojtechjelinek\n' +
      ' /core/templates/pages/preferences-page/ @jameesjohn @vojtechjelinek\n' +
      ' /core/templates/pages/signup-page/ @jameesjohn @vojtechjelinek\n' +
      '+/core/templates/pages/signup-page/ @jameesjohn @vojtechjelinek\n' +
      ' /core/templates/pages/splash-page/ @jameesjohn @vojtechjelinek\n' +
      '+/core/templates/pages/signup-page/ @vojtechjelinek @jameesjohn\n' +
      ' /core/templates/pages/teach-page/ @jameesjohn @vojtechjelinek\n' +
      ' /core/templates/pages/thanks-page/ @jameesjohn @vojtechjelinek\n' +
      ' ',
  };

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
    spyOn(checkPullRequestJobModule, 'checkForNewJob').and.callFake(() => {});
    spyOn(apiForSheetsModule, 'checkClaStatus').and.callFake(() => {});
    spyOn(
      checkPullRequestLabelsModule,
      'checkChangelogLabel'
    ).and.callFake(() => {});
    spyOn(
      checkCriticalPullRequestModule,
      'checkIfPRAffectsDatastoreLayer'
    ).and.callFake(() => {});
    spyOn(checkPullRequestBranchModule, 'checkBranch').and.callFake(() => {});
    spyOn(checkWIPModule, 'checkWIP').and.callFake(() => {});
    spyOn(
      checkPullRequestTemplateModule,
      'checkTemplate'
    ).and.callFake(() => {});

    spyOn(newCodeOwnerModule, 'checkForNewCodeowner').and.callThrough();
    spyOn(utils, 'getMainCodeOwnerfile').and.resolveTo(mainCodeOwnerFile);
  });

  describe('When a new code owner gets added', () => {
    beforeEach(() => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [nonCodeOwnerFile, codeOwnerFileWithNewUser],
        }),
      };
      payloadData.payload.pull_request.changed_files = 2;
    });

    describe('and there is a changelog label', () => {
      beforeEach(async () => {
        const label = {
          id: 638839900,
          node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
          url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
          name: 'PR CHANGELOG: Server Errors -- @kevintab95',
          color: '00FF00',
        };
        payloadData.payload.pull_request.labels.push(label);
        await robot.receive(payloadData);
      });

      it('should check for new code owner', () => {
        expect(newCodeOwnerModule.checkForNewCodeowner).toHaveBeenCalled();
      });

      it('should get all modified files', () => {
        expect(github.pulls.listFiles).toHaveBeenCalled();
      });

      it('should get codeowner file from develop', () => {
        expect(utils.getMainCodeOwnerfile).toHaveBeenCalled();
      })

      it('should ping project owner', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          issue_number: payloadData.payload.pull_request.number,
          body:
            'Hi @kevintab95, this PR adds a new code owner, @testuser, ' +
            'we are flagging this, please make sure the changes are ' +
            'verified by the previous codeowner of the file. Thanks!'
        });
      });

      afterEach(() => {
        payloadData.payload.pull_request.labels.pop();
      });
    });

    describe('and there is no changelog label', () => {
      beforeEach(async () => {
        const reviewer = {
          login: 'reviewer'
        }
        payloadData.payload.pull_request.requested_reviewers.push(reviewer);
        await robot.receive(payloadData);
      });

      it('should check for new code owner', () => {
        expect(newCodeOwnerModule.checkForNewCodeowner).toHaveBeenCalled();
      });

      it('should get all modified files', () => {
        expect(github.pulls.listFiles).toHaveBeenCalled();
      });

      it('should get codeowner file from develop', () => {
        expect(utils.getMainCodeOwnerfile).toHaveBeenCalled();
      })

      it('should ping reviewer', () => {
        expect(github.issues.createComment).toHaveBeenCalled();
        expect(github.issues.createComment).toHaveBeenCalledWith({
          repo: payloadData.payload.repository.name,
          owner: payloadData.payload.repository.owner.login,
          issue_number: payloadData.payload.pull_request.number,
          body:
            'Hi @reviewer, this PR adds a new code owner, @testuser, ' +
            'we are flagging this, please make sure the changes are ' +
            'verified by the previous codeowner of the file. Thanks!'
        });
      });

      afterEach(() => {
        payloadData.payload.pull_request.requested_reviewers.pop();
      })
    });
  });

  describe('When multiple new code owners get added', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [nonCodeOwnerFile, codeOwnerFileWithMultipleNewUsers],
        }),
      };
      payloadData.payload.pull_request.changed_files = 2;

      const label = {
        id: 638839900,
        node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
        url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
        name: 'PR CHANGELOG: Server Errors -- @kevintab95',
        color: '00FF00',
      };
      payloadData.payload.pull_request.labels.push(label);
      await robot.receive(payloadData);
    });
    it('should check for new code owner', () => {
      expect(newCodeOwnerModule.checkForNewCodeowner).toHaveBeenCalled();
    });

    it('should get all modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should get codeowner file from develop', () => {
      expect(utils.getMainCodeOwnerfile).toHaveBeenCalled();
    })

    it('should ping project owner', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
        issue_number: payloadData.payload.pull_request.number,
        body:
          'Hi @kevintab95, this PR adds the following new code owners ' +
          '@testuser, @testuser2, '+
          'we are flagging this, please make sure the changes are ' +
          'verified by the previous codeowner of the file. Thanks!',
      });
    });

    afterEach(() => {
      payloadData.payload.pull_request.labels.pop();
    });
  })

  describe('When an exisiting code owner gets added to another file', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [nonCodeOwnerFile, codeOwnerFileWithNewExistingUser],
        }),
      };
      payloadData.payload.pull_request.changed_files = 2;

      const label = {
        id: 638839900,
        node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
        url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
        name: 'PR CHANGELOG: Server Errors -- @kevintab95',
        color: '00FF00',
      };
      payloadData.payload.pull_request.labels.push(label);
      await robot.receive(payloadData);
    });
    it('should check for new code owner', () => {
      expect(newCodeOwnerModule.checkForNewCodeowner).toHaveBeenCalled();
    });

    it('should get all modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should get codeowner file from develop', () => {
      expect(utils.getMainCodeOwnerfile).toHaveBeenCalled();
    })

    it('should not ping project owner', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    afterEach(() => {
      payloadData.payload.pull_request.labels.pop();
    });
  });

  describe('When codeowner file is not modified', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [nonCodeOwnerFile],
        }),
      };
      payloadData.payload.pull_request.changed_files = 1;

      const label = {
        id: 638839900,
        node_id: 'MDU6TGFiZWw2Mzg4Mzk5MDA=',
        url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20released',
        name: 'PR CHANGELOG: Server Errors -- @kevintab95',
        color: '00FF00',
      };
      payloadData.payload.pull_request.labels.push(label);
      await robot.receive(payloadData);
    });
    it('should check for new code owner', () => {
      expect(newCodeOwnerModule.checkForNewCodeowner).toHaveBeenCalled();
    });

    it('should get all modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should not get codeowner file from develop', () => {
      expect(utils.getMainCodeOwnerfile).not.toHaveBeenCalled();
    })

    it('should not ping project owner', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    afterEach(() => {
      payloadData.payload.pull_request.labels.pop();
    });
  });
});
