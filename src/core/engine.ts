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
 * passes it to `execute()`. The engine validates the context, asks the plugin
 * registry for the registered plugins that both match the context's trigger
 * and are enabled by the repository configuration, executes those plugins, and
 * reports their results. The engine coordinates execution; it does not return
 * a result summary to its caller.
 *
 * Webhook and scheduled executions follow the same code path. Their triggers
 * and payloads reflect the event or scheduled workflow that started each
 * execution. If a plugin throws, the engine records a failed result for that
 * plugin and continues with the other matching plugins.
 *
 * When the execution context carries a GitHub client, the engine gives each
 * plugin a client configured from that plugin's `dry_run` configuration.
 * Dry-Run plugins therefore reach GitHub for reads but record, rather than
 * perform, their intended mutations.
 */
export class CoreEngine {
  constructor(
    private readonly pluginRegistry: PluginRegistry
  ) {}

  /**
   * Executes the plugins applicable to the current execution.
   *
   * Resolves the plugins that match `context.trigger` and are enabled by the
   * repository configuration, then executes each of them and reports the
   * aggregated results. Produces exactly one result per resolved plugin, in
   * registration order, for reporting.
   *
   * Failures are isolated per plugin: a plugin that throws, or resolves to a
   * value that is not a `PluginResult`, does not stop the remaining plugins
   * from running, and does not reject this promise. Its failure is reported as
   * a result with `success: false`, and the original error's stack trace is
   * preserved in the report.
   *
   * @param {ExecutionContext} context - Execution context carrying the trigger,
   *   event payload, repository, and repository configuration. Must satisfy
   *   `ExecutionContext.validate()`.
   * @returns {Promise<void>} Resolves after every applicable plugin has run and
   *   the aggregated results have been reported.
   * @throws {ExecutionContextValidationError} if the execution context is
   *   invalid. No plugin is executed in that case.
   * @throws {PluginResolutionError} if an enabled plugin's configuration
   *   cannot be resolved. No plugin is executed in that case.
   */
  async execute(context: ExecutionContext): Promise<void> {
    context.validate();

    const plugins = this.pluginRegistry.resolvePlugins(context);
    const results: PluginResult[] = [];
    for (const plugin of plugins) {
      results.push(await this.executePlugin(plugin, context));
    }
    this.reportResults(plugins, results);
  }

  /**
   * Builds the context a plugin receives.
   *
   * When the context carries a GitHub client, the returned context carries a
   * client for the same repository whose Dry-Run mode combines the plugin's
   * `dry_run` configuration with the mode of the client the entrypoint
   * supplied. A client that is already in Dry-Run mode takes precedence, so a
   * maintainer can run an entire execution in Dry-Run mode regardless of the
   * per-plugin configuration.
   *
   * Each Dry-Run plugin receives its own client so that the mutations it
   * records are attributed to that plugin alone. Live plugins share the client
   * supplied by the entrypoint and record nothing.
   *
   * @param {OppiabotPlugin} plugin - The plugin that will receive the context.
   * @param {ExecutionContext} context - The context of the execution.
   * @returns {ExecutionContext} The original context when it carries no GitHub
   *   client or runs live, otherwise a copy with a Dry-Run client.
   * @throws {ConfigurationValidationError} if the plugin's configuration no
   *   longer satisfies its schema.
   */
  private contextForPlugin(
    plugin: OppiabotPlugin,
    context: ExecutionContext
  ): ExecutionContext {
    const githubClient = context.githubClient;
    const configuration = context.configuration;
    if (githubClient === undefined || configuration === undefined) {
      return context;
    }
    const pluginConfiguration = configuration.getPluginConfiguration(
      plugin.name,
      {[plugin.name]: plugin.configSchema}
    );
    const dryRun = githubClient.isDryRun() || pluginConfiguration.dry_run;
    if (!dryRun) {
      return context;
    }
    return context.withGitHubClient(githubClient.asDryRun());
  }

  /**
   * Reports the aggregated results of one execution.
   *
   * The engine reports results by logging them: a one-line summary of how many
   * plugins ran and how many succeeded, followed by one line per failed plugin.
   * Each failure line names the plugin, so a failure is always attributable
   * even when the plugin supplied only its own `message`.
   *
   * @param {readonly OppiabotPlugin[]} plugins - The plugins that were run, in
   *   the same order as `results`.
   * @param {readonly PluginResult[]} results - The result of each plugin, one
   *   per entry of `plugins`.
   */
  private reportResults(
    plugins: readonly OppiabotPlugin[],
    results: readonly PluginResult[]
  ): void {
    const succeeded = results.filter((result) => result.success).length;
    const failed = results.length - succeeded;
    console.log(
      `[CoreEngine] Executed ${results.length} plugin(s): ` +
        `${succeeded} succeeded, ${failed} failed.`
    );
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      if (!result.success) {
        console.log(
          `[CoreEngine] Plugin '${plugins[index].name}' failed: ` +
            `${result.message}`
        );
      }
    }
  }

  /**
   * Executes a single plugin, converting any thrown error or invalid return
   * value into a failed result.
   *
   * When a plugin throws an error, its stack trace is included in the returned
   * `message` when available, so the failure can be traced back to where it
   * originated.
   *
   * @param {OppiabotPlugin} plugin - The plugin to execute.
   * @param {ExecutionContext} context - The execution context. The plugin
   *   receives a copy whose GitHub client is configured for its Dry-Run mode.
   * @returns {Promise<PluginResult>} The plugin's own result on success, or a
   *   result with `success: false`, an empty `actions` array, and the failure
   *   details in `message` if it throws or returns an invalid result. Never
   *   rejects.
   */
  private async executePlugin(
    plugin: OppiabotPlugin,
    context: ExecutionContext
  ): Promise<PluginResult> {
    try {
      const result = await plugin.execute(this.contextForPlugin(
        plugin,
        context
      ));
      if (!isPluginResult(result)) {
        return this.failureResult(
          'it returned a value that is not a PluginResult.'
        );
      }
      return result;
    } catch (err) {
      return this.failureResult(describeError(err));
    }
  }

  /**
   * Builds a failed result carrying `reason` as its message.
   *
   * The plugin's name is not included here. `reportResults` attaches it when it
   * logs the failure, so engine-detected and self-reported failures are
   * attributed in the same way.
   *
   * @param {string} reason - Why the plugin failed; a stack trace for a thrown
   *   error, or a description of an invalid return value.
   * @returns {PluginResult} A result with `success: false` and no actions.
   */
  private failureResult(reason: string): PluginResult {
    return {
      actions: [],
      success: false,
      message: reason,
    };
  }
}

/**
 * Returns whether `result` satisfies the PluginResult shape.
 *
 * A plugin's `execute` is typed to return a `PluginResult`, but at runtime it
 * may resolve to something else, such as `undefined`. The engine treats such a
 * value as an isolated plugin failure rather than aggregating it.
 *
 * @param {unknown} result - The value a plugin resolved to.
 * @returns {boolean} Whether `result` is a PluginResult.
 */
function isPluginResult(result: unknown): result is PluginResult {
  if (typeof result !== 'object' || result === null) {
    return false;
  }
  const candidate = result as Partial<PluginResult>;
  return (
    Array.isArray(candidate.actions) &&
    typeof candidate.message === 'string' &&
    typeof candidate.success === 'boolean'
  );
}

/**
 * Describes a thrown value for a failed result message.
 *
 * An `Error` is described by its stack trace, or by its string form when it has
 * no stack. A thrown string is used as-is. Any other value, such as a plain
 * object, is serialized with `JSON.stringify` so its contents are not lost; if
 * serialization is impossible or yields nothing, the value's string form is
 * used instead.
 *
 * @param {unknown} thrown - The value a plugin threw.
 * @returns {string} A description of the thrown value.
 */
function describeError(thrown: unknown): string {
  if (thrown instanceof Error) {
    return thrown.stack ?? String(thrown);
  }
  if (typeof thrown === 'string') {
    return thrown;
  }
  try {
    const serialized = JSON.stringify(thrown);
    if (serialized !== undefined) {
      return serialized;
    }
  } catch {
    // Not serializable (for example, a circular reference); use String below.
  }
  return String(thrown);
}
