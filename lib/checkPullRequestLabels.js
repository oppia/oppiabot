module.exports.checkPullRequestLabels = async function(context) {
  var pullRequest = context.payload.pull_request;
  var pullRequestNumber = pullRequest.number;

  // eslint-disable-next-line no-console
  console.log('RUNNING LABEL CHECKS ON PULL REQUEST ' + pullRequestNumber + ' ...');

  var labels = pullRequest.labels;
  var userName = pullRequest.user.login;
  var projectOwnerLabel;
  var hasProjectOwnerLabel = labels.some(function(label) {
    projectOwnerLabel = label.name;
    return projectOwnerLabel.startsWith('PROJECT');
  });

  // If the PR has a project owner label, assign the project owner
  // for the first-pass review of the PR and leave a top-level comment.
  if (hasProjectOwnerLabel) {
    var labelSubstrings = projectOwnerLabel.split('@');
    var projectOwner = labelSubstrings[labelSubstrings.length - 1].trim();

    var assigneeParams = context.issue({assignees: [projectOwner]});
    await context.github.issues.addAssigneesToIssue(assigneeParams);

    var commentParams = context.issue({body: 'Assigning @' + projectOwner +
      ' for the first-pass review of this pull request. Thanks!'});
    await context.github.issues.createComment(commentParams);
    return;
  }

  // If no project owner label is found, close the PR.
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
