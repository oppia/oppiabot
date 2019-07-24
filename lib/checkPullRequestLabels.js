module.exports.checkPullRequestLabels = function(context) {
    var pullRequest = context.payload.pull_request;
    var pullRequestNumber = pullRequest.number;

    // eslint-disable-next-line no-console
    console.log('RUNNING LABEL CHECKS ON PULL REQUEST ' + pullRequestNumber + ' ...');

    var labels = pullRequest.labels;
    var userName = pullRequest.user.login;
    var projectOwnerLabel;
    var hasProjectOwnerLabel = labels.some(function(label) {
        projectOwnerLabel = label;
        return label.startsWith('PROJECT');
    });

    // If the PR has a project owner label, assign the project owner
    // for the first-pass review of the PR and leave a top-level comment.
    if(hasProjectOwnerLabel === true) {
        var labelSubstrings = projectOwnerLabel.split('@');
        var projectOwner = labelSubstrings[labelSubstrings.length-1].trim();
        var PRAssignees = [projectOwner];

        var assigneeParams = context.issues({assignees: PRAssignees});
        await context.github.issues.addAssignees(assigneeParams);

        var commentParams = context.issues({body: 'Assigning @' + projectOwner +
            ' for the first-pass review of this pull request. Thanks!'});
        await context.github.issues.createComment(commentParams);
        return;
    }

    // If no project owner label is found, close the PR.
    // Ask the author to add the label and re-open it.
    var stateParams = context.issues({state: 'closed'});
    await context.github.issues.edit({stateParams});

    var stateCommentParams = context.issues({body: 'Hi, @' + userName +
        '. This pull request has been closed since it does have a project ' +
        'owner label. Please add this label and re-open the pull request.'});
    await context.github.issues.createComment(stateCommentParams);
}
