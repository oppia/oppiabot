module.exports.checkTitleForWIP = async function(context) {
  var pullRequest = context.payload.pull_request;
  var pullRequestNumber = pullRequest.number;

  // eslint-disable-next-line no-console
  console.log(
    'CHECKING PR NUMBER ' + pullRequestNumber + ' FOR WIP IN TITLE..');

  if (pullRequest.title.includes('WIP')) {
    var userName = pullRequest.user.login;
    var linkText = 'link';
    var linkA = linkText.link(
      'https://github.com/oppia/oppia/wiki/Setup-your-own-CircleCI-instance');
    var linkB = linkText.link(
      'https://github.com/oppia/oppia/wiki/Setup-your-own-Travis-instance');
    var params = context.repo({
      number: pullRequestNumber,
      body: 'Hi @' + userName +
          'We typically do not want WIP PRs since each ' +
          'push will make the Travis queue unnecessarily ' +
          'long. If you need to run automated tests, ' +
          'please see our guides:' +
          'Please follow this ' + linkA + ' and ' + linkB + ' ' +
          'on how to set that up. Thanks!'});
    await context.github.issues.createComment(params);
  }
};
