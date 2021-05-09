// Copyright 2020 The Oppia Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const openEvent = 'opened';
// Github action sends a different type of event.
const openEventGithubActions = 'pull_request_target_opened';
const reopenEventGithubActions = 'pull_request_target_reopened';
const reopenEvent = 'pull_request_reopened';
const unlabelEvent = 'unlabeled';
const PRLabelEvent = 'pull_request_labeled';
const synchronizeEvent = 'synchronize';
const closeEvent = 'closed';
const editEvent = 'edited';
const issuesLabelEvent = 'issues_labeled';
const issuesAssignedEvent = 'issues_assigned';
const pushEvent = 'push';
const pullRequestReviewEvent = 'pr_review';
const checkCompletedEvent = 'check_completed';
const periodicCheckEvent = 'periodic-check-event';
const issueCommentCreatedEvent = 'comment_created';

const periodicCheck = 'periodic-check';
const claCheck = 'cla-check';
const claCheckGithubAction = 'cla-check-github-action';
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
const cronJobCheck = 'cron-job-check';
const modelCheck = 'model-check';
const issuesLabelCheck = 'issues-labeled-check';
const issuesAssignedCheck = 'issues-assigned-check';
const forcePushCheck = 'force-push-check';
const pullRequestReviewCheck = 'pr-review-check';
const codeOwnerCheck = 'code-owner-check';
const ciFailureCheck = 'ci-failure-check';
const updateWithDevelopCheck = 'update-with-develop-check';
const respondToReviewCheck = 'respond-to-review-check';
const oldBuildLabelCheck = 'old-build-label-check';

const checksWhitelist = {
  // eslint-disable-next-line quote-props
  'oppia-android': {
    [openEvent]: [claCheck],
    [reopenEvent]: [],
    [PRLabelEvent]: [],
    [synchronizeEvent]: [],
    [closeEvent]: [],
    [editEvent]: [],
    [issuesLabelEvent]: [],
    [pullRequestReviewEvent]: [pullRequestReviewCheck],
    [issueCommentCreatedEvent]: [respondToReviewCheck],
  },
  // eslint-disable-next-line quote-props
  'oppia': {
    [openEvent]: [
      claCheck,
      changelogCheck,
      codeOwnerCheck,
      branchCheck,
      wipCheck,
      jobCheck,
      cronJobCheck,
      modelCheck,
      prTemplateCheck
    ],
    [openEventGithubActions]: [claCheckGithubAction],
    [reopenEventGithubActions]: [claCheckGithubAction],
    [reopenEvent]: [
      changelogCheck,
      claCheckGithubAction,
      branchCheck,
      wipCheck,
      jobCheck,
      cronJobCheck,
      modelCheck,
      prTemplateCheck
    ],
    [PRLabelEvent]: [assigneeCheck, prLabelCheck],
    [synchronizeEvent]: [
      mergeConflictCheck,
      jobCheck,
      cronJobCheck,
      modelCheck,
      codeOwnerCheck,
      oldBuildLabelCheck
    ],
    [closeEvent]: [allMergeConflictCheck, updateWithDevelopCheck],
    [editEvent]: [wipCheck],
    [issuesLabelEvent]: [issuesLabelCheck],
    [issuesAssignedEvent]: [issuesAssignedCheck],
    [unlabelEvent]: [datastoreLabelCheck],
    [pushEvent]: [forcePushCheck],
    [periodicCheckEvent]: [periodicCheck],
    [pullRequestReviewEvent]: [pullRequestReviewCheck],
    [checkCompletedEvent]: [ciFailureCheck],
    [issueCommentCreatedEvent]: [respondToReviewCheck]
  },
  // eslint-disable-next-line quote-props
  'oppiabot': {
    [openEvent]: [claCheck],
    [reopenEvent]: [],
    [synchronizeEvent]: [mergeConflictCheck],
    [closeEvent]: [allMergeConflictCheck],
    [editEvent]: [],
    [issuesLabelEvent]: [],
    [issuesAssignedEvent]: [],
    [pushEvent]: [],
    [pullRequestReviewEvent]: [pullRequestReviewCheck],
    [issueCommentCreatedEvent]: [respondToReviewCheck],
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
module.exports.periodicCheckEvent = periodicCheckEvent;
module.exports.issueCommentCreatedEvent = issueCommentCreatedEvent;

module.exports.periodicCheck = periodicCheck;
module.exports.claCheck = claCheck;
module.exports.claCheckGithubAction = claCheckGithubAction;
module.exports.changelogCheck = changelogCheck;
module.exports.branchCheck = branchCheck;
module.exports.wipCheck = wipCheck;
module.exports.assigneeCheck = assigneeCheck;
module.exports.mergeConflictCheck = mergeConflictCheck;
module.exports.allMergeConflictCheck = allMergeConflictCheck;
module.exports.jobCheck = jobCheck;
module.exports.cronJobCheck = cronJobCheck;
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
module.exports.respondToReviewCheck = respondToReviewCheck;
module.exports.oldBuildLabelCheck = oldBuildLabelCheck;

module.exports.getBlacklistedAuthors = function() {
  return blacklistedAuthors;
};

module.exports.getChecksWhitelist = function() {
  return checksWhitelist;
};
