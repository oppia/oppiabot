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

import {
  ExecutionContext,
  OppiabotGitHubClient,
  OppiabotPlugin,
  PluginResult,
  Trigger
} from '../../src/core';
import {
  GitHubApiClient,
  GitHubApiResponse
} from '../../src/core/oppiabot_github_client';
import { ConfigSchema, RepositoryContext } from '../../src/types';

/**
 * Records the requests that reach the fake GitHub API so tests can assert
 * whether a mutation was sent or intercepted.
 */
export class FakeGitHubApiClient implements GitHubApiClient {
  /** Requests sent to the fake GitHub API, in order. */
  readonly requests: Array<{
    route: string;
    parameters: Record<string, unknown>;
  }> = [];

  async request<TData>(
    route: string,
    parameters: Record<string, unknown>
  ): Promise<GitHubApiResponse<TData>> {
    this.requests.push({route, parameters});
    return {status: 200, data: {} as TData};
  }
}

/**
 * Creates a GitHub client for an execution.
 *
 * @param {FakeGitHubApiClient} api - The fake GitHub API.
 * @param {boolean} [dryRun] - Whether the client records mutations.
 * @returns {OppiabotGitHubClient} The client under test.
 */
export function createGitHubClient(
  api: FakeGitHubApiClient,
  dryRun = false
): OppiabotGitHubClient {
  return new OppiabotGitHubClient(
    api,
    new RepositoryContext('oppia', 'oppiabot', 'develop'),
    {dryRun}
  );
}

/**
 * Captures console.log output for the duration of one test.
 *
 * The engine reports execution results through the log rather than a return
 * value, so tests read that output.
 *
 * @returns {object} The captured `logs` array and a `restore` callback.
 */
export function captureLogs(): {logs: string[]; restore: () => void} {
  const logs: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map((arg) => String(arg)).join(' '));
  };
  return {
    logs: logs,
    restore: () => {
      console.log = original;
    },
  };
}

/**
 * Creates a stub plugin that resolves to a configurable result.
 *
 * @param {string} name - The plugin name.
 * @param {Trigger[]} supportedTriggers - The supported triggers.
 * @param {(context: ExecutionContext) => Promise<PluginResult>} execute - The
 *   execution handler.
 * @returns {OppiabotPlugin} A stub plugin.
 */
export function createStubPlugin(
  name: string,
  supportedTriggers: Trigger[],
  execute: (context: ExecutionContext) => Promise<PluginResult>
): OppiabotPlugin {
  return {
    name: name,
    supportedTriggers: supportedTriggers,
    configSchema: new ConfigSchema({}, []),
    execute: execute,
  };
}

/**
 * Returns a successful plugin result with the given message.
 *
 * @param {string} message - The result message.
 * @returns {PluginResult} A successful result.
 */
export function successfulResult(message: string): PluginResult {
  return { actions: [], message: message, success: true };
}
