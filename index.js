require('newrelic');
const scheduler = require('./lib/scheduler');
const apiForSheetsModule = require('./lib/apiForSheets');
const checkMergeConflictsModule = require('./lib/checkMergeConflicts');
const checkPullRequestLabelsModule = require('./lib/checkPullRequestLabels');
const checkPullRequestBranchModule = require('./lib/checkPullRequestBranch');
const checkWipModule = require('./lib/checkWipDraftPR');
const checkPullRequestJobModule = require('./lib/checkPullRequestJob');
const checkPullRequestTemplateModule = require('./lib/checkPullRequestTemplate');
const checkCriticalPullRequestModule = require('./lib/checkCriticalPullRequest');
const checkBranchPushModule = require('./lib/checkBranchPush');
const checkPullRequestReviewModule = require('./lib/checkPullRequestReview');
const newCodeOwnerModule = require('./lib/checkForNewCodeowner');
const ciCheckModule = require('./lib/ciChecks');

const constants = require('./constants');
const checkIssueAssigneeModule = require('./lib/checkIssueAssignee');

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
              context,
              context.payload.pull_request
            );
            break;
          case constants.allMergeConflictCheck:
            await checkMergeConflictsModule.checkMergeConflictsInAllPullRequests(
              context
            );
            break;
          case constants.jobCheck:
            await checkPullRequestJobModule.checkForNewJob(context);
            break;
          case constants.modelCheck:
            await checkCriticalPullRequestModule.checkIfPRAffectsDatastoreLayer(
              context
            );
            break;
          case constants.issuesAssignedCheck:
            await checkIssueAssigneeModule.checkAssignees(context);
            break;
          case constants.prLabelCheck:
            await checkPullRequestLabelsModule.checkForIssueLabel(context);
            break;
          case constants.datastoreLabelCheck:
            await checkPullRequestLabelsModule.checkCriticalLabel(context);
            break;
          case constants.forcePushCheck:
            await checkBranchPushModule.handleForcePush(context);
            break;
          case constants.prTemplateCheck:
            await checkPullRequestTemplateModule.checkTemplate(context);
            break;
          case constants.pullRequestReviewCheck:
            await checkPullRequestReviewModule.handlePullRequestReview(context);
            break;
          case constants.codeOwnerCheck:
            await newCodeOwnerModule.checkForNewCodeowner(context);
            break;
          case constants.ciFailureCheck:
            await ciCheckModule.handleFailure(context);
            break;
          case constants.updateWithDevelopCheck:
            await checkMergeConflictsModule.pingAllPullRequestsToMergeFromDevelop(context);
            break;
        }
      }
    }
  }
}

/**
 * This function checks if repo owner is whitelisted for Oppiabot checks.
 *
 * @param {import('probot').Context} context
 */
function checkWhitelistedAccounts(context) {
  return whitelistedAccounts.includes(context.repo().owner.toLowerCase());
}

/**
 * This function checks if pull request author is blacklisted for
 * Oppiabot checks.
 *
 * @param {import('probot').Context} context
 */
function checkAuthor(context) {
  const pullRequest = context.payload.pull_request;
  const author = pullRequest.user.login;
  return !constants.getBlacklistedAuthors().includes(author);
}

/**
 * This is the main entrypoint to the Probot app
 * @param {import('probot').Application} oppiabot
 */
module.exports = (oppiabot) => {
  scheduler.createScheduler(oppiabot, {
    delay: !process.env.DISABLE_DELAY,
    interval: 60 * 60 * 1000, // 1 hour
  });

  oppiabot.on('issues.assigned', async (context) => {
    if (checkWhitelistedAccounts(context)) {
      await runChecks(context, constants.issuesAssignedEvent);
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
    if(checkWhitelistedAccounts(context)) {
      console.log('A Pull Request got reviewed');
      await runChecks(context, constants.pullRequestReviewEvent);
    }
  });

  oppiabot.on('check_suite.completed', async (context) => {
    if(checkWhitelistedAccounts(context)) {
      // eslint-disable-next-line no-console
      console.log('A CHECK SUITE HAS BEEN COMPLETED...');
      await runChecks(context, constants.checkCompletedEvent);
    }
  });
};
