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

import { WEBHOOK_SECRET_ENV } from '../../src/entrypoints/cloudFunction';
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

describe('webhookHandler', () => {
  it('is exported as a callable handler', () => {
    assert.strictEqual(typeof webhookHandler, 'function');
  });
});
