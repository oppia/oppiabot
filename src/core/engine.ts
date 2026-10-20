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
 * executes those plugins, and reports their results. The engine coordinates
 * execution; it does not return a result summary to its caller.
 *
 * Webhook and scheduled executions follow the same code path. Their triggers
 * and payloads reflect the event or scheduled workflow that started each
 * execution. If a plugin throws, the engine records a failed result for that
 * plugin and continues with the other matching plugins.
 */
export class CoreEngine {
  constructor(
    private readonly pluginRegistry: PluginRegistry
  ) {}

  /**
   * Executes the plugins applicable to the current execution.
   *
   * Resolves the plugins whose `supportedTriggers` match `context.trigger`,
   * executes each of them, and reports the aggregated results. Produces exactly
   * one result per resolved plugin, in registration order, for reporting.
   *
   * Failures are isolated per plugin: a plugin that throws does not stop the
   * remaining plugins from running, and does not reject this promise. Its
   * failure is reported as a result with `success: false`, and the original
   * error's stack trace is preserved in the report.
   *
   * @param {ExecutionContext} context - Execution context carrying the trigger,
   *   event payload, repository, and repository configuration. Must satisfy
   *   `ExecutionContext.validate()`.
   * @returns {Promise<void>} Resolves after every applicable plugin has run and
   *   the aggregated results have been reported.
   * @throws {ExecutionContextValidationError} if the execution context is
   *   invalid. No plugin is executed in that case.
   */
  async execute(context: ExecutionContext): Promise<void> {
    context.validate();

    const plugins = this.pluginRegistry.resolvePlugins(context.trigger);
    const results: PluginResult[] = [];
    for (const plugin of plugins) {
      results.push(await this.executePlugin(plugin, context));
    }
    this.reportResults(results);
  }

  /**
   * Reports the aggregated results of one execution.
   *
   * The engine owns execution reporting. It logs how many plugins ran and how
   * many succeeded, followed by the failure detail for each plugin that failed.
   *
   * @param {readonly PluginResult[]} results - The results collected for the
   *   execution, one per resolved plugin.
   */
  private reportResults(results: readonly PluginResult[]): void {
    const succeeded = results.filter((result) => result.success).length;
    const failed = results.length - succeeded;
    console.log(
      `[CoreEngine] Executed ${results.length} plugin(s): ` +
        `${succeeded} succeeded, ${failed} failed.`
    );
    for (const result of results) {
      if (!result.success) {
        console.log(`[CoreEngine] ${result.message}`);
      }
    }
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
