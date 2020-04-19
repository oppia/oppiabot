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

const assignUnassignedReviewers = async (pullRequest, context) => {
  const assignees = pullRequest.assignees.map(user => user.login);

  // Users that have already reviewed the PR are not a part of this list unless
  // a new review is requested from the PR author.
  const reviewers = pullRequest.requested_reviewers.map(user => user.login);

  // If the PR author is assigned, then don't assign other reviewers.
  if (assignees.includes(pullRequest.user.login)) {
    return;
  }

  let botComment = 'Hi ';

  const pullRequestParams = context.repo({
    number: pullRequest.number,
  });

  const unassignedReviewers = reviewers.filter(
    reviewer => !assignees.includes(reviewer));

  unassignedReviewers.forEach(reviewer => {
    botComment += `@${reviewer}, `;
  });

  if (unassignedReviewers.length > 0) {
    await context.github.issues.addAssigneesToIssue(
      { ...pullRequestParams, assignees: unassignedReviewers });

    // Ping newly assigned reviewers.
    botComment += 'this PR is waiting for your review, can you PTAL? Thanks!';
    await context.github.issues.createComment(
      { ...pullRequestParams, body: botComment });
  }
};

module.exports.assignReviewers = async (context) => {
  // By default, this returns only open PRs.
  const pullRequestsPromiseObj = await context.github.pullRequests.getAll(
    context.repo({ per_page: 60 })
  );

  const arrayOfOpenPullRequests = pullRequestsPromiseObj.data;

  arrayOfOpenPullRequests.forEach(async (pullRequest) => {
    await assignUnassignedReviewers(pullRequest, context);
  });
};
