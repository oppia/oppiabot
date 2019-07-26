module.exports.checkProjectLabel = async function(context) {
  var pullRequest = context.payload.pull_request;
  var pullRequestNumber = pullRequest.number;

  // eslint-disable-next-line no-console
  console.log('RUNNING PROJECT LABEL CHECK ON PULL REQUEST ' +
    pullRequestNumber + ' ...');

  var labels = pullRequest.labels;
  var userName = pullRequest.user.login;
  var projectLabel;
  var hasProjectLabel = labels.some(function(label) {
    projectLabel = label.name.trim();
    return projectLabel.toUpperCase().startsWith('PROJECT');
  });

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

  // If no project label is found, close the PR.
  // Ask the author to add the label and re-open it.
  var stateParams = context.issue({state: 'closed'});
  await context.github.issues.edit(stateParams);

  var gitter = 'Gitter', gitterLink = gitter.link('https://gitter.im/oppia/oppia-chat');
  var stateCommentParams = context.issue({body: 'Hi, @' + userName +
    '. This pull request has been closed since it does not have a project ' +
    'label as mentioned in the PR checkbox list. Please add this label ' +
    'and re-open the pull request. If you are unsure about the project ' +
    'label, please feel free to ask on ' + gitterLink + '. Thanks!'});
  await context.github.issues.createComment(stateCommentParams);
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

  // If no changelog label is found, close the PR.
  // Ask the author to add the label and re-open it.
  var stateParams = context.issue({state: 'closed'});
  await context.github.issues.edit(stateParams);

  var stateCommentParams = context.issue({body: 'Hi, @' + userName +
    '. This pull request has been closed since it does not have ' +
    'a "CHANGELOG: ..." label as mentioned in the PR checkbox list. ' +
    'Please add this label and re-open the pull request. If you ' +
    'are unsure of which label to add, please ask the reviewers for ' +
    'guidance. Thanks!'});
  await context.github.issues.createComment(stateCommentParams);
}

module.exports.checkPullRequestLabels = async function(context) {
  var pullRequest = context.payload.pull_request;
  var pullRequestNumber = pullRequest.number;

  // eslint-disable-next-line no-console
  console.log('RUNNING LABEL CHECKS ON PULL REQUEST ' + pullRequestNumber + ' ...');

  this.checkProjectLabel(context);
  this.checkChangelogLabel(context);
}
