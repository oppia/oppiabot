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
import { createExecutionContext } from './testHelpers';

/**
 * Captures console.log output for the duration of one test.
 *
 * The engine reports execution results through the log rather than a return
 * value, so tests read that output.
 *
 * @returns {object} The captured `logs` array and a `restore` callback.
 */
function captureLogs(): {logs: string[]; restore: () => void} {
  const logs: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map((arg) => String(arg)).join(' '));
  };
  return {
    logs: logs,
    restore: () => {
      console.log = original;
    },
  };
}

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

/**
 * Returns a successful plugin result with the given message.
 *
 * @param {string} message - The result message.
 * @returns {PluginResult} A successful result.
 */
function successfulResult(message: string): PluginResult {
  return { actions: [], message: message, success: true };
}

describe('CoreEngine', () => {
  it('executes all applicable plugins and reports their results', async () => {
    const { logs, restore } = captureLogs();
    const executed: string[] = [];
    try {
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'plugin-a',
        [new Trigger('pull_request', 'opened')],
        async () => {
          executed.push('plugin-a');
          return successfulResult('a');
        }
      ));
      registry.register(createStubPlugin(
        'plugin-b',
        [new Trigger('pull_request', 'opened')],
        async () => {
          executed.push('plugin-b');
          return successfulResult('b');
        }
      ));

      const engine = new CoreEngine(registry);
      await engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'))
      );

      assert.deepStrictEqual(executed, ['plugin-a', 'plugin-b']);
      assert.ok(
        logs.some((line) => line.includes('2 plugin(s): 2 succeeded, 0 failed'))
      );
    } finally {
      restore();
    }
  });

  it('reports that no plugin ran when none is applicable', async () => {
    const { logs, restore } = captureLogs();
    const executed: string[] = [];
    try {
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'stale-sweeper',
        [new Trigger('schedule', 'stale-sweep')],
        async () => {
          executed.push('stale-sweeper');
          return successfulResult('stale');
        }
      ));

      const engine = new CoreEngine(registry);
      await engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'))
      );

      assert.deepStrictEqual(executed, []);
      assert.ok(
        logs.some((line) => line.includes('0 plugin(s): 0 succeeded, 0 failed'))
      );
    } finally {
      restore();
    }
  });

  it('isolates plugin failures and continues executing other plugins', async () => {
    const { logs, restore } = captureLogs();
    const executed: string[] = [];
    try {
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'failing-plugin',
        [new Trigger('pull_request', 'opened')],
        async () => {
          executed.push('failing-plugin');
          throw new Error('boom');
        }
      ));
      registry.register(createStubPlugin(
        'healthy-plugin',
        [new Trigger('pull_request', 'opened')],
        async () => {
          executed.push('healthy-plugin');
          return successfulResult('ok');
        }
      ));

      const engine = new CoreEngine(registry);
      await engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'))
      );

      assert.deepStrictEqual(executed, ['failing-plugin', 'healthy-plugin']);
      assert.ok(
        logs.some((line) => line.includes('2 plugin(s): 1 succeeded, 1 failed'))
      );
      assert.ok(
        logs.some(
          (line) => line.includes('failing-plugin') && line.includes('boom')
        )
      );
    } finally {
      restore();
    }
  });

  it('preserves the stack trace of a failed plugin execution', async () => {
    const { logs, restore } = captureLogs();
    try {
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'stack-plugin',
        [new Trigger('pull_request', 'opened')],
        async () => {
          throw new Error('boom');
        }
      ));

      const engine = new CoreEngine(registry);
      await engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'))
      );

      const failure = logs.find((line) => line.includes('stack-plugin'));
      assert.ok(failure !== undefined);
      assert.match(failure, /Error: boom/);
      assert.match(failure, /at .*engine\.test/);
    } finally {
      restore();
    }
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
