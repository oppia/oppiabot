exports.checkBranch = async function checkBranch(context) {
  const pullRequest = context.payload.pull_request;
  const userBranch = pullRequest.head.ref;
  const username = pullRequest.user.login;

  if ((userBranch.toLowerCase() === 'develop') ||
      userBranch.startsWith('release-') || userBranch.startsWith('test-')) {
    const stateCommentParams = context.issue({
      body: `Hi @${username}, PR’s made from the develop/release/test branch
        is not allowed. I’ll be closing this. Please make your changes
        in another branch and send in a PR.`
    });
    const updatePRParams = context.issue({
      state: 'closed'
    });
    // eslint-disable-next-line no-console
    console.log('Updating pull request');

    await context.github.issues.createComment(stateCommentParams);
    await context.github.issues.edit(updatePRParams);
  }
};

