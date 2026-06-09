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
 * @fileoverview Spec for local scheduler.
 */

const scheduler = require('../lib/scheduler');

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
};

describe('Scheduler', () => {
  let app;
  let handlers;
  let installation;
  let installations;
  let repositories;
  let repository;

  beforeEach(() => {
    jasmine.clock().install();
    handlers = {};
    installation = { id: 1, account: { login: 'oppia' } };
    installations = [installation];
    repository = { id: 2, name: 'oppia' };
    repositories = [repository];

    const rootGithub = {
      apps: {
        listInstallations: {
          endpoint: { merge: jasmine.createSpy('merge').and.returnValue({}) }
        }
      },
      paginate: jasmine.createSpy('paginate').and.callFake(() => {
        return Promise.resolve(installations);
      })
    };
    const installationGithub = {
      apps: {
        listRepos: {
          endpoint: { merge: jasmine.createSpy('merge').and.returnValue({}) }
        }
      },
      paginate: jasmine.createSpy('paginate').and.callFake(
        (endpoint, mapFn) => {
          return Promise.resolve(mapFn({ data: { repositories } }));
        })
    };

    app = {
      auth: jasmine.createSpy('auth').and.callFake((installationId) => {
        return Promise.resolve(
          installationId ? installationGithub : rootGithub);
      }),
      log: {
        debug: jasmine.createSpy('debug'),
        info: jasmine.createSpy('info'),
        trace: jasmine.createSpy('trace')
      },
      on: jasmine.createSpy('on').and.callFake((eventName, handler) => {
        handlers[eventName] = handler;
      }),
      receive: jasmine.createSpy('receive')
    };
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('emits schedule.repository events by default', async () => {
    scheduler.createScheduler(app, { delay: false, interval: 1000 });
    await flushPromises();

    jasmine.clock().tick(0);

    expect(app.receive).toHaveBeenCalledWith({
      name: 'schedule',
      payload: { action: 'repository', installation, repository }
    });
  });

  it('supports custom schedule event names', async () => {
    scheduler.createScheduler(app, {
      delay: false,
      eventName: 'stale.schedule',
      interval: 1000
    });
    await flushPromises();

    jasmine.clock().tick(0);

    expect(app.receive).toHaveBeenCalledWith({
      name: 'stale.schedule',
      payload: { action: 'repository', installation, repository }
    });
  });

  it('can stop scheduled repository events', async () => {
    const scheduled = scheduler.createScheduler(app, {
      delay: false,
      interval: 1000
    });
    await flushPromises();

    scheduled.stop(repository);
    jasmine.clock().tick(0);

    expect(app.receive).not.toHaveBeenCalled();
  });

  it('keeps receiving events on the configured interval', async () => {
    scheduler.createScheduler(app, { delay: false, interval: 1000 });
    await flushPromises();

    jasmine.clock().tick(0);
    jasmine.clock().tick(1000);

    expect(app.receive).toHaveBeenCalledTimes(2);
  });

  it('does not schedule the same repository twice', async () => {
    scheduler.createScheduler(app, { delay: false, interval: 1000 });
    await flushPromises();

    await handlers['installation.created']({ payload: { installation } });
    await flushPromises();

    expect(app.log.debug).toHaveBeenCalledTimes(1);
  });

  it('schedules repositories when an installation is created', async () => {
    installations = [];
    scheduler.createScheduler(app, { delay: false, interval: 1000 });
    await flushPromises();

    await handlers['installation.created']({ payload: { installation } });
    await flushPromises();
    jasmine.clock().tick(0);

    expect(app.receive).toHaveBeenCalledWith({
      name: 'schedule',
      payload: { action: 'repository', installation, repository }
    });
  });

  it('sets up repositories when repositories are added', async () => {
    installations = [];
    scheduler.createScheduler(app, { delay: false, interval: 1000 });
    await flushPromises();

    await handlers['installation_repositories.added']({
      payload: { installation }
    });
    await flushPromises();
    jasmine.clock().tick(0);

    expect(app.receive).toHaveBeenCalledWith({
      name: 'schedule',
      payload: { action: 'repository', installation, repository }
    });
  });

  it('filters installations before scheduling repositories', async () => {
    const filter = jasmine.createSpy('filter').and.callFake((inst, repo) => {
      return Boolean(repo);
    });
    scheduler.createScheduler(app, {
      delay: false,
      filter,
      interval: 1000
    });
    await flushPromises();
    jasmine.clock().tick(0);

    expect(filter).toHaveBeenCalledWith(installation);
    expect(app.receive).not.toHaveBeenCalled();
  });

  it('filters repositories before scheduling them', async () => {
    const filter = jasmine.createSpy('filter').and.callFake((inst, repo) => {
      return !repo;
    });
    scheduler.createScheduler(app, {
      delay: false,
      filter,
      interval: 1000
    });
    await flushPromises();
    jasmine.clock().tick(0);

    expect(filter).toHaveBeenCalledWith(installation, repository);
    expect(app.receive).not.toHaveBeenCalled();
  });

  it('does not schedule repositories for ignored installations', async () => {
    const originalIgnoredAccounts = process.env.IGNORED_ACCOUNTS;
    process.env.IGNORED_ACCOUNTS = 'oppia';
    delete require.cache[require.resolve('../lib/scheduler')];
    const schedulerWithIgnoredAccounts = require('../lib/scheduler');

    try {
      schedulerWithIgnoredAccounts.createScheduler(app, {
        delay: false,
        interval: 1000
      });
      await flushPromises();
      jasmine.clock().tick(0);

      expect(app.log.info).toHaveBeenCalledWith(
        { installation }, 'Installation is ignored');
      expect(app.receive).not.toHaveBeenCalled();
    } finally {
      if (originalIgnoredAccounts === undefined) {
        delete process.env.IGNORED_ACCOUNTS;
      } else {
        process.env.IGNORED_ACCOUNTS = originalIgnoredAccounts;
      }
      delete require.cache[require.resolve('../lib/scheduler')];
    }
  });
});
