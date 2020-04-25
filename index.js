require('newrelic');
const scheduler = require('./lib/scheduler');
const apiForSheetsModule = require('./lib/apiForSheets');
const checkMergeConflictsModule = require('./lib/checkMergeConflicts');
const checkPullRequestLabelsModule = require('./lib/checkPullRequestLabels');
const whitelistedAccounts = (
  (process.env.WHITELISTED_ACCOUNTS || '').toLowerCase().split(','));

/**
 * This is the main entrypoint to the Probot app
 * @param {import('probot').Application} app
 */
module.exports = (app) => {
  scheduler.createScheduler(app, {
    delay: !process.env.DISABLE_DELAY,
    interval: 60 * 60 * 1000 // 1 hour
  });

  app.on('pull_request.opened', async context => {
    // The oppiabot runs only for repositories belonging to certain
    // whitelisted accounts. The whitelisted accounts are stored as an
    // env variable. context.repo().owner returns the owner of the
    // repository on which the bot has been installed.
    // This condition checks whether the owner account is included in
    // the whitelisted accounts.
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      await apiForSheetsModule.checkClaStatus(context);
      await checkPullRequestLabelsModule.checkChangelogLabel(context);
    }
  });

  app.on('pull_request.reopened', async context => {
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      await checkPullRequestLabelsModule.checkChangelogLabel(context);
    }
  });

  app.on('pull_request.labeled', async context => {
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      await checkPullRequestLabelsModule.checkAssignee(context);
    }
  });

  app.on('pull_request.synchronize', async context => {
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      // eslint-disable-next-line no-console
      console.log(' PR SYNC EVENT TRIGGERED..');
      await checkMergeConflictsModule.checkMergeConflictsInPullRequest(
        context, context.payload.pull_request);
    }
  });

  app.on('pull_request.closed', async context => {
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase()) &&
      context.payload.pull_request.merged === true) {
      // eslint-disable-next-line no-console
      console.log(' A PR HAS BEEN MERGED..');
      await checkMergeConflictsModule.checkMergeConflictsInAllPullRequests(
        context);
    }
  });
};
