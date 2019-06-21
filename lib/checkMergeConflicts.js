const mergeConflictLabel = 'PR: don\'t merge - HAS MERGE CONFLICTS';
const mergeConflictLabelArray = [mergeConflictLabel];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports.checkMergeConflictsInPullRequest = async function(context, pullRequest) {
  var hasMergeConflictLabel = false;
  var pullRequestNumber = pullRequest.number;

  // eslint-disable-next-line no-console
  console.log(
    'CHECKING PR NUMBER ' + pullRequestNumber + ' FOR MERGE CONFLICTS..');

  // eslint-disable-next-line no-console
  console.log(' IS PR MERGEABLE BEFORE POLLING? ' + pullRequest.mergeable);

  // The value of the mergeable attribute can be true, false, or null.
  // If the value is null, then GitHub has started a background job to compute the mergeability.
  // After giving the job time to complete, resubmit the request.
  // When the job finishes, a non-null value for the mergeable attribute will be observed in the response.
  // Therefore, we poll the request until a non-null value is observed as suggested here:
  // https://developer.github.com/v3/git/#checking-mergeability-of-pull-requests
  while (pullRequest.mergeable === null) {
    // Wait for 2 seconds before making another request.
    await sleep(2000);
    var pullRequestPromiseObj = await context.github.pullRequests.get(
      context.repo({number: pullRequestNumber}));
    pullRequest = pullRequestPromiseObj.data;
  }

  // eslint-disable-next-line no-console
  console.log(' IS PR MERGEABLE AFTER POLLING? ' + pullRequest.mergeable);

  var labels = pullRequest.labels;

  hasMergeConflictLabel = labels.some(function(label) {
    return label.name === mergeConflictLabel;
  });

  var isMergeable = pullRequest.mergeable;

  if (hasMergeConflictLabel === false && isMergeable === false) {
    var userName = pullRequest.user.login;
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
      labels: mergeConflictLabelArray}));
    await context.github.issues.createComment(params);
  }

  if (hasMergeConflictLabel === true && isMergeable === true) {
    await context.github.issues.removeLabel(context.repo({
      number: pullRequestNumber,
      name: mergeConflictLabel
    }));
  }
};

module.exports.checkMergeConflictsInAllPullRequests = async function(context) {
  // pullRequests.getAll(..) fetches atmost 30 PRs in a batch, by default.
  // Since we've seen increasing number of PRs in the past, this value has
  // been increased to 60 PRs in a batch.
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
