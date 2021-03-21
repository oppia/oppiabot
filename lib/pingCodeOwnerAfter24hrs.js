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
  hasPendingReviews
} = require('./utils');

/**
 *  This function checks if a pull request has merge conflicts.
 * @param {import('probot').Context} context
 * @param {string[]} assignees
 * @param {string} comment
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */

const checkTime = (pullRequest)=>{
  return true;
};


const pingCodeOwners = async(context, pullRequest, assignees)=>{
  const message = 'Hi CodeAssignee, Its been more than 24 Hrs' +
   'since Requested Review.Please Review this. Thanks';
  await context.github.issues.createComment(
    context.repo({
      issue_number: pullRequest.number,
      body: message,
    })
  );
};
const checkAnyReviewRequiredPr = async(context)=>{
  const allOpenPullRequests = await getAllOpenPullRequests(context);
  //Finding those with Pending Reviews.
  //Those will have to be checked
  console.log('Coming one is From Pingafter24hrs');
  console.log(allOpenPullRequests);
  const requiredPrs = allOpenPullRequests.filter(
    (pullRequest)=>{
      return hasPendingReviews(pullRequest) && checkTime(pullRequest);
    }
  );
  alert(requiredPrs);
  console.log('Assignees are' + assignees);
  pingCodeOwners(context, pullRequest, assignees);
  console.log(requiredPrs);
};

module.exports = {
  checkAnyReviewRequiredPr
};