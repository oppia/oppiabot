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
 * @fileoverview Local scheduler module to replace the deprecated
 * probot-scheduler package. This triggers 'schedule.repository' events
 * on a configurable interval for each repository the app is installed on.
 *
 * Based on https://github.com/probot/scheduler (ISC License).
 */

const ignoredAccounts = (process.env.IGNORED_ACCOUNTS || '')
  .toLowerCase()
  .split(',')
  .filter(Boolean);

const defaults = {
  delay: !process.env.DISABLE_DELAY,
  interval: 60 * 60 * 1000, // 1 hour
};

/**
 * @param {import('probot').Probot} app
 * @param {Object} options
 * @param {boolean} [options.delay] - Whether to add a random delay before
 *   the first scheduled event.
 * @param {number} [options.interval] - Interval in ms between events.
 * @param {Function} [options.filter] - Optional filter for
 *   installations/repos.
 */
const createScheduler = (app, options) => {
  options = Object.assign({}, defaults, options || {});
  const intervals = {};

  app.on('installation.created', async (event) => {
    const installation = event.payload.installation;
    await eachRepository(app, installation, (repository) => {
      schedule(app, intervals, options, installation, repository);
    });
  });

  app.on('installation_repositories.added', async (event) => {
    await setupInstallation(app, intervals, options, event.payload.installation);
  });

  setup(app, intervals, options);

  function stop(repository) {
    app.log.info({ repository }, 'Canceling interval');
    clearInterval(intervals[repository.id]);
  }

  return { stop };
};

async function setup(app, intervals, options) {
  await eachInstallation(app, options, (installation) => {
    setupInstallation(app, intervals, options, installation);
  });
}

async function setupInstallation(app, intervals, options, installation) {
  if (ignoredAccounts.includes(installation.account.login.toLowerCase())) {
    app.log.info({ installation }, 'Installation is ignored');
    return;
  }

  await eachRepository(app, installation, (repository) => {
    schedule(app, intervals, options, installation, repository);
  });
}

function schedule(app, intervals, options, installation, repository) {
  if (intervals[repository.id]) {
    return;
  }

  const delay = options.delay ? options.interval * Math.random() : 0;

  app.log.debug(
    { repository, delay, interval: options.interval },
    'Scheduling interval'
  );

  intervals[repository.id] = setTimeout(() => {
    const event = {
      name: 'schedule',
      payload: { action: 'repository', installation, repository },
    };

    intervals[repository.id] = setInterval(
      () => app.receive(event),
      options.interval
    );

    app.receive(event);
  }, delay);
}

async function eachInstallation(app, options, callback) {
  app.log.trace('Fetching installations');
  const github = await app.auth();

  const installations = await github.paginate(
    github.rest.apps.listInstallations,
    { per_page: 100 }
  );

  const filteredInstallations = options.filter
    ? installations.filter((inst) => options.filter(inst))
    : installations;

  for (const installation of filteredInstallations) {
    await callback(installation);
  }
}

async function eachRepository(app, installation, callback) {
  app.log.trace({ installation }, 'Fetching repositories for installation');
  const github = await app.auth(installation.id);

  const repositories = await github.paginate(
    github.rest.apps.listReposAccessibleToInstallation,
    { per_page: 100 },
    (response) => response.data.repositories || response.data
  );

  const filteredRepositories = repositories;

  for (const repository of filteredRepositories) {
    await callback(repository, github);
  }
}

module.exports = { createScheduler };
