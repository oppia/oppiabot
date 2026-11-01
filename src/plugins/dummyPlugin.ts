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
 * @fileoverview Temporary dummy plugin used to validate the complete Oppiabot
 * execution pipeline.
 *
 * The plugin is deliberately small: it reads the pull request state through
 * `OppiabotGitHubClient`, comments on and labels pull requests that do not
 * already carry its configured label, and optionally defers its first run.
 * That exercises trigger resolution, repository configuration, GitHub
 * operations, Dry-Run, and deferred execution through the same entrypoints
 * and Core Engine a real plugin uses.
 *
 * This plugin is a migration aid and must be removed once the first real
 * plugins validate the production execution path.
 */

import {
  DeferredExecutionRequest,
  ExecutionContext,
  OppiabotPlugin,
  PluginAction,
  PluginConfigurationError,
  PluginExecutionError,
  PluginResult,
  Trigger
} from '../core';
import {
  PullRequest
} from '../core/oppiabot_github_client';
import { ConfigSchema } from '../types';

/** Name of the dummy plugin used by the end-to-end tests. */
export const DUMMY_PLUGIN_NAME = 'dummy-plugin';

/** Trigger for pull requests being opened. */
export const DUMMY_WEBHOOK_TRIGGER = new Trigger('pull_request', 'opened');

/** Workflow identifier for the dummy scheduled execution. */
export const DUMMY_SCHEDULED_WORKFLOW_ID = 'dummy-sweep';

/** Trigger for the dummy scheduled execution. */
export const DUMMY_SCHEDULED_TRIGGER = new Trigger(
  'schedule',
  DUMMY_SCHEDULED_WORKFLOW_ID
);

/**
 * Configuration accepted by the dummy plugin.
 *
 * `comment` and `label` are required so the tests prove that plugin-specific
 * settings are loaded and validated. `deferred_delay_ms` asks the plugin to
 * defer its first run, and `fail` makes it throw so failure isolation can be
 * exercised through a real entrypoint.
 */
export const DUMMY_PLUGIN_CONFIG_SCHEMA = new ConfigSchema({
  comment: {type: 'string'},
  label: {type: 'string'},
  deferred_delay_ms: {type: 'number'},
  fail: {type: 'boolean'}
}, ['comment', 'label']);

/**
 * The settings the dummy plugin reads from repository configuration.
 */
interface DummyPluginSettings {
  /** Comment to post on each pull request that needs it. */
  comment: string;
  /** Label that marks a pull request as already handled. */
  label: string;
  /** Delay in milliseconds before the follow-up run, when deferring. */
  deferredDelayMs?: number;
  /** Whether the plugin should throw instead of running. */
  fail: boolean;
}

/**
 * A temporary plugin that exercises the complete execution pipeline.
 */
export class DummyPlugin implements OppiabotPlugin {
  /**
   * @param {string} [name] - Plugin name; override to register more than one
   *   dummy instance, for example a failing one alongside a healthy one.
   * @param {Trigger[]} [supportedTriggers] - Triggers the plugin handles.
   *   Defaults to the opened webhook and dummy scheduled triggers.
   */
  constructor(
    public readonly name: string = DUMMY_PLUGIN_NAME,
    public readonly supportedTriggers: Trigger[] = [
      DUMMY_WEBHOOK_TRIGGER,
      DUMMY_SCHEDULED_TRIGGER
    ]
  ) {}

  readonly configSchema: ConfigSchema = DUMMY_PLUGIN_CONFIG_SCHEMA;

  /**
   * Runs the dummy workflow.
   *
   * On the first run, when `deferred_delay_ms` is configured, the plugin asks
   * the Core Engine to run it again after the delay instead of mutating GitHub
   * immediately. The follow-up run re-reads each pull request, so it acts on
   * the state that exists when the delay has elapsed rather than on the state
   * captured by the original webhook payload.
   *
   * @param {ExecutionContext} context - The execution the plugin handles.
   * @returns {Promise<PluginResult>} The actions performed and their outcome.
   * @throws {PluginConfigurationError} if the context has no repository
   *   configuration.
   * @throws {ConfigurationValidationError} if the plugin is not configured in
   *   the repository or its settings do not satisfy the plugin's schema.
   * @throws {PluginExecutionError} if the context has no GitHub client or the
   *   configured failure mode is active.
   */
  async execute(context: ExecutionContext): Promise<PluginResult> {
    const settings = this.readSettings(context);
    if (settings.fail) {
      throw new PluginExecutionError(
        `Dummy plugin '${this.name}' was configured to fail.`
      );
    }
    if (
      settings.deferredDelayMs !== undefined &&
      context.deferredRequest === undefined
    ) {
      return {
        actions: [],
        message: `Deferred for ${settings.deferredDelayMs}ms.`,
        success: true,
        deferred: new DeferredExecutionRequest(settings.deferredDelayMs)
      };
    }

    const githubClient = context.githubClient;
    if (githubClient === undefined) {
      throw new PluginExecutionError(
        `Dummy plugin '${this.name}' needs a GitHub client.`
      );
    }

    const pullRequests = await this.readPullRequests(context);
    const actions: PluginAction[] = [];
    let changed = 0;
    for (const pullRequest of pullRequests) {
      if (pullRequest.labels.some((label) => label.name === settings.label)) {
        continue;
      }
      await githubClient.createComment(pullRequest.number, settings.comment);
      await githubClient.addLabels(pullRequest.number, [settings.label]);
      actions.push(PluginAction.COMMENT, PluginAction.LABEL);
      changed++;
    }

    if (changed === 0) {
      return {
        actions: [],
        message: 'Every pull request already carries the configured label.',
        success: true
      };
    }
    return {
      actions: actions,
      message: `Updated ${changed} pull request(s).`,
      success: true
    };
  }

  /**
   * Reads the plugin's settings from repository configuration.
   *
   * @param {ExecutionContext} context - The execution being handled.
   * @returns {DummyPluginSettings} The validated settings.
   * @throws {PluginConfigurationError} if the context has no repository
   *   configuration.
   * @throws {ConfigurationValidationError} if the plugin is not configured in
   *   the repository or its settings do not satisfy the plugin's schema.
   */
  private readSettings(context: ExecutionContext): DummyPluginSettings {
    const settings = context.configuration?.getPluginConfiguration(
      this.name,
      {[this.name]: this.configSchema}
    ).settings;
    if (settings === undefined) {
      throw new PluginConfigurationError(
        `Dummy plugin '${this.name}' is not configured.`
      );
    }
    return {
      comment: settings.comment as string,
      label: settings.label as string,
      deferredDelayMs: settings.deferred_delay_ms as number | undefined,
      fail: settings.fail === true
    };
  }

  /**
   * Reads the pull requests this execution should inspect.
   *
   * A webhook run reads the pull request named by the delivery payload, so it
   * always sees the current state when it acts. A scheduled run lists every
   * open pull request, matching how scheduled sweepers evaluate a repository.
   *
   * @param {ExecutionContext} context - The execution being handled.
   * @returns {Promise<PullRequest[]>} The pull requests to inspect.
   * @throws {PluginExecutionError} if the webhook payload identifies no pull
   *   request.
   */
  private async readPullRequests(
    context: ExecutionContext
  ): Promise<PullRequest[]> {
    const githubClient = context.githubClient!;
    if (context.trigger.event === 'schedule') {
      return githubClient.listPullRequests('open');
    }
    const pullRequest = context.payload.pull_request;
    const number =
      typeof pullRequest === 'object' && pullRequest !== null
        ? (pullRequest as {number?: unknown}).number
        : undefined;
    if (typeof number !== 'number') {
      throw new PluginExecutionError(
        `Dummy plugin '${this.name}' needs a pull request number in the ` +
        'webhook payload.'
      );
    }
    return [await githubClient.getPullRequest(number)];
  }
}
