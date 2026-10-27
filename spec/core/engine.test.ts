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
  PluginResolutionError,
  PluginResult,
  PluginRegistry,
  Trigger
} from '../../src/core';
import { ConfigSchema } from '../../src/types';
import {
  createExecutionContext,
  createRepositoryConfiguration
} from './testHelpers';
import {
  captureLogs,
  createStubPlugin,
  successfulResult
} from './engineTestHelpers';

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
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'plugin-a': { enabled: true },
            'plugin-b': { enabled: true }
          })
        })
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
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'stale-sweeper': { enabled: true }
          })
        })
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
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'failing-plugin': { enabled: true },
            'healthy-plugin': { enabled: true }
          })
        })
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
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'stack-plugin': { enabled: true }
          })
        })
      );

      const failure = logs.find((line) => line.includes('stack-plugin'));
      assert.ok(failure !== undefined);
      assert.match(failure, /Error: boom/);
      assert.match(failure, /at .*engine\.test/);
    } finally {
      restore();
    }
  });

  it('isolates a plugin that throws a non-Error value', async () => {
    const { logs, restore } = captureLogs();
    try {
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'string-thrower',
        [new Trigger('pull_request', 'opened')],
        async () => {
          throw 'boom';
        }
      ));

      const engine = new CoreEngine(registry);
      await engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'string-thrower': { enabled: true }
          })
        })
      );

      const failure = logs.find((line) => line.includes('string-thrower'));
      assert.ok(failure !== undefined);
      assert.match(failure, /boom/);
    } finally {
      restore();
    }
  });

  it('isolates a plugin that throws synchronously', async () => {
    const { logs, restore } = captureLogs();
    try {
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
      await engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'sync-thrower': { enabled: true }
          })
        })
      );

      const failure = logs.find((line) => line.includes('sync-thrower'));
      assert.ok(failure !== undefined);
      assert.match(failure, /sync boom/);
    } finally {
      restore();
    }
  });

  it('keeps running after several plugins fail', async () => {
    const { logs, restore } = captureLogs();
    const executed: string[] = [];
    try {
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'fail-one',
        [new Trigger('pull_request', 'opened')],
        async () => {
          executed.push('fail-one');
          throw new Error('one');
        }
      ));
      registry.register(createStubPlugin(
        'fail-two',
        [new Trigger('pull_request', 'opened')],
        async () => {
          executed.push('fail-two');
          throw new Error('two');
        }
      ));
      registry.register(createStubPlugin(
        'healthy-three',
        [new Trigger('pull_request', 'opened')],
        async () => {
          executed.push('healthy-three');
          return { actions: [], message: 'ok', success: true };
        }
      ));

      const engine = new CoreEngine(registry);
      await engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'fail-one': { enabled: true },
            'fail-two': { enabled: true },
            'healthy-three': { enabled: true }
          })
        })
      );

      assert.deepStrictEqual(
        executed,
        ['fail-one', 'fail-two', 'healthy-three']
      );
      assert.ok(
        logs.some((line) => line.includes('3 plugin(s): 1 succeeded, 2 failed'))
      );
    } finally {
      restore();
    }
  });

  it('treats a value that is not a PluginResult as a failed result', async () => {
    const { logs, restore } = captureLogs();
    try {
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'invalid-result-plugin',
        [new Trigger('pull_request', 'opened')],
        async () => undefined as unknown as PluginResult
      ));

      const engine = new CoreEngine(registry);
      await engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'invalid-result-plugin': { enabled: true }
          })
        })
      );

      assert.ok(
        logs.some((line) => line.includes('not a PluginResult'))
      );
    } finally {
      restore();
    }
  });

  it('rejects when an enabled plugin has invalid configuration', async () => {
    const executed: string[] = [];
    const registry = new PluginRegistry();
    registry.register({
      name: 'needs-settings',
      supportedTriggers: [new Trigger('pull_request', 'opened')],
      configSchema: new ConfigSchema(
        { stale_days: { type: 'number' } },
        ['stale_days']
      ),
      execute: async () => {
        executed.push('needs-settings');
        return successfulResult('ok');
      }
    });

    const engine = new CoreEngine(registry);
    await assert.rejects(
      engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'needs-settings': { enabled: true }
          })
        })
      ),
      (err) => err instanceof PluginResolutionError
    );
    assert.deepStrictEqual(executed, []);
  });

  it('names the plugin when reporting a failure it reported itself', async () => {
    const { logs, restore } = captureLogs();
    try {
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'self-reporting',
        [new Trigger('pull_request', 'opened')],
        async () => ({
          actions: [],
          message: 'could not find the upstream file',
          success: false
        })
      ));

      const engine = new CoreEngine(registry);
      await engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'self-reporting': { enabled: true }
          })
        })
      );

      assert.ok(
        logs.some(
          (line) =>
            line.includes("Plugin 'self-reporting' failed") &&
            line.includes('could not find the upstream file')
        )
      );
    } finally {
      restore();
    }
  });

  it('describes a plugin that throws a non-Error object', async () => {
    const { logs, restore } = captureLogs();
    try {
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'object-thrower',
        [new Trigger('pull_request', 'opened')],
        async () => {
          throw { reason: 'custom failure', code: 42 };
        }
      ));

      const engine = new CoreEngine(registry);
      await engine.execute(
        createExecutionContext(new Trigger('pull_request', 'opened'), {
          configuration: createRepositoryConfiguration({
            'object-thrower': { enabled: true }
          })
        })
      );

      const failure = logs.find((line) => line.includes('object-thrower'));
      assert.ok(failure !== undefined);
      assert.match(failure, /"reason":"custom failure"/);
      assert.match(failure, /"code":42/);
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
