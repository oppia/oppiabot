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
 * @fileoverview Setup file for running tests.
 */

/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { EOL } = require('os');
const { exec } = require('child_process');

const WHITELISTED_ACCOUNTS = 'WHITELISTED_ACCOUNTS';
const CLIENT_SECRET = 'CLIENT_SECRET';
const CREDENTIALS = 'CREDENTIALS';
const NEW_RELIC_NO_CONFIG = 'NEW_RELIC_NO_CONFIG_FILE';
const NEW_RELIC_APP = 'NEW_RELIC_APP_NAME';
const NEW_RELIC_ENABLED = 'NEW_RELIC_ENABLED';
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');
let envData = '';

const setWhitelistedAccount = () => {
  // Load env.
  let data = '';
  if (fs.existsSync(envPath)) {
    data = fs.readFileSync(envPath);
  } else if (fs.existsSync(envExamplePath)) {
    data = fs.readFileSync(envExamplePath);
  } else {
    throw new Error(
      '.env.example could not be found.' +
      'Please update your branch with master.');
  }

  envData = data.toString();

  // Parse and remove comments.
  let envArray = data.toString().split(EOL);
  envArray = envArray.filter((line) => {
    if (line && !line.startsWith('#')) {
      return line;
    }
  });

  // Check for whitelisted_account.
  const whitelist = envArray.find((line) =>
    line.startsWith(WHITELISTED_ACCOUNTS)
  );
  const whitelistIndex = envArray.indexOf(whitelist);
  if (!whitelist.includes('oppia')) {
    // Replace the current whitelist with new one.
    const newWhitelist = WHITELISTED_ACCOUNTS + '=oppia';
    envArray.splice(whitelistIndex, 1, newWhitelist);
  }

  // Set client secret.
  const clientSecretIndex = envArray.findIndex((line) =>
    line.startsWith(CLIENT_SECRET)
  );
  const clientSecretObj = {
    installed: {
      client_id: '',
      project_id: '',
      redirect_uris: [],
    }
  };
  const newClientSecret = (
    CLIENT_SECRET + '="' + JSON.stringify(clientSecretObj) + '"');
  envArray.splice(clientSecretIndex, 1, newClientSecret);

  // Set credentials.
  const credentialsIndex = envArray.findIndex((line) =>
    line.startsWith(CREDENTIALS)
  );
  const credentialsObj = {};
  const newCredentials = (
    CREDENTIALS + '="' + JSON.stringify(credentialsObj) + '"');
  envArray.splice(credentialsIndex, 1, newCredentials);

  // Update new relic config.
  const newRelicConfigIndex = envArray.findIndex((line) =>
    line.startsWith(NEW_RELIC_NO_CONFIG)
  );
  const newRelicConfig = NEW_RELIC_NO_CONFIG + '=true';
  if (newRelicConfigIndex !== -1) {
    envArray.splice(newRelicConfigIndex, 1, newRelicConfig);
  } else {
    envArray.push(newRelicConfig);
  }

  const newRelicAppIndex = envArray.findIndex((line) =>
    line.startsWith(NEW_RELIC_APP)
  );
  const newRelicConfigApp = NEW_RELIC_APP + '=oppiabot';
  if (newRelicAppIndex !== -1) {
    envArray.splice(newRelicAppIndex, 1, newRelicConfigApp);
  } else {
    envArray.push(newRelicConfigApp);
  }

  const newRelicEnabledIndex = envArray.findIndex((line) =>
    line.startsWith(NEW_RELIC_ENABLED)
  );
  const newRelicEnabled = NEW_RELIC_ENABLED + '=false';
  if (newRelicEnabledIndex !== -1) {
    envArray.splice(newRelicEnabledIndex, 1, newRelicEnabled);
  } else {
    envArray.push(newRelicEnabled);
  }

  // Save new env.
  const newEnv = envArray.join(EOL);
  console.log('Updating .env');
  fs.writeFileSync(envPath, newEnv, (err) => {
    if (err) {
      throw err;
    }
  });
};

const runTest = () => {
  const jasminePath = path.join(
    __dirname, '..', 'node_modules', '.bin', 'jasmine');
  const nycPath = path.join(
    __dirname, '..', 'node_modules', '.bin', 'nyc');

  return new Promise((resolve, reject) => {
    exec(
      nycPath + ' "' + jasminePath + '"',
      (error, stdout, stderr) => {
        console.log(stdout);
        if (error) {
          console.log(error);
          reject();
        }
        if (stderr) {
          console.log(stderr);
          reject();
        }
        resolve();
      });
  });
};

const revertEnv = () => {
  console.log('Reverting .env');
  fs.writeFileSync(envPath, envData);
};

setWhitelistedAccount();
runTest().then(
  () => {
    revertEnv();
    console.log('Tests successful');
  }).catch(() => {
    revertEnv();
    console.log('Tests failed.')
    process.exit(1);
  });
