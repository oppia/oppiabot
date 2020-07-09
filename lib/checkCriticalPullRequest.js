const {
  getAllChangedFiles,
  hasCriticalLabel,
  CRITICAL_LABEL,
} = require('./checkPullRequestJob');
const { teamLeads } = require('../userWhitelist.json');
const STORAGE_DIR_PREFIX = 'core/storage/';

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem} file
 */
const getNewModelsFromFile = (file) => {
  const newLine = '\n';
  const changesArray = file.patch.split(newLine);
  const modelRegex = /(?<addition>\+)(?<classDefinition>class\s)(?<modelName>[a-zA-Z]{2,256})(?<modelSuffix>Model)(?<funDef>\()/;

  const newModelDefinitions = changesArray.filter(change => {
    const matches = modelRegex.exec(change);
    return matches !== null;
  });

  const newModels = newModelDefinitions.map(definition => {
    const matches = modelRegex.exec(definition);
    return matches.groups.modelName + matches.groups.modelSuffix;
  });

  return newModels;
};

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem} file
 */
const addsNewModel = (file) => {
  const newModels = getNewModelsFromFile(file);
  return newModels.length > 0;
};

/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} newModelFiles
 */
const getModelNameString = (newModelFiles) => {
  let modelNameString = '';
  let totalNumberOfModels = 0;

  let modelNameArray = newModelFiles.map(file => {
    const newModelNames = getNewModelsFromFile(file);
    totalNumberOfModels += newModelNames.length;
    return (newModelNames.join(', ')).link(file.blob_url);
  });

  if (totalNumberOfModels === 1) {
    modelNameString = ' The name of the model is ' + modelNameArray[0] + '.';
  } else {
    modelNameString = ' The models are ' + modelNameArray.join(', ') + '.';
  }

  return modelNameString;
};

/**
 * @param {string} filename
 */
const isInStorageDir = (filename) => {
  return filename.startsWith(STORAGE_DIR_PREFIX);
};


/**
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} newModelFiles
 * @param {import('probot').Octokit.PullsListFilesResponseItem[]} changedFiles
 * @param {string} prAuthor - Author of the Pull Request
 */
const getCommentBody = (newModelFiles) => {
  const modelNameString = getModelNameString(newModelFiles);
  const newLineFeed = '<br>';

  // This function will never be called when there are no model files.
  if (newModelFiles.length === 1) {
    const message = 'Hi @' + teamLeads.releaseTeam + ', PTAL at this PR, ' +
      'it adds a model.' + modelNameString + newLineFeed +'Thanks!';

    return message;
  } else {
    const message = 'Hi @' + teamLeads.releaseTeam + ', PTAL at this PR, ' +
      'it adds new models.' + modelNameString + newLineFeed +'Thanks!';

    return message;
  }
};


/**
 * @param {import('probot').Context} context
 */
const checkIfCritical = async (context) => {
  /**
   * @type {import('probot').Octokit.PullsGetResponse} pullRequest
   */
  const pullRequest = context.payload.pull_request;

  if (!hasCriticalLabel(pullRequest)) {
    const changedFiles = await getAllChangedFiles(context);

    // Get new models that were created in the PR.
    const newModelFiles = changedFiles.filter((file) => {
      return isInStorageDir(file.filename) && addsNewModel(file);
    });

    if (newModelFiles.length > 0) {
      const commentBody = getCommentBody(
        newModelFiles
      );

      const commentParams = context.repo({
        issue_number: pullRequest.number,
        body: commentBody,
      });
      await context.github.issues.createComment(commentParams);

      const labelParams = context.repo({
        issue_number: pullRequest.number,
        labels: [CRITICAL_LABEL],
      });
      await context.github.issues.addLabels(labelParams);

      const assigneeParams = context.repo({
        issue_number: pullRequest.number,
        assignees: [teamLeads.releaseTeam],
      });
      await context.github.issues.addAssignees(assigneeParams);
    }
  }
};

module.exports = {
  checkIfCritical
}
