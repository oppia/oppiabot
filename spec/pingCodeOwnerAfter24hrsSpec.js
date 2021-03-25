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
//Following plugin is actual app in index.jd
const oppiaBot = require('../index');
const scheduler = require('../lib/scheduler');
const pushPayload = require('../fixtures/push.json');
const pullRequestPayload = require('../fixtures/pullRequestPayload.json');
const pingCodeOwnerModule = require('../lib/pingCodeOwnerAfter24hrs');
const checkBranchPushModule = require('../lib/checkBranchPush');

describe('Should Ping after 24 hrs without review in PR', ()=> {
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
  beforeEach(()=>{
    spyOn(scheduler, 'createScheduler').and.callFake(()=>{});

    github = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.returnValue({}),
        update: jasmine.createSpy('update').and.resolveTo({}),
      },
      search: {
        issuesAndPullRequests: jasmine
          .createSpy('issuesAndPullRequests')
          .and.resolveTo({
            data: {
              items: [pullRequestPayload.payload.pull_request],
            },
          }),
      },
    };

    robot = createProbot({
      id: 1,
      cert: 'test',
      githubToken: 'test',
    }
    );
    app = robot.load(oppiaBot);
    spyOn(app, 'auth').and.resolveTo(github);
    spyOn(pingCodeOwnerModule, 'checkAnyReviewRequiredPr').and.callThrough();
  });

  //BeforeEach Ends here

  // From here Starting Describe suite to check
  describe('Its been more than 24 Hrs since' +
  'last review and there is no Code Review till now ', ()=>{
    beforeEach(async () => {
      await robot.receive(pushPayload);
    });

    it('should comment on pull request', ()=>{
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });

    it('should not close the pull request', () => {
      expect(github.issues.update).not.toHaveBeenCalled();
    });
  });

  describe('Less than 24 Hrs', ()=>{
    // In this beforeEach is not Required as we don't require any
    // data before Performing these tests
    beforeEach(async () => {
      await robot.receive(pushPayload);
    });
    it('should not close the pull request', () => {
      expect(github.issues.update).not.toHaveBeenCalled();
    });

    it('should not comment on pull request', ()=>{
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
  });
});