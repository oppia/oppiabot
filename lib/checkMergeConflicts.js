module.exports.checkMergeConflicts = async function(context) {
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
    // eslint-disable-next-line no-console
    console.log(
      'CHECKING PR NUMBER ' + pullRequestNumber + ' FOR MERGE CONFLICTS..');
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
            '. Due to recent changes in the "develop" branch, ' +
            'this PR now has a merge conflict. ' +
            'Please follow this ' + linkResult +
            ' if you need help resolving the conflict, ' +
            'so that the PR can be merged. Thanks!'});
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
