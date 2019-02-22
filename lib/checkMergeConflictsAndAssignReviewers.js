module.exports.checkMergeConflictsAndAssignReviewers = async function(context) {
  var mergeConflictLabel = ['PR: don\'t merge - HAS MERGE CONFLICTS'];
  pullRequestsPromiseObj = await context.github.pullRequests.getAll(
    context.repo({per_page: 40}));

  arrayOfOpenPullRequests = pullRequestsPromiseObj.data;
  var hasMergeConflictLabel;
  for (var indexOfPullRequest in arrayOfOpenPullRequests) {
    pullRequestNumber = arrayOfOpenPullRequests[
      indexOfPullRequest].number;
    pullRequestDetailsPromiseObj = await context.github.pullRequests.get(
      context.repo({number: pullRequestNumber}));

    pullRequestDetails = pullRequestDetailsPromiseObj.data;
    hasMergeConflictLabel = false;
    labels = pullRequestDetails.labels;
    for (var label in labels) {
      if (labels[label].name === mergeConflictLabel[0]) {
        hasMergeConflictLabel = true;
        break;
      }
    }

    isMergeable = pullRequestDetails.mergeable;

    if (hasMergeConflictLabel === false && isMergeable === false) {
      userName = pullRequestDetails.user.login;
      var linkText = 'link';
      var linkResult = linkText.link(
        'https://help.github.com/articles/resolving-a-merge-conflict-using-the-command-line/');
      var params_check_conflicts = context.repo({
        number: pullRequestNumber,
        body: 'Hi @' + userName +
            '. Due to recent changes in the "develop" branch, ' +
            'this PR now has a merge conflict. ' +
            'Please follow this ' + linkResult +
            ' if you need help resolving the conflict, ' +
            'so that the PR can be merged. Thanks!'});
      labelPromiseObj = await context.github.issues.addLabels(context.repo({
        number: pullRequestNumber,
        labels: mergeConflictLabel}));
      await context.github.issues.createComment(params_check_conflicts);
    }

    if (hasMergeConflictLabel === true && isMergeable === true) {
      await context.github.issues.removeLabel(context.repo({
        number: pullRequestNumber,
        name: mergeConflictLabel[0]
      }));
    }

    pullRequestCreated = pullRequestDetails.created_at;
    var cur_time = new Date();
    pullRequestOpenedForInHours = Math.abs(cur_time.getTime() - Date.parse(pullRequestCreated)) / 36e5;
    requested_teams = pullRequestDetails.requested_teams;
    requested_reviewers = pullRequestDetails.requested_reviewers;

    if (requested_reviewers == [] && requested_teams == [] &&
      pullRequestOpenedForInHours > 24) {
      var params_assign_reviewers = context.repo({
        number: pullRequestNumber,
        team_reviewers: ["dev-workflow-team"]
      });
      await context.github.pullRequests.createReviewRequest(params_assign_reviewers);
    }
  }
};
