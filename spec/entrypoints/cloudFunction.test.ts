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

import {
  ConfigurationLoader,
  CoreEngine,
  ExecutionContext,
  GitHubApiClient,
  OppiabotGitHubClient,
  Trigger
} from '../../src/core';
import { RepositoryConfiguration, RepositoryContext } from '../../src/types';
import {
  CloudFunctionDependencies,
  WebhookRequestError,
  extractRepositoryContext,
  handleGitHubWebhook,
  normalizeWebhook,
  verifyGitHubSignature
} from '../../src/entrypoints/cloudFunction';

const WEBHOOK_SECRET = 'test-webhook-secret';

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
 * @param {Record<string, unknown>} [overrides] - Fields to override.
 * @returns {Record<string, unknown>} The webhook payload.
 */
function createPayload(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    action: 'opened',
    repository: {
      name: 'oppiabot',
      default_branch: 'develop',
      owner: { login: 'oppia' }
    },
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
 * Builds entrypoint dependencies for a webhook delivery.
 *
 * @param {object} [overrides] - Dependency overrides.
 * @returns {CloudFunctionDependencies} The dependencies.
 */
function createDependencies(overrides: {
  engine?: CoreEngine;
  configuration?: RepositoryConfiguration;
} = {}): CloudFunctionDependencies {
  const configuration = overrides.configuration || (
    new RepositoryConfiguration('1.0', {})
  );
  const api = {
    request: async () => ({ status: 200, data: {} })
  } as unknown as GitHubApiClient;
  const loader = {
    load: async () => configuration
  } as unknown as ConfigurationLoader;
  return {
    webhookSecret: WEBHOOK_SECRET,
    engine: overrides.engine || createCapturingEngine().engine,
    configurationLoader: loader,
    createGitHubClient: (repository: RepositoryContext) =>
      new OppiabotGitHubClient(api, repository)
  };
}

describe('verifyGitHubSignature', () => {
  it('accepts a signature computed with the configured secret', () => {
    const body = JSON.stringify(createPayload());
    assert.strictEqual(
      verifyGitHubSignature(WEBHOOK_SECRET, body, signBody(WEBHOOK_SECRET, body)),
      true
    );
  });

  it('rejects a missing signature header', () => {
    const body = JSON.stringify(createPayload());
    assert.strictEqual(
      verifyGitHubSignature(WEBHOOK_SECRET, body, undefined),
      false
    );
  });

  it('rejects a signature computed with a different secret', () => {
    const body = JSON.stringify(createPayload());
    assert.strictEqual(
      verifyGitHubSignature(
        WEBHOOK_SECRET,
        body,
        signBody('another-secret', body)
      ),
      false
    );
  });

  it('rejects a signature that does not use the sha256 prefix', () => {
    const body = JSON.stringify(createPayload());
    const signature = signBody(WEBHOOK_SECRET, body).replace('sha256=', '');
    assert.strictEqual(
      verifyGitHubSignature(WEBHOOK_SECRET, body, signature),
      false
    );
  });

  it('rejects a signature for a different body', () => {
    const body = JSON.stringify(createPayload());
    assert.strictEqual(
      verifyGitHubSignature(
        WEBHOOK_SECRET,
        body,
        signBody(WEBHOOK_SECRET, '{"action":"closed"}')
      ),
      false
    );
  });

  it('rejects a valid digest followed by trailing characters', () => {
    const body = JSON.stringify(createPayload());
    const signature = signBody(WEBHOOK_SECRET, body) + 'zz';
    assert.strictEqual(
      verifyGitHubSignature(WEBHOOK_SECRET, body, signature),
      false
    );
  });

  it('rejects a digest that is not exactly 64 hexadecimal characters', () => {
    const body = JSON.stringify(createPayload());
    const signature = signBody(WEBHOOK_SECRET, body).slice(0, -1);
    assert.strictEqual(
      verifyGitHubSignature(WEBHOOK_SECRET, body, signature),
      false
    );
  });
});

describe('normalizeWebhook', () => {
  it('reads the event, action, and delivery id from a delivery', () => {
    const payload = createPayload();
    const normalized = normalizeWebhook(
      {
        'x-github-event': 'pull_request',
        'x-github-delivery': 'delivery-1'
      },
      payload
    );
    assert.strictEqual(normalized.event, 'pull_request');
    assert.strictEqual(normalized.action, 'opened');
    assert.strictEqual(normalized.deliveryId, 'delivery-1');
    assert.strictEqual(normalized.payload, payload);
  });

  it('matches header names case-insensitively', () => {
    const normalized = normalizeWebhook(
      { 'X-GitHub-Event': 'issues' },
      createPayload({ action: undefined })
    );
    assert.strictEqual(normalized.event, 'issues');
    assert.strictEqual(normalized.action, undefined);
  });

  it('omits the action when the payload has none', () => {
    const normalized = normalizeWebhook(
      { 'x-github-event': 'push' },
      createPayload({ action: undefined })
    );
    assert.strictEqual(normalized.action, undefined);
  });

  it('omits an empty action', () => {
    const normalized = normalizeWebhook(
      { 'x-github-event': 'push' },
      createPayload({ action: '' })
    );
    assert.strictEqual(normalized.action, undefined);
  });

  it('rejects a delivery without an event header', () => {
    assert.throws(
      () => normalizeWebhook({}, createPayload()),
      WebhookRequestError
    );
  });

  it('rejects a non-string action', () => {
    assert.throws(
      () => normalizeWebhook(
        { 'x-github-event': 'pull_request' },
        createPayload({ action: 7 })
      ),
      WebhookRequestError
    );
  });
});

describe('extractRepositoryContext', () => {
  it('reads the owner, name, and default branch from the payload', () => {
    const repository = extractRepositoryContext(createPayload());
    assert.strictEqual(repository.getFullName(), 'oppia/oppiabot');
    assert.strictEqual(repository.default_branch, 'develop');
  });

  it('rejects a payload without repository information', () => {
    assert.throws(
      () => extractRepositoryContext({ action: 'opened' }),
      WebhookRequestError
    );
  });

  it('rejects a payload with an incomplete repository', () => {
    assert.throws(
      () => extractRepositoryContext({
        repository: { name: 'oppiabot', owner: { login: 'oppia' } }
      }),
      WebhookRequestError
    );
  });
});

describe('handleGitHubWebhook', () => {
  it('rejects an invalid signature without invoking the engine', async () => {
    const { engine, contexts } = createCapturingEngine();
    const response = await handleGitHubWebhook(
      {
        headers: { 'x-github-event': 'pull_request' },
        body: JSON.stringify(createPayload())
      },
      createDependencies({ engine })
    );
    assert.strictEqual(response.status, 401);
    assert.deepStrictEqual(contexts, []);
  });

  it('normalizes a valid delivery into an execution context', async () => {
    const { engine, contexts } = createCapturingEngine();
    const body = JSON.stringify(createPayload());
    const response = await handleGitHubWebhook(
      {
        headers: {
          'x-github-event': 'pull_request',
          'x-github-delivery': 'delivery-1',
          'x-hub-signature-256': signBody(WEBHOOK_SECRET, body)
        },
        body: body
      },
      createDependencies({ engine })
    );

    assert.strictEqual(response.status, 200);
    assert.strictEqual(contexts.length, 1);
    const context = contexts[0];
    assert.deepStrictEqual(context.trigger, new Trigger('pull_request', 'opened'));
    assert.strictEqual(context.repository.getFullName(), 'oppia/oppiabot');
    assert.strictEqual(context.deliveryId, 'delivery-1');
    assert.ok(context.githubClient instanceof OppiabotGitHubClient);
    assert.deepStrictEqual(context.payload, createPayload());
  });

  it('rejects malformed JSON after verifying the signature', async () => {
    const body = 'not-json';
    const { engine, contexts } = createCapturingEngine();
    const response = await handleGitHubWebhook(
      {
        headers: {
          'x-github-event': 'pull_request',
          'x-hub-signature-256': signBody(WEBHOOK_SECRET, body)
        },
        body: body
      },
      createDependencies({ engine })
    );
    assert.strictEqual(response.status, 400);
    assert.deepStrictEqual(contexts, []);
  });

  it('rejects a delivery without an event header', async () => {
    const body = JSON.stringify(createPayload());
    const { engine, contexts } = createCapturingEngine();
    const response = await handleGitHubWebhook(
      {
        headers: { 'x-hub-signature-256': signBody(WEBHOOK_SECRET, body) },
        body: body
      },
      createDependencies({ engine })
    );
    assert.strictEqual(response.status, 400);
    assert.deepStrictEqual(contexts, []);
  });

  it('passes the loaded configuration to the execution context', async () => {
    const { engine, contexts } = createCapturingEngine();
    const configuration = new RepositoryConfiguration('1.0', {});
    const body = JSON.stringify(createPayload());
    await handleGitHubWebhook(
      {
        headers: {
          'x-github-event': 'pull_request',
          'x-hub-signature-256': signBody(WEBHOOK_SECRET, body)
        },
        body: body
      },
      createDependencies({ engine, configuration })
    );
    assert.strictEqual(contexts[0].configuration, configuration);
  });
});
