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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ConfigurationLoader,
  ConfigurationLoadError,
  DEFAULT_CONFIGURATION_VERSION,
  OPPIABOT_CONFIG_PATH,
  OppiabotPlugin,
  PluginRegistry,
  RepositoryFileReader,
  Trigger
} from '../../src/core';
import {
  ConfigSchema,
  ConfigurationValidationError,
  RepositoryContext
} from '../../src/types';

const REPOSITORY = new RepositoryContext('oppia', 'oppiabot', 'develop');

/**
 * Creates a file reader that serves a fixed set of repository files.
 *
 * @param {Record<string, string>} files - File contents keyed by
 *   repository-relative path.
 * @param {Object} [options] - Optional reader options.
 * @param {Error} [options.readError] - Error to raise instead of returning the
 *   file contents.
 * @param {string[]} [options.reads] - Array that collects the read requests as
 *   "<filePath>@<ref>" entries.
 * @returns {RepositoryFileReader} A stub file reader.
 */
function createFileReader(
  files: Record<string, string>,
  options: { readError?: Error; reads?: string[] } = {}
): RepositoryFileReader {
  return {
    readRepositoryFile: async (
      repository: RepositoryContext,
      filePath: string,
      ref: string
    ): Promise<string | undefined> => {
      assert.strictEqual(repository, REPOSITORY);
      if (options.reads !== undefined) {
        options.reads.push(`${filePath}@${ref}`);
      }
      if (options.readError !== undefined) {
        throw options.readError;
      }
      return files[filePath];
    }
  };
}

/**
 * Creates a stub plugin with the given configuration schema.
 *
 * @param {string} name - The plugin name.
 * @param {ConfigSchema} configSchema - The plugin configuration schema.
 * @returns {OppiabotPlugin} A stub plugin.
 */
function createStubPlugin(
  name: string,
  configSchema: ConfigSchema
): OppiabotPlugin {
  return {
    name: name,
    supportedTriggers: [new Trigger('pull_request', 'opened')],
    configSchema: configSchema,
    execute: async () => ({ actions: [], message: '', success: true })
  };
}

/**
 * Creates a loader over the given configuration file contents.
 *
 * @param {string} contents - The raw configuration file contents.
 * @param {OppiabotPlugin[]} [plugins] - Plugins to register.
 * @param {Object} [options] - Optional reader options.
 * @returns {ConfigurationLoader} A loader under test.
 */
function createLoader(
  contents: string,
  plugins: OppiabotPlugin[] = [],
  options: { readError?: Error; reads?: string[] } = {}
): ConfigurationLoader {
  const registry = new PluginRegistry();
  for (const plugin of plugins) {
    registry.register(plugin);
  }
  return new ConfigurationLoader(
    createFileReader({ [OPPIABOT_CONFIG_PATH]: contents }, options),
    registry
  );
}

const STALE_SCHEMA = new ConfigSchema(
  {stale_days: {type: 'number'}},
  ['stale_days']
);

const CLA_SCHEMA = new ConfigSchema(
  {fail_action: {type: 'string', enum: ['close', 'comment']}},
  ['fail_action']
);

/**
 * Reads a repository configuration fixture.
 *
 * Fixtures are stored as repository files rather than being copied into the
 * compiled output, so they are resolved relative to the working directory that
 * the test command runs from.
 *
 * @param {string} fixtureName - File name of the fixture.
 * @returns {string} The fixture contents.
 */
function readConfigFixture(fixtureName: string): string {
  return readFileSync(
    join(process.cwd(), 'spec', 'core', 'fixtures', fixtureName),
    'utf8'
  );
}

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

  describe('configuration validation', () => {
    it('rejects a configuration file that is not a mapping', async () => {
      await assert.rejects(
        () => createLoader('- stale\n- cla').load(REPOSITORY),
        (error: unknown) => {
          assert.ok(error instanceof ConfigurationValidationError);
          assert.match(error.message, /must define a mapping/);
          return true;
        }
      );
    });

    it('rejects an empty version', async () => {
      await assert.rejects(
        () => createLoader('version: ""').load(REPOSITORY),
        /must define version as a non-empty string/
      );
    });

    it('rejects a version that is not a string', async () => {
      await assert.rejects(
        () => createLoader('version:\n  major: 2').load(REPOSITORY),
        /must define version as a non-empty string/
      );
    });

    it('rejects plugins that is not a mapping', async () => {
      await assert.rejects(
        () => createLoader('plugins:\n  - stale').load(REPOSITORY),
        /must define plugins as a mapping/
      );
    });

    it('rejects plugins that YAML parses as a timestamp', async () => {
      await assert.rejects(
        () => createLoader('plugins: 2020-01-01').load(REPOSITORY),
        /must define plugins as a mapping/
      );
    });

    it('rejects a plugin without a name', async () => {
      await assert.rejects(
        () => createLoader('plugins:\n  " ": \n    enabled: true')
          .load(REPOSITORY),
        /must not define a plugin with an empty name/
      );
    });

    it('rejects a plugin configuration that is not a mapping', async () => {
      await assert.rejects(
        () => createLoader('plugins:\n  stale: true').load(REPOSITORY),
        /must define a mapping of configuration fields/
      );
    });

    it('rejects a plugin without an enabled flag', async () => {
      await assert.rejects(
        () => createLoader(
          'plugins:\n  stale:\n    settings:\n      stale_days: 30'
        ).load(REPOSITORY),
        /must define a boolean enabled field/
      );
    });

    it('rejects a plugin whose enabled flag is not a boolean', async () => {
      await assert.rejects(
        () => createLoader('plugins:\n  stale:\n    enabled: "yes"')
          .load(REPOSITORY),
        /must define a boolean enabled field/
      );
    });

    it('rejects a plugin whose dry_run flag is not a boolean', async () => {
      await assert.rejects(
        () => createLoader(
          'plugins:\n  stale:\n    enabled: true\n    dry_run: 1'
        ).load(REPOSITORY),
        /must define a boolean dry_run field/
      );
    });

    it('rejects a plugin whose settings are not an object', async () => {
      await assert.rejects(
        () => createLoader(
          'plugins:\n  stale:\n    enabled: true\n    settings: 30'
        ).load(REPOSITORY),
        /must define a settings object/
      );
    });

    it('rejects settings that YAML parses as a timestamp', async () => {
      await assert.rejects(
        () => createLoader(
          'plugins:\n  stale:\n    enabled: true\n' +
          '    settings: 2020-01-01'
        ).load(REPOSITORY),
        /must define a settings object/
      );
    });
  });

  describe('explicit null fields', () => {
    it('rejects an explicit null version instead of applying the default',
      async () => {
        await assert.rejects(
          () => createLoader('version:').load(REPOSITORY),
          (error: Error) => {
            assert.ok(error instanceof ConfigurationValidationError);
            assert.match(error.message, /must define version as a non-empty/);
            return true;
          }
        );
      });

    it('rejects an explicit null plugins field instead of applying the ' +
      'default', async () => {
      await assert.rejects(
        () => createLoader('version: \'1.0\'\nplugins:').load(REPOSITORY),
        (error: Error) => {
          assert.ok(error instanceof ConfigurationValidationError);
          assert.match(error.message, /must define plugins as a mapping/);
          return true;
        }
      );
    });

    it('rejects an explicit null dry_run field instead of applying the ' +
      'default', async () => {
      await assert.rejects(
        () => createLoader(
          'plugins:\n  stale:\n    enabled: true\n    dry_run:'
        ).load(REPOSITORY),
        (error: Error) => {
          assert.ok(error instanceof ConfigurationValidationError);
          assert.match(error.message, /must define a boolean dry_run field/);
          return true;
        }
      );
    });

    it('rejects an explicit null settings field instead of applying the ' +
      'default', async () => {
      await assert.rejects(
        () => createLoader(
          'plugins:\n  stale:\n    enabled: true\n    settings:'
        ).load(REPOSITORY),
        (error: Error) => {
          assert.ok(error instanceof ConfigurationValidationError);
          assert.match(error.message, /must define a settings object/);
          return true;
        }
      );
    });

    it('still applies the documented defaults when the fields are omitted',
      async () => {
        const configuration = await createLoader(
          'plugins:\n  stale:\n    enabled: true'
        ).load(REPOSITORY);

        assert.strictEqual(configuration.version, DEFAULT_CONFIGURATION_VERSION);
        assert.deepStrictEqual(configuration.getPluginConfiguration('stale'), {
          enabled: true,
          dry_run: false,
          settings: {}
        });
      });

    it('loads an empty plugins mapping rather than treating it as null',
      async () => {
        const configuration = await createLoader('plugins: {}').load(
          REPOSITORY
        );

        assert.strictEqual(configuration.version, DEFAULT_CONFIGURATION_VERSION);
        assert.deepStrictEqual(Object.assign({}, configuration.plugins), {});
      });
  });

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

  describe('repository configuration format', () => {
    const STALE_NOTIFIER_SCHEMA = new ConfigSchema(
      {
        stale_days: {type: 'number'},
        stale_label: {type: 'string'}
      },
      ['stale_days']
    );

    it('loads a configuration file in the repository format', async () => {
      const loader = createLoader(readConfigFixture('oppiabot.yml'), [
        createStubPlugin('stale-pr-notifier', STALE_NOTIFIER_SCHEMA),
        createStubPlugin('cla-signature-check', CLA_SCHEMA)
      ]);

      const configuration = await loader.load(REPOSITORY);

      assert.strictEqual(configuration.version, '1.0');
      assert.deepStrictEqual(
        configuration.getPluginConfiguration('stale-pr-notifier', {
          'stale-pr-notifier': STALE_NOTIFIER_SCHEMA
        }),
        {
          enabled: true,
          dry_run: true,
          settings: { stale_days: 30, stale_label: 'status: stale' }
        }
      );
      assert.deepStrictEqual(
        configuration.getPluginConfiguration('cla-signature-check', {
          'cla-signature-check': CLA_SCHEMA
        }),
        {
          enabled: true,
          dry_run: false,
          settings: { fail_action: 'close' }
        }
      );
    });

    it('loads a disabled plugin that is not registered', async () => {
      const loader = createLoader(readConfigFixture('oppiabot.yml'));

      const configuration = await loader.load(REPOSITORY);

      assert.deepStrictEqual(
        configuration.getPluginConfiguration('pr-template-check'),
        { enabled: false, dry_run: false, settings: {} }
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
