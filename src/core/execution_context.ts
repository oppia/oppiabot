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
 * The raw event data for one execution, as received by the entrypoint.
 *
 * A webhook entrypoint sets this to the GitHub webhook payload for the
 * delivered event, for example the `pull_request` object from a
 * `pull_request.opened` delivery. A scheduled entrypoint sets this to
 * whatever input its scheduled workflow supplies.
 *
 * The Core Engine does not read this field; it is handed to each resolved
 * plugin, and the plugin decides which parts of it to use.
 */
export type RuntimeEventPayload = Record<string, unknown>;

/**
 * The input to a single Oppiabot execution.
 *
 * An entrypoint (a webhook handler or a scheduled workflow) constructs one
 * instance per triggered run and passes it to `CoreEngine.execute()`, which
 * passes the same instance to every resolved plugin. All fields are readonly,
 * so their properties cannot be reassigned through the typed API. The nested
 * objects they reference are not frozen, so plugins must treat them as
 * read-only and must not mutate them.
 */
export class ExecutionContext {
  constructor(
    /**
     * The event that caused this run; see `Trigger`.
     */
    public readonly trigger: Trigger,
    /**
     * Raw event data for this run, as described by `RuntimeEventPayload`.
     * Read by plugins, not by the Core Engine.
     */
    public readonly payload: RuntimeEventPayload,
    /**
     * The repository this run is about, providing the owner, name, and
     * default branch plugins operate on.
     */
    public readonly repository: RepositoryContext,
    /**
     * The repository's Oppiabot configuration. `undefined` when no
     * configuration has been loaded for this execution; plugins must handle
     * that case.
     */
    public readonly configuration?: RepositoryConfiguration,
    /**
     * The GitHub webhook delivery ID when this run came from a webhook, and
     * `undefined` when it came from a schedule. Use it to correlate a run with
     * the delivery that started it.
     */
    public readonly deliveryId?: string
  ) {}

  /**
   * Checks that this execution context can be executed.
   *
   * Requires `trigger` and `repository` to be present and to satisfy their own
   * `validate()` methods: `Trigger.validate()` rejects an undefined, null, or
   * empty event and a null or empty action, and `RepositoryContext.validate()`
   * rejects an undefined, null, or empty owner, name, or default branch. When
   * `configuration` is provided its own `validate()` is called too. `payload`
   * and `deliveryId` carry no constraints here, so they are not inspected.
   *
   * @throws {ExecutionContextValidationError} naming the first field that
   *   fails, with that field's own validation message appended. Returns
   *   without throwing if every check passes.
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
