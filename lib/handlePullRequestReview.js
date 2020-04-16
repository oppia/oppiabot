const CHANGES_REQUESTED = 'changes_requested';

module.exports.pullRequestReviewed = async (context) => {
  const review = context.payload.review;
  const prAuthor = context.payload.pull_request.user;

  if (review.state === CHANGES_REQUESTED) {
    // assign PR author to PR
    const assigneeParams = context.issue({
      assignees: [prAuthor.login]
    });

    context.github.issues.addAssigneesToIssue(assigneeParams);
  }
};
