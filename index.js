const createScheduler = require('probot-scheduler');
const apiForSheetsModule = require('./lib/apiForSheets');
const checkMergeConflictsModule = require('./lib/checkMergeConflicts');
const whitelistedAccounts = (
  (process.env.WHITELISTED_ACCOUNTS || '').toLowerCase().split(','));
var pullRequestAuthor;

module.exports = (robot) => {
  scheduler = createScheduler(robot, {
    delay: !process.env.DISABLE_DELAY,
    interval: 60 * 60 * 1000 * 24 * 3 // 3 days
  });

  robot.on('issue_comment.created', async context => {
    if (
      whitelistedAccounts.includes(context.repo().owner.toLowerCase()) &&
      context.isBot === false) {
      const userName = context.payload.comment.user.login;
      if (pullRequestAuthor === userName) {
        apiForSheetsModule.apiForSheets(userName, context, false);
      }
    }
  });

  robot.on('pull_request.opened', async context => {
    if (
      whitelistedAccounts.includes(context.repo().owner.toLowerCase()) &&
      context.isBot === false) {
      const userName = context.payload.pull_request.user.login;
      pullRequestAuthor = userName;
      apiForSheetsModule.apiForSheets(userName, context, true);
    }
  });

  robot.on('schedule.repository', async context => {
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      await checkMergeConflictsModule.checkMergeConflicts(context);
    }
  });
};
