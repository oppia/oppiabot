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
 * @fileoverview Deployed Cloud Function export.
 *
 * This module is the composition root for the Google Cloud Function. It reads
 * the deployment credentials from the environment and exports the configured
 * webhook handler that the Cloud Functions runtime invokes. The handler is
 * built lazily on the first request so that loading the module never requires
 * the credentials to be present.
 */

import { PluginRegistry } from '../core';
import {
  CloudFunctionHandler,
  WEBHOOK_SECRET_ENV
} from './cloudFunction';
import {
  createTokenApiClient,
  createWebhookFunction
} from './cloudFunctionFactory';

/**
 * Name of the environment variable holding the token used for outbound
 * GitHub API requests.
 */
export const GITHUB_TOKEN_ENV = 'GITHUB_TOKEN';

let cachedHandler: CloudFunctionHandler | undefined;

/**
 * Creates the plugin registry the Core Engine executes.
 *
 * @returns {PluginRegistry} A registry holding the plugins the deployment
 *   exposes to the Core Engine.
 */
function createPluginRegistry(): PluginRegistry {
  const registry = new PluginRegistry();
  return registry;
}

/**
 * Builds the deployed webhook handler from the environment configuration.
 *
 * @returns {CloudFunctionHandler} The configured Cloud Function handler.
 * @throws {Error} if `WEBHOOK_SECRET` or `GITHUB_TOKEN` is not set. The first
 *   call builds and caches the handler; later calls return the cached
 *   instance.
 */
export function getWebhookHandler(): CloudFunctionHandler {
  if (cachedHandler === undefined) {
    const webhookSecret = process.env[WEBHOOK_SECRET_ENV];
    if (!webhookSecret) {
      throw new Error(`${WEBHOOK_SECRET_ENV} is not set.`);
    }
    const githubToken = process.env[GITHUB_TOKEN_ENV];
    if (!githubToken) {
      throw new Error(`${GITHUB_TOKEN_ENV} is not set.`);
    }
    cachedHandler = createWebhookFunction({
      webhookSecret: webhookSecret,
      pluginRegistry: createPluginRegistry(),
      createApiClient: () => createTokenApiClient(githubToken)
    });
  }
  return cachedHandler;
}

/**
 * The configured Cloud Function handler for GitHub webhook deliveries.
 */
export const webhookHandler: CloudFunctionHandler = async (req, res) => {
  await getWebhookHandler()(req, res);
};
