const assignUnAssignedReviewers = async (pullRequest, context) => {
  const assignees = pullRequest.assignees.map(user => user.login);
  const reviewers = pullRequest.requested_reviewers.map(user => user.login);

  let botComment = 'PTAL ';
  const prParams = context.repo(
    {
      number: pullRequest.number,
    }
  );

  const unAssignedReviewers = reviewers.filter(reviewer => {
    if (!assignees.includes(reviewer)) {
      botComment += `@${reviewer} `;
      return true;
    }
  });
  if (unAssignedReviewers.length > 0) {
    await context.github.issues.addAssigneesToIssue(
      { ...prParams, assignees: unAssignedReviewers });

    // Ping newly assigned reviewers.
    await context.github.issues.createComment(
      { ...prParams, body: botComment });
  }
};

module.exports.assignReviewers = async (context) => {
  // By default, this returns only open PRs
  const pullRequestsPromiseObj = await context.github.pullRequests.getAll(
    context.repo({ per_page: 60 })
  );

  const arrayOfOpenPullRequests = pullRequestsPromiseObj.data;

  arrayOfOpenPullRequests.forEach(async (pullRequest) => {
    const pullRequestDetailsPromise = await context.github.pullRequests.get(
      context.repo({ number: pullRequest.number })
    );
    const pullRequestDetails = pullRequestDetailsPromise.data;
    await assignUnAssignedReviewers(pullRequestDetails, context);
  });
};
