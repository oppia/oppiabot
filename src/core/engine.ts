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
 * Runs the plugins that apply to one execution.
 *
 * Call `execute()` with a valid `ExecutionContext`. The engine validates the
 * context, asks its `PluginRegistry` for the plugins that match the trigger
 * and are enabled by the configuration, and runs them in that order. A plugin
 * that throws does not stop the others; see `execute`.
 */
export class CoreEngine {
  constructor(
    private readonly pluginRegistry: PluginRegistry
  ) {}

  /**
   * Executes the plugins applicable to `context`.
   *
   * Resolves the applicable plugins through the registry and awaits each one
   * in turn. Each resolved plugin contributes exactly one result.
   *
   * @param {ExecutionContext} context - The execution context. Must satisfy
   *   `ExecutionContext.validate()`.
   * @returns {Promise<PluginResult[]>} One result per resolved plugin, in
   *   resolution order, or an empty array when none applies. A plugin that
   *   throws yields a `success: false` result rather than rejecting.
   * @throws {ExecutionContextValidationError} if `context` is invalid; no
   *   plugin is run.
   * @throws {PluginResolutionError} if an enabled plugin's configuration is
   *   invalid; no plugin is run.
   */
  async execute(context: ExecutionContext): Promise<PluginResult[]> {
    context.validate();

    const plugins = this.pluginRegistry.resolvePlugins(context);
    const results: PluginResult[] = [];
    for (const plugin of plugins) {
      results.push(await this.executePlugin(plugin, context));
    }
    return results;
  }

  /**
   * Runs one plugin, turning a thrown error into a failed result.
   *
   * @param {OppiabotPlugin} plugin - The plugin to run.
   * @param {ExecutionContext} context - Passed unchanged to the plugin.
   * @returns {Promise<PluginResult>} The plugin's result, or, if it throws, a
   *   result with `success: false`, no actions, and the error's stack in
   *   `message`. Never rejects.
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
