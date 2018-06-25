const createScheduler = require('probot-scheduler');
const apiForSheetsModule = require('./lib/apiForSheets');
const checkMergeConflictsModule = require('./lib/checkMergeConflicts');
var pullRequestAuthor;

module.exports = (robot) => {
  scheduler = createScheduler(robot, {
    delay: !process.env.DISABLE_DELAY,
    interval: 60 * 60 * 1000 * 24 * 3 // 3 days
  });

  robot.on('issue_comment.created', async context => {
    if (context.isBot === false) {
      const userName = context.payload.comment.user.login;
      if (pullRequestAuthor === userName) {
        apiForSheetsModule.apiForSheets(userName, context, false);
      }
    }
  });

  robot.on('pull_request.opened', async context => {
    if (context.isBot === false) {
      const userName = context.payload.pull_request.user.login;
      pullRequestAuthor = userName;
      apiForSheetsModule.apiForSheets(userName, context, true);
    }
  });

  /*robot.on('schedule.repository', async context => {
    await checkMergeConflictsModule.checkMergeConflicts(context);
  });*/
};
