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

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ConfigurationLoader,
  OPPIABOT_CONFIG_PATH,
  OppiabotPlugin,
  PluginRegistry,
  RepositoryFileReader,
  Trigger
} from '../../src/core';
import { ConfigSchema, RepositoryContext } from '../../src/types';

export const REPOSITORY = new RepositoryContext('oppia', 'oppiabot', 'develop');

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
export function createFileReader(
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
export function createStubPlugin(
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
export function createLoader(
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

export const STALE_SCHEMA = new ConfigSchema(
  {stale_days: {type: 'number'}},
  ['stale_days']
);

export const CLA_SCHEMA = new ConfigSchema(
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
export function readConfigFixture(fixtureName: string): string {
  return readFileSync(
    join(process.cwd(), 'spec', 'core', 'fixtures', fixtureName),
    'utf8'
  );
}
