// Copyright 2026 The Oppia Authors. All Rights Reserved.
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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CoreEngine,
  DeferredExecutionRequest,
  DeferredExecutionScheduler,
  ExecutionContext,
  PluginRegistry,
  Trigger
} from '../../src/core';
import {
  createExecutionContext,
  createRepositoryConfiguration,
  waitFor
} from './testHelpers';
import {
  captureLogs,
  createStubPlugin,
  successfulResult
} from './engineTestHelpers';

/** One follow-up execution a scheduler accepted for later execution. */
interface ScheduledRun {
  request: DeferredExecutionRequest;
  run: () => Promise<void>;
}

/**
 * A scheduler that records the follow-up executions instead of running them.
 *
 * Tests decide when, and in which order, the recorded follow-up executions
 * run by calling `scheduled[i].run()`.
 */
class ManualDeferredExecutionScheduler implements DeferredExecutionScheduler {
  public readonly scheduled: ScheduledRun[] = [];

  async schedule(
    request: DeferredExecutionRequest,
    run: () => Promise<void>
  ): Promise<void> {
    this.scheduled.push({ request, run });
  }
}

/** A scheduler that refuses every follow-up execution. */
class FailingDeferredExecutionScheduler
  implements DeferredExecutionScheduler {
  async schedule(): Promise<void> {
    throw new Error('queue unavailable');
  }
}

describe('CoreEngine deferred execution', () => {
  it('schedules a follow-up run for a deferring plugin and attaches the request', async () => {
    const { logs, restore } = captureLogs();
    const contexts: ExecutionContext[] = [];
    try {
      const scheduler = new ManualDeferredExecutionScheduler();
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'review-switcher',
        [new Trigger('pull_request_review', 'submitted')],
        async (context) => {
          contexts.push(context);
          if (context.deferredRequest === undefined) {
            return {
              actions: [],
              message: 'deferring until the review interval passes',
              success: true,
              deferred: new DeferredExecutionRequest(180000)
            };
          }
          return successfulResult('re-fetched the current pull request');
        }
      ));

      const engine = new CoreEngine(registry, scheduler);
      const context = createExecutionContext(
        new Trigger('pull_request_review', 'submitted'),
        {
          configuration: createRepositoryConfiguration({
            'review-switcher': { enabled: true }
          })
        }
      );
      await engine.execute(context);

      assert.strictEqual(scheduler.scheduled.length, 1);
      assert.strictEqual(scheduler.scheduled[0].request.delayMs, 180000);
      assert.deepStrictEqual(contexts, [context]);
      assert.ok(logs.some(
        (line) =>
          line.includes("Plugin 'review-switcher' deferred for 180000ms")
      ));

      await scheduler.scheduled[0].run();

      assert.strictEqual(contexts.length, 2);
      assert.strictEqual(
        contexts[1].deferredRequest,
        scheduler.scheduled[0].request
      );
      assert.strictEqual(contexts[1].trigger, context.trigger);
      assert.strictEqual(contexts[1].repository, context.repository);
      assert.ok(logs.some(
        (line) =>
          line.includes("Running the deferred execution of plugin " +
            "'review-switcher'")
      ));
      assert.ok(logs.some(
        (line) => line.includes('1 plugin(s): 1 succeeded, 0 failed')
      ));
    } finally {
      restore();
    }
  });

  it('executes the remaining plugins when one plugin defers', async () => {
    const { logs, restore } = captureLogs();
    const executed: string[] = [];
    try {
      const scheduler = new ManualDeferredExecutionScheduler();
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'deferring-plugin',
        [new Trigger('pull_request', 'opened')],
        async () => {
          executed.push('deferring-plugin');
          return {
            actions: [],
            message: 'deferring',
            success: true,
            deferred: new DeferredExecutionRequest(60000)
          };
        }
      ));
      registry.register(createStubPlugin(
        'unrelated-plugin',
        [new Trigger('pull_request', 'opened')],
        async () => {
          executed.push('unrelated-plugin');
          return successfulResult('unrelated work completed');
        }
      ));

      const engine = new CoreEngine(registry, scheduler);
      await engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'deferring-plugin': { enabled: true },
            'unrelated-plugin': { enabled: true }
          })
        })
      );

      assert.deepStrictEqual(executed, ['deferring-plugin', 'unrelated-plugin']);
      assert.strictEqual(scheduler.scheduled.length, 1);
      assert.ok(logs.some(
        (line) => line.includes('2 plugin(s): 2 succeeded, 0 failed')
      ));
    } finally {
      restore();
    }
  });

  it('reports an invalid deferral request as an isolated plugin failure', async () => {
    const { logs, restore } = captureLogs();
    try {
      const scheduler = new ManualDeferredExecutionScheduler();
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'bad-deferral',
        [new Trigger('pull_request', 'opened')],
        async () => ({
          actions: [],
          message: 'deferring',
          success: true,
          deferred: new DeferredExecutionRequest(0)
        })
      ));

      const engine = new CoreEngine(registry, scheduler);
      await engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'bad-deferral': { enabled: true }
          })
        })
      );

      assert.strictEqual(scheduler.scheduled.length, 0);
      assert.ok(logs.some(
        (line) =>
          line.includes("Plugin 'bad-deferral' failed") &&
          line.includes('invalid deferred execution request') &&
          line.includes('greater than zero')
      ));
      assert.ok(logs.some(
        (line) => line.includes('1 plugin(s): 0 succeeded, 1 failed')
      ));
    } finally {
      restore();
    }
  });

  it('reports a scheduling failure as an isolated plugin failure', async () => {
    const { logs, restore } = captureLogs();
    try {
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'queued-plugin',
        [new Trigger('pull_request', 'opened')],
        async () => ({
          actions: [],
          message: 'deferring',
          success: true,
          deferred: new DeferredExecutionRequest(60000)
        })
      ));

      const engine = new CoreEngine(registry, new FailingDeferredExecutionScheduler());
      await engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'queued-plugin': { enabled: true }
          })
        })
      );

      assert.ok(logs.some(
        (line) =>
          line.includes("Plugin 'queued-plugin' failed") &&
          line.includes('could not be scheduled') &&
          line.includes('queue unavailable')
      ));
      assert.ok(logs.some(
        (line) => line.includes('1 plugin(s): 0 succeeded, 1 failed')
      ));
    } finally {
      restore();
    }
  });

  it('attributes a failure in the deferred run to the plugin', async () => {
    const { logs, restore } = captureLogs();
    try {
      const scheduler = new ManualDeferredExecutionScheduler();
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'review-switcher',
        [new Trigger('pull_request_review', 'submitted')],
        async (context) => {
          if (context.deferredRequest === undefined) {
            return {
              actions: [],
              message: 'deferring',
              success: true,
              deferred: new DeferredExecutionRequest(180000)
            };
          }
          throw new Error('refetch failed');
        }
      ));

      const engine = new CoreEngine(registry, scheduler);
      await engine.execute(
        createExecutionContext(new Trigger('pull_request_review', 'submitted'), {
          configuration: createRepositoryConfiguration({
            'review-switcher': { enabled: true }
          })
        })
      );

      await scheduler.scheduled[0].run();

      assert.ok(logs.some(
        (line) =>
          line.includes("Plugin 'review-switcher' failed") &&
          line.includes('refetch failed')
      ));
      assert.ok(logs.some(
        (line) => line.includes('1 plugin(s): 0 succeeded, 1 failed')
      ));
    } finally {
      restore();
    }
  });

  it('schedules a further follow-up when a deferred run defers again', async () => {
    const { logs, restore } = captureLogs();
    const executed: string[] = [];
    try {
      const scheduler = new ManualDeferredExecutionScheduler();
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'multi-defer',
        [new Trigger('pull_request', 'opened')],
        async (context) => {
          if (executed.length === 0) {
            executed.push('first');
            return {
              actions: [],
              message: 'deferring the first time',
              success: true,
              deferred: new DeferredExecutionRequest(1000)
            };
          }
          if (executed.length === 1) {
            executed.push('second');
            return {
              actions: [],
              message: 'deferring the second time',
              success: true,
              deferred: new DeferredExecutionRequest(2000)
            };
          }
          executed.push('third');
          return successfulResult('completed after two deferrals');
        }
      ));

      const engine = new CoreEngine(registry, scheduler);
      await engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'multi-defer': { enabled: true }
          })
        })
      );
      assert.deepStrictEqual(executed, ['first']);
      assert.strictEqual(scheduler.scheduled.length, 1);

      await scheduler.scheduled[0].run();
      assert.deepStrictEqual(executed, ['first', 'second']);
      assert.strictEqual(scheduler.scheduled.length, 2);
      assert.strictEqual(scheduler.scheduled[1].request.delayMs, 2000);

      await scheduler.scheduled[1].run();
      assert.deepStrictEqual(executed, ['first', 'second', 'third']);
      assert.strictEqual(scheduler.scheduled.length, 2);
      // One success summary per run: the initial run and the two follow-ups.
      assert.strictEqual(
        logs.filter(
          (line) => line.includes('1 plugin(s): 1 succeeded, 0 failed')
        ).length,
        3
      );
    } finally {
      restore();
    }
  });

  it('runs a deferred follow-up through the default scheduler', async () => {
    const { logs, restore } = captureLogs();
    const executed: string[] = [];
    try {
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'timer-plugin',
        [new Trigger('pull_request', 'opened')],
        async (context) => {
          if (context.deferredRequest === undefined) {
            executed.push('initial');
            return {
              actions: [],
              message: 'deferring briefly',
              success: true,
              deferred: new DeferredExecutionRequest(1)
            };
          }
          executed.push('deferred');
          return successfulResult('completed after the delay');
        }
      ));

      const engine = new CoreEngine(registry);
      await engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'timer-plugin': { enabled: true }
          })
        })
      );

      assert.deepStrictEqual(executed, ['initial']);
      // The initial run reports one success summary; waiting for a second one
      // means the deferred follow-up has run and reported its own result.
      await waitFor(
        () => logs.filter(
          (line) => line.includes('1 plugin(s): 1 succeeded, 0 failed')
        ).length === 2
      );
      assert.deepStrictEqual(executed, ['initial', 'deferred']);
    } finally {
      restore();
    }
  });
});
