module.exports.checkTitleForWIP = async function(context) {
  var pullRequest = context.payload.pull_request;
  var pullRequestNumber = pullRequest.number;

  // eslint-disable-next-line no-console
  console.log(
    'CHECKING PR NUMBER ' + pullRequestNumber + ' FOR WIP IN TITLE..');

  if (pullRequest.title.includes('WIP')) {
    var userName = pullRequest.user.login;
    var linkText = 'wiki';
    var link = linkText.link(
      'https://github.com/oppia/oppia/wiki/WIP-PRs');
    var params = context.repo({
      number: pullRequestNumber,
      body: 'Hi @' + userName + ' ' +
          'We typically do not want WIP PRs ' +
          'Please refer to our ' + link +'. Thanks!'});
    await context.github.issues.createComment(params);
  }
};
