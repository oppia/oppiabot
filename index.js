require ('newrelic');
const createScheduler = require('probot-scheduler');
const apiForSheetsModule = require('./lib/apiForSheets');
const checkMergeConflictsModule = require('./lib/checkMergeConflicts');
const whitelistedAccounts = (
  (process.env.WHITELISTED_ACCOUNTS || '').toLowerCase().split(','));
var pullRequestAuthor;

module.exports = (robot) => {
  scheduler = createScheduler(robot, {
    delay: !process.env.DISABLE_DELAY,
    interval: 60 * 60 * 1000 // 1 hour
  });

  robot.on('schedule.repository', async context => {
    if (
      whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      await checkMergeConflictsModule.checkMergeConflicts(context);
      if (context.isBot === false) {
        const userName_issue_comment = context.payload.comment.user.login;
        if (pullRequestAuthor === userName_issue_comment) {
          apiForSheetsModule.apiForSheets(userName_issue_comment, context, false);
        }
        const userName_pull_request = context.payload.pull_request.user.login;
        pullRequestAuthor = userName_pull_request;
        apiForSheetsModule.apiForSheets(userName_pull_request, context, true);
      }
    }
  });
};
