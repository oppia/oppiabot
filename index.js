require('newrelic');
const scheduler = require('./lib/scheduler');
const apiForSheetsModule = require('./lib/apiForSheets');
const checkMergeConflictsModule = require('./lib/checkMergeConflicts');
const checkPullRequestLabelsModule = require('./lib/checkPullRequestLabels');
const checkPullRequestBranchModule = require('./lib/checkPullRequestBranch');
const checkWIPModule = require('./lib/checkWipDraftPR');

const whitelistedAccounts = (
  (process.env.WHITELISTED_ACCOUNTS || '').toLowerCase().split(','));
const reposWithOnlyCLACheck = (
  (process.env.ONLY_CLA_CHECK_ENABLED_REPOS || '').toLowerCase().split(','));

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
    console.log(JSON.stringify(context.repo()));
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      await apiForSheetsModule.checkClaStatus(context);
      if (!reposWithOnlyCLACheck.includes(context.repo().repo.toLowerCase())) {
        await checkPullRequestLabelsModule.checkChangelogLabel(context);
        await checkPullRequestBranchModule.checkBranch(context);
        await checkWIPModule.checkWIP(context);
      }
    }
  });

  oppiabot.on('pull_request.reopened', async context => {
    if (
      whitelistedAccounts.includes(context.repo().owner.toLowerCase()) &&
      !reposWithOnlyCLACheck.includes(context.repo().repo.toLowerCase)) {
      await checkPullRequestLabelsModule.checkChangelogLabel(context);
      // Prevent user from reopening the PR.
      await checkPullRequestBranchModule.checkBranch(context);
      await checkWIPModule.checkWIP(context);
    }
  });

  oppiabot.on('pull_request.labeled', async context => {
     if (
      whitelistedAccounts.includes(context.repo().owner.toLowerCase()) &&
      !reposWithOnlyCLACheck.includes(context.repo().repo.toLowerCase)) {
      await checkPullRequestLabelsModule.checkAssignee(context);
    }
  });

  oppiabot.on('pull_request.synchronize', async context => {
    if (
      whitelistedAccounts.includes(context.repo().owner.toLowerCase()) &&
      !reposWithOnlyCLACheck.includes(context.repo().repo.toLowerCase)) {
      // eslint-disable-next-line no-console
      console.log(' PR SYNC EVENT TRIGGERED..');
      await checkMergeConflictsModule.checkMergeConflictsInPullRequest(
        context, context.payload.pull_request);
    }
  });

  oppiabot.on('pull_request.closed', async context => {
     if (
      whitelistedAccounts.includes(context.repo().owner.toLowerCase()) &&
      !reposWithOnlyCLACheck.includes(context.repo().repo.toLowerCase) &&
      context.payload.pull_request.merged === true) {
      // eslint-disable-next-line no-console
      console.log(' A PR HAS BEEN MERGED..');
      await checkMergeConflictsModule.checkMergeConflictsInAllPullRequests(
        context);
    }
  });

  oppiabot.on('pull_request.edited', async context => {
    if (
      whitelistedAccounts.includes(context.repo().owner.toLowerCase()) &&
      !reposWithOnlyCLACheck.includes(context.repo().repo.toLowerCase) &&
      context.payload.pull_request.state === 'open') {
      // eslint-disable-next-line no-console
      console.log('A PR HAS BEEN EDITED...');
      await checkWIPModule.checkWIP(context);
    }
  });
};
