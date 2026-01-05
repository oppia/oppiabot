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

/**
 * @fileoverview Spec for CLA Check Github Action.
 */

const claCheckGithubActionModule =
 require('../actions/src/pull_requests/claCheck.js');
const core = require('@actions/core');
const dispatcher = require('../actions/src/dispatcher');
const github = require('@actions/github');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const pullRequestPayload = require('../fixtures/pullRequestPayload.json');
const sheetsToken = JSON.stringify(require('../fixtures/token.json'));
const sheetsCredentials =
  JSON.stringify(require('../fixtures/credentials.json'));


describe('CLA check github action Module for Oppia', () => {
  beforeEach(async () => {
    spyOn(core, 'getInput').and.callFake((val) =>{
      if (val === 'repo-token') {
        return 'sample-token';
      } else if (val === 'sheets-cred') {
        return sheetsCredentials;
      } else if (val === 'sheets-token') {
        return sheetsToken;
      }
    });
    github.context.eventName = 'pull_request_target';
    github.context.payload = pullRequestPayload.payload;

    octokit = {
      rest: {
        issues: {
          createComment: jasmine.createSpy('createComment').and.resolveTo({}),
          update: jasmine.createSpy('update').and.resolveTo({}),
        },
      },
    };

    spyOn(core, 'info').and.callFake(() => {});
    spyOn(github, 'getOctokit').and.returnValue(octokit);

    spyOnProperty(github.context, 'repo').and.returnValue({
      owner: pullRequestPayload.payload.repository.owner.login,
      repo: pullRequestPayload.payload.repository.name,
    });
    spyOn(claCheckGithubActionModule, 'claCheckGithubAction').and.callThrough();
  });

  describe('called for only PR opened or reopened action', () => {
    beforeEach(() => {
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.callFake(async (obj, cb) => {
              await cb(null, {
                data: {
                  values: [['testuser7777']]
                },
              });
            }),
          },
        },
      });
    });

    it('should be called for PR opened action', async () => {
      await dispatcher.dispatch('pull_request_target', 'opened');

      expect(claCheckGithubActionModule.claCheckGithubAction)
        .toHaveBeenCalled();
    });

    it('should be called for PR reopened action', async () => {
      await dispatcher.dispatch('pull_request_target', 'reopened');

      expect(claCheckGithubActionModule.claCheckGithubAction)
        .toHaveBeenCalled();
    });
  });

  describe('user has signed cla sheet', () => {
    beforeEach(function () {
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.callFake(async (obj, cb) => {
              await cb(null, {
                data: {
                  values: [['testuser7777']]
                },
              });
            }),
          },
        },
      });
    });

    it('should not fail', async () => {
      await dispatcher.dispatch('pull_request_target', 'reopened');
      expect(claCheckGithubActionModule.claCheckGithubAction)
        .toHaveBeenCalled();
      expect(octokit.rest.issues.update).not.toHaveBeenCalled();
      expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
      expect(octokit.rest.issues.createComment).not.toHaveBeenCalledWith({});
      expect(core.info).toHaveBeenCalledWith('testuser7777 has signed the CLA');
    });
  });

  describe('user with multi cased username has signed cla sheet', () => {
    const username = pullRequestPayload.payload.pull_request.user.login;
    beforeEach(function () {
      // Changing the username to be multi cased.
      pullRequestPayload.payload.pull_request.user.login = 'TestUser7777';
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.callFake(async (obj, cb) => {
              await cb(null, {
                data: {
                  values: [['testuser7777']]
                },
              });
            }),
          },
        },
      });
    });

    afterEach(() => {
      pullRequestPayload.payload.pull_request.user.login = username;
    });

    it('should not fail', async () => {
      await dispatcher.dispatch('pull_request_target', 'reopened');
      expect(claCheckGithubActionModule.claCheckGithubAction)
        .toHaveBeenCalled();
      expect(octokit.rest.issues.update).not.toHaveBeenCalled();
      expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
      expect(octokit.rest.issues.createComment).not.toHaveBeenCalledWith({});
      expect(core.info).toHaveBeenCalledWith('TestUser7777 has signed the CLA');
    });
  });

  describe('user has not signed cla sheet', () => {
    beforeEach(async () => {
      spyOn(core, 'setFailed');
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.callFake(async (obj, cb) => {
              await cb(null, {
                data: {
                  values: [['testuser']]
                },
              });
            }),
          },
        },
      });
      await dispatcher.dispatch('pull_request_target', 'opened');
    });

    it('should comment in PR', async () => {
      const LINK_RESULT = 'here'.link(
        'https://github.com/oppia/oppia/wiki/' +
        'Contributing-code-to-Oppia#setting-things-up'
      );
      const PR_AUTHOR = pullRequestPayload.payload.pull_request.user.login;
      const body = (
        'Hi! @' +
        PR_AUTHOR +
        ' Welcome to Oppia! Could you please ' +
        'follow the instructions ' + LINK_RESULT +
        " and sign the CLA Sheet to get started? You'll need to do " +
        "this before we can accept your PR. Once you're done," +
        ' please reopen the PR. Thanks!');

      expect(octokit.rest.issues.update).toHaveBeenCalledWith({
        state: 'closed',
        issue_number: pullRequestPayload.payload.pull_request.number,
        owner: pullRequestPayload.payload.repository.owner.login,
        repo: pullRequestPayload.payload.repository.name,
      });

      expect(octokit.rest.issues.createComment).toHaveBeenCalled();

      expect(octokit.rest.issues.createComment).toHaveBeenCalledWith({
        body: body,
        issue_number: pullRequestPayload.payload.pull_request.number,
        owner: pullRequestPayload.payload.repository.owner.login,
        repo: pullRequestPayload.payload.repository.name,
      });
    });

    it('should fail Github action', async () => {
      expect(claCheckGithubActionModule.claCheckGithubAction)
        .toHaveBeenCalled();
      expect(core.setFailed).toHaveBeenCalledWith(
        'testuser7777 has not signed the CLA');
    });
  });

  describe('testing http req fails', () => {
    beforeEach(async () => {
      spyOn(core, 'setFailed');
    });

    it('should fail if no data is present in sheet', async () => {
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.callFake(async (obj, cb) => {
              await cb(null, {
                data: {
                  values: []
                },
              });
            }),
          },
        },
      });

      await dispatcher.dispatch('pull_request_target', 'opened');

      expect(core.setFailed).toHaveBeenCalledWith('No data found.');
    });

    it('should fail if spreadsheet value fetch fails', async () => {
      spyOn(google, 'sheets').and.returnValue({
        spreadsheets: {
          values: {
            get: jasmine.createSpy('get').and.callFake(async (obj, cb) => {
              await cb('error', {
                data: {
                  values: []
                },
              });
            }),
          },
        },
      });

      await dispatcher.dispatch('pull_request_target', 'opened');

      expect(core.setFailed).toHaveBeenCalledWith(
        'The API returned an error: error');
    });
  });
});

describe('CLA check github action Module Auth fail', () => {
  beforeEach(async () => {
    spyOn(core, 'getInput').and.callFake((val) =>{
      if (val === 'repo-token') {
        return 'sample-token';
      } else if (val === 'sheets-cred') {
        return {};
      } else if (val === 'sheets-token') {
        return sheetsToken;
      }
    });
    github.context.eventName = 'pull_request_target';
    github.context.payload = pullRequestPayload.payload;
    spyOn(claCheckGithubActionModule, 'claCheckGithubAction').and.callThrough();
  });

  it('should fail if Auth fails', async () => {
    spyOn(core, 'setFailed');

    await dispatcher.dispatch('pull_request_target', 'opened');

    expect(core.setFailed).toHaveBeenCalledWith(
      jasmine.stringMatching(/^Auth failure: SyntaxError:/));
  });
});

describe('CLA check github action Module for oppia-android', () => {
  beforeEach(async () => {
    spyOn(core, 'getInput').and.callFake((val) =>{
      if (val === 'repo-token') {
        return 'sample-token';
      } else if (val === 'sheets-cred') {
        return sheetsCredentials;
      } else if (val === 'sheets-token') {
        return sheetsToken;
      }
    });
    github.context.eventName = 'pull_request_target';
    github.context.payload = pullRequestPayload.payload;
    github.context.payload.repository.name = 'oppia-android';

    octokit = {
      rest: {
        issues: {
          createComment: jasmine.createSpy('createComment').and.resolveTo({}),
          update: jasmine.createSpy('update').and.resolveTo({}),
        },
      },
    };

    spyOn(github, 'getOctokit').and.returnValue(octokit);

    spyOnProperty(github.context, 'repo').and.returnValue({
      owner: pullRequestPayload.payload.repository.owner.login,
      repo: pullRequestPayload.payload.repository.name,
    });
    spyOn(claCheckGithubActionModule, 'claCheckGithubAction').and.callThrough();
    spyOn(core, 'setFailed');
    spyOn(google, 'sheets').and.returnValue({
      spreadsheets: {
        values: {
          get: jasmine.createSpy('get').and.callFake(async (obj, cb) => {
            await cb(null, {
              data: {
                values: [['testuser']]
              },
            });
          }),
        },
      },
    });
    await dispatcher.dispatch('pull_request_target', 'opened');
  });

  afterEach(() => {
    github.context.payload.repository.name = 'oppia';
  });

  it('should comment in PR if user has not signed the CLA' +
  ' for Oppia-Android', async () => {
    const LINK_RESULT = 'here'.link(
      'https://github.com/oppia/oppia-android/wiki#onboarding-instructions'
    );
    const PR_AUTHOR = pullRequestPayload.payload.pull_request.user.login;
    const body = (
      'Hi! @' +
      PR_AUTHOR +
      ' Welcome to Oppia! Could you please ' +
      'follow the instructions ' + LINK_RESULT +
      " and sign the CLA Sheet to get started? You'll need to do " +
      "this before we can accept your PR. Once you're done," +
      ' please reopen the PR. Thanks!');

    expect(octokit.rest.issues.update).toHaveBeenCalledWith({
      state: 'closed',
      issue_number: pullRequestPayload.payload.pull_request.number,
      owner: pullRequestPayload.payload.repository.owner.login,
      repo: pullRequestPayload.payload.repository.name,
    });

    expect(octokit.rest.issues.createComment).toHaveBeenCalled();

    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith({
      body: body,
      issue_number: pullRequestPayload.payload.pull_request.number,
      owner: pullRequestPayload.payload.repository.owner.login,
      repo: pullRequestPayload.payload.repository.name,
    });
  });
});
