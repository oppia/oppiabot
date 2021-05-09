// Copyright 2021 The Oppia Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview File to handle checks when a pull request is labeled.
 */

const core = require('@actions/core');
const { context, GitHub } = require('@actions/github');
const DONT_MERGE_LABEL_PREFIX = "PR: don't merge";

const checkLabels = async () => {
  core.info('Checking newly added label...');
  const token = core.getInput('repo-token');
  const label = context.payload.label;
  const octokit = new GitHub(token);
  const user = context.payload.sender.login;

  if (label.name.startsWith(DONT_MERGE_LABEL_PREFIX)) {
    await handleDontMergeLabel(octokit, label.name);
  }
};

/**
 * Handles cases when a good first issue gets added by a non whitelisted user.
 *
 * @param {import('@actions/github').GitHub} octokit
 */
const handleDontMergeLabel = async (octokit, label) => {
  core.setFailed(
    'This PR should not be merged because it has a ' + label + ' label.'
  );
};

module.exports = {
  checkLabels
};
