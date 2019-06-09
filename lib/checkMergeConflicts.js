const mergeConflictLabel = ['PR: don\'t merge - HAS MERGE CONFLICTS'];

module.exports.checkMergeConflictsInPullRequest = async function(context, pullRequest) {
  var hasMergeConflictLabel = false;
  var pullRequestNumber = pullRequest.number;

  console.log(
    'CHECKING PR NUMBER ' + pullRequestNumber + ' FOR MERGE CONFLICTS..');

  var labels = pullRequest.labels;
  for (var label in labels) {
    if (labels[label].name === mergeConflictLabel[0]) {
      hasMergeConflictLabel = true;
      break;
    }
  }

  var isMergeable = pullRequest.mergeable;

  if (hasMergeConflictLabel === false && isMergeable === false) {
    var userName = pullRequestDetails.user.login;
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
    await context.github.issues.addLabels(context.repo({
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
};

module.exports.checkMergeConflictsInAllPullRequests = async function(context) {
  var pullRequestsPromiseObj = await context.github.pullRequests.getAll(
    context.repo({per_page: 60}));

  var arrayOfOpenPullRequests = pullRequestsPromiseObj.data;
  for (var indexOfPullRequest in arrayOfOpenPullRequests) {
    var pullRequestNumber = arrayOfOpenPullRequests[
      indexOfPullRequest].number;
    var pullRequestDetailsPromiseObj = await context.github.pullRequests.get(
      context.repo({number: pullRequestNumber}));
    var pullRequestDetails = pullRequestDetailsPromiseObj.data;
    this.checkMergeConflictsInPullRequest(context, pullRequestDetails);
  }
};
