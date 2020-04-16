require ('newrelic');
const createScheduler = require('probot-scheduler');
const apiForSheetsModule = require('./lib/apiForSheets');
const checkMergeConflictsModule = require('./lib/checkMergeConflicts');
const checkPullRequestLabelsModule = require('./lib/checkPullRequestLabels');
const periodicChecksModule = require('./lib/periodicChecks');
const handlePrReviewModule = require('./lib/handlePullRequestReview');

const whitelistedAccounts = (
  (process.env.WHITELISTED_ACCOUNTS || '').toLowerCase().split(','));
var pullRequestAuthor;


module.exports = (robot) => {
  scheduler = createScheduler(robot, {
    delay: !process.env.DISABLE_DELAY,
    interval: 60 * 60 * 24 * 1000 // 24 hours
  });

  robot.on('pull_request.opened', async context => {
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

  robot.on('pull_request.reopened', async context => {
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      await checkPullRequestLabelsModule.checkChangelogLabel(context);
    }
  });

  robot.on('pull_request.labeled', async context => {
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      await checkPullRequestLabelsModule.checkAssignee(context);
    }
  });

  robot.on('pull_request.synchronize', async context => {
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      // eslint-disable-next-line no-console
      console.log(' PR SYNC EVENT TRIGGERED..');
      await checkMergeConflictsModule.checkMergeConflictsInPullRequest(context, context.payload.pull_request);
    }
  });

  robot.on('pull_request.closed', async context => {
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase()) &&
      context.payload.pull_request.merged === true) {
      // eslint-disable-next-line no-console
      console.log(' A PR HAS BEEN MERGED..');
      await checkMergeConflictsModule.checkMergeConflictsInAllPullRequests(context);
    }
  });

  robot.on('pull_request_review.submitted', async context => {
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      // eslint-disable-next-line no-console
      console.log('A PR HAS BEEN REVIEWED..');
      await handlePrReviewModule.pullRequestReviewed(context);
    }
  });

  robot.on('schedule.repository', async context => {
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      // This check is triggered once every 24 hours by the scheduler.
      // eslint-disable-next-line no-console
      console.log('Periodic Checks...');
      await periodicChecksModule.assignReviewers(context);
    }
  });
};
