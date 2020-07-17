const openEvent = 'opened';
const reopenEvent = 'reopened';
const unlabelEvent = 'unlabeled';
const PRLabelEvent = 'labeled';
const synchronizeEvent = 'synchronize';
const closeEvent = 'closed';
const editEvent = 'edited';
const issuesLabelEvent = 'issues_labeled';
const issuesAssignedEvent = 'issues_assigned';
const pushEvent = 'push';

const assignCodeowners = 'assignReviewers';
const claCheck = 'cla-check';
const changelogCheck = 'changelog-check';
const criticalLabelCheck = 'critical-label-check';
const prLabelCheck = 'pr-label-check';
// This check is required in re-open events as well to
// prevent user from reopening the PR.
const branchCheck = 'branch-check';
const wipCheck = 'wip-check';
const mergeConflictCheck = 'merge-conflict-check';
const allMergeConflictCheck = 'all-merge-conflict-check';
const jobCheck = 'job-check';
const issuesLabelCheck = 'issues-labeled-check';
const issuesAssignedCheck = 'issues-assigned-check';
const forcePushCheck = 'force-push-check';

const checksWhitelist = {
  'oppia-android': {
    [openEvent]: [claCheck],
    [reopenEvent]: [],
    [PRLabelEvent]: [],
    [synchronizeEvent]: [],
    [closeEvent]: [],
    [editEvent]: [],
    [issuesLabelEvent]: []
  },
  'oppia': {
    [openEvent]: [
      claCheck,
      assignCodeowners,
      changelogCheck,
      branchCheck,
      wipCheck,
      jobCheck,
    ],
    [reopenEvent]: [changelogCheck, branchCheck, wipCheck, jobCheck],
    [PRLabelEvent]: [prLabelCheck],
    [synchronizeEvent]: [mergeConflictCheck, jobCheck],
    [closeEvent]: [allMergeConflictCheck],
    [editEvent]: [wipCheck],
    [issuesLabelEvent]: [issuesLabelCheck],
    [issuesAssignedEvent]: [issuesAssignedCheck],
    [unlabelEvent]: [criticalLabelCheck],
    [pushEvent]: [forcePushCheck]
  },
  'oppiabot': {
    [openEvent]: [claCheck],
    [reopenEvent]: [],
    [synchronizeEvent]: [mergeConflictCheck],
    [closeEvent]: [allMergeConflictCheck],
    [editEvent]: [],
    [issuesLabelEvent]: [],
    [issuesAssignedEvent]: [],
    [pushEvent]: []
  }
};

module.exports.openEvent = openEvent;
module.exports.reopenEvent = reopenEvent;
module.exports.unlabelEvent = unlabelEvent;
module.exports.PRLabelEvent = PRLabelEvent;
module.exports.synchronizeEvent = synchronizeEvent;
module.exports.closeEvent = closeEvent;
module.exports.editEvent = editEvent;
module.exports.issuesLabelEvent = issuesLabelEvent;
module.exports.issuesAssignedEvent = issuesAssignedEvent;
module.exports.pushEvent = pushEvent;

module.exports.assignCodeowners = assignCodeowners;
module.exports.claCheck = claCheck;
module.exports.changelogCheck = changelogCheck;
module.exports.branchCheck = branchCheck;
module.exports.wipCheck = wipCheck;
module.exports.mergeConflictCheck = mergeConflictCheck;
module.exports.allMergeConflictCheck = allMergeConflictCheck;
module.exports.jobCheck = jobCheck;
module.exports.issuesLabelCheck = issuesLabelCheck;
module.exports.issuesAssignedCheck = issuesAssignedCheck;
module.exports.criticalLabelCheck = criticalLabelCheck;
module.exports.prLabelCheck = prLabelCheck;
module.exports.forcePushCheck = forcePushCheck;

module.exports.getChecksWhitelist = function() {
  return checksWhitelist;
};
