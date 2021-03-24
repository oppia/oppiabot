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
  hasPendingReviews,
  sleep
} = require('./utils');

/**
 *  This function checks if a pull request has merge conflicts.
 * @param {import('probot').Context} context
 * @param {string[]} assignees
 * @param {string} comment
 * @param {import('probot').Octokit.PullsGetResponse} pullRequest
 */


// This is a function to check if there are more than 24 Hours with the Pr
// const checkTime = (pullRequest)=>{
//   let timeOfPr = pullRequest.updated_at;
//   timeOfPr = new Date(timeOfPr);
//   let currentTime = new Date.now();
//   let diff = Math.abs(timeOfPr - currentTime);
//   diff > 24 ? true : false;
// };

const checkTime=(pullRequest)=>{
  return true;
};


const pingCodeOwners = async(context, pullRequest)=>{
  const reviewers = pullRequest.requested_reviewers;
  const message = 'Hi' + reviewers.map((reviewer)=>{
    return ' @' + reviewer.login + ' ';
  }) + ', Its been more than 24 Hrs, ' +
   'since Requested Review. Please Review this. Thanks';
  await context.github.issues.createComment(
    context.repo({
      issue_number: pullRequest.number,
      body: message,
    })
  );
};
const checkAnyReviewRequiredPr = async(context)=>{
  await sleep(5000);
  console.log(await getAllOpenPullRequests(context));
  const allOpenPullRequests = await getAllOpenPullRequests(context);
  //Finding those with Pending Reviews.
  //Those will have to be checked
  const temp = context.github.pulls;
  console.log('Pullrequest Details is', temp);
  console.log('Coming one is From Pingafter24hrs');
  // console.log(allOpenPullRequests);
  const requiredPrs = await allOpenPullRequests.filter(
    (pullRequest)=>{
      return hasPendingReviews(pullRequest) && checkTime(pullRequest);
    }
  );
  // console.log('Assignees are' + assignees);
  // pingCodeOwners(context, pullRequest, assignees);
  console.log(requiredPrs);
  await requiredPrs.map(async (pullRequest)=>{
    await pingCodeOwners(context, pullRequest);
  });
};

module.exports = {
  checkAnyReviewRequiredPr
};