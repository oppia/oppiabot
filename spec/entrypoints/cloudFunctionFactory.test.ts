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

import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';

import {
  GitHubApiClient,
  OppiabotPlugin,
  PluginRegistry,
  Trigger
} from '../../src/core';
import { ConfigSchema, RepositoryContext } from '../../src/types';
import {
  CloudFunctionRequest
} from '../../src/entrypoints/cloudFunction';
import {
  ApiRepositoryFileReader,
  createWebhookFunction
} from '../../src/entrypoints/cloudFunctionFactory';

const WEBHOOK_SECRET = 'test-webhook-secret';

const CONFIGURATION_YAML = [
  'version: "1.0"',
  'plugins:',
  '  test-plugin:',
  '    enabled: true'
].join('\n');

/**
 * Builds the signature GitHub sends for a body.
 *
 * @param {string} secret - The webhook secret.
 * @param {string | Buffer} body - The raw body to sign.
 * @returns {string} The `sha256=<hex>` signature header value.
 */
function signBody(secret: string, body: string | Buffer): string {
  return (
    'sha256=' +
    createHmac('sha256', secret).update(body).digest('hex')
  );
}

/**
 * Builds a repository payload as GitHub delivers it.
 *
 * @returns {Record<string, unknown>} The webhook payload.
 */
function createPayload(): Record<string, unknown> {
  return {
    action: 'opened',
    repository: {
      name: 'oppiabot',
      default_branch: 'develop',
      owner: { login: 'oppia' }
    }
  };
}

const CONTENTS_ROUTE = 'GET /repos/{owner}/{repo}/contents/{path}';
const REPOSITORY_ROUTE = 'GET /repos/{owner}/{repo}';

/**
 * One request recorded by `createRecordingApi`.
 */
interface RecordedRequest {
  route: string;
  parameters: Record<string, unknown>;
}

/**
 * Builds a GitHub API client that records the requests it receives.
 *
 * @param {(route: string, parameters: Record<string, unknown>) => unknown}
 *   handle - Responds to, or throws for, each recorded request.
 * @returns {object} The API client and the requests it recorded.
 */
function createRecordingApi(
  handle: (
    route: string,
    parameters: Record<string, unknown>
  ) => unknown
): { api: GitHubApiClient; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  const api = {
    request: async (route: string, parameters: Record<string, unknown>) => {
      requests.push({ route: route, parameters: parameters });
      return handle(route, parameters) as {
        status: number;
        data: unknown;
      };
    }
  } as unknown as GitHubApiClient;
  return { api: api, requests: requests };
}

describe('ApiRepositoryFileReader', () => {
  it('decodes a base64-encoded file from the contents API', async () => {
    const { api, requests } = createRecordingApi(() => ({
      status: 200,
      data: {
        type: 'file',
        encoding: 'base64',
        content: Buffer.from('version: "1.0"').toString('base64')
      }
    }));
    const reader = new ApiRepositoryFileReader(() => api);
    const contents = await reader.readRepositoryFile(
      new RepositoryContext('oppia', 'oppiabot', 'develop'),
      '.github/oppiabot.yml',
      'develop'
    );
    assert.strictEqual(contents, 'version: "1.0"');
    assert.strictEqual(requests[0].route, CONTENTS_ROUTE);
    assert.deepStrictEqual(requests[0].parameters, {
      owner: 'oppia',
      repo: 'oppiabot',
      path: '.github/oppiabot.yml',
      ref: 'develop'
    });
  });

  it('returns undefined when the file does not exist', async () => {
    const { api, requests } = createRecordingApi((route) => {
      if (route === CONTENTS_ROUTE) {
        throw Object.assign(new Error('Not Found'), { status: 404 });
      }
      return { status: 200, data: {} };
    });
    const reader = new ApiRepositoryFileReader(() => api);
    const contents = await reader.readRepositoryFile(
      new RepositoryContext('oppia', 'oppiabot', 'develop'),
      '.github/oppiabot.yml',
      'develop'
    );
    assert.strictEqual(contents, undefined);
    assert.deepStrictEqual(
      requests.map((request) => request.route),
      [CONTENTS_ROUTE, REPOSITORY_ROUTE]
    );
    assert.deepStrictEqual(requests[1].parameters, {
      owner: 'oppia',
      repo: 'oppiabot'
    });
  });

  it('throws when a file 404 shows the repository is inaccessible', async () => {
    const { api } = createRecordingApi(() => {
      throw Object.assign(new Error('Not Found'), { status: 404 });
    });
    const reader = new ApiRepositoryFileReader(() => api);
    await assert.rejects(
      reader.readRepositoryFile(
        new RepositoryContext('oppia', 'oppiabot', 'develop'),
        '.github/oppiabot.yml',
        'develop'
      ),
      /Not Found/
    );
  });

  it('rethrows errors other than a 404', async () => {
    const api = {
      request: async () => {
        throw Object.assign(new Error('Server Error'), { status: 500 });
      }
    } as unknown as GitHubApiClient;
    const reader = new ApiRepositoryFileReader(() => api);
    await assert.rejects(
      reader.readRepositoryFile(
        new RepositoryContext('oppia', 'oppiabot', 'develop'),
        '.github/oppiabot.yml',
        'develop'
      ),
      /Server Error/
    );
  });

  it('returns undefined when the path is a directory', async () => {
    const api = {
      request: async () => ({
        status: 200,
        data: [{ type: 'file', content: 'ignored' }]
      })
    } as unknown as GitHubApiClient;
    const reader = new ApiRepositoryFileReader(() => api);
    const contents = await reader.readRepositoryFile(
      new RepositoryContext('oppia', 'oppiabot', 'develop'),
      '.github',
      'develop'
    );
    assert.strictEqual(contents, undefined);
  });
});

describe('createWebhookFunction', () => {
  it('rejects an empty webhook secret', () => {
    assert.throws(
      () => createWebhookFunction({
        webhookSecret: '',
        pluginRegistry: new PluginRegistry(),
        createApiClient: () => ({
          request: async () => ({ status: 200, data: {} })
        } as unknown as GitHubApiClient)
      }),
      /webhook secret/
    );
  });

  it('runs an enabled plugin for a signed webhook delivery', async () => {
    const executed: string[] = [];
    const plugin: OppiabotPlugin = {
      name: 'test-plugin',
      supportedTriggers: [new Trigger('pull_request', 'opened')],
      configSchema: new ConfigSchema({}, []),
      execute: async () => {
        executed.push('test-plugin');
        return { actions: [], message: 'ok', success: true };
      }
    };
    const registry = new PluginRegistry();
    registry.register(plugin);

    const api = {
      request: async (route: string) => {
        if (route.includes('contents')) {
          return {
            status: 200,
            data: {
              type: 'file',
              encoding: 'base64',
              content: Buffer.from(CONFIGURATION_YAML).toString('base64')
            }
          };
        }
        return { status: 200, data: {} };
      }
    } as unknown as GitHubApiClient;
    const handler = createWebhookFunction({
      webhookSecret: WEBHOOK_SECRET,
      pluginRegistry: registry,
      createApiClient: () => api
    });

    const body = JSON.stringify(createPayload());
    const request = {
      headers: {
        'x-github-event': 'pull_request',
        'x-hub-signature-256': signBody(WEBHOOK_SECRET, body)
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
    } as unknown as ServerResponse & { body: string; statusCode: number };

    await handler(request, response);

    assert.deepStrictEqual(executed, ['test-plugin']);
    assert.strictEqual(response.statusCode, 200);
  });

  it('does not run a plugin when the signature is invalid', async () => {
    const executed: string[] = [];
    const plugin: OppiabotPlugin = {
      name: 'test-plugin',
      supportedTriggers: [new Trigger('pull_request', 'opened')],
      configSchema: new ConfigSchema({}, []),
      execute: async () => {
        executed.push('test-plugin');
        return { actions: [], message: 'ok', success: true };
      }
    };
    const registry = new PluginRegistry();
    registry.register(plugin);
    const api = {
      request: async () => ({ status: 200, data: {} })
    } as unknown as GitHubApiClient;
    const handler = createWebhookFunction({
      webhookSecret: WEBHOOK_SECRET,
      pluginRegistry: registry,
      createApiClient: () => api
    });

    const body = JSON.stringify(createPayload());
    const request = {
      headers: {
        'x-github-event': 'pull_request',
        'x-hub-signature-256': signBody('wrong-secret', body)
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
    } as unknown as ServerResponse & { body: string; statusCode: number };

    await handler(request, response);

    assert.deepStrictEqual(executed, []);
    assert.strictEqual(response.statusCode, 401);
  });
});
