// Copyright 2021 The Oppia Authors. All Rights Reserved.
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
const checkCronJobModule = require('../lib/checkNewCronJobs');
const checkPullRequestJobModule = require('../lib/checkPullRequestJob');
const apiForSheetsModule = require('../lib/apiForSheets');
const checkPullRequestLabelsModule = require('../lib/checkPullRequestLabels');
const checkPullRequestBranchModule = require('../lib/checkPullRequestBranch');
const checkCriticalPullRequestModule =
  require('../lib/checkCriticalPullRequest');
const checkPullRequestTemplateModule =
  require('../lib/checkPullRequestTemplate');
const newCodeOwnerModule = require('../lib/checkForNewCodeowner');
const scheduler = require('../lib/scheduler');
const { JOBS_AND_FETURES_TESTING_WIKI_LINK } = require('../lib/utils');
let payloadData = JSON.parse(
  JSON.stringify(require('../fixtures/pullRequestPayload.json'))
);

describe('Cron Job Spec', () => {
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
    sha: 'bbc41f1bd8b2c90c91a1335d149be7a132a732d8',
    filename: 'core/controllers/cron.py',
    status: 'added',
    additions: 37,
    deletions: 0,
    changes: 37,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/cron.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/cron.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/' +
      'cron.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch: '@@ -0,0 +1,37 @@\n+class JobStatusMailerHandler(base.BaseHanr):' +
    '\n+    """Handler for mailing admin about job failures."""\n+\n+' +
    '   @acl_decorators.can_perform_cron_tasks\n+    def get(self):\n+' +
    '     """Handles GET requests."""\n+        # TODO(sll): Get the 50 most' +
    'recent failed shards, not all of them.\n+        failed_jobs' +
    ' = cron_services.get_stuck_jobs(TWENTY_FIVE_HOURS_IN_MSECS)\n+' +
    '    if failed_jobs:\n+            email_subject = \'MapReduce failure' +
    ' alert\'\n+            email_message = (\n+                \'%s jobs' +
    ' have failed in the past 25 hours. More information \'\n+ ' +
    '   \'(about at most %s jobs; to see more, please check the logs):\'\n+' +
    '           ) % (len(failed_jobs), MAX_JOBS_TO_REPORT_ON)\n+\n+' +
    '            for job in failed_jobs[:MAX_JOBS_TO_REPORT_ON]:\n+' +
    '          email_message += \'\\n\'\n+               ' +
    'email_message += \'-----------------------------------\'\n+  ' +
    '              email_message += \'\\n\'\n+               ' +
    ' email_message += (\n+                    \'Job with mapreduce ID %s' +
    '(key name %s) failed. \'\n+      \'More info:\\n\\n\'\n+'
  };

  const urlJobFileObj = {
    sha: 'f06a0d3ea104733080c4dad4a4e5aa7fb76d8f5d',
    filename: 'main_cron.py',
    status: 'modified',
    additions: 43,
    deletions: 0,
    changes: 43,
    blob_url:
      'https://github.com/oppia/oppia/blob/5b0e633fa1b9a00771a3b88302fa' +
      '3ff048d7240c/main_cron.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/5b0e633fa1b9a00771a3b88302fa' +
      '3ff048d7240c/main_cron.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/' +
      'main_cron.py?ref=5b0e633fa1b9a00771a3b88302fa3ff048d7240c',
    patch:
      '@@ -0,0 +1,46 @@\n+"""Main package for URL routing and the index' +
      'page."""\n+\n+from __future__ import absolute_import  # pylint:' +
      ' disable=import-only-modules\n+from __future__' +
      '   import unicode_literals  # pylint: disable=import-only-modules\n' +
      '+\n+from core.controllers import cron\n+from core.platform import' +
      ' n+\n+\n+transaction_services = models.Registry.' +
      ' import_transaction_services()\n+\n+# Register the URLs with' +
      'the classes responsible for handling them.\n+URLS = [\n+  ' +
      'main.get_redirect_route(\n+        r\'/cron/mail/admin/job_s' +
      'tatus\', cron.JobStatusMailerHandler),\n+' +
      'main.get_redirect_route(\n+ ' +
      'r\'/cron/users/dashboard_stats\', cron.CronDashboardStatsHandler),\n+' +
      ' main.get_redirect_route(\n+        r\'/cron/users/user_deletion' +
      'r\'/cron/users/fully_complete_user_deletion\',\n+' +
      ' cron.CronFullyCompleteUserDeletionHandler),\n+' +
      ' main.get_redirect_route(\n+tionRecommendationsHandler),\n+' +
      'main.get_redirect_route(\n+ r\'/cron/explorations/search_rank\',\n+' +
      'cron.CronActivitySearchRankHandler),\n+    main.get_redirect_route(\n' +
      ' main.get_redirect_route(\n+        r\'/cron/models/cleanup\', cron'
  };

  const jobTestFile = {
    sha: 'd144f32b9812373d5f1bc9f94d9af795f09023ff',
    filename: 'core/controllers/cron_test.py',
    status: 'added',
    additions: 1,
    deletions: 0,
    changes: 1,
    blob_url:
      'https://github.com/oppia/oppia/blob/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/cpntrollers/cron_test.py',
    raw_url:
      'https://github.com/oppia/oppia/raw/67fb4a973b318882af3b5a894130' +
      'e110d7e9833c/core/domain/cron_test.py',
    contents_url:
      'https://api.github.com/repos/oppia/oppia/contents/core/domain/' +
      'exp_jobs_oppiabot_off.py?ref=67fb4a973b318882af3b5a894130e110d7e9833c',
    patch:
     '@@ -0,0 +1,25 @@\n+class CronJobTests(test_utils.GenericTestBase):\n+' +
      'FIVE_WEEKS = datetime.timedelta(weeks=5)\n+    NINE_WEEKS' +
      '= datetime.timedelta(weeks=9)\n+\n+    def setUp(self):\n+' +
      '       super(CronJobTests, self).setUp()\n+ ' +
      ' self.signup(self.ADMIN_EMAIL, self.ADMIN_USERNAME)\n+' +
      'self.admin_id = self.get_user_id_from_email(self.ADMIN_EMAIL)\n+' +
      'self.set_admins([self.ADMIN_USERNAME])\n+' +
      ' self.testapp_swap = self.swap(\n+' +
      'self, \'testapp\', webtest.TestApp(main_cron.app))\n+\n+' +
      'self.email_subjects = []\n+        self.email_bodies = []\n+' +
      'def _mock_send_mail_to_admin(email_subject, email_body):\n+ ' +
      'ocks email_manager.send_mail_to_admin() as it\'s not possible to\n+' +
      'send mail with self.testapp_swap, i.e with the URLs defined in\n+' +
      ' main_cron.\n+            """\n+            self.email_subjects' +
      '.append(email_subject)\n+            self.email_bodies.append' +
      '(email_body)\n+\n+        self.send_mail_to_admin_swap = self.swap' +
      '(\n+            email_manager, \'send_mail_to_admin\',' +
      '_mock_send_mail_to_admin)\n'
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
    spyOn(checkCronJobModule, 'checkForNewCronJob').and.callThrough();
    spyOn(
      checkPullRequestJobModule, 'checkForNewJob').and.callFake(() => { });
    spyOn(apiForSheetsModule, 'checkClaStatus').and.callFake(() => { });
    spyOn(
      checkCriticalPullRequestModule, 'checkIfPRAffectsDatastoreLayer'
    ).and.callFake(() => { });
    spyOn(checkPullRequestBranchModule, 'checkBranch').and.callFake(() => { });
    spyOn(
      checkPullRequestTemplateModule, 'checkTemplate'
    ).and.callFake(() => { });
    spyOn(newCodeOwnerModule, 'checkForNewCodeowner').and.callFake(() => { });
  });

  describe('When a new cron job is added in a pull request', () => {
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

    it('should check for cron jobs', () => {
      expect(checkCronJobModule.checkForNewCronJob).toHaveBeenCalled();
    });

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should ping server jobs admin', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      const author = payloadData.payload.pull_request.user.login;
      const formText = (
        'server jobs form'.link(
          'https://goo.gl/forms/XIj00RJ2h5L55XzU2')
      );
      const newLineFeed = '<br>';
      const wikiLinkText = 'this guide'.link(
        JOBS_AND_FETURES_TESTING_WIKI_LINK);

      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        body:
        'Hi @vojtechjelinek, @DubeySandeep, @kevintab95, PTAL at this PR, ' +
        'it adds a new cron job.' + newLineFeed + 'Also @' + author + 
        ' please add the new test and URL redirects for the new CRON jobs ' +
        'It seems you have added or edited a CRON job, if so please request ' +
        'a testing of this CRON job with this ' + formText + ' Please refer ' +
        'to ' + wikiLinkText + ' for details.' + newLineFeed + 'Thanks!',
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
        assignees: ['vojtechjelinek', 'DubeySandeep', 'kevintab95']
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

  describe('When a new cron job is added in an existing cron job file', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            urlJobFileObj, jobTestFile, firstNewJobFileObj
          ],
        }),
      };
      payloadData.payload.pull_request.changed_files = 1;
      await robot.receive(payloadData);
    });

    it('should check for cron jobs', () => {
      expect(checkCronJobModule.checkForNewCronJob).toHaveBeenCalled();
    });

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });


    it('should ping server jobs admin', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      const author = payloadData.payload.pull_request.user.login;
      const formText = (
        'server jobs form'.link('https://goo.gl/forms/XIj00RJ2h5L55XzU2')
      );
      const newLineFeed = '<br>';
      const wikiLinkText = 'this guide'.link(
        JOBS_AND_FETURES_TESTING_WIKI_LINK);

      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        body:
        'Hi @vojtechjelinek, @DubeySandeep, @kevintab95, PTAL at this PR, it ' +
        'adds a new cron job.' + newLineFeed + 'Also @' + author + ' It seems' +
        ' you have added or edited a CRON job, if so please request a testing' +
        ' of this CRON job with this ' + formText + ' Please refer to ' +
        wikiLinkText + ' for details.' + newLineFeed + 'Thanks!',
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
        assignees: ['vojtechjelinek', 'DubeySandeep', 'kevintab95']
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

    it('should check for cron jobs', () => {
      expect(checkCronJobModule.checkForNewCronJob).toHaveBeenCalled();
    });

    it('should not get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should not ping server job admin', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not add datastore label', () => {
      expect(github.issues.addLabels).not.toHaveBeenCalled();
    });
  });

  describe('When test and URL redirects are added for a  cron job', () => {
    beforeEach(async () => {
      github.pulls = {
        listFiles: jasmine.createSpy('listFiles').and.resolveTo({
          data: [
            jobTestFile, urlJobFileObj
          ],
        }),
      };

      payloadData.payload.pull_request.changed_files = 1;
      await robot.receive(payloadData);
    });

    it('should check for cron jobs', () => {
      expect(checkCronJobModule.checkForNewCronJob).toHaveBeenCalled();
    });

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should ping server job admin', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      const author = payloadData.payload.pull_request.user.login;
      const formText = (
        'server jobs form'.link('https://goo.gl/forms/XIj00RJ2h5L55XzU2')
      );
      const newLineFeed = '<br>';
      const wikiLinkText = 'this guide'.link(
        JOBS_AND_FETURES_TESTING_WIKI_LINK);

      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        body:
        'Hi @vojtechjelinek, @DubeySandeep, @kevintab95, PTAL at this PR, it ' +
        'adds a new cron job.' + newLineFeed + 'Also @' + author + ' It seems' +
        ' you have added or edited a CRON job, if so please request a testing' +
        ' of this CRON job with this ' + formText + ' Please refer to ' +
        wikiLinkText + ' for details.' + newLineFeed + 'Thanks!',
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
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

  describe('When only tests are added for a cron job', () => {
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

    it('should check for cron jobs', () => {
      expect(checkCronJobModule.checkForNewCronJob).toHaveBeenCalled();
    });

    it('should get modified files', () => {
      expect(github.pulls.listFiles).toHaveBeenCalled();
    });

    it('should ping server job admin', () => {
      expect(github.issues.createComment).toHaveBeenCalled();
      const author = payloadData.payload.pull_request.user.login;
      const formText = (
        'server jobs form'.link('https://goo.gl/forms/XIj00RJ2h5L55XzU2')
      );
      const newLineFeed = '<br>';
      const wikiLinkText = 'this guide'.link(
        JOBS_AND_FETURES_TESTING_WIKI_LINK);

      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pull_request.number,
        body:
        'Hi @vojtechjelinek, @DubeySandeep, @kevintab95, PTAL at this PR, it ' +
        'adds a new cron job.' + newLineFeed + 'Also @' + author + ' It seems' +
        ' you have added or edited a CRON job, if so please request a testing' +
        ' of this CRON job with this ' + formText + ' Please refer to ' +
        wikiLinkText + ' for details.' + newLineFeed + 'Thanks!',
        repo: payloadData.payload.repository.name,
        owner: payloadData.payload.repository.owner.login,
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

  describe('When pull request has datastore label', () => {
    beforeEach(async () => {
      payloadData.payload.pull_request.labels = [{
        name: 'PR: Affects datastore layer'
      }];
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

    it('should check for cron jobs', () => {
      expect(checkCronJobModule.checkForNewCronJob).toHaveBeenCalled();
    });

    it('should not get modified files', () => {
      expect(github.pulls.listFiles).not.toHaveBeenCalled();
    });

    it('should not ping server job admin', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
  });
});