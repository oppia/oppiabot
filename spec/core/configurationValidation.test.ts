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
import { DEFAULT_CONFIGURATION_VERSION } from '../../src/core';
import {
  ConfigSchema,
  ConfigurationValidationError
} from '../../src/types';
import {
  createLoader,
  createStubPlugin,
  CLA_SCHEMA,
  readConfigFixture,
  REPOSITORY
} from './configurationTestHelpers';

describe('ConfigurationLoader', () => {
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
});
