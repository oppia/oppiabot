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
 * @fileoverview Schedules a recurring "schedule.repository" event for every
 * repository the GitHub App is installed on.
 *
 * This module is vendored from the (now archived) probot-scheduler package
 * so that oppiabot no longer depends on an unmaintained npm release. The
 * implementation is derived from:
 *
 *   https://github.com/probot/scheduler  (commit 060b19a, master branch)
 *
 * Original work is licensed under the ISC License, Copyright (c) 2016
 * Brandon Keepers and Probot contributors. A copy of the ISC notice is
 * reproduced below per the terms of that license.
 *
 * --- BEGIN ISC NOTICE ---------------------------------------------------
 * ISC License
 *
 * Copyright (c) 2016, Brandon Keepers
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 * --- END ISC NOTICE -----------------------------------------------------
 */

const ignoredAccounts = (process.env.IGNORED_ACCOUNTS || '')
  .toLowerCase()
  .split(',');

const defaults = {
  // Whether to add a random delay before the first run for each repository.
  // Disabled by setting DISABLE_DELAY=true in the environment.
  delay: !process.env.DISABLE_DELAY,
  // Event name received by Probot. With action "repository", the default
  // handler name remains "schedule.repository". This can be changed later for
  // stale-specific scheduling, e.g. "stale.schedule.repository".
  eventName: 'schedule',
  // Interval between scheduled events, in milliseconds. Default: 1 hour.
  interval: 60 * 60 * 1000
};

const createScheduler = (app, options) => {
  options = Object.assign({}, defaults, options || {});
  const intervals = {};

  const schedule = (installation, repository) => {
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
        name: options.eventName,
        payload: { action: 'repository', installation, repository }
      };

      intervals[repository.id] = setInterval(
        () => app.receive(event),
        options.interval
      );

      app.receive(event);
    }, delay);
  };

  const eachInstallation = async (callback) => {
    app.log.trace('Fetching installations');
    const github = await app.auth();

    const installations = await github.paginate(
      github.apps.listInstallations.endpoint.merge({ per_page: 100 })
    );

    const filteredInstallations = options.filter ?
      installations.filter((installation) => options.filter(installation)) :
      installations;

    for (const installation of filteredInstallations) {
      await callback(installation);
    }
  };

  const eachRepository = async (installation, callback) => {
    app.log.trace({ installation }, 'Fetching repositories for installation');
    const github = await app.auth(installation.id);

    const repositories = await github.paginate(
      github.apps.listRepos.endpoint.merge({ per_page: 100 }),
      (response) => response.data.repositories
    );

    const filteredRepositories = options.filter ?
      repositories.filter((repository) => {
        return options.filter(installation, repository);
      }) :
      repositories;

    for (const repository of filteredRepositories) {
      await callback(repository, github);
    }
  };

  const setupInstallation = async (installation) => {
    if (ignoredAccounts.includes(installation.account.login.toLowerCase())) {
      app.log.info({ installation }, 'Installation is ignored');
      return;
    }

    await eachRepository(installation, (repository) => {
      schedule(installation, repository);
    });
  };

  const setup = async () => {
    await eachInstallation(setupInstallation);
  };

  const stop = (repository) => {
    app.log.info({ repository }, 'Canceling interval');
    clearTimeout(intervals[repository.id]);
    clearInterval(intervals[repository.id]);
    delete intervals[repository.id];
  };

  app.on('installation.created', async (event) => {
    const installation = event.payload.installation;
    await eachRepository(installation, (repository) => {
      schedule(installation, repository);
    });
  });

  app.on('installation_repositories.added', async (event) => {
    return setupInstallation(event.payload.installation);
  });

  setup();

  return { stop };
};

module.exports = { createScheduler };
