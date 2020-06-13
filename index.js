require('newrelic');
const scheduler = require('./lib/scheduler');
const apiForSheetsModule = require('./lib/apiForSheets');
const checkMergeConflictsModule = require('./lib/checkMergeConflicts');
const checkPullRequestLabelsModule = require('./lib/checkPullRequestLabels');
const checkPullRequestBranchModule = require('./lib/checkPullRequestBranch');
const checkWipModule = require('./lib/checkWipDraftPR');
const constants = require('./constants');

const whitelistedAccounts = (
  (process.env.WHITELISTED_ACCOUNTS || '').toLowerCase().split(','));

async function runChecks(context, checkEvent) {
  const repoName = context.repo().repo.toLowerCase();
  const checksWhitelist = constants.getChecksWhitelist();
  if (checksWhitelist.hasOwnProperty(repoName)) {
    const checks = checksWhitelist[repoName];
    if (checks.hasOwnProperty(checkEvent)) {
      const checkList = checks[checkEvent];
      for (var i = 0; i < checkList.length; i++) {
        switch (checkList[i]) {
          case constants.claCheck:
            await apiForSheetsModule.checkClaStatus(context);
            break;
          case constants.changelogCheck:
            await checkPullRequestLabelsModule.checkChangelogLabel(context);
            break;
          case constants.branchCheck:
            await checkPullRequestBranchModule.checkBranch(context);
            break;
          case constants.wipCheck:
            await checkWipModule.checkWIP(context);
            break;
          case constants.assigneeCheck:
            await checkPullRequestLabelsModule.checkAssignee(context);
            break;
          case constants.mergeConflictCheck:
            await checkMergeConflictsModule.checkMergeConflictsInPullRequest(
              context, context.payload.pull_request);
            break;
          case constants.allMergeConflictCheck:
            await (
              checkMergeConflictsModule.checkMergeConflictsInAllPullRequests(
                context));
            break;
        }
      }
    }
  }
}

function checkWhitelistedAccounts(context) {
  return whitelistedAccounts.includes(context.repo().owner.toLowerCase());
}

/**
 * This is the main entrypoint to the Probot app
 * @param {import('probot').Application} oppiabot
 */
module.exports = (oppiabot) => {
  scheduler.createScheduler(oppiabot, {
    delay: !process.env.DISABLE_DELAY,
    interval: 60 * 60 * 1000 // 1 hour
  });

  oppiabot.on('pull_request.opened', async context => {
    // The oppiabot runs only for repositories belonging to certain
    // whitelisted accounts. The whitelisted accounts are stored as an
    // env variable. context.repo().owner returns the owner of the
    // repository on which the bot has been installed.
    // This condition checks whether the owner account is included in
    // the whitelisted accounts.
    if (checkWhitelistedAccounts(context)) {
      await runChecks(context, constants.openEvent);
    }
  });

  oppiabot.on('pull_request.reopened', async context => {
    if (checkWhitelistedAccounts(context)) {
      await runChecks(context, constants.reopenEvent);
    }
  });

  oppiabot.on('pull_request.labeled', async context => {
     if (checkWhitelistedAccounts(context)) {
      await runChecks(context, constants.labelEvent);
    }
  });

  oppiabot.on('pull_request.synchronize', async context => {
    if (checkWhitelistedAccounts(context)) {
      // eslint-disable-next-line no-console
      console.log(' PR SYNC EVENT TRIGGERED..');
      await runChecks(context, constants.synchronizeEvent);
    }
  });

  oppiabot.on('pull_request.closed', async context => {
     if (
      checkWhitelistedAccounts(context) &&
      context.payload.pull_request.merged === true) {
      // eslint-disable-next-line no-console
      console.log(' A PR HAS BEEN MERGED..');
      await runChecks(context, constants.closeEvent);
    }
  });

  oppiabot.on('pull_request.edited', async context => {
    if (
      checkWhitelistedAccounts(context) &&
      context.payload.pull_request.state === 'open') {
      // eslint-disable-next-line no-console
      console.log('A PR HAS BEEN EDITED...');
      await runChecks(context, constants.editEvent);
    }
  });
};
