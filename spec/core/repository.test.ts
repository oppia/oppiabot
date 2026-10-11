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
  ConfigSchema,
  ConfigurationValidationError,
  PluginConfiguration,
  RepositoryConfiguration,
  RepositoryContext,
  RepositoryContextValidationError
} from '../../src/types';

describe('RepositoryContext', () => {
  describe('getFullName', () => {
    it('returns the repository identifier', () => {
      const repository = new RepositoryContext('oppia', 'oppiabot', 'develop');
      assert.strictEqual(repository.getFullName(), 'oppia/oppiabot');
    });
  });

  describe('validate', () => {
    it('accepts a repository with all fields populated', () => {
      const repository = new RepositoryContext('oppia', 'oppiabot', 'develop');
      assert.doesNotThrow(() => repository.validate());
    });

    it('rejects a repository with an empty owner', () => {
      const repository = new RepositoryContext('', 'oppiabot', 'develop');
      assert.throws(
        () => repository.validate(),
        (err: Error) => (
          err instanceof RepositoryContextValidationError &&
          err.message.includes('owner')
        )
      );
    });

    it('rejects a repository with an empty name', () => {
      const repository = new RepositoryContext('oppia', '', 'develop');
      assert.throws(
        () => repository.validate(),
        (err: Error) => (
          err instanceof RepositoryContextValidationError &&
          err.message.includes('name')
        )
      );
    });

    it('rejects a repository with an empty default branch', () => {
      const repository = new RepositoryContext('oppia', 'oppiabot', '');
      assert.throws(
        () => repository.validate(),
        (err: Error) => (
          err instanceof RepositoryContextValidationError &&
          err.message.includes('default_branch')
        )
      );
    });

    it('lists all empty fields in the error message', () => {
      const repository = new RepositoryContext('', '', '');
      assert.throws(
        () => repository.validate(),
        (err: Error) => (
          err instanceof RepositoryContextValidationError &&
          err.message.includes('owner') &&
          err.message.includes('name') &&
          err.message.includes('default_branch')
        )
      );
    });
  });
});
describe('RepositoryConfiguration', () => {
  const createConfiguration = (
    version: string,
    plugins: Record<string, PluginConfiguration>
  ): RepositoryConfiguration => new RepositoryConfiguration(version, plugins);

  const createPluginConfiguration = (
    enabled: boolean,
    settings: Record<string, unknown> = {}
  ): PluginConfiguration => ({
    enabled: enabled,
    dry_run: false,
    settings: settings
  });

  describe('getPluginConfiguration', () => {
    it('returns the configuration for a configured plugin', () => {
      const pluginConfiguration = createPluginConfiguration(true);
      const configuration = createConfiguration('1.0', {
        stale: pluginConfiguration
      });
      assert.strictEqual(
        configuration.getPluginConfiguration('stale'),
        pluginConfiguration
      );
    });

    it('rejects a plugin that is not configured', () => {
      const configuration = createConfiguration('1.0', {});
      assert.throws(
        () => configuration.getPluginConfiguration('stale'),
        (error: unknown) => {
          assert.ok(error instanceof ConfigurationValidationError);
          assert.match(error.message, /plugin stale is not configured/);
          return true;
        }
      );
    });

    it('does not resolve an inherited Object property as a plugin schema', () => {
      const pluginConfiguration = createPluginConfiguration(true, {
        stale_days: 'thirty'
      });
      const configuration = createConfiguration('1.0', {
        constructor: pluginConfiguration
      });

      assert.strictEqual(
        configuration.getPluginConfiguration('constructor'),
        pluginConfiguration
      );
    });

    it('rejects a plugin whose configuration violates the plugin schema', () => {
      const configSchema = new ConfigSchema(
        {stale_days: {type: 'number'}},
        ['stale_days']
      );
      const configuration = createConfiguration('1.0', {
        stale: createPluginConfiguration(true, {stale_days: 'thirty'})
      });
      assert.throws(
        () => configuration.getPluginConfiguration('stale', {
          stale: configSchema
        }),
        (error: unknown) => {
          assert.ok(error instanceof ConfigurationValidationError);
          assert.match(error.message, /plugin stale is invalid/);
          return true;
        }
      );
    });

    it('applies the plugin schema even when the plugin is disabled', () => {
      const configSchema = new ConfigSchema(
        {stale_days: {type: 'number'}},
        ['stale_days']
      );
      const configuration = createConfiguration('1.0', {
        stale: createPluginConfiguration(false, {stale_days: 'thirty'})
      });
      assert.throws(
        () => configuration.getPluginConfiguration('stale', {
          stale: configSchema
        }),
        ConfigurationValidationError
      );
    });

    it('returns the configuration for a disabled plugin', () => {
      const pluginConfiguration = createPluginConfiguration(false);
      const configuration = createConfiguration('1.0', {
        stale: pluginConfiguration
      });
      assert.strictEqual(
        configuration.getPluginConfiguration('stale'),
        pluginConfiguration
      );
    });
  });

  describe('validate', () => {
    it('accepts a configuration with a version and no plugins', () => {
      createConfiguration('1.0', {}).validate();
    });

    it('does not resolve an inherited Object property as a plugin schema', () => {
      createConfiguration('1.0', {
        constructor: createPluginConfiguration(true, {stale_days: 'thirty'})
      }).validate();
    });

    it('rejects a configuration with an empty version', () => {
      assert.throws(
        () => createConfiguration('', {}).validate(),
        (error: unknown) => {
          assert.ok(error instanceof ConfigurationValidationError);
          assert.match(error.message, /must define a version/);
          return true;
        }
      );
    });

    it('accepts an enabled plugin with well-formed settings', () => {
      createConfiguration('1.0', {
        stale: createPluginConfiguration(true, {stale_days: 30})
      }).validate();
    });

    it('rejects a plugin whose enabled flag is not a boolean', () => {
      assert.throws(
        () => createConfiguration('1.0', {
          stale: {
            enabled: 'yes',
            dry_run: false,
            settings: {}
          } as unknown as PluginConfiguration
        }).validate(),
        (error: unknown) => {
          assert.ok(error instanceof ConfigurationValidationError);
          assert.match(error.message, /boolean enabled field/);
          return true;
        }
      );
    });

    it('rejects a plugin whose dry_run flag is not a boolean', () => {
      assert.throws(
        () => createConfiguration('1.0', {
          stale: {
            enabled: true,
            dry_run: 1,
            settings: {}
          } as unknown as PluginConfiguration
        }).validate(),
        (error: unknown) => {
          assert.ok(error instanceof ConfigurationValidationError);
          assert.match(error.message, /boolean dry_run field/);
          return true;
        }
      );
    });

    it('rejects a plugin whose settings are not an object', () => {
      assert.throws(
        () => createConfiguration('1.0', {
          stale: {
            enabled: true,
            dry_run: false,
            settings: null
          }
        } as unknown as Record<string, PluginConfiguration>).validate(),
        (error: unknown) => {
          assert.ok(error instanceof ConfigurationValidationError);
          assert.match(error.message, /settings object/);
          return true;
        }
      );
    });

    it('validates enabled plugin settings against the plugin schema', () => {
      const configSchema = new ConfigSchema(
        {stale_days: {type: 'number'}},
        ['stale_days']
      );
      assert.throws(
        () => createConfiguration('1.0', {
          stale: createPluginConfiguration(true, {stale_days: 'thirty'})
        }).validate({stale: configSchema}),
        (error: unknown) => {
          assert.ok(error instanceof ConfigurationValidationError);
          assert.match(error.message, /plugin stale is invalid/);
          return true;
        }
      );
    });

    it('rejects an enabled plugin missing a required setting', () => {
      const configSchema = new ConfigSchema(
        {stale_days: {type: 'number'}},
        ['stale_days']
      );
      assert.throws(
        () => createConfiguration('1.0', {
          stale: createPluginConfiguration(true)
        }).validate({stale: configSchema}),
        ConfigurationValidationError
      );
    });

    it('does not apply the plugin schema to a disabled plugin', () => {
      const configSchema = new ConfigSchema(
        {stale_days: {type: 'number'}},
        ['stale_days']
      );
      createConfiguration('1.0', {
        stale: createPluginConfiguration(false)
      }).validate({stale: configSchema});
    });

    it('validates a plugin with no registered schema structurally only', () => {
      createConfiguration('1.0', {
        unknownPlugin: createPluginConfiguration(true, {anything: 'goes'})
      }).validate();
    });
  });
});
