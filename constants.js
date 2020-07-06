const openEvent = 'opened';
const reopenEvent = 'reopened';
const labelEvent = 'labeled';
const synchronizeEvent = 'synchronize';
const closeEvent = 'closed';
const editEvent = 'edited';
const issuesLabelEvent = 'issues_labeled';
const issuesAssignedEvent = 'issues_assigned';
const pushEvent = 'push';

const claCheck = 'cla-check';
const changelogCheck = 'changelog-check';
// This check is required in re-open events as well to
// prevent user from reopening the PR.
const branchCheck = 'branch-check';
const wipCheck = 'wip-check';
const assigneeCheck = 'assignee-check';
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
    [labelEvent]: [],
    [synchronizeEvent]: [],
    [closeEvent]: [],
    [editEvent]: [],
    [issuesLabelEvent]: []
  },
  'oppia': {
    [openEvent]: [claCheck, changelogCheck, branchCheck, wipCheck, jobCheck],
    [reopenEvent]: [changelogCheck, branchCheck, wipCheck, jobCheck],
    [labelEvent]: [assigneeCheck],
    [synchronizeEvent]: [mergeConflictCheck, jobCheck],
    [closeEvent]: [allMergeConflictCheck],
    [editEvent]: [wipCheck],
    [issuesLabelEvent]: [issuesLabelCheck],
    [issuesAssignedEvent]: [issuesAssignedCheck],
    [pushEvent]: [forcePushCheck]
  },
  'oppiabot': {
    [openEvent]: [claCheck],
    [reopenEvent]: [],
    [synchronizeEvent]: [mergeConflictCheck],
    [closeEvent]: [allMergeConflictCheck],
    [editEvent]: []
  },
};

module.exports.openEvent = openEvent;
module.exports.reopenEvent = reopenEvent;
module.exports.labelEvent = labelEvent;
module.exports.synchronizeEvent = synchronizeEvent;
module.exports.closeEvent = closeEvent;
module.exports.editEvent = editEvent;
module.exports.issuesLabelEvent = issuesLabelEvent;
module.exports.issuesAssignedEvent = issuesAssignedEvent;
module.exports.pushEvent = pushEvent;

module.exports.claCheck = claCheck;
module.exports.changelogCheck = changelogCheck;
module.exports.branchCheck = branchCheck;
module.exports.wipCheck = wipCheck;
module.exports.assigneeCheck = assigneeCheck;
module.exports.mergeConflictCheck = mergeConflictCheck;
module.exports.allMergeConflictCheck = allMergeConflictCheck;
module.exports.jobCheck = jobCheck;
module.exports.issuesLabelCheck = issuesLabelCheck;
module.exports.issuesAssignedCheck = issuesAssignedCheck;
module.exports.forcePushCheck = forcePushCheck;

module.exports.getChecksWhitelist = function() {
  return checksWhitelist;
};
