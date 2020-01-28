var matchChangelogLabelWithRegex = function(changelogLabel) {
  // Please refer to https://regex101.com/r/Eo976S/3 for explanation
  // of the below regular expression.
  var regExpForChangelogLabel = (
    /^([pP][rR] [cC][hH][aA][nN][gG][eE][lL][oO][gG]: .* -- @\s*\w+\s*)/);
  return regExpForChangelogLabel.test(changelogLabel);
}

module.exports.checkAssignee = async function(context) {
  var pullRequest = context.payload.pull_request;
  var pullRequestNumber = pullRequest.number;

  // eslint-disable-next-line no-console
  console.log('RUNNING ASSIGNEE CHECK ON PULL REQUEST ' +
    pullRequestNumber + ' ...');

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

    if (projectOwner !== pullRequest.user.login) {
      var assigneeParams = context.issue({assignees: [projectOwner]});
      await context.github.issues.addAssigneesToIssue(assigneeParams);

      var commentParams = context.issue({body: 'Assigning @' + projectOwner +
        ' for the first-pass review of this pull request. Thanks!'});
      await context.github.issues.createComment(commentParams);
    }
    return;
  }
  // If no changelog label is found, no action is required.
}

module.exports.checkChangelogLabel = async function(context) {
  var pullRequest = context.payload.pull_request;
  var pullRequestNumber = pullRequest.number;

  // eslint-disable-next-line no-console
  console.log('RUNNING CHANGELOG LABEL CHECK ON PULL REQUEST ' +
    pullRequestNumber + ' ...');

  var labels = pullRequest.labels;
  var userName = pullRequest.user.login;
  var changelogLabel = '';
  var hasChangelogLabel = labels.some(function(label) {
    if (label.name.trim().toUpperCase().startsWith('PR CHANGELOG')) {
      changelogLabel = label.name.trim()
      return true;
    }
  });

  // If the PR has a changelog label, no action is required.
  if (hasChangelogLabel) {
    var changelogLabelIsValid = matchChangelogLabelWithRegex(changelogLabel);
    if (!changelogLabelIsValid) {
      // There is some problem with the changelog label. Ping the dev workflow team
      // in a comment on the PR.
      var failedCommentParams = context.issue({body: 'Hi, @oppia/dev-workflow-team.' +
      ' The changelog label on this pull request seems to be invalid.' +
      ' Can you please take a look at this pull request? Thanks!'});
      await context.github.issues.createComment(failedCommentParams);
    }
    return;
  }

  // If no changelog label is found, ping the author in the PR
  // thread and ask him/her to add a label.
  var stateCommentParams = context.issue({body: 'Hi, @' + userName +
    '. This pull request does not have a "CHANGELOG: ..." label '+
    'as mentioned in the PR checkbox list. Please add this label. ' +
    'PRs without this label will not be merged. If you are unsure ' +
    'of which label to add, please ask the reviewers for ' +
    'guidance. Thanks!'});
  await context.github.issues.createComment(stateCommentParams);
}
