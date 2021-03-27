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
 * @fileoverview Spec for issue assigned handler.
 */

require('dotenv').config();
const { createProbot } = require('probot');
const oppiaBot = require('../index');
const payloadData = require('../fixtures/pullRequestPayload.json');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const alertOnBoardingTeamModule = require('../lib/alertOnBoardingTeam');
const apiForSheetsModule = require('../lib/apiForSheets');
const scheduler = require('../lib/scheduler');
const {
  teamLeads
} = require('../userWhitelist.json');

describe('Alert onboarding team for author who do not signed CLA module', ()=>{
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

  beforeEach(async () => {
    spyOn(scheduler, 'createScheduler').and.callFake(() => { });

    github = {
      issues: {
        createComment: jasmine.createSpy('createComment').and.resolveTo({}),
      },
    };

    robot = createProbot({
      id: 1,
      cert: 'test',
      githubToken: 'test',
    });

    app = robot.load(oppiaBot);
    spyOn(app, 'auth').and.resolveTo(github);

    // Mock google auth
    Object.setPrototypeOf(OAuth2Client, function () {
      return {};
    });
    spyOn(apiForSheetsModule, 'authorize').and.callThrough();
    spyOn(alertOnBoardingTeamModule, 'alertOnboardingTeam').and.callThrough();
  });

  describe('check when user has not signed cla', () => {
    beforeEach(async () => {
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.resolveTo({
              data: { values: [['other_user']] },
            }),
          },
        },
      });

      await app.receive(payloadData);
    });

    it('should check has user signed CLA', () => {
      expect(alertOnBoardingTeamModule.hasSignedCla).toHaveBeenCalled();
    });

    it('should call alertOnBoardingTeam', () => {
      expect(alertOnBoardingTeamModule.alertOnboardingTeam).toHaveBeenCalled();
    });

    it('should be authorized', () => {
      expect(apiForSheetsModule.authorize).toHaveBeenCalled();
    });

    it('should check the spreadsheet', () => {
      expect(google.sheets).toHaveBeenCalled();
    });

    it('should comment on pullrequest', () => {
      const onBoardingTeamMember = [teamLeads.onboardingTeam];
      var members = '';
      onBoardingTeamMember.forEach((member)=>{
        members = members + '@' + member + ',';
      });
      members = members.slice(0, -1);
      expect(github.issues.createComment).toHaveBeenCalled();
      expect(github.issues.createComment).toHaveBeenCalledWith({
        issue_number: payloadData.payload.pullRequest.number,
        body: members +
         ' The author of this pull request has not signed CLA.'
      });
    });
  });

  describe('check when user has signed cla', () => {
    beforeEach(async () => {
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.resolveTo({
              data: { values: [['test_user']] },
            }),
          },
        },
      });

      await app.receive(payloadData);
    });

    it('should call alertOnBoardingTeam', () => {
      expect(alertOnBoardingTeamModule.alertOnboardingTeam).toHaveBeenCalled();
    });

    it('should check the spreadsheet', () => {
      expect(google.sheets).toHaveBeenCalled();
    });

    it('should not comment on pullrequest', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
  });

  describe('when sheets api throws error', () => {
    beforeEach(async () => {
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine
              .createSpy('get')
              .and.throwError('Unable to get sheet.'),
          },
        },
      });

      await app.receive(payloadData);
    });

    it('should call alertOnBardingTeam', () => {
      expect(alertOnBoardingTeamModule.alertOnboardingTeam).toHaveBeenCalled();
    });

    it('should be authorized', () => {
      expect(apiForSheetsModule.authorize).toHaveBeenCalled();
    });

    it('should check the spreadsheet', () => {
      expect(google.sheets).toHaveBeenCalled();
    });

    it('should not comment on ipullrequest', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
  });

  describe('check non whitelisted repo', () => {
    beforeEach(async () => {
      payloadData.payload.repository.name = 'non-whitelisted-repo';
      await app.receive(payloadData);
    });

    it('should not be called for the payload', () => {
      expect(alertOnBoardingTeamModule.alertOnboardingTeam).not
      .toHaveBeenCalled();
    });

    it('should not comment on pullrequest', () => {
      expect(github.issues.createComment).not.toHaveBeenCalled();
    });
  });
});