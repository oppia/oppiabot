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
 * @fileoverview Deferred execution mechanism.
 *
 * Some plugins cannot decide what to do during the webhook delivery that
 * triggered them: the review workflow, for example, waits three minutes and
 * then re-fetches the pull request so that interim changes are reflected in
 * its decision. Holding the webhook request open for the whole delay is not
 * safe, because the runtime may recycle the request handler once the response
 * is sent. A plugin therefore requests deferral instead of waiting: the Core
 * Engine schedules a follow-up execution through a `DeferredExecutionScheduler`
 * and finishes the current execution. The follow-up re-runs the plugin with
 * the request attached to the execution context, so the plugin can re-fetch
 * the current GitHub state and continue from there.
 */

/**
 * A plugin's request to continue the work in a later execution.
 *
 * A plugin returns one of these on its `PluginResult` when it needs to
 * re-evaluate repository state after a delay instead of deciding during the
 * current run. The Core Engine validates the request before scheduling it and
 * attaches it to the execution context of the follow-up run (see
 * `ExecutionContext.deferredRequest`), which is how the plugin distinguishes
 * an initial run from a follow-up run.
 */
export class DeferredExecutionRequest {
  constructor(
    /**
     * How long to wait before the follow-up execution runs, in milliseconds.
     * Must be a finite number greater than zero (enforced by `validate`).
     */
    public readonly delayMs: number
  ) {}

  /**
   * Validates that this request describes a usable delay.
   *
   * @throws {DeferredExecutionValidationError} if `delayMs` is not a finite
   *   number, or is not greater than zero. Returns without throwing when
   *   every check passes.
   */
  validate(): void {
    if (!Number.isFinite(this.delayMs)) {
      throw new DeferredExecutionValidationError(
        'The deferred execution delay must be a finite number of ' +
          'milliseconds.'
      );
    }
    if (this.delayMs <= 0) {
      throw new DeferredExecutionValidationError(
        'The deferred execution delay must be greater than zero milliseconds.'
      );
    }
  }
}

/**
 * Hands a delayed follow-up execution to the runtime that will run it.
 *
 * The Core Engine calls `schedule` as soon as a plugin requests deferral and
 * never waits for the delay itself, so the execution that requested deferral
 * finishes promptly. What keeps the timer is the runtime's responsibility:
 * the default `TimeoutDeferredExecutionScheduler` uses an in-process timer,
 * while a runtime whose process may be reclaimed before the delay elapses
 * supplies its own implementation, for example one backed by a task queue.
 */
export interface DeferredExecutionScheduler {
  /**
   * Requests that `run` be executed after `request.delayMs` milliseconds.
   *
   * @param {DeferredExecutionRequest} request - The delay to wait. Callers
   *   must have called `request.validate()`; `schedule` trusts it.
   * @param {() => Promise<void>} run - The follow-up execution to run after
   *   the delay.
   * @returns {Promise<void>} Resolves once the follow-up execution has been
   *   accepted for later execution, not when it has run. Rejects if the
   *   follow-up cannot be scheduled; the engine reports that as a failure of
   *   the requesting plugin.
   */
  schedule(
    request: DeferredExecutionRequest,
    run: () => Promise<void>
  ): Promise<void>;
}

/**
 * A `DeferredExecutionScheduler` backed by an in-process timer.
 *
 * Suitable for runtimes that stay alive until pending work finishes, such as
 * a long-running server. A failure of `run` is logged rather than rethrown:
 * `schedule` has already resolved by then, so there is no caller left to
 * reject.
 */
export class TimeoutDeferredExecutionScheduler
  implements DeferredExecutionScheduler {
  /**
   * Starts a timer that runs `run` after `request.delayMs` milliseconds.
   *
   * @param {DeferredExecutionRequest} request - The validated delay to wait.
   * @param {() => Promise<void>} run - The follow-up execution to run after
   *   the delay.
   * @returns {Promise<void>} Resolves immediately after the timer is armed.
   */
  schedule(
    request: DeferredExecutionRequest,
    run: () => Promise<void>
  ): Promise<void> {
    setTimeout(() => {
      run().catch((err) => {
        console.log(
          '[DeferredExecution] A deferred execution failed: ' +
            (err instanceof Error ? err.stack ?? err.message : String(err))
        );
      });
    }, request.delayMs);
    return Promise.resolve();
  }
}

/**
 * Error thrown when a DeferredExecutionRequest is invalid.
 */
export class DeferredExecutionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeferredExecutionValidationError';
  }
}
