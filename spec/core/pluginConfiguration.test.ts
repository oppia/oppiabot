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
  ConfigurationLoader,
  PluginRegistry
} from '../../src/core';
import { ConfigurationValidationError } from '../../src/types';
import {
  createFileReader,
  createLoader,
  createStubPlugin,
  CLA_SCHEMA,
  REPOSITORY,
  STALE_SCHEMA
} from './configurationTestHelpers';

describe('ConfigurationLoader', () => {
  describe('plugin configuration validation', () => {
    it('validates enabled plugin settings against the plugin schema', async () => {
      const loader = createLoader(
        'plugins:\n  stale:\n    enabled: true\n    settings:\n' +
        '      stale_days: thirty',
        [createStubPlugin('stale', STALE_SCHEMA)]
      );

      await assert.rejects(
        () => loader.load(REPOSITORY),
        /The configuration for plugin stale is invalid/
      );
    });

    it('rejects an enabled plugin missing a required setting', async () => {
      const loader = createLoader(
        'plugins:\n  stale:\n    enabled: true',
        [createStubPlugin('stale', STALE_SCHEMA)]
      );

      await assert.rejects(
        () => loader.load(REPOSITORY),
        ConfigurationValidationError
      );
    });

    it('does not apply the plugin schema to a disabled plugin', async () => {
      const loader = createLoader(
        'plugins:\n  stale:\n    enabled: false',
        [createStubPlugin('stale', STALE_SCHEMA)]
      );

      const configuration = await loader.load(REPOSITORY);

      assert.strictEqual(
        configuration.getPluginConfiguration('stale').enabled,
        false
      );
    });

    it('does not apply the plugin schema to an unregistered plugin', async () => {
      const loader = createLoader(
        'plugins:\n  stale:\n    enabled: true\n    settings:\n' +
        '      stale_days: thirty'
      );

      const configuration = await loader.load(REPOSITORY);

      assert.deepStrictEqual(configuration.getPluginConfiguration('stale'), {
        enabled: true,
        dry_run: false,
        settings: { stale_days: 'thirty' }
      });
    });

    it('does not resolve an inherited Object property as a plugin schema',
      async () => {
        const configuration = await createLoader(
          'plugins:\n  constructor:\n    enabled: true'
        ).load(REPOSITORY);

        assert.deepStrictEqual(Object.keys(configuration.plugins), [
          'constructor'
        ]);
        assert.deepStrictEqual(configuration.plugins.constructor, {
          enabled: true,
          dry_run: false,
          settings: {}
        });
      });

    it('keeps a plugin named __proto__ as a real configuration key',
      async () => {
        const configuration = await createLoader(
          'plugins:\n  __proto__:\n    enabled: true'
        ).load(REPOSITORY);

        assert.deepStrictEqual(Object.keys(configuration.plugins), [
          '__proto__'
        ]);
        assert.ok(
          Object.prototype.hasOwnProperty.call(
            configuration.plugins,
            '__proto__'
          )
        );
        assert.deepStrictEqual(configuration.plugins.__proto__, {
          enabled: true,
          dry_run: false,
          settings: {}
        });
      });

    it('validates the shape of an unregistered plugin configuration', async () => {
      await assert.rejects(
        () => createLoader(
          'plugins:\n  not-yet-registered:\n    enabled: "yes"'
        ).load(REPOSITORY),
        /must define a boolean enabled field/
      );
    });

    it('rejects an unsupported field in an unregistered plugin ' +
      'configuration', async () => {
        await assert.rejects(
          () => createLoader(
            'plugins:\n  not-yet-registered:\n    enabled: true\n' +
            '    days-before-stale: 7'
          ).load(REPOSITORY),
          /Unsupported fields: days-before-stale\./
        );
      });

    it('validates each plugin against its own schema', async () => {
      const loader = createLoader([
        'plugins:',
        '  stale:',
        '    enabled: true',
        '    settings:',
        '      stale_days: 30',
        '  cla:',
        '    enabled: true',
        '    settings:',
        '      fail_action: close'
      ].join('\n'), [
        createStubPlugin('stale', STALE_SCHEMA),
        createStubPlugin('cla', CLA_SCHEMA)
      ]);

      const configuration = await loader.load(REPOSITORY);

      assert.deepStrictEqual(configuration.getPluginConfiguration('stale', {
        stale: STALE_SCHEMA
      }).settings, { stale_days: 30 });
      assert.deepStrictEqual(configuration.getPluginConfiguration('cla', {
        cla: CLA_SCHEMA
      }).settings, { fail_action: 'close' });
    });

    it('rejects a plugin setting that is not in the allowed values', async () => {
      const loader = createLoader(
        'plugins:\n  cla:\n    enabled: true\n    settings:\n' +
        '      fail_action: block',
        [createStubPlugin('cla', CLA_SCHEMA)]
      );

      await assert.rejects(
        () => loader.load(REPOSITORY),
        /The configuration for plugin cla is invalid/
      );
    });
  });

  describe('plugin-specific configuration lookup', () => {
    it('returns the configuration a plugin declared for itself', async () => {
      const configuration = await createLoader([
        'plugins:',
        '  stale:',
        '    enabled: true',
        '    dry_run: true',
        '    settings:',
        '      stale_days: 30'
      ].join('\n'), [createStubPlugin('stale', STALE_SCHEMA)])
        .load(REPOSITORY);

      assert.deepStrictEqual(configuration.getPluginConfiguration('stale', {
        stale: STALE_SCHEMA
      }), {
        enabled: true,
        dry_run: true,
        settings: { stale_days: 30 }
      });
    });

    it('raises a validation error when a plugin is not configured', async () => {
      const configuration = await createLoader(
        'plugins:\n  cla:\n    enabled: true'
      ).load(REPOSITORY);

      assert.throws(
        () => configuration.getPluginConfiguration('stale'),
        /The plugin stale is not configured/
      );
    });

    it('raises a validation error when the configuration is unavailable',
      async () => {
        const registry = new PluginRegistry();
        const loader = new ConfigurationLoader(createFileReader({}), registry);

        const configuration = await loader.load(REPOSITORY);

        assert.throws(
          () => configuration.getPluginConfiguration('stale'),
          /The plugin stale is not configured/
        );
      });
  });
});
