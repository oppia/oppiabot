// Copyright 2020 The Oppia Authors. All Rights Reserved.
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
 * @fileoverview Handler for checks to be carried out periodically.
 */

const { context } = require('@actions/github');
const {
  getAllOpenPullRequests,
  doesPullRequestHaveChangesRequested,
  getProjectOwnerFromLabel,
} = require('./utils');

/**
 *  This function will be helpful to check for payload.
 *
 * @param {import('probot').Context} context
 */

/**
 *  This function checks if a pull request has merge conflicts.
 *
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */

const checkAnyReviewRequiredPr=async(context)=>{
  const allOpenPullRequests=await getAllOpenPullRequests(context);
  const PrWithoutChanges=allOpenPullRequests.filter(async (pullrequest) =>{
    const number = pullrequest.number;
    const result = doesPullRequestHaveChangesRequested(context, number);
    return result.valueOf();
  });
};
