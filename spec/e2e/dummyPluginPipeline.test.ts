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
 * @fileoverview End-to-end validation of the new Oppiabot execution pipeline.
 *
 * These tests drive the real webhook and scheduled entrypoints, the real
 * configuration loader, the Core Engine, the plugin registry, and
 * OppiabotGitHubClient with a fake GitHub API. Only the GitHub API transport
 * and the wall-clock timer are substituted. The temporary `DummyPlugin`
 * exercises trigger resolution, configuration, GitHub operations, failure
 * isolation, Dry-Run, and deferred execution through that complete path.
 */

import { createHmac } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';

import {
  ConfigurationLoader,
  CoreEngine,
  DeferredExecutionRequest,
  DeferredExecutionScheduler,
  OppiabotGitHubClient,
  PluginRegistry,
  Trigger
} from '../../src/core';
import type {
  GitHubApiClient,
  GitHubApiResponse,
  PullRequest
} from '../../src/core/oppiabot_github_client';
import { RepositoryContext } from '../../src/types';
import {
  CloudFunctionHandler,
  CloudFunctionRequest,
  WebhookRequest,
  handleGitHubWebhook
} from '../../src/entrypoints/cloudFunction';
import {
  ApiRepositoryFileReader,
  createWebhookFunction
} from '../../src/entrypoints/cloudFunctionFactory';
import { createScheduledExecution } from '../../src/entrypoints/githubActionFactory';
import {
  DUMMY_SCHEDULED_WORKFLOW_ID,
  DummyPlugin
} from '../../src/plugins/dummyPlugin';

const WEBHOOK_SECRET = 'e2e-webhook-secret';
const CONFIG_FILE_ROUTE = 'GET /repos/{owner}/{repo}/contents/{path}';
const CONTENTS_ROUTE = 'GET /repos/{owner}/{repo}/contents';
const LIST_PULL_REQUESTS_ROUTE = 'GET /repos/{owner}/{repo}/pulls';
const GET_PULL_REQUEST_ROUTE =
  'GET /repos/{owner}/{repo}/pulls/{pull_number}';
const CREATE_COMMENT_ROUTE =
  'POST /repos/{owner}/{repo}/issues/{issue_number}/comments';
const ADD_LABELS_ROUTE =
  'POST /repos/{owner}/{repo}/issues/{issue_number}/labels';

/**
 * One request the fake GitHub API received.
 */
interface RecordedRequest {
  /** The GitHub REST route the request was sent to. */
  route: string;
  /** The route parameters and request body. */
  parameters: Record<string, unknown>;
}

/**
 * A fake GitHub API that serves configuration, pull request state, and
 * records every request so tests can distinguish reads from mutations.
 */
class FakeGitHubApi implements GitHubApiClient {
  /** Requests sent to the fake GitHub API, in order. */
  readonly requests: RecordedRequest[] = [];

  /**
   * @param {string | undefined} configurationYaml - Repository configuration
   *   to serve from `.github/oppiabot.yml`, or undefined when the repository
   *   has not opted in.
   * @param {PullRequest[]} pullRequests - Pull request state, mutated by live
   *   label writes.
   */
  constructor(
    private readonly configurationYaml: string | undefined,
    readonly pullRequests: PullRequest[]
  ) {}

  async request<TData>(
    route: string,
    parameters: Record<string, unknown>
  ): Promise<GitHubApiResponse<TData>> {
    this.requests.push({route: route, parameters: parameters});

    if (route === CONFIG_FILE_ROUTE) {
      if (this.configurationYaml === undefined) {
        throw Object.assign(new Error('Not Found'), {status: 404});
      }
      return this.respond({
        type: 'file',
        encoding: 'base64',
        content: Buffer.from(this.configurationYaml).toString('base64')
      });
    }
    if (route === CONTENTS_ROUTE) {
      return this.respond([]);
    }
    if (route === LIST_PULL_REQUESTS_ROUTE) {
      return this.respond(this.pullRequests);
    }
    if (route === GET_PULL_REQUEST_ROUTE) {
      const pullRequest = this.pullRequests.find(
        (candidate) => candidate.number === parameters.pull_number
      );
      if (pullRequest === undefined) {
        throw Object.assign(new Error('Not Found'), {status: 404});
      }
      return this.respond(pullRequest);
    }
    if (route === ADD_LABELS_ROUTE) {
      const pullRequest = this.pullRequests.find(
        (candidate) => candidate.number === parameters.issue_number
      );
      for (const label of parameters.labels as string[]) {
        if (
          pullRequest !== undefined &&
          !pullRequest.labels.some((existing) => existing.name === label)
        ) {
          pullRequest.labels.push({name: label});
        }
      }
      return {status: 201, data: {} as TData};
    }
    if (route === CREATE_COMMENT_ROUTE) {
      return {status: 201, data: {} as TData};
    }
    return this.respond({});
  }

  /**
   * Returns the requests that mutate repository state.
   *
   * @returns {RecordedRequest[]} Every non-GET request, in order.
   */
  writeRequests(): RecordedRequest[] {
    return this.requests.filter(
      (request) => !request.route.startsWith('GET ')
    );
  }

  /**
   * Returns the requests for one route.
   *
   * @param {string} route - The route to filter by.
   * @returns {RecordedRequest[]} The matching requests, in order.
   */
  requestsFor(route: string): RecordedRequest[] {
    return this.requests.filter((request) => request.route === route);
  }

  /**
   * Builds a successful response carrying `data`.
   *
   * @param {unknown} data - The response body.
   * @returns {GitHubApiResponse<TData>} The response.
   */
  private respond<TData>(data: unknown): GitHubApiResponse<TData> {
    return {status: 200, data: data as TData};
  }
}

/**
 * A scheduler that records deferred runs instead of waiting for a timer.
 */
class RecordingScheduler implements DeferredExecutionScheduler {
  /** Deferral requests the engine submitted, in order. */
  readonly requests: DeferredExecutionRequest[] = [];
  private readonly runs: Array<() => Promise<void>> = [];

  async schedule(
    request: DeferredExecutionRequest,
    run: () => Promise<void>
  ): Promise<void> {
    this.requests.push(request);
    this.runs.push(run);
  }

  /**
   * Runs every follow-up execution that has been scheduled.
   *
   * @returns {Promise<void>} Resolves after every follow-up has run.
   */
  async runScheduled(): Promise<void> {
    const runs = this.runs.splice(0);
    for (const run of runs) {
      await run();
    }
  }
}

/**
 * Creates a pull request with the given labels.
 *
 * @param {number} number - The pull request number.
 * @param {string[]} [labels] - Existing label names.
 * @returns {PullRequest} The pull request.
 */
function createPullRequest(
  number: number,
  labels: string[] = []
): PullRequest {
  return {
    number: number,
    state: 'open',
    title: `Pull request ${number}`,
    body: null,
    user: {login: 'contributor'},
    labels: labels.map((name) => ({name: name})),
    head: {sha: `sha-${number}`},
    base: {ref: 'develop'}
  };
}

/**
 * Builds the webhook payload GitHub sends for a pull request event.
 *
 * @param {number} pullRequestNumber - The pull request the event is about.
 * @param {string} action - The pull request action.
 * @returns {Record<string, unknown>} The webhook payload.
 */
function createPullRequestPayload(
  pullRequestNumber: number,
  action: string
): Record<string, unknown> {
  return {
    action: action,
    repository: {
      name: 'oppiabot',
      default_branch: 'develop',
      owner: {login: 'oppia'}
    },
    pull_request: {number: pullRequestNumber}
  };
}

/**
 * Signs a body the way GitHub signs a webhook delivery.
 *
 * @param {string} body - The raw request body.
 * @returns {string} The signature header value.
 */
function signBody(body: string): string {
  return 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(body).digest(
    'hex'
  );
}

/**
 * Builds a signed webhook request for a payload.
 *
 * @param {Record<string, unknown>} payload - The webhook payload.
 * @returns {WebhookRequest} The signed request.
 */
function createWebhookRequest(
  payload: Record<string, unknown>
): WebhookRequest {
  const body = JSON.stringify(payload);
  return {
    headers: {
      'x-github-event': 'pull_request',
      'x-hub-signature-256': signBody(body),
      'x-github-delivery': 'delivery-1'
    },
    body: Buffer.from(body)
  };
}

/**
 * Invokes a Cloud Function webhook handler and collects its response.
 *
 * @param {CloudFunctionHandler} handler - The handler to invoke.
 * @param {Record<string, unknown>} payload - The webhook payload.
 * @returns {Promise<{statusCode: number, body: string}>} The response.
 */
async function deliverWebhook(
  handler: CloudFunctionHandler,
  payload: Record<string, unknown>
): Promise<{statusCode: number, body: string}> {
  const body = JSON.stringify(payload);
  const request = {
    headers: {
      'x-github-event': 'pull_request',
      'x-hub-signature-256': signBody(body),
      'x-github-delivery': 'delivery-1'
    },
    rawBody: Buffer.from(body)
  } as unknown as CloudFunctionRequest;
  const response = {
    statusCode: 0,
    body: '',
    setHeader: () => undefined,
    end: (chunk: string) => {
      response.body = chunk;
    }
  } as unknown as ServerResponse & {body: string; statusCode: number};

  await handler(request, response);
  return {statusCode: response.statusCode, body: response.body};
}

/**
 * Captures console output for one test.
 *
 * @returns {object} The captured lines and a restore callback.
 */
function captureLogs(): {logs: string[], restore: () => void} {
  const logs: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  const record = (...args: unknown[]) => {
    logs.push(args.map((arg) => String(arg)).join(' '));
  };
  console.log = record;
  console.error = record;
  return {
    logs: logs,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
    }
  };
}

describe('Dummy plugin end-to-end pipeline', () => {
  it('resolves triggers and configuration and performs GitHub operations',
    async () => {
      const registry = new PluginRegistry();
      registry.register(new DummyPlugin());
      registry.register(new DummyPlugin(
        'dummy-any-action',
        [new Trigger('pull_request')]
      ));
      registry.register(new DummyPlugin(
        'dummy-disabled',
        [new Trigger('pull_request', 'opened')]
      ));
      const configuration = [
        'version: "1.0"',
        'plugins:',
        '  dummy-plugin:',
        '    enabled: true',
        '    settings:',
        '      comment: "Explicitly opened only."',
        '      label: "dummy-opened"',
        '  dummy-any-action:',
        '    enabled: true',
        '    settings:',
        '      comment: "Any pull request action."',
        '      label: "dummy-any-action"',
        '  dummy-disabled:',
        '    enabled: false',
        '    settings:',
        '      comment: "Never runs."',
        '      label: "dummy-disabled"'
      ].join('\n');

      const openedApi = new FakeGitHubApi(
        configuration,
        [createPullRequest(101)]
      );
      const openedHandler = createWebhookFunction({
        webhookSecret: WEBHOOK_SECRET,
        pluginRegistry: registry,
        createApiClient: () => openedApi
      });

      const openedResponse = await deliverWebhook(
        openedHandler,
        createPullRequestPayload(101, 'opened')
      );

      assert.strictEqual(openedResponse.statusCode, 200);
      assert.deepStrictEqual(
        openedApi.pullRequests[0].labels.map((label) => label.name),
        ['dummy-opened', 'dummy-any-action']
      );
      assert.deepStrictEqual(
        openedApi.writeRequests().map((request) => request.route),
        [
          CREATE_COMMENT_ROUTE,
          ADD_LABELS_ROUTE,
          CREATE_COMMENT_ROUTE,
          ADD_LABELS_ROUTE
        ]
      );
      const commentBodies = openedApi.requestsFor(CREATE_COMMENT_ROUTE).map(
        (request) => request.parameters.body
      );
      assert.deepStrictEqual(
        commentBodies,
        ['Explicitly opened only.', 'Any pull request action.']
      );
      assert.deepStrictEqual(
        openedApi.requestsFor(GET_PULL_REQUEST_ROUTE)[0].parameters,
        {
          owner: 'oppia',
          repo: 'oppiabot',
          pull_number: 101
        }
      );

      const synchronizeApi = new FakeGitHubApi(
        configuration,
        [createPullRequest(102)]
      );
      const synchronizeHandler = createWebhookFunction({
        webhookSecret: WEBHOOK_SECRET,
        pluginRegistry: registry,
        createApiClient: () => synchronizeApi
      });

      const synchronizeResponse = await deliverWebhook(
        synchronizeHandler,
        createPullRequestPayload(102, 'synchronize')
      );

      assert.strictEqual(synchronizeResponse.statusCode, 200);
      assert.deepStrictEqual(
        synchronizeApi.pullRequests[0].labels.map((label) => label.name),
        ['dummy-any-action']
      );
      assert.deepStrictEqual(
        synchronizeApi.writeRequests().map((request) => request.route),
        [CREATE_COMMENT_ROUTE, ADD_LABELS_ROUTE]
      );
    });

  it('treats a repository without a configuration file as not opted in',
    async () => {
      const registry = new PluginRegistry();
      registry.register(new DummyPlugin());
      const api = new FakeGitHubApi(undefined, [createPullRequest(201)]);
      const handler = createWebhookFunction({
        webhookSecret: WEBHOOK_SECRET,
        pluginRegistry: registry,
        createApiClient: () => api
      });
      const {logs, restore} = captureLogs();
      try {
        const response = await deliverWebhook(
          handler,
          createPullRequestPayload(201, 'opened')
        );

        assert.strictEqual(response.statusCode, 200);
        assert.deepStrictEqual(api.writeRequests(), []);
        assert.ok(
          logs.some(
            (line) => line.includes('0 plugin(s): 0 succeeded, 0 failed')
          )
        );
      } finally {
        restore();
      }
    });

  it('rejects invalid plugin settings before executing anything', async () => {
    const registry = new PluginRegistry();
    registry.register(new DummyPlugin());
    const api = new FakeGitHubApi([
      'version: "1.0"',
      'plugins:',
      '  dummy-plugin:',
      '    enabled: true',
      '    settings:',
      '      label: "dummy-opened"'
    ].join('\n'), [createPullRequest(301)]);
    const handler = createWebhookFunction({
      webhookSecret: WEBHOOK_SECRET,
      pluginRegistry: registry,
      createApiClient: () => api
    });
    const {logs, restore} = captureLogs();
    try {
      const response = await deliverWebhook(
        handler,
        createPullRequestPayload(301, 'opened')
      );

      assert.strictEqual(response.statusCode, 500);
      assert.deepStrictEqual(api.writeRequests(), []);
      assert.ok(
        logs.some(
          (line) =>
            line.includes('Failed to process webhook delivery') &&
            line.includes('Missing required configuration field: comment')
        )
      );
    } finally {
      restore();
    }
  });

  it('isolates a failing plugin and keeps executing the healthy one',
    async () => {
      const registry = new PluginRegistry();
      registry.register(new DummyPlugin('dummy-failing'));
      registry.register(new DummyPlugin());
      const api = new FakeGitHubApi([
        'version: "1.0"',
        'plugins:',
        '  dummy-failing:',
        '    enabled: true',
        '    settings:',
        '      comment: "This run fails."',
        '      label: "dummy-failing"',
        '      fail: true',
        '  dummy-plugin:',
        '    enabled: true',
        '    settings:',
        '      comment: "This run succeeds."',
        '      label: "dummy-healthy"'
      ].join('\n'), [createPullRequest(401)]);
      const handler = createWebhookFunction({
        webhookSecret: WEBHOOK_SECRET,
        pluginRegistry: registry,
        createApiClient: () => api
      });
      const {logs, restore} = captureLogs();
      try {
        const response = await deliverWebhook(
          handler,
          createPullRequestPayload(401, 'opened')
        );

        assert.strictEqual(response.statusCode, 200);
        assert.deepStrictEqual(
          api.pullRequests[0].labels.map((label) => label.name),
          ['dummy-healthy']
        );
        assert.ok(
          logs.some(
            (line) =>
              line.includes("Plugin 'dummy-failing' failed") &&
              line.includes('configured to fail')
          )
        );
        assert.ok(
          logs.some(
            (line) => line.includes('2 plugin(s): 1 succeeded, 1 failed')
          )
        );
      } finally {
        restore();
      }
    });

  it('records Dry-Run mutations without changing repository state',
    async () => {
      const registry = new PluginRegistry();
      registry.register(new DummyPlugin());
      const api = new FakeGitHubApi([
        'version: "1.0"',
        'plugins:',
        '  dummy-plugin:',
        '    enabled: true',
        '    dry_run: true',
        '    settings:',
        '      comment: "Dry-Run comment."',
        '      label: "dummy-dry-run"'
      ].join('\n'), [createPullRequest(501)]);
      const handler = createWebhookFunction({
        webhookSecret: WEBHOOK_SECRET,
        pluginRegistry: registry,
        createApiClient: () => api
      });
      const {logs, restore} = captureLogs();
      try {
        const response = await deliverWebhook(
          handler,
          createPullRequestPayload(501, 'opened')
        );

        assert.strictEqual(response.statusCode, 200);
        assert.deepStrictEqual(api.writeRequests(), []);
        assert.deepStrictEqual(api.pullRequests[0].labels, []);
        assert.strictEqual(
          api.requestsFor(GET_PULL_REQUEST_ROUTE).length,
          1
        );
        assert.ok(
          logs.some(
            (line) =>
              line.includes('Dry-Run: ' + CREATE_COMMENT_ROUTE) &&
              line.includes('Dry-Run comment.')
          )
        );
        assert.ok(
          logs.some(
            (line) =>
              line.includes('Dry-Run: ' + ADD_LABELS_ROUTE) &&
              line.includes('dummy-dry-run')
          )
        );
        assert.ok(
          logs.some(
            (line) => line.includes('1 plugin(s): 1 succeeded, 0 failed')
          )
        );
      } finally {
        restore();
      }
    });

  it('executes a scheduled run only for its OPPIABOT_WORKFLOW_ID',
    async () => {
      const registry = new PluginRegistry();
      registry.register(new DummyPlugin());
      const workspace = await mkdtemp(join(tmpdir(), 'oppiabot-e2e-'));
      await mkdir(join(workspace, '.github'), {recursive: true});
      await writeFile(
        join(workspace, '.github', 'oppiabot.yml'),
        [
          'version: "1.0"',
          'plugins:',
          '  dummy-plugin:',
          '    enabled: true',
          '    settings:',
          '      comment: "Scheduled dummy sweep."',
          '      label: "dummy-scheduled"'
        ].join('\n')
      );
      try {
        const api = new FakeGitHubApi(undefined, [
          createPullRequest(601),
          createPullRequest(602, ['dummy-scheduled'])
        ]);
        const handler = createScheduledExecution({
          pluginRegistry: registry,
          workspaceDirectory: workspace,
          createApiClient: () => api
        });

        await handler({
          OPPIABOT_WORKFLOW_ID: DUMMY_SCHEDULED_WORKFLOW_ID,
          GITHUB_REPOSITORY: 'oppia/oppiabot',
          GITHUB_REF_NAME: 'develop'
        });

        assert.deepStrictEqual(
          api.pullRequests.map(
            (pullRequest) => pullRequest.labels.map((label) => label.name)
          ),
          [['dummy-scheduled'], ['dummy-scheduled']]
        );
        assert.deepStrictEqual(
          api.writeRequests().map((request) => request.route),
          [CREATE_COMMENT_ROUTE, ADD_LABELS_ROUTE]
        );
        assert.deepStrictEqual(
          api.requestsFor(LIST_PULL_REQUESTS_ROUTE)[0].parameters,
          {
            owner: 'oppia',
            repo: 'oppiabot',
            state: 'open',
            per_page: 100,
            page: 1
          }
        );

        const otherApi = new FakeGitHubApi(undefined, [
          createPullRequest(603)
        ]);
        const otherHandler = createScheduledExecution({
          pluginRegistry: registry,
          workspaceDirectory: workspace,
          createApiClient: () => otherApi
        });
        await otherHandler({
          OPPIABOT_WORKFLOW_ID: 'reviewer-lag-digest',
          GITHUB_REPOSITORY: 'oppia/oppiabot',
          GITHUB_REF_NAME: 'develop'
        });

        assert.deepStrictEqual(otherApi.writeRequests(), []);
      } finally {
        await rm(workspace, {recursive: true, force: true});
      }
    });

  it('runs a deferred follow-up against the current GitHub state',
    async () => {
      const registry = new PluginRegistry();
      registry.register(new DummyPlugin());
      const api = new FakeGitHubApi([
        'version: "1.0"',
        'plugins:',
        '  dummy-plugin:',
        '    enabled: true',
        '    settings:',
        '      comment: "Deferred comment."',
        '      label: "dummy-deferred"',
        '      deferred_delay_ms: 3000'
      ].join('\n'), [createPullRequest(701)]);
      const scheduler = new RecordingScheduler();
      const configurationLoader = new ConfigurationLoader(
        new ApiRepositoryFileReader(() => api),
        registry
      );
      const engine = new CoreEngine(registry, scheduler);
      const response = await handleGitHubWebhook(
        createWebhookRequest(createPullRequestPayload(701, 'opened')),
        {
          webhookSecret: WEBHOOK_SECRET,
          engine: engine,
          configurationLoader: configurationLoader,
          createGitHubClient: (repository: RepositoryContext) =>
            new OppiabotGitHubClient(api, repository)
        }
      );

      assert.strictEqual(response.status, 200);
      assert.strictEqual(scheduler.requests.length, 1);
      assert.strictEqual(scheduler.requests[0].delayMs, 3000);
      assert.deepStrictEqual(api.writeRequests(), []);
      assert.strictEqual(api.requestsFor(GET_PULL_REQUEST_ROUTE).length, 0);

      api.pullRequests[0].labels.push({name: 'dummy-deferred'});
      await scheduler.runScheduled();

      assert.strictEqual(scheduler.requests.length, 1);
      assert.strictEqual(api.requestsFor(GET_PULL_REQUEST_ROUTE).length, 1);
      assert.deepStrictEqual(api.writeRequests(), []);
      assert.deepStrictEqual(
        api.pullRequests[0].labels.map((label) => label.name),
        ['dummy-deferred']
      );
    });
});
