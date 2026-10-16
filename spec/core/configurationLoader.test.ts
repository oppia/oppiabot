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
  ConfigurationLoadError,
  DEFAULT_CONFIGURATION_VERSION,
  OPPIABOT_CONFIG_PATH,
  PluginRegistry
} from '../../src/core';
import {
  ConfigurationValidationError,
  RepositoryContext
} from '../../src/types';
import {
  createFileReader,
  createLoader,
  createStubPlugin,
  REPOSITORY,
  STALE_SCHEMA
} from './configurationTestHelpers';

describe('ConfigurationLoader', () => {
  describe('load', () => {
    it('reads the configuration file from the default branch', async () => {
      const reads: string[] = [];
      const loader = createLoader('version: "1.0"\n', [], { reads: reads });

      await loader.load(REPOSITORY);

      assert.deepStrictEqual(reads, [
        `${OPPIABOT_CONFIG_PATH}@${REPOSITORY.default_branch}`
      ]);
    });

    it('loads the declared version and plugin configuration', async () => {
      const loader = createLoader([
        'version: "2"',
        'plugins:',
        '  stale:',
        '    enabled: true',
        '    dry_run: true',
        '    settings:',
        '      stale_days: 30'
      ].join('\n'));

      const configuration = await loader.load(REPOSITORY);

      assert.strictEqual(configuration.version, '2');
      assert.deepStrictEqual(configuration.getPluginConfiguration('stale'), {
        enabled: true,
        dry_run: true,
        settings: { stale_days: 30 }
      });
    });

    it('resolves to a configuration with no enabled plugins when the ' +
      'configuration file is absent', async () => {
      const registry = new PluginRegistry();
      registry.register(createStubPlugin('stale', STALE_SCHEMA));
      const loader = new ConfigurationLoader(
        createFileReader({}),
        registry
      );

      const configuration = await loader.load(REPOSITORY);

      assert.strictEqual(configuration.version, DEFAULT_CONFIGURATION_VERSION);
      assert.deepStrictEqual(Object.assign({}, configuration.plugins), {});
    });

    it('resolves to a configuration with no enabled plugins for an empty ' +
      'configuration file', async () => {
      const configuration = await createLoader('').load(REPOSITORY);

      assert.strictEqual(configuration.version, DEFAULT_CONFIGURATION_VERSION);
      assert.deepStrictEqual(Object.assign({}, configuration.plugins), {});
    });

    it('applies the default version when the configuration omits it', async () => {
      const configuration = await createLoader('plugins: {}').load(
        REPOSITORY
      );

      assert.strictEqual(configuration.version, DEFAULT_CONFIGURATION_VERSION);
    });

    it('rejects a numeric version', async () => {
      await assert.rejects(
        () => createLoader('version: 2').load(REPOSITORY),
        /must define version as a non-empty string/
      );
    });

    it('distinguishes versions that a number would collapse', async () => {
      await assert.rejects(
        () => createLoader('version: 2.0').load(REPOSITORY),
        /must define version as a non-empty string/
      );
    });

    it('defaults dry_run to false and settings to an empty object', async () => {
      const configuration = await createLoader(
        'plugins:\n  stale:\n    enabled: true'
      ).load(REPOSITORY);

      assert.deepStrictEqual(configuration.getPluginConfiguration('stale'), {
        enabled: true,
        dry_run: false,
        settings: {}
      });
    });

    it('rejects an unsupported top-level configuration field', async () => {
      await assert.rejects(
        () => createLoader([
          'version: "1.0"',
          'plugin:',
          '  stale:',
          '    enabled: true'
        ].join('\n')).load(REPOSITORY),
        (error: unknown) => {
          assert.ok(error instanceof ConfigurationValidationError);
          assert.match(
            error.message,
            /must only define the following fields: version, plugins/
          );
          assert.match(error.message, /Unsupported fields: plugin\./);
          return true;
        }
      );
    });

    it('rejects an unsupported plugin configuration field', async () => {
      await assert.rejects(
        () => createLoader(
          'plugins:\n  stale:\n    enabled: true\n    days-before-stale: 7',
          [createStubPlugin('stale', STALE_SCHEMA)]
        ).load(REPOSITORY),
        (error: unknown) => {
          assert.ok(error instanceof ConfigurationValidationError);
          assert.match(
            error.message,
            /must only define the following fields: enabled, dry_run, settings/
          );
          assert.match(
            error.message,
            /Unsupported fields: days-before-stale\./
          );
          return true;
        }
      );
    });

    it('reports every unsupported field in one error', async () => {
      await assert.rejects(
        () => createLoader('global:\n  a: 1\nunrelated: true').load(
          REPOSITORY
        ),
        /Unsupported fields: global, unrelated\./
      );
    });

    it('loads configuration for a plugin that is not registered', async () => {
      const configuration = await createLoader(
        'plugins:\n  not-yet-registered:\n    enabled: true'
      ).load(REPOSITORY);

      assert.deepStrictEqual(Object.assign({}, configuration.plugins), {
        'not-yet-registered': {
          enabled: true,
          dry_run: false,
          settings: {}
        }
      });
    });

    it('does not execute repository configuration as YAML code', async () => {
      await assert.rejects(
        () => createLoader(
          'version: !!js/function "function () { return 1; }"'
        ).load(REPOSITORY),
        ConfigurationLoadError
      );
    });

    it('rejects an invalid repository', async () => {
      const loader = createLoader('version: "1.0"\n');

      await assert.rejects(
        () => loader.load(new RepositoryContext('oppia', 'oppiabot', '')),
        /default_branch/
      );
    });
  });

  describe('load failures', () => {
    it('raises a load error when the configuration file cannot be read', async () => {
      const loader = createLoader('version: "1.0"\n', [], {
        readError: new Error('Not Found')
      });

      await assert.rejects(
        () => loader.load(REPOSITORY),
        (error: unknown) => {
          assert.ok(error instanceof ConfigurationLoadError);
          assert.match(error.message, /Could not load/);
          assert.match(error.message, /Not Found/);
          return true;
        }
      );
    });

    it('raises a load error when the configuration file is not valid YAML',
      async () => {
        await assert.rejects(
          () => createLoader('plugins:\n  - stale\n :::\n').load(REPOSITORY),
          (error: unknown) => {
            assert.ok(error instanceof ConfigurationLoadError);
            assert.match(error.message, /Could not parse/);
            return true;
          }
        );
      });
  });
});
