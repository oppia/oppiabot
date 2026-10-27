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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ExecutionContext,
  ExecutionContextValidationError,
  OppiabotGitHubClient,
  Trigger
} from '../../src/core';
import {
  GitHubApiClient,
  GitHubApiResponse
} from '../../src/core/oppiabot_github_client';
import {
  PluginConfiguration,
  RepositoryConfiguration,
  RepositoryContext
} from '../../src/types';
import { createExecutionContext } from './testHelpers';

describe('ExecutionContext', () => {
  describe('validate', () => {
    it('accepts a fully populated execution context', () => {
      const context = createExecutionContext(new Trigger('pull_request', 'opened'));
      assert.doesNotThrow(() => context.validate());
    });

    it('accepts an execution context without configuration', () => {
      const repository = new RepositoryContext('oppia', 'oppiabot', 'develop');
      const context = new ExecutionContext(
        new Trigger('schedule', 'stale-sweep'),
        {},
        repository
      );
      assert.doesNotThrow(() => context.validate());
    });

    it('rejects an execution context without a trigger', () => {
      const context = createExecutionContext(new Trigger('pull_request', 'opened'));
      (context as unknown as { trigger: Trigger }).trigger =
        undefined as unknown as Trigger;
      assert.throws(
        () => context.validate(),
        (err: Error) => (
          err instanceof ExecutionContextValidationError &&
          err.message.includes('must define a trigger')
        )
      );
    });

    it('rejects an execution context with an empty trigger event', () => {
      const context = createExecutionContext(new Trigger(''));
      assert.throws(
        () => context.validate(),
        (err: Error) => (
          err instanceof ExecutionContextValidationError &&
          err.message.includes('invalid trigger') &&
          err.message.includes('non-empty')
        )
      );
    });

    it('rejects an execution context with an empty trigger action', () => {
      const context = createExecutionContext(new Trigger('pull_request', ''));
      assert.throws(
        () => context.validate(),
        (err: Error) => (
          err instanceof ExecutionContextValidationError &&
          err.message.includes('invalid trigger') &&
          err.message.includes('non-empty')
        )
      );
    });

    it('rejects an execution context without repository information', () => {
      const configuration = createExecutionContext(
        new Trigger('pull_request', 'opened')
      ).configuration;
      const context = new ExecutionContext(
        new Trigger('pull_request', 'opened'),
        {},
        undefined as unknown as RepositoryContext,
        configuration
      );
      assert.throws(
        () => context.validate(),
        (err: Error) => (
          err instanceof ExecutionContextValidationError &&
          err.message.includes('must define repository')
        )
      );
    });

    it('rejects an execution context with an invalid repository', () => {
      const context = createExecutionContext(
        new Trigger('pull_request', 'opened'),
        { repository: new RepositoryContext('', 'oppiabot', 'develop') }
      );
      assert.throws(
        () => context.validate(),
        (err: Error) => (
          err instanceof ExecutionContextValidationError &&
          err.message.includes('invalid repository') &&
          err.message.includes('owner')
        )
      );
    });

    it('rejects an execution context with an invalid configuration', () => {
      const pluginConfiguration: PluginConfiguration = {
        enabled: true,
        dry_run: false,
        settings: {}
      };
      const context = createExecutionContext(
        new Trigger('pull_request', 'opened'),
        {
          configuration: new RepositoryConfiguration('', {
            stale: pluginConfiguration
          })
        }
      );
      assert.throws(
        () => context.validate(),
        (err: Error) => (
          err instanceof ExecutionContextValidationError &&
          err.message.includes('invalid configuration') &&
          err.message.includes('version')
        )
      );
    });

    it('rejects an execution context whose plugin configuration is malformed', () => {
      const context = createExecutionContext(
        new Trigger('pull_request', 'opened'),
        {
          configuration: new RepositoryConfiguration('1.0', {
            stale: {
              enabled: 'yes',
              dry_run: false,
              settings: {}
            } as unknown as PluginConfiguration
          })
        }
      );
      assert.throws(
        () => context.validate(),
        (err: Error) => (
          err instanceof ExecutionContextValidationError &&
          err.message.includes('invalid configuration') &&
          err.message.includes('stale')
        )
      );
    });
  });

  describe('withGitHubClient', () => {
    it('copies every field and replaces only the client', () => {
      const repository = new RepositoryContext('oppia', 'oppiabot', 'develop');
      const configuration = new RepositoryConfiguration('1.0', {});
      const api: GitHubApiClient = {
        async request<TData>(
          _route: string,
          _parameters: Record<string, unknown>
        ): Promise<GitHubApiResponse<TData>> {
          return {status: 200, data: {} as TData};
        }
      };
      const originalClient = new OppiabotGitHubClient(api, repository);
      const replacement = originalClient.asDryRun();
      const context = new ExecutionContext(
        new Trigger('pull_request', 'opened'),
        {action: 'opened'},
        repository,
        configuration,
        originalClient,
        'delivery-1'
      );

      const copy = context.withGitHubClient(replacement);

      assert.notStrictEqual(copy, context);
      assert.strictEqual(copy.trigger, context.trigger);
      assert.deepStrictEqual(copy.payload, context.payload);
      assert.strictEqual(copy.repository, context.repository);
      assert.strictEqual(copy.configuration, context.configuration);
      assert.strictEqual(copy.githubClient, replacement);
      assert.strictEqual(copy.deliveryId, 'delivery-1');
    });
  });
});
