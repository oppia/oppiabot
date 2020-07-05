const DEFAULT_CHANGELOG_LABEL = 'PR CHANGELOG: Miscellaneous -- @ankita240796';

var matchChangelogLabelWithRegex = function(changelogLabel) {
  // Please refer to https://regex101.com/r/Eo976S/3 for explanation
  // of the below regular expression.
  var regExpForChangelogLabel = (
    /^([pP][rR] [cC][hH][aA][nN][gG][eE][lL][oO][gG]: .* -- @\s*\w+\s*)/);
  return regExpForChangelogLabel.test(changelogLabel);
};

/**
 * @param {import('probot').Context} context
 */
module.exports.checkAssignee = async function(context) {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  var pullRequest = context.payload.pull_request;

  if (pullRequest.review_comments !== 0) {
    // We do not assign anyone to the pull request in this case since
    // a review is already done.
    return;
  }
  var pullRequestNumber = pullRequest.number;

  // eslint-disable-next-line no-console
  console.log(
    'RUNNING ASSIGNEE CHECK ON PULL REQUEST ' + pullRequestNumber + ' ...'
  );

  var changelogLabel = context.payload.label.name.trim();
  var hasChangelogLabel = changelogLabel.toUpperCase().startsWith(
    'PR CHANGELOG');

  // If the PR has a changelog label, assign the project owner
  // for the first-pass review of the PR and leave a top-level comment.
  if (hasChangelogLabel) {
    var changelogLabelIsValid = matchChangelogLabelWithRegex(changelogLabel);
    if (!changelogLabelIsValid) {
      // No action is taken here since a comment is already added initially
      // for invalid labels when a pull request is opened.
      return;
    }
    var labelSubstrings = changelogLabel.split('@');
    var projectOwner = labelSubstrings[labelSubstrings.length - 1].trim();

    var assignees = [];
    for (var i = 0; i < pullRequest.assignees.length; i++) {
      assignees.push(pullRequest.assignees[i].login);
    }

    if (
        projectOwner !== pullRequest.user.login &&
        !assignees.includes(projectOwner)) {
      var assigneeParams = context.issue({ assignees: [projectOwner] });
      await context.github.issues.addAssignees(assigneeParams);

      var commentParams = context.issue({
        body:
          'Assigning @' +
          projectOwner +
          ' for the first-pass review of this pull request. Thanks!',
      });
      await context.github.issues.createComment(commentParams);
    }
  }
  // If no changelog label is found, no action is required.
};

/**
 * @param {import('probot').Context} context
 */
module.exports.checkChangelogLabel = async function(context) {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} context
   */
  var pullRequest = context.payload.pull_request;
  var pullRequestNumber = pullRequest.number;

  // eslint-disable-next-line no-console
  console.log(
    'RUNNING CHANGELOG LABEL CHECK ON PULL REQUEST ' +
      pullRequestNumber +
      ' ...'
  );

  var labels = pullRequest.labels;
  var userName = pullRequest.user.login;
  var changelogLabel = '';
  var hasChangelogLabel = labels.some(function(label) {
    if (label.name.trim().toUpperCase().startsWith('PR CHANGELOG')) {
      changelogLabel = label.name.trim();
      return true;
    }
  });

  // If the PR has a changelog label, no action is required.
  if (hasChangelogLabel) {
    var changelogLabelIsValid = matchChangelogLabelWithRegex(changelogLabel);
    if (!changelogLabelIsValid) {
      // There is some problem with the changelog label. Ping the dev workflow team
      // in a comment on the PR.
      var failedCommentParams = context.issue({
        body:
          'Hi, @oppia/dev-workflow-team.' +
          ' The changelog label on this pull request seems to be invalid.' +
          ' Can you please take a look at this pull request? Thanks!',
      });
      await context.github.issues.createComment(failedCommentParams);
    }
    return;
  }

  var isCollaborator = context.github.repos.checkCollaborator({
    username: userName
  });

  if (!isCollaborator) {
    const labelParams = context.repo({
      issue_number: pullRequestNumber,
      labels: [DEFAULT_CHANGELOG_LABEL]
    });
    await context.github.issues.addLabels(labelParams);

    var commentParams = context.issue({
      body:
        'Hi, @' +
        userName +
        ', I have added a default changelog label to the pull request. Thanks!',
    });
    await context.github.issues.createComment(commentParams);
    return;
  }

  // If no changelog label is found, ping the author in the PR
  // thread and ask him/her to add a label.
  var stateCommentParams = context.issue({
    body:
      'Hi, @' +
      userName +
      ', this pull request does not have a "CHANGELOG: ..." label ' +
      'as mentioned in the PR checkbox list. Please add this label. ' +
      'PRs without this label will not be merged. If you are unsure ' +
      'of which label to add, please ask the reviewers for ' +
      'guidance. Thanks!',
  });
  await context.github.issues.createComment(stateCommentParams);
};
