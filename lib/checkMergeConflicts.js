var checkMergeConflicts = async function(context) {
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
      var params = context.repo({
        number: pullRequestNumber,
        body: 'Hi @' + userName +
            '. The latest commit in this PR has resulted in ' +
            'a merge conflict. Please follow this ' + linkResult +
            ' if you need help to resolve the conflict. Thanks!'});
      labelPromiseObj = await context.github.issues.addLabels(context.repo({
        number: pullRequestNumber,
        labels: mergeConflictLabel}));
      await context.github.issues.createComment(params);
    }

    if (hasMergeConflictLabel === true && isMergeable === true) {
      await context.github.issues.removeLabel(context.repo({
        number: pullRequestNumber,
        name: mergeConflictLabel[0]
      }));
    }
  }
};

module.exports = checkMergeConflicts;
