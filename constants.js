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
const pullRequestReviewEvent = 'pr-review';
const checkCompletedEvent = 'check_completed';
const issueCommentCreatedEvent = 'comment_created';

const claCheck = 'cla-check';
const changelogCheck = 'changelog-check';
const datastoreLabelCheck = 'datastore-label-check';
const prLabelCheck = 'pr-label-check';
const prTemplateCheck = 'pr-template-check';
// This check is required in re-open events as well to
// prevent user from reopening the PR.
const branchCheck = 'branch-check';
const wipCheck = 'wip-check';
const assigneeCheck = 'assignee-check';
const mergeConflictCheck = 'merge-conflict-check';
const allMergeConflictCheck = 'all-merge-conflict-check';
const jobCheck = 'job-check';
const modelCheck = 'model-check';
const issuesLabelCheck = 'issues-labeled-check';
const issuesAssignedCheck = 'issues-assigned-check';
const forcePushCheck = 'force-push-check';
const pullRequestReviewCheck = 'pr-review-check';
const codeOwnerCheck = 'code-owner-check'
const ciFailureCheck = 'ci-failure-check';
const updateWithDevelopCheck = 'update-with-develop-check';
const respondToReviewCheck = 'respond-to-review-check';

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
      changelogCheck,
      branchCheck,
      wipCheck,
      jobCheck,
      modelCheck,
      prTemplateCheck
    ],
    [reopenEvent]: [
      changelogCheck,
      branchCheck,
      wipCheck,
      jobCheck,
      modelCheck,
      prTemplateCheck
    ],
    [PRLabelEvent]: [assigneeCheck, prLabelCheck],
    [synchronizeEvent]: [
      mergeConflictCheck,
      jobCheck,
      modelCheck,
      codeOwnerCheck
    ],
    [closeEvent]: [allMergeConflictCheck, updateWithDevelopCheck],
    [editEvent]: [wipCheck],
    [issuesLabelEvent]: [issuesLabelCheck],
    [issuesAssignedEvent]: [issuesAssignedCheck],
    [unlabelEvent]: [datastoreLabelCheck],
    [pushEvent]: [forcePushCheck],
    [pullRequestReviewEvent]: [pullRequestReviewCheck],
    [checkCompletedEvent]: [ciFailureCheck],
    [issueCommentCreatedEvent]: [respondToReviewCheck]
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
  },
};

const blacklistedAuthors = ['translatewiki'];

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
module.exports.pullRequestReviewEvent = pullRequestReviewEvent;
module.exports.checkCompletedEvent = checkCompletedEvent;
module.exports.issueCommentCreatedEvent = issueCommentCreatedEvent;

module.exports.claCheck = claCheck;
module.exports.changelogCheck = changelogCheck;
module.exports.branchCheck = branchCheck;
module.exports.wipCheck = wipCheck;
module.exports.assigneeCheck = assigneeCheck;
module.exports.mergeConflictCheck = mergeConflictCheck;
module.exports.allMergeConflictCheck = allMergeConflictCheck;
module.exports.jobCheck = jobCheck;
module.exports.modelCheck = modelCheck;
module.exports.issuesLabelCheck = issuesLabelCheck;
module.exports.issuesAssignedCheck = issuesAssignedCheck;
module.exports.datastoreLabelCheck = datastoreLabelCheck;
module.exports.prLabelCheck = prLabelCheck;
module.exports.prTemplateCheck = prTemplateCheck;
module.exports.forcePushCheck = forcePushCheck;
module.exports.pullRequestReviewCheck = pullRequestReviewCheck;
module.exports.codeOwnerCheck = codeOwnerCheck;
module.exports.ciFailureCheck = ciFailureCheck;
module.exports.updateWithDevelopCheck = updateWithDevelopCheck;
module.exports.respondToReviewCheck = respondToReviewCheck

module.exports.getBlacklistedAuthors = function() {
  return blacklistedAuthors;
};

module.exports.getChecksWhitelist = function() {
  return checksWhitelist;
};
