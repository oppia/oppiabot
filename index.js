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
    // The oppiabot runs only for repositories belonging to certain
    // whitelisted accounts. The whitelisted accounts are stored as an
    // env variable. context.repo().owner returns the owner of the
    // repository on which the bot has been installed.
    // This condition checks whether the owner account is included in
    // the whitelisted accounts.
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      await apiForSheetsModule.checkClaStatus(context);
    }
  });

  robot.on('schedule.repository', async context => {
    if (whitelistedAccounts.includes(context.repo().owner.toLowerCase())) {
      await checkMergeConflictsModule.checkMergeConflicts(context);
    }
  });
};
