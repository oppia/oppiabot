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
 * @fileoverview File to handle checks when a new user makes a PR.
 */

const checkNewUser = async (context) => {
  // Get all issues for repo with user as creator
  const response = await context.github.issues
    .listForRepo(context.repo({
      state: 'all',
      creator: context.payload.pull_request.user.login
    }));

  // Creating a welcome message on a new user's first PR
  const countPR = response.data.filter(data => data.pull_request);
  if (countPR.length === 1) {
    try {
      await context.github.issues.createComment(context.issue({
        body: 'Welcome!! Good job on opening your first PR.'
      }));
    } catch (error) {
      if (error.code !== 404) {
        throw error;
      }
    }
  }
  //Adding more functions for helping new users.
  //Some feedback required.
};