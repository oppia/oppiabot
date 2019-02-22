module.exports.assignReviewers = async function(context) {
  pullRequestsPromiseObj = await context.github.pullRequests.getAll(
    context.repo({per_page: 40}));
  arrayOfOpenPullRequests = pullRequestsPromiseObj.data;
  for (var indexOfPullRequest in arrayOfOpenPullRequests) {
    pullRequestNumber = arrayOfOpenPullRequests[
      indexOfPullRequest].number;
    pullRequestDetailsPromiseObj = await context.github.pullRequests.get(
      context.repo({number: pullRequestNumber}));

    pullRequestDetails = pullRequestDetailsPromiseObj.data;
    pullRequestCreated = pullRequestDetails.created_at;
    var cur_time = new Date();
    pullRequestOpenedForInHours = Math.abs(cur_time.getTime() - Date.parse(pullRequestCreated)) / 36e5;
    requested_teams = pullRequestDetails.requested_teams;
    requested_reviewers = pullRequestDetails.requested_reviewers;

    if (requested_reviewers == [] && requested_teams == [] &&
      pullRequestOpenedForInHours > 24) {
      var params = context.repo({
        number: pullRequestNumber,
        team_reviewers: ["dev-workflow-team"]
      });
      await context.github.pullRequests.createReviewRequest(params);
    }
  }
};
