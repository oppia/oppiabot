const assignUnassignedReviewers = async (pullRequest, context) => {
  const assignees = pullRequest.assignees.map(user => user.login);
  const reviewers = pullRequest.requested_reviewers.map(user => user.login);

  // If the PR author is assigned, then don't assign other reviewers.
  if (assignees.includes(pullRequest.user.login)) {
    return;
  }

  let botComment = 'Hey ';
  const prParams = context.repo(
    {
      number: pullRequest.number,
    }
  );

  const unassignedReviewers = reviewers.filter(reviewer => {
    if (!assignees.includes(reviewer)) {
      botComment += `@${reviewer}, `;
      return true;
    }
  });
  if (unassignedReviewers.length > 0) {
    await context.github.issues.addAssigneesToIssue(
      { ...prParams, assignees: unassignedReviewers });

    // Ping newly assigned reviewers.
    botComment += 'this PR is waiting for your review, can you PTAL? Thanks!';
    await context.github.issues.createComment(
      { ...prParams, body: botComment });
  }
};

module.exports.assignReviewers = async (context) => {
  // By default, this returns only open PRs.
  const pullRequestsPromiseObj = await context.github.pullRequests.getAll(
    context.repo({ per_page: 60 })
  );

  const arrayOfOpenPullRequests = pullRequestsPromiseObj.data;

  arrayOfOpenPullRequests.forEach(async (pullRequest) => {
    const pullRequestDetailsPromise = await context.github.pullRequests.get(
      context.repo({ number: pullRequest.number })
    );
    const pullRequestDetails = pullRequestDetailsPromise.data;
    await assignUnassignedReviewers(pullRequestDetails, context);
  });
};
