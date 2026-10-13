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
  ExecutionContext,
  OppiabotPlugin,
  PluginResolutionError,
  PluginResult,
  PluginRegistry,
  Trigger
} from '../../src/core';
import {
  ConfigSchema,
  PluginConfiguration,
  RepositoryConfiguration,
  RepositoryContext
} from '../../src/types';
import {
  createExecutionContext,
  createRepositoryConfiguration
} from './testHelpers';

/**
 * Creates a stub plugin for test purposes.
 *
 * @param {string} name - The plugin name.
 * @param {Trigger[]} supportedTriggers - The supported triggers.
 * @param {ConfigSchema} [configSchema] - The schema declared by the plugin.
 * @returns {OppiabotPlugin} A stub plugin.
 */
function createStubPlugin(
  name: string,
  supportedTriggers: Trigger[],
  configSchema: ConfigSchema = new ConfigSchema({}, [])
): OppiabotPlugin {
  return {
    name: name,
    supportedTriggers: supportedTriggers,
    configSchema: configSchema,
    async execute(context: ExecutionContext): Promise<PluginResult> {
      return {
        actions: [],
        message: name,
        success: true,
      };
    },
  };
}

describe('PluginRegistry', () => {
  describe('registration', () => {
    it('stores registered plugins and returns their metadata', () => {
      const registry = new PluginRegistry();
      const plugin = createStubPlugin(
        'pr-check',
        [new Trigger('pull_request', 'opened')]
      );
      registry.register(plugin);

      assert.strictEqual(registry.getAllPlugins().length, 1);
      const metadata = registry.getRegistration('pr-check');
      assert.strictEqual(metadata?.name, 'pr-check');
      assert.deepStrictEqual(metadata?.supportedTriggers, [
        new Trigger('pull_request', 'opened'),
      ]);
      assert.strictEqual(registry.getRegistration('missing'), undefined);
    });

    it('rejects duplicate plugin registration', () => {
      const registry = new PluginRegistry();
      registry.register(createStubPlugin('dup', []));
      assert.throws(
        () => registry.register(createStubPlugin('dup', [])),
        (err) => (
          err instanceof PluginResolutionError &&
          err.message.includes('dup')
        )
      );
    });
  });

  describe('resolvePlugins', () => {
    it('resolves an enabled plugin whose supported trigger matches', () => {
      const registry = new PluginRegistry();
      registry.register(
        createStubPlugin('actions-not-triggered', [])
      );
      registry.register(
        createStubPlugin('opened-check', [
          new Trigger('pull_request', 'opened'),
        ])
      );
      registry.register(
        createStubPlugin('stale-sweeper', [
          new Trigger('schedule', 'stale-sweep'),
        ])
      );

      const resolved = registry.resolvePlugins(createExecutionContext(
        new Trigger('pull_request', 'opened'),
        {
          configuration: createRepositoryConfiguration({
            'opened-check': { enabled: true },
            'stale-sweeper': { enabled: true }
          })
        }
      ));
      assert.deepStrictEqual(
        resolved.map((plugin) => plugin.name),
        ['opened-check']
      );
    });

    it('resolves an enabled scheduled plugin for its scheduled trigger', () => {
      const registry = new PluginRegistry();
      registry.register(
        createStubPlugin('stale-sweeper', [
          new Trigger('schedule', 'stale-sweep'),
        ])
      );
      registry.register(
        createStubPlugin('reviewer-lag', [
          new Trigger('schedule', 'reviewer-lag'),
        ])
      );

      const resolved = registry.resolvePlugins(createExecutionContext(
        new Trigger('schedule', 'stale-sweep'),
        {
          configuration: createRepositoryConfiguration({
            'stale-sweeper': { enabled: true },
            'reviewer-lag': { enabled: true }
          })
        }
      ));
      assert.deepStrictEqual(
        resolved.map((plugin) => plugin.name),
        ['stale-sweeper']
      );
    });

    it('resolves an action-less registered trigger for all actions of its event', () => {
      const registry = new PluginRegistry();
      registry.register(
        createStubPlugin('all-pr-checks', [new Trigger('pull_request')])
      );

      const resolved = registry.resolvePlugins(createExecutionContext(
        new Trigger('pull_request', 'synchronize'),
        {
          configuration: createRepositoryConfiguration({
            'all-pr-checks': { enabled: true }
          })
        }
      ));
      assert.deepStrictEqual(
        resolved.map((plugin) => plugin.name),
        ['all-pr-checks']
      );
    });

    it('does not resolve a plugin the repository has not configured', () => {
      const registry = new PluginRegistry();
      registry.register(
        createStubPlugin('opened-check', [
          new Trigger('pull_request', 'opened'),
        ])
      );

      const resolved = registry.resolvePlugins(createExecutionContext(
        new Trigger('pull_request', 'opened')
      ));
      assert.deepStrictEqual(resolved, []);
    });

    it('does not resolve a plugin configured with enabled: false', () => {
      const registry = new PluginRegistry();
      registry.register(
        createStubPlugin('opened-check', [
          new Trigger('pull_request', 'opened'),
        ])
      );

      const resolved = registry.resolvePlugins(createExecutionContext(
        new Trigger('pull_request', 'opened'),
        {
          configuration: createRepositoryConfiguration({
            'opened-check': { enabled: false }
          })
        }
      ));
      assert.deepStrictEqual(resolved, []);
    });

    it('does not resolve plugins when the context carries no configuration', () => {
      const registry = new PluginRegistry();
      registry.register(
        createStubPlugin('opened-check', [
          new Trigger('pull_request', 'opened'),
        ])
      );

      const context = new ExecutionContext(
        new Trigger('pull_request', 'opened'),
        {},
        new RepositoryContext('oppia', 'oppiabot', 'develop')
      );
      assert.deepStrictEqual(registry.resolvePlugins(context), []);
    });

    it('resolves no plugins when there is no matching trigger', () => {
      const registry = new PluginRegistry();
      registry.register(
        createStubPlugin('stale-sweeper', [
          new Trigger('schedule', 'stale-sweep'),
        ])
      );

      const resolved = registry.resolvePlugins(createExecutionContext(
        new Trigger('pull_request', 'opened'),
        {
          configuration: createRepositoryConfiguration({
            'stale-sweeper': { enabled: true }
          })
        }
      ));
      assert.deepStrictEqual(resolved, []);
    });

    it('ignores a configured plugin that is not registered', () => {
      const registry = new PluginRegistry();
      registry.register(
        createStubPlugin('opened-check', [
          new Trigger('pull_request', 'opened'),
        ])
      );

      const resolved = registry.resolvePlugins(createExecutionContext(
        new Trigger('pull_request', 'opened'),
        {
          configuration: createRepositoryConfiguration({
            'opened-check': { enabled: true },
            'not-yet-registered': { enabled: true }
          })
        }
      ));
      assert.deepStrictEqual(
        resolved.map((plugin) => plugin.name),
        ['opened-check']
      );
    });

    it('raises PluginResolutionError when an enabled plugin configuration is invalid', () => {
      const registry = new PluginRegistry();
      registry.register(createStubPlugin(
        'stale-sweeper',
        [new Trigger('schedule', 'stale-sweep')],
        new ConfigSchema(
          { stale_days: { type: 'number' } },
          ['stale_days']
        )
      ));

      assert.throws(
        () => registry.resolvePlugins(createExecutionContext(
          new Trigger('schedule', 'stale-sweep'),
          {
            configuration: createRepositoryConfiguration({
              'stale-sweeper': { enabled: true, settings: {} }
            })
          }
        )),
        (err) => (
          err instanceof PluginResolutionError &&
          err.message.includes('stale-sweeper') &&
          err.message.includes('schedule.stale-sweep')
        )
      );
    });

    it('does not resolve a plugin whose configuration entry is null', () => {
      const registry = new PluginRegistry();
      registry.register(
        createStubPlugin('opened-check', [
          new Trigger('pull_request', 'opened'),
        ])
      );

      const context = new ExecutionContext(
        new Trigger('pull_request', 'opened'),
        {},
        new RepositoryContext('oppia', 'oppiabot', 'develop'),
        new RepositoryConfiguration('1.0', {
          'opened-check': null as unknown as PluginConfiguration
        })
      );
      assert.deepStrictEqual(registry.resolvePlugins(context), []);
    });
  });
});
