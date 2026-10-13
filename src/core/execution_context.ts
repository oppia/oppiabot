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
 * @fileoverview ExecutionContext domain object.
 */

import { Trigger } from './trigger';
import { RepositoryContext } from '../types/repository';
import { RepositoryConfiguration } from
  '../types/repository_configuration';

/**
 * The raw event data for one execution, as supplied by the entrypoint.
 *
 * A webhook entrypoint sets this to the GitHub delivery's payload object, for
 * example the `pull_request` payload of a `pull_request.opened` delivery. A
 * scheduled entrypoint sets it to whatever input the workflow supplies. See
 * the GitHub webhook event reference for payload shapes:
 * https://docs.github.com/en/webhooks/webhook-events-and-payloads
 *
 * The Core Engine never reads this value; it is passed unchanged to each
 * resolved plugin.
 */
export type RuntimeEventPayload = Record<string, unknown>;

/**
 * The input to a single Oppiabot execution.
 *
 * An entrypoint constructs exactly one of these per triggered run and passes
 * it to `CoreEngine.execute()`, which passes the same instance to every plugin
 * it resolves. The fields are readonly, but the objects they reference are not
 * frozen; treat them as read-only and do not mutate them.
 */
export class ExecutionContext {
  constructor(
    /**
     * The event that caused this run. Used by the registry to select plugins.
     */
    public readonly trigger: Trigger,
    /**
     * The raw event data for this run. Read by plugins, never by the Core
     * Engine.
     */
    public readonly payload: RuntimeEventPayload,
    /**
     * The repository this run operates on: its owner, name, and default
     * branch.
     */
    public readonly repository: RepositoryContext,
    /**
     * The repository's loaded Oppiabot configuration, or `undefined` if none
     * was loaded. Plugins must handle `undefined`.
     */
    public readonly configuration?: RepositoryConfiguration,
    /**
     * The GitHub webhook delivery ID, or `undefined` for a scheduled run. Use
     * it to correlate a run with the delivery that started it.
     */
    public readonly deliveryId?: string
  ) {}

  /**
   * Validates that this context is ready to execute.
   *
   * Requires `trigger` and `repository` to be present and to pass their own
   * `validate()`, and, when `configuration` is present, requires it to pass
   * `configuration.validate()`. `payload` and `deliveryId` are not checked.
   *
   * @throws {ExecutionContextValidationError} if `trigger` or `repository` is
   *   `undefined` or `null`, or fails its own `validate()`, or if
   *   `configuration` is present and fails `validate()`. The message names the
   *   offending field and includes the underlying error message. Returns
   *   without throwing when every check passes.
   */
  validate(): void {
    if (this.trigger === undefined || this.trigger === null) {
      throw new ExecutionContextValidationError(
        'The execution context must define a trigger.'
      );
    }
    try {
      this.trigger.validate();
    } catch (error) {
      const errorMessage = (
        error instanceof Error ? error.message : String(error)
      );
      throw new ExecutionContextValidationError(
        'The execution context contains an invalid trigger: ' + errorMessage
      );
    }
    if (this.repository === undefined || this.repository === null) {
      throw new ExecutionContextValidationError(
        'The execution context must define repository.'
      );
    }
    try {
      this.repository.validate();
    } catch (error) {
      const errorMessage = (
        error instanceof Error ? error.message : String(error)
      );
      throw new ExecutionContextValidationError(
        'The execution context contains an invalid repository: ' + errorMessage
      );
    }
    if (this.configuration !== undefined && this.configuration !== null) {
      try {
        this.configuration.validate();
      } catch (error) {
        const errorMessage = (
          error instanceof Error ? error.message : String(error)
        );
        throw new ExecutionContextValidationError(
          'The execution context contains an invalid configuration: ' +
          errorMessage
        );
      }
    }
  }
}

/**
 * Error thrown when an ExecutionContext is invalid.
 */
export class ExecutionContextValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionContextValidationError';
  }
}
