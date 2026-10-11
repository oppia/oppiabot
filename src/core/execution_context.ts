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
 * `pull_request.opened` delivery. A scheduled entrypoint sets this to the
 * input its workflow received, which is normally empty.
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
     * The event that caused this run. The entrypoint builds it from the
     * webhook's event and action names, or from the scheduled workflow's
     * names, and the Core Engine passes it to `PluginRegistry.resolvePlugins`
     * to decide which plugins run.
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
   * Requires `trigger` to be neither `undefined` nor `null`, `trigger.event`
   * to be neither `undefined` nor `''`, and `repository` to be neither
   * `undefined` nor `null`. `payload`, `configuration`, and `deliveryId` are
   * not checked; `configuration` in particular has not been loaded yet when an
   * entrypoint builds the context.
   *
   * @throws {ExecutionContextValidationError} with a message naming the failed
   *   field. Returns without throwing when every required field is present.
   */
  validate(): void {
    if (
      this.trigger === undefined ||
      this.trigger === null ||
      this.trigger.event === undefined ||
      this.trigger.event === ''
    ) {
      throw new ExecutionContextValidationError(
        'The execution context must define a trigger, and trigger.event ' +
        'must be defined and non-empty.'
      );
    }
    if (this.repository === undefined || this.repository === null) {
      throw new ExecutionContextValidationError(
        'The execution context must define repository.'
      );
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
