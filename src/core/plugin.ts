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
 * The GitHub operations a plugin performed while handling an execution.
 *
 * A plugin reports what it did by returning these values in
 * `PluginResult.actions`, so a run can be described as a list of concrete
 * GitHub changes instead of free text.
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
 * Represents the outcome of plugin execution returned by an Oppiabot plugin
 * after processing an execution context.
 */
export interface PluginResult {
  /** GitHub operations performed during execution. */
  actions: PluginAction[];
  /** Human-readable explanation of the plugin execution result. */
  message: string;
  /** Whether plugin execution completed successfully. */
  success: boolean;
}

/**
 * Represents the registration information provided by a plugin to the Plugin
 * Registry during application initialization.
 */
export interface PluginRegistrationMetadata {
  /** Unique identifier of the plugin. */
  name: string;
  /**
   * Execution triggers supported by the plugin. The cadence of scheduled
   * executions is defined by the GitHub Actions workflow cron configuration
   * rather than plugin metadata; supportedTriggers identifies which scheduled
   * execution a plugin supports.
   */
  supportedTriggers: Trigger[];
  /** Schema definition used to validate plugin-specific configuration. */
  configSchema: ConfigSchema;
}

/**
 * Represents an isolated workflow implementation that can be executed by the
 * Core Engine for supported execution triggers, including GitHub events and
 * scheduled executions.
 *
 * New Oppiabot workflows are implemented as independent plugins implementing
 * this contract, allowing workflow logic to evolve without modifying the Core
 * Engine. Plugins are explicitly registered with the Plugin Registry during
 * application initialization.
 */
export interface OppiabotPlugin extends PluginRegistrationMetadata {
  /**
   * Executes workflow-specific plugin logic for the given execution context.
   *
   * A plugin should return a `PluginResult` describing its outcome. If
   * `execute()` throws an error, `CoreEngine` catches it and creates a failed
   * `PluginResult`. The error is not propagated to the caller of
   * `CoreEngine.execute()`, and the engine continues executing the other
   * matching plugins.
   *
   * @param {ExecutionContext} context - Contains GitHub event information,
   *   repository details, configuration, and runtime execution state.
   * @returns {Promise<PluginResult>} Result of the plugin execution describing
   *   the actions performed, message, and execution status.
   * @throws {PluginConfigurationError} if required plugin configuration is
   *   missing or invalid.
   * @throws {PluginExecutionError} if plugin execution fails.
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
