/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { EOL } = require('os');
const { exec } = require('child_process');

const envPath = path.join(__dirname, '..', '.env');
let envData = '';

const setWhitelistedAccount = () => {
  // Load env
  const data = fs.readFileSync(envPath, (err) => {
    if (err) {
      throw err;
    }
  });
  envData = data.toString();

  // Parse and remove comments
  let envArray = data.toString().split(EOL);
  envArray = envArray.filter((line) => {
    if (line && !line.startsWith('#')) {
      return line;
    }
  });

  // check for whtelisted_account
  const whitelist = envArray.find((line) =>
    line.startsWith('WHITELISTED_ACCOUNTS')
  );
  const whitelistIndex = envArray.indexOf(whitelist);
  if (!whitelist.includes('oppia')) {
    // Replace the current whitelist with new one
    const newWhitelist = 'WHITELISTED_ACCOUNTS=oppia';
    envArray.splice(whitelistIndex, 1, newWhitelist);
  }

  // set client secret
  const clientSecretIndex = envArray.findIndex((line) =>
    line.startsWith('CLIENT_SECRET')
  );
  const newClientSecret = 'CLIENT_SECRET="{}"';
  envArray.splice(clientSecretIndex, 1, newClientSecret);

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
    __dirname,
    '..',
    'node_modules',
    '.bin',
    'jasmine'
  );

  return new Promise((resolve, reject) => {
    exec('"' + jasminePath + '"', (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
      }
      if (stderr) {
        console.log(stderr);
        resolve();
      }
      console.log(stdout);
      resolve();
    });
  });
};

const revertEnv = () => {
  console.log('Reverting .env');
  fs.writeFileSync(envPath, envData);
};

setWhitelistedAccount();
runTest().then(() => revertEnv());
