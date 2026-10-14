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
  ExecutionContextValidationError,
  OppiabotPlugin,
  PluginResult,
  PluginRegistry,
  Trigger
} from '../../src/core';
import { ConfigSchema } from '../../src/types';
import {
  createExecutionContext,
  createRepositoryConfiguration
} from './testHelpers';

/**
 * Creates a stub plugin that resolves to a configurable result.
 *
 * @param {string} name - The plugin name.
 * @param {Trigger[]} supportedTriggers - The supported triggers.
 * @param {() => Promise<PluginResult>} execute - The execution handler.
 * @returns {OppiabotPlugin} A stub plugin.
 */
function createStubPlugin(
  name: string,
  supportedTriggers: Trigger[],
  execute: () => Promise<PluginResult>
): OppiabotPlugin {
  return {
    name: name,
    supportedTriggers: supportedTriggers,
    configSchema: new ConfigSchema({}, []),
    execute: execute,
  };
}

describe('CoreEngine', () => {
  it('executes all applicable plugins and aggregates their results', async () => {
    const registry = new PluginRegistry();
    registry.register(createStubPlugin(
      'plugin-a',
      [new Trigger('pull_request', 'opened')],
      async () => ({ actions: [], message: 'a', success: true })
    ));
    registry.register(createStubPlugin(
      'plugin-b',
      [new Trigger('pull_request', 'opened')],
      async () => ({ actions: [], message: 'b', success: true })
    ));

    const engine = new CoreEngine(registry);
    const results = await engine.execute(
      createExecutionContext(new Trigger('pull_request', 'opened'), {
        configuration: createRepositoryConfiguration({
          'plugin-a': { enabled: true },
          'plugin-b': { enabled: true }
        })
      })
    );

    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].success, true);
    assert.strictEqual(results[1].success, true);
  });

  it('returns no results when no plugin is applicable', async () => {
    const registry = new PluginRegistry();
    registry.register(createStubPlugin(
      'stale-sweeper',
      [new Trigger('schedule', 'stale-sweep')],
      async () => ({ actions: [], message: 'stale', success: true })
    ));

    const engine = new CoreEngine(registry);
    const results = await engine.execute(
      createExecutionContext(new Trigger('pull_request', 'opened'), {
        configuration: createRepositoryConfiguration({
          'stale-sweeper': { enabled: true }
        })
      })
    );

    assert.deepStrictEqual(results, []);
  });

  it('isolates plugin failures and continues executing other plugins', async () => {
    const registry = new PluginRegistry();
    registry.register(createStubPlugin(
      'failing-plugin',
      [new Trigger('pull_request', 'opened')],
      async () => {
        throw new Error('boom');
      }
    ));
    registry.register(createStubPlugin(
      'healthy-plugin',
      [new Trigger('pull_request', 'opened')],
      async () => ({ actions: [], message: 'ok', success: true })
    ));

    const engine = new CoreEngine(registry);
    const results = await engine.execute(
      createExecutionContext(new Trigger('pull_request', 'opened'), {
        configuration: createRepositoryConfiguration({
          'failing-plugin': { enabled: true },
          'healthy-plugin': { enabled: true }
        })
      })
    );

    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].success, false);
    assert.match(results[0].message, /failing-plugin/);
    assert.match(results[0].message, /boom/);
    assert.strictEqual(results[1].success, true);
  });

  it('preserves the stack trace of a failed plugin execution', async () => {
    const registry = new PluginRegistry();
    registry.register(createStubPlugin(
      'stack-plugin',
      [new Trigger('pull_request', 'opened')],
      async () => {
        throw new Error('boom');
      }
    ));

    const engine = new CoreEngine(registry);
    const results = await engine.execute(
      createExecutionContext(new Trigger('pull_request', 'opened'), {
        configuration: createRepositoryConfiguration({
          'stack-plugin': { enabled: true }
        })
      })
    );

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].success, false);
    assert.match(results[0].message, /stack-plugin/);
    assert.match(results[0].message, /Error: boom/);
    assert.match(results[0].message, /at .*engine\.test/);
  });

  it('isolates a plugin that throws a non-Error value', async () => {
    const registry = new PluginRegistry();
    registry.register(createStubPlugin(
      'string-thrower',
      [new Trigger('pull_request', 'opened')],
      async () => {
        throw 'boom';
      }
    ));

    const engine = new CoreEngine(registry);
    const results = await engine.execute(
      createExecutionContext(new Trigger('pull_request', 'opened'), {
        configuration: createRepositoryConfiguration({
          'string-thrower': { enabled: true }
        })
      })
    );

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].success, false);
    assert.match(results[0].message, /string-thrower/);
    assert.match(results[0].message, /boom/);
  });

  it('isolates a plugin that throws synchronously', async () => {
    const registry = new PluginRegistry();
    const syncThrower = (() => {
      throw new Error('sync boom');
    }) as () => Promise<PluginResult>;
    registry.register(createStubPlugin(
      'sync-thrower',
      [new Trigger('pull_request', 'opened')],
      syncThrower
    ));

    const engine = new CoreEngine(registry);
    const results = await engine.execute(
      createExecutionContext(new Trigger('pull_request', 'opened'), {
        configuration: createRepositoryConfiguration({
          'sync-thrower': { enabled: true }
        })
      })
    );

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].success, false);
    assert.match(results[0].message, /sync-thrower/);
    assert.match(results[0].message, /sync boom/);
  });

  it('keeps running after several plugins fail', async () => {
    const registry = new PluginRegistry();
    registry.register(createStubPlugin(
      'fail-one',
      [new Trigger('pull_request', 'opened')],
      async () => {
        throw new Error('one');
      }
    ));
    registry.register(createStubPlugin(
      'fail-two',
      [new Trigger('pull_request', 'opened')],
      async () => {
        throw new Error('two');
      }
    ));
    registry.register(createStubPlugin(
      'healthy-three',
      [new Trigger('pull_request', 'opened')],
      async () => ({ actions: [], message: 'ok', success: true })
    ));

    const engine = new CoreEngine(registry);
    const results = await engine.execute(
      createExecutionContext(new Trigger('pull_request', 'opened'), {
        configuration: createRepositoryConfiguration({
          'fail-one': { enabled: true },
          'fail-two': { enabled: true },
          'healthy-three': { enabled: true }
        })
      })
    );

    assert.deepStrictEqual(
      results.map((result) => result.success),
      [false, false, true]
    );
  });

  it('treats a value that is not a PluginResult as a failed result', async () => {
    const registry = new PluginRegistry();
    registry.register(createStubPlugin(
      'invalid-result-plugin',
      [new Trigger('pull_request', 'opened')],
      async () => undefined as unknown as PluginResult
    ));

    const engine = new CoreEngine(registry);
    const results = await engine.execute(
      createExecutionContext(new Trigger('pull_request', 'opened'), {
        configuration: createRepositoryConfiguration({
          'invalid-result-plugin': { enabled: true }
        })
      })
    );

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].success, false);
    assert.match(results[0].message, /not a PluginResult/);
  });

  it('rejects an invalid execution context', async () => {
    const registry = new PluginRegistry();
    const engine = new CoreEngine(registry);

    const invalidContext = createExecutionContext(
      new Trigger('pull_request', 'opened')
    );
    (invalidContext as unknown as { trigger: unknown }).trigger = undefined;

    await assert.rejects(
      engine.execute(invalidContext),
      (err) => err instanceof ExecutionContextValidationError
    );
  });

  it('rejects a context whose trigger has a null event', async () => {
    const registry = new PluginRegistry();
    const engine = new CoreEngine(registry);

    const context = createExecutionContext(
      new Trigger(null as unknown as string)
    );

    await assert.rejects(
      engine.execute(context),
      (err) => err instanceof ExecutionContextValidationError
    );
  });
});
