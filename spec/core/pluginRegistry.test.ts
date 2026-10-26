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
  OppiabotPlugin,
  PluginResolutionError,
  PluginResult,
  PluginRegistry,
  Trigger
} from '../../src/core';
import { ConfigSchema } from '../../src/types';
import { ExecutionContext } from '../../src/core';

/**
 * Creates a stub plugin for test purposes.
 *
 * @param {string} name - The plugin name.
 * @param {Trigger[]} supportedTriggers - The supported triggers.
 * @returns {OppiabotPlugin} A stub plugin.
 */
function createStubPlugin(
  name: string,
  supportedTriggers: Trigger[]
): OppiabotPlugin {
  return {
    name: name,
    supportedTriggers: supportedTriggers,
    configSchema: new ConfigSchema({}, []),
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

  it('resolves plugins whose supported trigger matches the incoming trigger', () => {
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

    const resolved = registry.resolvePlugins(
      new Trigger('pull_request', 'opened')
    );
    assert.deepStrictEqual(
      resolved.map((plugin) => plugin.name),
      ['opened-check']
    );
  });

  it('resolves an action-less registered trigger for all actions of its event', () => {
    const registry = new PluginRegistry();
    registry.register(
      createStubPlugin('all-pr-checks', [new Trigger('pull_request')])
    );

    const resolved = registry.resolvePlugins(
      new Trigger('pull_request', 'synchronize')
    );
    assert.deepStrictEqual(
      resolved.map((plugin) => plugin.name),
      ['all-pr-checks']
    );
  });

  it('resolves no plugins when there is no matching trigger', () => {
    const registry = new PluginRegistry();
    registry.register(
      createStubPlugin('stale-sweeper', [
        new Trigger('schedule', 'stale-sweep'),
      ])
    );

    const resolved = registry.resolvePlugins(
      new Trigger('pull_request', 'opened')
    );
    assert.deepStrictEqual(resolved, []);
  });
});
