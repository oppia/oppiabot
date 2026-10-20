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
  OppiabotPlugin,
  PluginResult,
  Trigger
} from '../../src/core';
import { ConfigSchema } from '../../src/types';

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
