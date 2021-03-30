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
 * @fileoverview Entry point to the app.
 */

require('newrelic');
const scheduler = require('./lib/scheduler');
const apiForSheetsModule = require('./lib/apiForSheets');
const checkMergeConflictsModule = require('./lib/checkMergeConflicts');
const checkPullRequestLabelsModule = require('./lib/checkPullRequestLabels');
const checkPullRequestBranchModule = require('./lib/checkPullRequestBranch');
const checkWipModule = require('./lib/checkWipDraftPR');
const checkPullRequestJobModule = require('./lib/checkPullRequestJob');
const checkPullRequestTemplateModule = require(
  './lib/checkPullRequestTemplate'
);
const checkCriticalPullRequestModule = require(
  './lib/checkCriticalPullRequest'
);
const checkBranchPushModule = require('./lib/checkBranchPush');
const checkPullRequestReviewModule = require('./lib/checkPullRequestReview');
const newCodeOwnerModule = require('./lib/checkForNewCodeowner');
const ciCheckModule = require('./lib/ciChecks');
const periodicCheckModule = require('./lib/periodicChecks');

const constants = require('./constants');
const checkIssueAssigneeModule = require('./lib/checkIssueAssignee');
const staleBuildModule = require('./lib/staleBuildChecks');

const whitelistedAccounts = (process.env.WHITELISTED_ACCOUNTS || '')
  .toLowerCase()
  .split(',');

/**
 * This function checks the event type and accordingly invokes the right
 * checks.
 *
 * @param {import('probot').Context} context
 * @param {String} checkEvent
 */
const runChecks = async (context, checkEvent) => {
  const repoName = context.repo().repo.toLowerCase();
  const checksWhitelist = constants.getChecksWhitelist();
  if (Object.prototype.hasOwnProperty.call(checksWhitelist, repoName)) {
    const checks = checksWhitelist[repoName];
    if (Object.prototype.hasOwnProperty.call(checks, checkEvent)) {
      const checkList = checks[checkEvent];
      const callable = [];
      for (var i = 0; i < checkList.length; i++) {
        switch (checkList[i]) {
          case constants.claCheck:
            callable.push(apiForSheetsModule.checkClaStatus(context));
            break;
          case constants.branchCheck:
            callable.push(checkPullRequestBranchModule.checkBranch(context));
            break;
          case constants.changelogCheck:
            callable.push(
              checkPullRequestLabelsModule.checkChangelogLabel(context)
            );
            break;
          case constants.wipCheck:
            callable.push(checkWipModule.checkWIP(context));
            break;
          case constants.assigneeCheck:
            callable.push(checkPullRequestLabelsModule.checkAssignee(context));
            break;
          case constants.mergeConflictCheck:
            callable.push(
              checkMergeConflictsModule.checkMergeConflictsInPullRequest(
                context, context.payload.pull_request
              )
            );
            break;
          case constants.allMergeConflictCheck:
            callable.push(
              checkMergeConflictsModule.checkMergeConflictsInAllPullRequests(
                context
              )
            );
            break;
          case constants.jobCheck:
            callable.push(checkPullRequestJobModule.checkForNewJob(context));
            break;
          case constants.modelCheck:
            callable.push(
              checkCriticalPullRequestModule.checkIfPRAffectsDatastoreLayer(
                context
              )
            );
            break;
          case constants.issuesAssignedCheck:
            callable.push(checkIssueAssigneeModule.checkAssignees(context));
            break;
          case constants.prLabelCheck:
            callable.push(
              checkPullRequestLabelsModule.checkForIssueLabel(context)
            );
            break;
          case constants.datastoreLabelCheck:
            callable.push(
              checkPullRequestLabelsModule.checkCriticalLabel(context)
            );
            break;
          case constants.forcePushCheck:
            callable.push(checkBranchPushModule.handleForcePush(context));
            break;
          case constants.prTemplateCheck:
            callable.push(
              checkPullRequestTemplateModule.checkTemplate(context)
            );
            break;
          case constants.pullRequestReviewCheck:
            callable.push(
              checkPullRequestReviewModule.handlePullRequestReview(context)
            );
            break;
          case constants.codeOwnerCheck:
            callable.push(newCodeOwnerModule.checkForNewCodeowner(context));
            break;
          case constants.ciFailureCheck:
            callable.push(ciCheckModule.handleFailure(context));
            break;
          case constants.updateWithDevelopCheck:
            callable.push(
              checkMergeConflictsModule.pingAllPullRequestsToMergeFromDevelop(
                context
              )
            );
            break;
          case constants.periodicCheck:
            callable.push(...[
              periodicCheckModule.ensureAllPullRequestsAreAssigned(context),
              periodicCheckModule.ensureAllIssuesHaveProjects(context),
              staleBuildModule.checkAndTagPRsWithOldBuilds(context),
            ]);
            break;
          case constants.respondToReviewCheck:
            callable.push(
              checkPullRequestReviewModule.handleResponseToReview(context)
            );
            break;
          case constants.oldBuildLabelCheck:
            callable.push(staleBuildModule.removeOldBuildLabel(context));
            break;
          case constants.ensureAllIssuesHaveProject:
            callable.push(periodicCheckModule.
              ensureAllIssuesHaveProjects(context));
            break;
        }
      }
      // Wait for all checks to resolve or reject.
      await Promise.allSettled(callable);
    }
  }
};

/**
 * This function checks if repo owner is whitelisted for Oppiabot checks.
 *
 * @param {import('probot').Context} context
 */
const checkWhitelistedAccounts = (context) => {
  return whitelistedAccounts.includes(context.repo().owner.toLowerCase());
};

/**
 * This function checks if pull request author is blacklisted for
 * Oppiabot checks.
 *
 * @param {import('probot').Context} context
 */
const checkAuthor = (context) => {
  const pullRequest = context.payload.pull_request;
  const author = pullRequest.user.login;
  return !constants.getBlacklistedAuthors().includes(author);
};

/**
 * This is the main entry point to the Probot app
 * @param {import('probot').Application} oppiabot
 */
module.exports = (oppiabot) => {
  scheduler.createScheduler(oppiabot, {
    delay: !process.env.DISABLE_DELAY, // delay is enabled on first run
    interval: 24 * 60 * 60 * 1000, // 1 day
  });

  oppiabot.on('schedule.repository', async (context) => {
    console.log('PERIODIC CHECKS RUNNING...');
    if (checkWhitelistedAccounts(context)) {
      await runChecks(context, constants.periodicCheckEvent);
    }
  });

  oppiabot.on('issues.assigned', async (context) => {
    if (checkWhitelistedAccounts(context)) {
      await runChecks(context, constants.issuesAssignedEvent);
    }
  });

  oppiabot.on('issue_comment.created', async (context) => {
    if (checkWhitelistedAccounts(context)) {
      // eslint-disable-next-line no-console
      console.log('COMMENT CREATED ON ISSUE OR PULL REQUEST...');
      await runChecks(context, constants.issueCommentCreatedEvent);
    }
  });

  oppiabot.on('pull_request.opened', async (context) => {
    // The oppiabot runs only for repositories belonging to certain
    // whitelisted accounts. The whitelisted accounts are stored as an
    // env variable. context.repo().owner returns the owner of the
    // repository on which the bot has been installed.
    // This condition checks whether the owner account is included in
    // the whitelisted accounts.
    if (checkWhitelistedAccounts(context) && checkAuthor(context)) {
      await runChecks(context, constants.openEvent);
    }
  });

  oppiabot.on('pull_request.reopened', async (context) => {
    if (checkWhitelistedAccounts(context) && checkAuthor(context)) {
      await runChecks(context, constants.reopenEvent);
    }
  });

  oppiabot.on('pull_request.labeled', async (context) => {
    if (checkWhitelistedAccounts(context) && checkAuthor(context)) {
      await runChecks(context, constants.PRLabelEvent);
    }
  });

  oppiabot.on('pull_request.unlabeled', async (context) => {
    if (checkWhitelistedAccounts(context) && checkAuthor(context)) {
      await runChecks(context, constants.unlabelEvent);
    }
  });

  oppiabot.on('pull_request.synchronize', async (context) => {
    if (checkWhitelistedAccounts(context) && checkAuthor(context)) {
      // eslint-disable-next-line no-console
      console.log(' PR SYNC EVENT TRIGGERED..');
      await runChecks(context, constants.synchronizeEvent);
    }
  });

  oppiabot.on('pull_request.closed', async (context) => {
    if (
      checkWhitelistedAccounts(context) &&
      context.payload.pull_request.merged === true &&
      checkAuthor(context)
    ) {
      // eslint-disable-next-line no-console
      console.log(' A PR HAS BEEN MERGED..');
      await runChecks(context, constants.closeEvent);
    }
  });

  oppiabot.on('pull_request.edited', async (context) => {
    if (
      checkWhitelistedAccounts(context) &&
      context.payload.pull_request.state === 'open' &&
      checkAuthor(context)
    ) {
      // eslint-disable-next-line no-console
      console.log('A PR HAS BEEN EDITED...');
      await runChecks(context, constants.editEvent);
    }
  });

  oppiabot.on('push', async (context) => {
    if (checkWhitelistedAccounts(context)) {
      // eslint-disable-next-line no-console
      console.log('A BRANCH HAS BEEN PUSHED...');
      await runChecks(context, constants.pushEvent);
    }
  });

  oppiabot.on('pull_request_review.submitted', async (context) => {
    if (checkWhitelistedAccounts(context)) {
      console.log('A Pull Request got reviewed');
      await runChecks(context, constants.pullRequestReviewEvent);
    }
  });

  oppiabot.on('check_suite.completed', async (context) => {
    if (checkWhitelistedAccounts(context)) {
      // eslint-disable-next-line no-console
      console.log('A CHECK SUITE HAS BEEN COMPLETED...');
      await runChecks(context, constants.checkCompletedEvent);
    }
  });

  oppiabot.on('issues.opened', async (context) => {
    if (checkWhitelistedAccounts(context)) {
      console.log('An Issue is Opened');
      await runChecks(context, constants.ensureAllIssuesHaveProject);
    }
  });
};
