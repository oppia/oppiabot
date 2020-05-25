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
 * @fileoverview Test for github actions build.
 */

/* eslint-disable no-console */

const ncc = require('@zeit/ncc');
const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', 'actions', 'main.js');
const BUILD_PATH = path.join(__dirname, '..', 'dist', 'index.js');
let BUILD_FILE = '';

if (fs.existsSync(BUILD_PATH)) {
  BUILD_FILE = fs.readFileSync(BUILD_PATH, 'utf-8');
} else {
  console.log('Test failed: Build file not found');
  process.exit(1);
}

ncc(INDEX_PATH, {}).then(({ code }) => {
  if (code !== BUILD_FILE) {
    console.log('Test failed: Build file is not updated.');
    process.exit(1);
  } else {
    console.log('Test Successful.');
  }
});
