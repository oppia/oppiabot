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

/**
 * @fileoverview Oppiabot Core Engine.
 */

import { ExecutionContext } from './execution_context';
import { OppiabotPlugin } from './plugin';
import { PluginResult } from './plugin';
import { PluginRegistry } from './pluginRegistry';

/**
 * The Oppiabot Core Engine runs the plugins that apply to one execution.
 *
 * A webhook handler or a scheduled workflow builds an `ExecutionContext` and
 * passes it to `execute()`. The engine validates the context, finds the
 * registered plugins whose `supportedTriggers` match the context's trigger,
 * executes those plugins, and returns their results.
 *
 * The engine does not tell webhook executions and scheduled executions apart.
 * Both arrive as an `ExecutionContext` and take the same code path; the only
 * difference is which entrypoint built the context and what it put in
 * `payload`. If a plugin throws, the engine records a failed result for that
 * plugin and continues with the other matching plugins.
 */
export class CoreEngine {
  constructor(
    private readonly pluginRegistry: PluginRegistry
  ) {}

  /**
   * Executes the plugins applicable to the current execution.
   *
   * Resolves the plugins whose `supportedTriggers` match `context.trigger` and
   * executes each of them. Every resolved plugin appears exactly once in the
   * returned array.
   *
   * Failures are isolated per plugin: a plugin that throws does not stop the
   * remaining plugins from running, and does not reject this promise. Its
   * failure is reported as a `PluginResult` with `success: false`, and the
   * original error's stack trace is preserved in that result's `message`.
   *
   * @param {ExecutionContext} context - Execution context carrying the trigger,
   *   event payload, repository, and repository configuration. Must satisfy
   *   `ExecutionContext.validate()`.
   * @returns {Promise<PluginResult[]>} One result per resolved plugin. Empty
   *   if no plugin matches the trigger.
   * @throws {ExecutionContextValidationError} if the execution context is
   *   invalid. No plugin is executed in that case.
   */
  async execute(context: ExecutionContext): Promise<PluginResult[]> {
    context.validate();

    const plugins = this.pluginRegistry.resolvePlugins(context.trigger);
    const results: PluginResult[] = [];
    for (const plugin of plugins) {
      results.push(await this.executePlugin(plugin, context));
    }
    return results;
  }

  /**
   * Executes a single plugin, converting any thrown error into a failed
   * result.
   *
   * The error's stack trace is kept: it is appended to the returned `message`
   * after the summary line, so a failure that reaches a log or a comment can
   * still be traced back to where it was thrown.
   *
   * @param {OppiabotPlugin} plugin - The plugin to execute.
   * @param {ExecutionContext} context - The execution context passed unchanged
   *   to the plugin.
   * @returns {Promise<PluginResult>} The plugin's own result on success, or a
   *   result with `success: false`, an empty `actions` array, and the failure
   *   details in `message` if the plugin throws. Never rejects.
   */
  private async executePlugin(
    plugin: OppiabotPlugin,
    context: ExecutionContext
  ): Promise<PluginResult> {
    try {
      return await plugin.execute(context);
    } catch (err) {
      const failure = (
        err instanceof Error && err.stack !== undefined
          ? err.stack
          : String(err)
      );
      return {
        actions: [],
        success: false,
        message: (
          `Plugin '${plugin.name}' failed to execute:\n${failure}`
        ),
      };
    }
  }
}
