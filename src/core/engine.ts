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
import { OppiabotPlugin, PluginAction, PluginResult } from './plugin';
import { PluginRegistry } from './pluginRegistry';
import {
  DeferredExecutionRequest,
  DeferredExecutionScheduler,
  TimeoutDeferredExecutionScheduler
} from './deferredExecution';

/**
 * Runs the plugins that apply to one execution.
 *
 * Call `execute()` with a valid `ExecutionContext`, whose repository
 * configuration is expected to be loaded already. The engine validates the
 * context, asks its `PluginRegistry` for the plugins that match the trigger
 * and are enabled by the configuration, and runs each one. It reports the
 * aggregated results and does not return them to the caller. A plugin that
 * throws does not stop the others; see `execute`. A plugin that needs to
 * re-evaluate repository state after a delay requests deferral instead of
 * waiting; the engine schedules the follow-up run and does not hold the
 * current execution open.
 */
export class CoreEngine {
  constructor(
    private readonly pluginRegistry: PluginRegistry,
    /**
     * Runs the follow-up executions that deferred plugins request. Defaults
     * to an in-process timer; runtimes whose process may be reclaimed before
     * a delay elapses pass their own scheduler.
     */
    private readonly deferredScheduler: DeferredExecutionScheduler =
      new TimeoutDeferredExecutionScheduler()
  ) {}

  /**
   * Executes the plugins applicable to `context`.
   *
   * Resolves the applicable plugins through the registry and awaits each one
   * in turn. Each resolved plugin contributes exactly one result, which is
   * reported once all plugins have run.
   *
   * @param {ExecutionContext} context - The execution context. Must satisfy
   *   `ExecutionContext.validate()`.
   * @returns {Promise<void>} Resolves after every applicable plugin has run and
   *   the aggregated results have been reported. A plugin that throws, or
   *   resolves to a value that is not a `PluginResult`, yields a
   *   `success: false` result in the report rather than rejecting. A plugin
   *   that requests deferral is scheduled for a follow-up run through the
   *   scheduler; this method does not await that run.
   * @throws {ExecutionContextValidationError} if `context` is invalid; no
   *   plugin is run.
   * @throws {PluginResolutionError} if an enabled plugin's configuration is
   *   invalid; no plugin is run.
   */
  async execute(context: ExecutionContext): Promise<void> {
    context.validate();

    const plugins = this.pluginRegistry.resolvePlugins(context);
    const results: PluginResult[] = [];
    for (const plugin of plugins) {
      const result = await this.executePlugin(plugin, context);
      results.push(
        await this.scheduleDeferredExecution(plugin, context, result)
      );
    }
    this.reportResults(plugins, results);
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
   * Runs one plugin, turning a thrown error or an invalid return value into a
   * failed result.
   *
   * @param {OppiabotPlugin} plugin - The plugin to run.
   * @param {ExecutionContext} context - Passed unchanged to the plugin.
   * @returns {Promise<PluginResult>} The plugin's result, or, if it throws or
   *   resolves to something that is not a `PluginResult`, a failed result
   *   describing what went wrong. Never rejects.
   */
  private async executePlugin(
    plugin: OppiabotPlugin,
    context: ExecutionContext
  ): Promise<PluginResult> {
    try {
      const result = await plugin.execute(context);
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
   * Hands a plugin's deferral request to the scheduler, or passes the result
   * through when the plugin did not request one.
   *
   * A deferral request that fails validation, or that the scheduler refuses,
   * becomes a failed result attributed to the plugin. The failure is
   * isolated: it appears in the aggregated report and does not stop the
   * execution or the other plugins.
   *
   * @param {OppiabotPlugin} plugin - The plugin that produced `result`.
   * @param {ExecutionContext} context - The context of the run that produced
   *   `result`; the follow-up run receives a copy of it.
   * @param {PluginResult} result - The plugin's result, which may carry a
   *   deferral request.
   * @returns {Promise<PluginResult>} The result to aggregate: `result`
   *   unchanged when no deferral was requested, otherwise a failed result
   *   describing the invalid request or the scheduling failure.
   */
  private async scheduleDeferredExecution(
    plugin: OppiabotPlugin,
    context: ExecutionContext,
    result: PluginResult
  ): Promise<PluginResult> {
    const request = result.deferred;
    if (request === undefined) {
      return result;
    }
    try {
      request.validate();
    } catch (err) {
      return this.failureResult(
        'it returned an invalid deferred execution request: ' +
          (err instanceof Error ? err.message : String(err)),
        result.actions
      );
    }
    try {
      await this.deferredScheduler.schedule(request, () =>
        this.runDeferred(plugin, context, request)
      );
    } catch (err) {
      return this.failureResult(
        'its deferred execution could not be scheduled: ' + describeError(err),
        result.actions
      );
    }
    console.log(
      `[CoreEngine] Plugin '${plugin.name}' deferred for ` +
        `${request.delayMs}ms.`
    );
    return result;
  }

  /**
   * Runs one plugin's follow-up execution after its deferral delay elapsed.
   *
   * The plugin receives a copy of the original context with the request that
   * produced this run attached (see `ExecutionContext.deferredRequest`), so
   * it can re-fetch the current GitHub state instead of trusting the payload
   * of the original delivery. A plugin that defers again is scheduled once
   * more, the same way as in the original run.
   *
   * @param {OppiabotPlugin} plugin - The plugin that requested deferral.
   * @param {ExecutionContext} context - The context of the run that requested
   *   deferral.
   * @param {DeferredExecutionRequest} request - The validated request.
   * @returns {Promise<void>} Resolves after the follow-up run has been
   *   executed and reported. Never rejects: a failed follow-up run is
   *   reported like any other isolated plugin failure.
   */
  private async runDeferred(
    plugin: OppiabotPlugin,
    context: ExecutionContext,
    request: DeferredExecutionRequest
  ): Promise<void> {
    console.log(
      `[CoreEngine] Running the deferred execution of plugin '${plugin.name}'.`
    );
    const deferredContext = new ExecutionContext(
      context.trigger,
      context.payload,
      context.repository,
      context.configuration,
      context.deliveryId,
      request
    );
    const result = await this.executePlugin(plugin, deferredContext);
    const finalResult = await this.scheduleDeferredExecution(
      plugin,
      deferredContext,
      result
    );
    this.reportResults([plugin], [finalResult]);
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
   * @param {PluginAction[]} [actions] - The operations the plugin performed
   *   before failing, so they are not lost from the report; none by default.
   * @returns {PluginResult} A result with `success: false`.
   */
  private failureResult(
    reason: string,
    actions: PluginAction[] = []
  ): PluginResult {
    return {
      actions: actions,
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
