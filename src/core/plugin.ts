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
 * @fileoverview Oppiabot plugin contract and registration metadata.
 */

import { Trigger } from './trigger';
import { ConfigSchema } from '../types/repository_configuration';
import { ExecutionContext } from './execution_context';

/**
 * A GitHub operation a plugin reported performing during an execution.
 *
 * A plugin lists the operations it performed in `PluginResult.actions`, so a
 * run's effects can be described as concrete GitHub operations rather than
 * free text.
 */
export enum PluginAction {
  /** Post a comment on the relevant GitHub resource. */
  COMMENT = 'COMMENT',
  /** Apply a label to a GitHub resource. */
  LABEL = 'LABEL',
  /** Close a pull request or issue. */
  CLOSE = 'CLOSE',
  /** Set or update a commit status. */
  STATUS = 'STATUS',
  /** Assign a GitHub user. */
  ASSIGN = 'ASSIGN',
  /** Remove a label from a GitHub resource. */
  REMOVE_LABEL = 'REMOVE_LABEL',
  /** Request a review from a GitHub user. */
  REQUEST_REVIEW = 'REQUEST_REVIEW',
}

/**
 * The outcome a plugin reports for one execution.
 */
export interface PluginResult {
  /** The GitHub operations the plugin performed; empty if it performed none. */
  actions: PluginAction[];
  /** Human-readable description of what happened, for logs and comments. */
  message: string;
  /** Whether the plugin completed the work it intended to do. */
  success: boolean;
}

/**
 * The information a plugin supplies to `PluginRegistry.register()`.
 */
export interface PluginRegistrationMetadata {
  /** Unique identifier; used as both the registry key and configuration key. */
  name: string;
  /**
   * The triggers this plugin handles. The plugin runs when one of these
   * matches the execution's trigger (see `Trigger.matches`). A scheduled
   * trigger sets only the schedule name it handles; the cadence lives in the
   * GitHub Actions workflow, not here.
   */
  supportedTriggers: Trigger[];
  /** Schema used to validate this plugin's entry in the configuration. */
  configSchema: ConfigSchema;
}

/**
 * A self-contained Oppiabot workflow that the Core Engine can run.
 *
 * Implement this interface once per workflow. Plugins are registered with the
 * `PluginRegistry` during initialization, and the registry resolves them per
 * execution by their `supportedTriggers` and configuration. Keeping workflows
 * behind this interface lets them change without modifying the Core Engine.
 */
export interface OppiabotPlugin extends PluginRegistrationMetadata {
  /**
   * Runs this plugin for `context` and reports the outcome.
   *
   * @param {ExecutionContext} context - The execution context, containing the
   *   trigger, event payload, repository, and configuration for this run.
   * @returns {Promise<PluginResult>} The operations performed, a message, and
   *   whether the plugin succeeded.
   * @throws {PluginConfigurationError} if configuration this plugin requires is
   *   missing or invalid.
   * @throws {PluginExecutionError} if the plugin fails while running.
   */
  execute(context: ExecutionContext): Promise<PluginResult>;
}

/**
 * Error thrown when a plugin cannot be resolved by the Plugin Registry.
 */
export class PluginResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginResolutionError';
  }
}

/**
 * Error thrown when required plugin configuration is missing or invalid.
 */
export class PluginConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginConfigurationError';
  }
}

/**
 * Error thrown when plugin execution fails.
 */
export class PluginExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginExecutionError';
  }
}
