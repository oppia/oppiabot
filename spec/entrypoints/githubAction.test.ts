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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ConfigurationLoader,
  CoreEngine,
  ExecutionContext,
  Trigger
} from '../../src/core';
import { RepositoryConfiguration, RepositoryContext } from '../../src/types';
import {
  ScheduledEnvironment,
  ScheduledWorkflowError,
  buildScheduledPayload,
  extractScheduledRepositoryContext,
  handleScheduledExecution,
  resolveScheduledWorkflowId
} from '../../src/entrypoints/githubAction';

/**
 * Builds a scheduled workflow environment for a run.
 *
 * @param {ScheduledEnvironment} [overrides] - Variables to override or add.
 * @returns {ScheduledEnvironment} A complete scheduled environment.
 */
function createEnvironment(
  overrides: ScheduledEnvironment = {}
): ScheduledEnvironment {
  return {
    OPPIABOT_WORKFLOW_ID: 'stale-sweep',
    GITHUB_REPOSITORY: 'oppia/oppia',
    GITHUB_REF_NAME: 'develop',
    ...overrides
  };
}

/**
 * Captures the execution context passed to the Core Engine.
 *
 * @returns {object} A fake engine and the contexts it received.
 */
function createCapturingEngine(): {
  engine: CoreEngine;
  contexts: ExecutionContext[];
} {
  const contexts: ExecutionContext[] = [];
  const engine = {
    execute: async (context: ExecutionContext) => {
      contexts.push(context);
    }
  } as unknown as CoreEngine;
  return { engine, contexts };
}

/**
 * Builds an entrypoint configuration for a scheduled run.
 *
 * @param {ScheduledEnvironment} [environment] - The environment to process.
 * @param {object} [overrides] - Configuration overrides.
 * @param {CoreEngine} [overrides.engine] - Engine to invoke.
 * @param {ConfigurationLoader} [overrides.configurationLoader] - Loader to
 *   call.
 * @returns {object} The config and the capturing engine it uses by default.
 */
function createConfig(
  environment: ScheduledEnvironment = createEnvironment(),
  overrides: {
    engine?: CoreEngine;
    configurationLoader?: ConfigurationLoader;
  } = {}
): {
  config: {
    engine: CoreEngine;
    configurationLoader: ConfigurationLoader;
    environment: ScheduledEnvironment;
  };
  contexts: ExecutionContext[];
} {
  const capturing = createCapturingEngine();
  const loader = overrides.configurationLoader || ({
    load: async (): Promise<RepositoryConfiguration> =>
      new RepositoryConfiguration('1.0', {})
  } as unknown as ConfigurationLoader);
  return {
    config: {
      engine: overrides.engine || capturing.engine,
      configurationLoader: loader,
      environment: environment
    },
    contexts: capturing.contexts
  };
}

describe('resolveScheduledWorkflowId', () => {
  it('returns the OPPIABOT_WORKFLOW_ID value', () => {
    assert.strictEqual(
      resolveScheduledWorkflowId(createEnvironment()),
      'stale-sweep'
    );
  });

  it('trims surrounding whitespace from the identifier', () => {
    assert.strictEqual(
      resolveScheduledWorkflowId(
        createEnvironment({OPPIABOT_WORKFLOW_ID: ' stale-sweep '})
      ),
      'stale-sweep'
    );
  });

  it('rejects an unset OPPIABOT_WORKFLOW_ID', () => {
    assert.throws(
      () =>
        resolveScheduledWorkflowId(
          createEnvironment({OPPIABOT_WORKFLOW_ID: undefined})
        ),
      (error: Error) => {
        assert.ok(error instanceof ScheduledWorkflowError);
        assert.match(error.message, /OPPIABOT_WORKFLOW_ID/);
        return true;
      }
    );
  });

  it('rejects an empty OPPIABOT_WORKFLOW_ID', () => {
    assert.throws(
      () =>
        resolveScheduledWorkflowId(
          createEnvironment({OPPIABOT_WORKFLOW_ID: ''})
        ),
      ScheduledWorkflowError
    );
  });

  it('rejects an OPPIABOT_WORKFLOW_ID of only whitespace', () => {
    assert.throws(
      () =>
        resolveScheduledWorkflowId(
          createEnvironment({OPPIABOT_WORKFLOW_ID: '   '})
        ),
      ScheduledWorkflowError
    );
  });
});

describe('extractScheduledRepositoryContext', () => {
  it('builds the repository from GITHUB_REPOSITORY and GITHUB_REF_NAME', () => {
    const repository = extractScheduledRepositoryContext(createEnvironment());
    assert.strictEqual(repository.owner, 'oppia');
    assert.strictEqual(repository.name, 'oppia');
    assert.strictEqual(repository.default_branch, 'develop');
  });

  it('rejects an unset GITHUB_REPOSITORY', () => {
    assert.throws(
      () =>
        extractScheduledRepositoryContext(
          createEnvironment({GITHUB_REPOSITORY: undefined})
        ),
      (error: Error) => {
        assert.ok(error instanceof ScheduledWorkflowError);
        assert.match(error.message, /GITHUB_REPOSITORY/);
        return true;
      }
    );
  });

  it('rejects a GITHUB_REPOSITORY without an owner and name', () => {
    assert.throws(
      () =>
        extractScheduledRepositoryContext(
          createEnvironment({GITHUB_REPOSITORY: 'oppia'})
        ),
      ScheduledWorkflowError
    );
  });

  it('rejects a GITHUB_REPOSITORY with an empty owner', () => {
    assert.throws(
      () =>
        extractScheduledRepositoryContext(
          createEnvironment({GITHUB_REPOSITORY: '/oppia'})
        ),
      ScheduledWorkflowError
    );
  });

  it('rejects an unset GITHUB_REF_NAME', () => {
    assert.throws(
      () =>
        extractScheduledRepositoryContext(
          createEnvironment({GITHUB_REF_NAME: undefined})
        ),
      (error: Error) => {
        assert.ok(error instanceof ScheduledWorkflowError);
        assert.match(error.message, /GITHUB_REF_NAME/);
        return true;
      }
    );
  });
});

describe('buildScheduledPayload', () => {
  it('describes the scheduled run for its plugins', () => {
    const repository = new RepositoryContext('oppia', 'oppia', 'develop');
    assert.deepStrictEqual(buildScheduledPayload('stale-sweep', repository), {
      workflow_id: 'stale-sweep',
      repository: 'oppia/oppia',
      ref: 'develop'
    });
  });
});

describe('handleScheduledExecution', () => {
  it('invokes the Core Engine with a schedule trigger keyed by the ' +
    'workflow id', async () => {
    const { config, contexts } = createConfig();

    await handleScheduledExecution(config);

    assert.strictEqual(contexts.length, 1);
    const context = contexts[0];
    assert.ok(context.trigger instanceof Trigger);
    assert.strictEqual(context.trigger.event, 'schedule');
    assert.strictEqual(context.trigger.action, 'stale-sweep');
    assert.strictEqual(context.trigger.toKey(), 'schedule.stale-sweep');
  });

  it('passes the repository built from the environment', async () => {
    const { config, contexts } = createConfig();

    await handleScheduledExecution(config);

    assert.strictEqual(contexts[0].repository.getFullName(), 'oppia/oppia');
    assert.strictEqual(contexts[0].repository.default_branch, 'develop');
  });

  it('loads and passes the repository configuration', async () => {
    const configuration = new RepositoryConfiguration('1.0', {});
    const loadedRepositories: RepositoryContext[] = [];
    const configurationLoader = {
      load: async (repository: RepositoryContext) => {
        loadedRepositories.push(repository);
        return configuration;
      }
    } as unknown as ConfigurationLoader;
    const { config, contexts } = createConfig(createEnvironment(), {
      configurationLoader: configurationLoader
    });

    await handleScheduledExecution(config);

    assert.strictEqual(loadedRepositories.length, 1);
    assert.strictEqual(loadedRepositories[0].getFullName(), 'oppia/oppia');
    assert.strictEqual(contexts[0].configuration, configuration);
  });

  it('hands plugins a payload identifying the scheduled run', async () => {
    const { config, contexts } = createConfig();

    await handleScheduledExecution(config);

    assert.deepStrictEqual(contexts[0].payload, {
      workflow_id: 'stale-sweep',
      repository: 'oppia/oppia',
      ref: 'develop'
    });
  });

  it('does not set a delivery id for a scheduled run', async () => {
    const { config, contexts } = createConfig();

    await handleScheduledExecution(config);

    assert.strictEqual(contexts[0].deliveryId, undefined);
  });

  it('does not invoke the Core Engine when OPPIABOT_WORKFLOW_ID is ' +
    'missing', async () => {
    const { config, contexts } = createConfig(
      createEnvironment({OPPIABOT_WORKFLOW_ID: undefined})
    );

    await assert.rejects(
      () => handleScheduledExecution(config),
      ScheduledWorkflowError
    );
    assert.strictEqual(contexts.length, 0);
  });

  it('does not invoke the Core Engine when the repository cannot be ' +
    'identified', async () => {
    const { config, contexts } = createConfig(
      createEnvironment({GITHUB_REPOSITORY: undefined})
    );

    await assert.rejects(
      () => handleScheduledExecution(config),
      ScheduledWorkflowError
    );
    assert.strictEqual(contexts.length, 0);
  });

  it('surfaces configuration loading failures to the workflow run',
    async () => {
      const loadError = new Error('configuration is invalid');
      const configurationLoader = {
        load: async (): Promise<RepositoryConfiguration> => {
          throw loadError;
        }
      } as unknown as ConfigurationLoader;
      const { config } = createConfig(createEnvironment(), {
        configurationLoader: configurationLoader
      });

      await assert.rejects(
        () => handleScheduledExecution(config),
        (error: Error) => {
          assert.strictEqual(error, loadError);
          return true;
        }
      );
    });

  it('surfaces Core Engine failures to the workflow run', async () => {
    const engineError = new Error('engine failed to start');
    const engine = {
      execute: async (): Promise<void> => {
        throw engineError;
      }
    } as unknown as CoreEngine;
    const { config } = createConfig(createEnvironment(), {engine: engine});

    await assert.rejects(
      () => handleScheduledExecution(config),
      (error: Error) => {
        assert.strictEqual(error, engineError);
        return true;
      }
    );
  });
});
