module.exports.checkProjectLabel = async function(context) {
  var pullRequest = context.payload.pull_request;
  var pullRequestNumber = pullRequest.number;

  // eslint-disable-next-line no-console
  console.log('RUNNING PROJECT LABEL CHECK ON PULL REQUEST ' +
    pullRequestNumber + ' ...');

  var projectLabel = context.payload.label.name.trim();
  var hasProjectLabel = projectLabel.toUpperCase().startsWith('PROJECT');

  // If the PR has a project label, assign the project owner
  // for the first-pass review of the PR and leave a top-level comment.
  if (hasProjectLabel) {
    // Check if project label is valid.

    // Please refer to https://regex101.com/r/IRWeSA/1 for explanation
    // of the below regular expression.
    var regExpForProjectLabel = /^([pP][rR][oO][jJ][eE][cC][tT].*@\s*\w+\s*)/;
    var projectLabelIsValid = regExpForProjectLabel.test(projectLabel);

    if (projectLabelIsValid) {
      var labelSubstrings = projectLabel.split('@');
      var projectOwner = labelSubstrings[labelSubstrings.length - 1].trim();

      var assigneeParams = context.issue({assignees: [projectOwner]});
      await context.github.issues.addAssigneesToIssue(assigneeParams);

      var commentParams = context.issue({body: 'Assigning @' + projectOwner +
        ' for the first-pass review of this pull request. Thanks!'});
      await context.github.issues.createComment(commentParams);
    } else {
      // There is some problem with the project label. Ping the dev workflow team
      // in a comment on the PR.
      var failedCommentParams = context.issue({body: 'Hi, @oppia/dev-workflow-team.' +
      ' The project label on this pull request seems to be invalid.' +
      ' Can you please take a look at this pull request? Thanks!'});
      await context.github.issues.createComment(failedCommentParams);
    }

    return;
  }

  // If no project label is found, no action is required.
}

module.exports.checkChangelogLabel = async function(context) {
  var pullRequest = context.payload.pull_request;
  var pullRequestNumber = pullRequest.number;

  // eslint-disable-next-line no-console
  console.log('RUNNING CHANGELOG LABEL CHECK ON PULL REQUEST ' +
    pullRequestNumber + ' ...');

  var labels = pullRequest.labels;
  var userName = pullRequest.user.login;
  var hasChangelogLabel = labels.some(function(label) {
    return label.name.trim().toUpperCase().startsWith('CHANGELOG');
  });

  // If the PR has a changelog label, no action is required.
  if (hasChangelogLabel) {
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
