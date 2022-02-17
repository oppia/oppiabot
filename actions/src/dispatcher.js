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
 * @fileoverview Handles dispatching events and actions to different handlers.
 */

const core = require('@actions/core');
const { context } = require('@actions/github');
const issueLabelsModule = require('./issues/checkIssueLabels');
const claCheckGithubActionModule = require('./pull_requests/claCheck');
const constants = require('../../constants');
const PRLabelsModule = require('./pull_requests/labelCheck');
const wipDraftModule = require('./pull_requests/checkWipDraftPR');
const ciCheckModule = require('./pull_requests/ciChecks');

module.exports = {
  async dispatch(event, action) {
    core.info(`Received Event:${event} Action:${action}.`);
    const checkEvent = `${event}_${action}`;
    const repoName = context.payload.repository.name.toLowerCase();
    const checksWhitelist = constants.getChecksWhitelist();
    if (Object.prototype.hasOwnProperty.call(checksWhitelist, repoName)) {
      core.info('Repo is whitelisted');
      const checks = checksWhitelist[repoName];
      if ((Object.prototype.hasOwnProperty.call(checks, checkEvent))) {
        core.info('Valid checkevent');
        const checkList = checks[checkEvent];
        for (var i = 0; i < checkList.length; i++) {
          switch (checkList[i]) {
            case constants.issuesLabelCheck:
              core.info('issue label check triggered');
              await issueLabelsModule.checkLabels();
              break;
            case constants.claCheckGithubAction:
              core.info('cla check triggered');
              await claCheckGithubActionModule.claCheckGithubAction();
              break;
            case constants.prLabelCheck:
              core.info('PR label check triggered');
              await PRLabelsModule.checkLabels();
              break;
            case constants.dontMergeLabelCheck:
              core.info('Don\'t label check triggered');
              await PRLabelsModule.checkUnLabeled();
              break;
            case constants.wipCheck:
              core.info('WIP check triggered');
              await wipDraftModule.checkWIP();
              break;
            case constants.ciFailureCheck:
              core.info('CI check triggered');
              await ciCheckModule.handleFailure();
              break;
          }
        }
      }
    }
  }
};
