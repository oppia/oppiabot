// Copyright 2026 The Oppia Authors. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview GitHub Actions scheduled entrypoint.
 *
 * This entrypoint turns a scheduled GitHub Actions workflow run into the
 * common `Trigger` and `ExecutionContext` used by the Core Engine. A
 * scheduled run carries no webhook payload: the cron expression determines
 * when the workflow runs, and the workflow's OPPIABOT_WORKFLOW_ID identifies
 * which scheduled execution started. The entrypoint converts that identifier
 * into a Trigger with event 'schedule' and the workflow identifier as its
 * action, so the PluginRegistry resolves scheduled plugins through the same
 * path that resolves webhook plugins. Workflow logic stays in plugins.
 */

import {
  ConfigurationLoader,
  CoreEngine,
  ExecutionContext,
  Trigger
} from '../core';
import { RuntimeEventPayload } from '../core/execution_context';
import { RepositoryContext } from '../types';

/**
 * Name of the environment variable a scheduled workflow sets to identify
 * itself, for example 'stale-sweep'. It becomes the Trigger's action, so
 * plugins register for the scheduled executions they handle.
 */
export const OPPIABOT_WORKFLOW_ID_ENV = 'OPPIABOT_WORKFLOW_ID';

/**
 * Name of the environment variable GitHub Actions sets to the repository the
 * workflow runs in, in 'owner/name' form.
 */
export const GITHUB_REPOSITORY_ENV = 'GITHUB_REPOSITORY';

/**
 * Name of the environment variable GitHub Actions sets to the ref that
 * triggered the run. A scheduled run always targets the repository's default
 * branch, so the entrypoint uses it as the ref configuration is read from.
 */
export const GITHUB_REF_NAME_ENV = 'GITHUB_REF_NAME';

/**
 * The environment an entrypoint reads its configuration from.
 *
 * GitHub Actions supplies the GITHUB_* variables; OPPIABOT_WORKFLOW_ID is
 * supplied by the scheduled workflow's env block.
 */
export type ScheduledEnvironment = {
  [name: string]: string | undefined;
};

/**
 * The collaborators the entrypoint uses to process one scheduled run.
 *
 * Supplying them keeps the entrypoint independent of how the Core Engine is
 * populated and of where the repository configuration is read from.
 */
export interface ScheduledEntrypointConfig {
  /** Core Engine that executes the plugins applicable to the run. */
  engine: CoreEngine;
  /** Loads the repository configuration passed to the Core Engine. */
  configurationLoader: ConfigurationLoader;
  /** The scheduled workflow environment, typically `process.env`. */
  environment: ScheduledEnvironment;
}

/**
 * Error thrown when a scheduled run's environment does not identify the
 * workflow or the repository it runs against.
 */
export class ScheduledWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduledWorkflowError';
  }
}

/**
 * Resolves the scheduled workflow identifier from the environment.
 *
 * The identifier becomes the Trigger's action, so a scheduled workflow that
 * does not set OPPIABOT_WORKFLOW_ID has no way to resolve the plugins it
 * should run and fails before the Core Engine is invoked.
 *
 * @param {ScheduledEnvironment} environment - The scheduled workflow
 *   environment.
 * @returns {string} The trimmed workflow identifier.
 * @throws {ScheduledWorkflowError} if OPPIABOT_WORKFLOW_ID is unset, empty,
 *   or only whitespace.
 */
export function resolveScheduledWorkflowId(
  environment: ScheduledEnvironment
): string {
  const workflowId = environment[OPPIABOT_WORKFLOW_ID_ENV];
  if (workflowId === undefined || workflowId.trim() === '') {
    throw new ScheduledWorkflowError(
      `The ${OPPIABOT_WORKFLOW_ID_ENV} environment variable must name the ` +
      'scheduled execution. Set it in the scheduled workflow\'s env block, ' +
      'for example OPPIABOT_WORKFLOW_ID: stale-sweep.'
    );
  }
  return workflowId.trim();
}

/**
 * Extracts the repository a scheduled run operates on from the environment.
 *
 * GitHub Actions reports the repository as 'owner/name' and the triggered ref
 * as GITHUB_REF_NAME. A scheduled run is always triggered against the
 * repository's default branch, so that ref identifies the configuration the
 * run applies.
 *
 * @param {ScheduledEnvironment} environment - The scheduled workflow
 *   environment.
 * @returns {RepositoryContext} The repository the run operates on.
 * @throws {ScheduledWorkflowError} if GITHUB_REPOSITORY or GITHUB_REF_NAME is
 *   unset, or the repository is not in 'owner/name' form.
 */
export function extractScheduledRepositoryContext(
  environment: ScheduledEnvironment
): RepositoryContext {
  const repository = environment[GITHUB_REPOSITORY_ENV];
  if (repository === undefined || repository === '') {
    throw new ScheduledWorkflowError(
      `The ${GITHUB_REPOSITORY_ENV} environment variable must identify the ` +
      'repository the scheduled workflow runs against.'
    );
  }
  const nameParts = repository.split('/');
  if (nameParts.length !== 2 || nameParts[0] === '' || nameParts[1] === '') {
    throw new ScheduledWorkflowError(
      `The ${GITHUB_REPOSITORY_ENV} environment variable must be in ` +
      `'owner/name' form, but was '${repository}'.`
    );
  }
  const defaultBranch = environment[GITHUB_REF_NAME_ENV];
  if (defaultBranch === undefined || defaultBranch === '') {
    throw new ScheduledWorkflowError(
      `The ${GITHUB_REF_NAME_ENV} environment variable must identify the ` +
      'ref the scheduled workflow runs against.'
    );
  }
  return new RepositoryContext(nameParts[0], nameParts[1], defaultBranch);
}

/**
 * Builds the payload handed to the scheduled run's plugins.
 *
 * A scheduled run has no webhook payload, so the payload describes the run
 * itself: which scheduled execution started, which repository it runs
 * against, and which ref it targets. Plugins read the fields they need; the
 * Core Engine never reads the payload.
 *
 * @param {string} workflowId - The scheduled workflow identifier.
 * @param {RepositoryContext} repository - The repository the run operates on.
 * @returns {RuntimeEventPayload} The payload for the run's plugins.
 */
export function buildScheduledPayload(
  workflowId: string,
  repository: RepositoryContext
): RuntimeEventPayload {
  return {
    workflow_id: workflowId,
    repository: repository.getFullName(),
    ref: repository.default_branch
  };
}

/**
 * Handles one scheduled GitHub Actions run.
 *
 * The workflow identifier and repository are read from the environment, the
 * repository configuration is loaded, and the resulting ExecutionContext is
 * submitted to the Core Engine, which resolves and executes the plugins
 * registered for the 'schedule.<workflowId>' trigger.
 *
 * Failures are not converted into a result: an unset OPPIABOT_WORKFLOW_ID, an
 * environment that does not identify the repository, a configuration that
 * cannot be loaded, or an engine failure reject the returned promise so that
 * the GitHub Actions run is marked failed and the failure is visible in the
 * workflow's summary.
 *
 * @param {ScheduledEntrypointConfig} config - The engine, configuration
 *   loader, and scheduled workflow environment for this run.
 * @returns {Promise<void>} Resolves once the applicable plugins have run.
 * @throws {ScheduledWorkflowError} if the environment does not identify the
 *   scheduled execution or the repository.
 */
export async function handleScheduledExecution(
  config: ScheduledEntrypointConfig
): Promise<void> {
  const workflowId = resolveScheduledWorkflowId(config.environment);
  const repository = extractScheduledRepositoryContext(config.environment);
  const configuration = await config.configurationLoader.load(repository);
  const context = new ExecutionContext(
    new Trigger('schedule', workflowId),
    buildScheduledPayload(workflowId, repository),
    repository,
    configuration
  );
  await config.engine.execute(context);
}
