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

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  OppiabotPlugin,
  PluginRegistry,
  PluginResult,
  Trigger
} from '../../src/core';
import {
  ConfigSchema,
  RepositoryContext
} from '../../src/types';
import {
  ScheduledWorkflowError,
  WorkspaceRepositoryFileReader,
  createScheduledExecution
} from '../../src/entrypoints';

/**
 * Creates a stub scheduled plugin that records its executions.
 *
 * @param {string} name - The plugin name.
 * @param {Trigger[]} supportedTriggers - The triggers the plugin handles.
 * @param {PluginResult[]} [executions] - Array collecting execution records.
 * @returns {OppiabotPlugin} A stub plugin.
 */
function createScheduledStubPlugin(
  name: string,
  supportedTriggers: Trigger[],
  executions: PluginResult[] = []
): OppiabotPlugin {
  return {
    name: name,
    supportedTriggers: supportedTriggers,
    configSchema: new ConfigSchema({}, []),
    execute: async (): Promise<PluginResult> => {
      const result: PluginResult = {
        actions: [],
        message: `ran ${name}`,
        success: true
      };
      executions.push(result);
      return result;
    }
  };
}

describe('WorkspaceRepositoryFileReader', () => {
  let workspace: string;

  before(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'oppiabot-workspace-'));
    await mkdir(join(workspace, '.github'), {recursive: true});
    await writeFile(
      join(workspace, '.github', 'oppiabot.yml'),
      'version: "1.0"\nplugins:\n'
    );
    await writeFile(join(workspace, 'README.md'), 'not a config');
  });

  after(async () => {
    await rm(workspace, {recursive: true, force: true});
  });

  it('reads a file present in the checkout', async () => {
    const reader = new WorkspaceRepositoryFileReader(workspace);
    const contents = await reader.readRepositoryFile(
      new RepositoryContext('oppia', 'oppia', 'develop'),
      '.github/oppiabot.yml',
      'develop'
    );
    assert.match(contents ?? '', /version: "1\.0"/);
  });

  it('resolves to undefined for a file the checkout does not contain',
    async () => {
      const reader = new WorkspaceRepositoryFileReader(workspace);
      const contents = await reader.readRepositoryFile(
        new RepositoryContext('oppia', 'oppia', 'develop'),
        '.github/absent.yml',
        'develop'
      );
      assert.strictEqual(contents, undefined);
    });

  it('surfaces read failures that are not a missing file', async () => {
    const reader = new WorkspaceRepositoryFileReader(
      join(workspace, 'README.md')
    );
    await assert.rejects(
      () =>
        reader.readRepositoryFile(
          new RepositoryContext('oppia', 'oppia', 'develop'),
          '.github/oppiabot.yml',
          'develop'
        ),
      (error: NodeJS.ErrnoException) => {
        assert.strictEqual(error.code, 'ENOTDIR');
        return true;
      }
    );
  });
});

describe('createScheduledExecution', () => {
  let workspace: string;

  before(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'oppiabot-scheduled-'));
    await mkdir(join(workspace, '.github'), {recursive: true});
    await writeFile(
      join(workspace, '.github', 'oppiabot.yml'),
      'version: "1.0"\n' +
      'plugins:\n' +
      '  stale-sweeper:\n' +
      '    enabled: true\n'
    );
  });

  after(async () => {
    await rm(workspace, {recursive: true, force: true});
  });

  it('runs the plugins registered for the scheduled trigger', async () => {
    const executions: PluginResult[] = [];
    const registry = new PluginRegistry();
    registry.register(
      createScheduledStubPlugin(
        'stale-sweeper',
        [new Trigger('schedule', 'stale-sweep')],
        executions
      )
    );
    const handler = createScheduledExecution({
      pluginRegistry: registry,
      workspaceDirectory: workspace
    });

    await handler({
      OPPIABOT_WORKFLOW_ID: 'stale-sweep',
      GITHUB_REPOSITORY: 'oppia/oppia',
      GITHUB_REF_NAME: 'develop'
    });

    assert.strictEqual(executions.length, 1);
  });

  it('does not run plugins registered for a different scheduled ' +
    'execution', async () => {
    const executions: PluginResult[] = [];
    const registry = new PluginRegistry();
    registry.register(
      createScheduledStubPlugin(
        'reviewer-lag-monitor',
        [new Trigger('schedule', 'reviewer-lag-digest')],
        executions
      )
    );
    const handler = createScheduledExecution({
      pluginRegistry: registry,
      workspaceDirectory: workspace
    });

    await handler({
      OPPIABOT_WORKFLOW_ID: 'stale-sweep',
      GITHUB_REPOSITORY: 'oppia/oppia',
      GITHUB_REF_NAME: 'develop'
    });

    assert.strictEqual(executions.length, 0);
  });

  it('does not run plugins registered only for webhook triggers', async () => {
    const executions: PluginResult[] = [];
    const registry = new PluginRegistry();
    registry.register(
      createScheduledStubPlugin(
        'cla-check',
        [new Trigger('pull_request', 'opened')],
        executions
      )
    );
    const handler = createScheduledExecution({
      pluginRegistry: registry,
      workspaceDirectory: workspace
    });

    await handler({
      OPPIABOT_WORKFLOW_ID: 'stale-sweep',
      GITHUB_REPOSITORY: 'oppia/oppia',
      GITHUB_REF_NAME: 'develop'
    });

    assert.strictEqual(executions.length, 0);
  });

  it('fails the run when OPPIABOT_WORKFLOW_ID is not set', async () => {
    const registry = new PluginRegistry();
    const handler = createScheduledExecution({
      pluginRegistry: registry,
      workspaceDirectory: workspace
    });

    await assert.rejects(
      () =>
        handler({
          GITHUB_REPOSITORY: 'oppia/oppia',
          GITHUB_REF_NAME: 'develop'
        }),
      ScheduledWorkflowError
    );
  });

  it('treats a checkout without a configuration file as no opted-in ' +
    'plugins', async () => {
    const executions: PluginResult[] = [];
    const registry = new PluginRegistry();
    registry.register(
      createScheduledStubPlugin(
        'stale-sweeper',
        [new Trigger('schedule', 'stale-sweep')],
        executions
      )
    );
    const emptyWorkspace = await mkdtemp(
      join(tmpdir(), 'oppiabot-empty-')
    );
    try {
      const handler = createScheduledExecution({
        pluginRegistry: registry,
        workspaceDirectory: emptyWorkspace
      });

      await handler({
        OPPIABOT_WORKFLOW_ID: 'stale-sweep',
        GITHUB_REPOSITORY: 'oppia/oppia',
        GITHUB_REF_NAME: 'develop'
      });

      assert.strictEqual(executions.length, 0);
    } finally {
      await rm(emptyWorkspace, {recursive: true, force: true});
    }
  });
});
