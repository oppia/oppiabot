// Copyright 2026 The Oppia Authors. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Wiring for the GitHub Actions scheduled entrypoint.
 *
 * A scheduled GitHub Actions workflow checks the repository out before
 * invoking Oppiabot, so the configuration file is read from the checkout
 * rather than through the GitHub contents API. This module builds the
 * entrypoint from a plugin registry and the workspace directory, keeping
 * authentication and deployment concerns outside the entrypoint.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

import {
  ConfigurationLoader,
  CoreEngine,
  PluginRegistry,
  RepositoryFileReader
} from '../core';
import { RepositoryContext } from '../types';
import {
  ScheduledEnvironment,
  handleScheduledExecution
} from './githubAction';

/**
 * Name of the environment variable GitHub Actions sets to the checked-out
 * repository directory.
 */
export const GITHUB_WORKSPACE_ENV = 'GITHUB_WORKSPACE';

/**
 * A `RepositoryFileReader` backed by the checked-out workspace.
 *
 * The configuration loader reads `.github/oppiabot.yml` through this reader.
 * A missing file resolves to `undefined`, which the loader treats as a
 * repository that has not opted in to Oppiabot. The `ref` parameter is
 * ignored: a scheduled workflow checks out the ref it runs against, so the
 * checkout already holds the configuration at that ref.
 */
export class WorkspaceRepositoryFileReader implements RepositoryFileReader {
  constructor(private readonly workspaceDirectory: string) {}

  /**
   * Reads a text file from the checked-out workspace.
   *
   * @param {RepositoryContext} _repository - Repository containing the file;
   *   unused because the workspace already identifies it.
   * @param {string} filePath - Repository-relative path of the file.
   * @param {string} _ref - Git ref to read the file at; unused because the
   *   checkout already targets the scheduled ref.
   * @returns {Promise<string | undefined>} The file contents, or undefined
   *   when the workspace does not contain the file.
   * @throws {Error} if the file cannot be read for a reason other than being
   *   absent.
   */
  async readRepositoryFile(
    _repository: RepositoryContext,
    filePath: string,
    _ref: string
  ): Promise<string | undefined> {
    try {
      return await readFile(join(this.workspaceDirectory, filePath), 'utf8');
    } catch (error) {
      if (isNotFoundError(error)) {
        return undefined;
      }
      throw error;
    }
  }
}

/**
 * Options used to build the GitHub Actions scheduled entrypoint.
 */
export interface ScheduledExecutionOptions {
  /** Registry of the plugins the Core Engine may execute. */
  pluginRegistry: PluginRegistry;
  /** Directory the workflow checked the repository out into. */
  workspaceDirectory: string;
}

/**
 * Builds the handler that processes one scheduled workflow run.
 *
 * @param {ScheduledExecutionOptions} options - The plugin registry and
 *   workspace directory.
 * @returns {(environment: ScheduledEnvironment) => Promise<void>} A handler
 *   that runs the applicable plugins for the scheduled run described by the
 *   given environment, typically `process.env`.
 */
export function createScheduledExecution(
  options: ScheduledExecutionOptions
): (environment: ScheduledEnvironment) => Promise<void> {
  const configurationLoader = new ConfigurationLoader(
    new WorkspaceRepositoryFileReader(options.workspaceDirectory),
    options.pluginRegistry
  );
  const engine = new CoreEngine(options.pluginRegistry);
  return (environment: ScheduledEnvironment): Promise<void> =>
    handleScheduledExecution({
      engine: engine,
      configurationLoader: configurationLoader,
      environment: environment
    });
}

/**
 * Returns whether an error represents a missing file.
 *
 * @param {unknown} error - The error thrown while reading the file.
 * @returns {boolean} Whether the error is a file-not-found error.
 */
function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
