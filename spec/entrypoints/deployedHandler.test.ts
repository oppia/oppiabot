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

import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';

import {
  CloudFunctionRequest,
  WEBHOOK_SECRET_ENV
} from '../../src/entrypoints/cloudFunction';
import {
  GITHUB_TOKEN_ENV,
  getWebhookHandler,
  webhookHandler
} from '../../src/entrypoints/deployedHandler';

const originalEnv: Record<string, string | undefined> = {};

afterEach(() => {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
    delete originalEnv[name];
  }
});

/**
 * Replaces an environment variable for the duration of one test.
 *
 * @param {string} name - The environment variable name.
 * @param {string | undefined} value - The value to set, or undefined to
 *   remove the variable.
 */
function setEnv(name: string, value: string | undefined): void {
  if (!(name in originalEnv)) {
    originalEnv[name] = process.env[name];
  }
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

/**
 * Builds a response double that records the reply it receives.
 *
 * @returns {object} The response double and its body.
 */
function createResponse(): {
  response: ServerResponse & { body: string; statusCode: number };
  body: () => string;
} {
  const response = {
    statusCode: 0,
    body: '',
    setHeader: () => undefined,
    end: (chunk: string) => {
      response.body = chunk;
    }
  } as unknown as ServerResponse & { body: string; statusCode: number };
  return { response: response, body: () => response.body };
}

/**
 * Runs a function with `console.error` captured for assertions.
 *
 * @param {() => Promise<void>} run - The function to execute.
 * @returns {Promise<string[]>} The logged lines.
 */
async function captureErrors(
  run: () => Promise<void>
): Promise<string[]> {
  const logged: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args.map(String).join(' '));
  };
  try {
    await run();
  } finally {
    console.error = originalError;
  }
  return logged;
}

describe('webhookHandler', () => {
  it('returns a JSON 500 when initialization fails', async () => {
    setEnv(WEBHOOK_SECRET_ENV, undefined);
    setEnv(GITHUB_TOKEN_ENV, undefined);
    const { response, body } = createResponse();
    const logged = await captureErrors(async () => {
      await webhookHandler(
        {} as CloudFunctionRequest,
        response
      );
    });
    assert.strictEqual(response.statusCode, 500);
    assert.strictEqual(
      body(),
      JSON.stringify({ message: 'Internal server error.' })
    );
    assert.match(logged.join('\n'), /WEBHOOK_SECRET/);
  });

  it('is exported as a callable handler', () => {
    assert.strictEqual(typeof webhookHandler, 'function');
  });
});

describe('getWebhookHandler', () => {
  it('throws when the webhook secret is not configured', () => {
    setEnv(WEBHOOK_SECRET_ENV, undefined);
    setEnv(GITHUB_TOKEN_ENV, undefined);
    assert.throws(() => getWebhookHandler(), /WEBHOOK_SECRET/);
  });

  it('throws when the GitHub token is not configured', () => {
    setEnv(WEBHOOK_SECRET_ENV, 'test-webhook-secret');
    setEnv(GITHUB_TOKEN_ENV, undefined);
    assert.throws(() => getWebhookHandler(), /GITHUB_TOKEN/);
  });

  it('builds a handler from the environment configuration', () => {
    setEnv(WEBHOOK_SECRET_ENV, 'test-webhook-secret');
    setEnv(GITHUB_TOKEN_ENV, 'test-github-token');
    assert.strictEqual(typeof getWebhookHandler(), 'function');
  });

  it('reuses the cached handler across calls', () => {
    setEnv(WEBHOOK_SECRET_ENV, 'test-webhook-secret');
    setEnv(GITHUB_TOKEN_ENV, 'test-github-token');
    const first = getWebhookHandler();
    assert.strictEqual(getWebhookHandler(), first);
  });
});
