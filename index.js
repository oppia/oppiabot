require('newrelic');
const scheduler = require('./lib/scheduler');
const apiForSheetsModule = require('./lib/apiForSheets');
const checkMergeConflictsModule = require('./lib/checkMergeConflicts');
const checkPullRequestLabelsModule = require('./lib/checkPullRequestLabels');
const checkPullRequestBranchModule = require('./lib/checkPullRequestBranch');
const checkWIPModule = require('./lib/checkWipDraftPR');

const whitelistedAccounts = (
  (process.env.WHITELISTED_ACCOUNTS || '').toLowerCase().split(','));
const checksWhitelist = {
  'oppia-android': {
    'opened': ['cla-check'],
    'reopened': [],
    'labeled': [],
    'synchronize': [],
    'closed': [],
    'edited': []
  },
  'oppia': {
    'opened': [
      'cla-check',
      'changelog-check',
      'branch-check',
      'wip-check'],
    'reopened': [
      'changelog-check',
      // Prevent user from reopening the PR.
      'branch-check',
      'wip-check'
    ],
    'labeled': ['assignee-check',],
    'synchronize': ['merge-conflict-check'],
    'closed': ['all-merge-conflict-check'],
    'edited': ['wip-check']
  }
};

async function runChecks(context, checkContext) {
  const repoName = context.repo().repo.toLowerCase();
  if (checksWhitelist.hasOwnProperty(repoName)) {
    const checks = checksWhitelist[repoName];
    if (checks.hasOwnProperty(checkContext)) {
      const checkList = checks[checkContext];
      for (var i = 0; i < checkList.length; i++) {
        switch(checkList[i]) {
          case 'cla-check':
            await apiForSheetsModule.checkClaStatus(context);
            break;
          case 'changelog-check':
            await checkPullRequestLabelsModule.checkChangelogLabel(context);
            break;
          case 'branch-check':
            await checkPullRequestBranchModule.checkBranch(context);
            break;
          case 'wip-check':
            await checkWIPModule.checkWIP(context);
            break;
          case 'assignee-check':
            await checkPullRequestLabelsModule.checkAssignee(context);
            break;
          case 'merge-conflict-check':
            await checkMergeConflictsModule.checkMergeConflictsInPullRequest(
              context, context.payload.pull_request);
            break;
          case 'all-merge-conflict-check':
            await (
              checkMergeConflictsModule.checkMergeConflictsInAllPullRequests(
                context));
            break;
        }
      }
    }
  }
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
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      await runChecks(context, 'opened');
    }
  });

  oppiabot.on('pull_request.reopened', async context => {
    if (
      whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      await runChecks(context, 'reopened');
    }
  });

  oppiabot.on('pull_request.labeled', async context => {
     if (
      whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      await runChecks(context, 'labeled');
    }
  });

  oppiabot.on('pull_request.synchronize', async context => {
    if (
      whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      // eslint-disable-next-line no-console
      console.log(' PR SYNC EVENT TRIGGERED..');
      await runChecks(context, 'synchronize');
    }
  });

  oppiabot.on('pull_request.closed', async context => {
     if (
      whitelistedAccounts.includes(context.repo().owner.toLowerCase()) &&
      context.payload.pull_request.merged === true) {
      // eslint-disable-next-line no-console
      console.log(' A PR HAS BEEN MERGED..');
      await runChecks(context, 'closed');
    }
  });

  oppiabot.on('pull_request.edited', async context => {
    if (
      whitelistedAccounts.includes(context.repo().owner.toLowerCase()) &&
      context.payload.pull_request.state === 'open') {
      // eslint-disable-next-line no-console
      console.log('A PR HAS BEEN EDITED...');
      await runChecks(context, 'edited');
    }
  });
};
