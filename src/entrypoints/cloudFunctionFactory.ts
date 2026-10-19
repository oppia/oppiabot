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
 * @fileoverview Wiring for the Google Cloud Function webhook entrypoint.
 *
 * This module builds the entrypoint from a plugin registry and a GitHub API
 * client factory. The factory is supplied by the deployment so that
 * authentication for outbound GitHub API operations stays outside the
 * entrypoint, while the entrypoint itself stays testable with a fake client.
 */

import { getOctokit } from '@actions/github';

import {
  ConfigurationLoader,
  CoreEngine,
  GitHubApiClient,
  OppiabotGitHubClient,
  PluginRegistry,
  RepositoryFileReader
} from '../core';
import { RepositoryContext } from '../types';
import {
  CloudFunctionDependencies,
  CloudFunctionHandler,
  WEBHOOK_SECRET_ENV,
  createCloudFunctionHandler
} from './cloudFunction';

/**
 * The `GET /repos/{owner}/{repo}/contents/{path}` response for a file, as
 * returned by the GitHub contents API.
 */
interface RepositoryContents {
  type?: string;
  encoding?: string;
  content?: string;
}

/**
 * A `RepositoryFileReader` backed by the GitHub contents API.
 *
 * The configuration loader reads `.github/oppiabot.yml` through this reader.
 * A missing file resolves to `undefined`, which the loader treats as a
 * repository that has not opted in to Oppiabot.
 */
export class ApiRepositoryFileReader implements RepositoryFileReader {
  constructor(
    private readonly createApiClient: (
      repository: RepositoryContext
    ) => GitHubApiClient
  ) {}

  /**
   * Reads a text file from a repository at the given ref.
   *
   * @param {RepositoryContext} repository - Repository containing the file.
   * @param {string} filePath - Repository-relative path of the file.
   * @param {string} ref - Git ref to read the file at.
   * @returns {Promise<string | undefined>} The file contents, or undefined
   *   when the repository does not contain the file at the given ref.
   * @throws {Error} if the file cannot be read for any other reason.
   */
  async readRepositoryFile(
    repository: RepositoryContext,
    filePath: string,
    ref: string
  ): Promise<string | undefined> {
    const api = this.createApiClient(repository);
    let data: RepositoryContents | RepositoryContents[];
    try {
      const response = await api.request<
        RepositoryContents | RepositoryContents[]
      >('GET /repos/{owner}/{repo}/contents/{path}', {
        owner: repository.owner,
        repo: repository.name,
        path: filePath,
        ref: ref
      });
      data = response.data;
    } catch (error) {
      if (isNotFoundError(error)) {
        return undefined;
      }
      throw error;
    }
    if (Array.isArray(data) || data.type !== 'file') {
      return undefined;
    }
    if (typeof data.content !== 'string') {
      return undefined;
    }
    const encoding = data.encoding === 'base64' ? 'base64' : 'utf8';
    return Buffer.from(data.content, encoding).toString('utf8');
  }
}

/**
 * Options used to build the Google Cloud Function webhook entrypoint.
 */
export interface CloudFunctionOptions {
  /** Secret used to verify inbound webhook signatures. Must not be empty. */
  webhookSecret: string;
  /** Registry of the plugins the Core Engine may execute. */
  pluginRegistry: PluginRegistry;
  /**
   * Builds a GitHub API client for a repository. The deployment supplies this
   * so that authentication stays outside the entrypoint.
   */
  createApiClient(repository: RepositoryContext): GitHubApiClient;
}

/**
 * Builds the Google Cloud Function callable for GitHub webhook deliveries.
 *
 * @param {CloudFunctionOptions} options - The webhook secret, plugin registry,
 *   and GitHub API client factory.
 * @returns {CloudFunctionHandler} The Cloud Function callable.
 * @throws {Error} if the webhook secret is empty.
 */
export function createWebhookFunction(
  options: CloudFunctionOptions
): CloudFunctionHandler {
  if (options.webhookSecret === '') {
    throw new Error(
      `The webhook secret (${WEBHOOK_SECRET_ENV}) must not be empty.`
    );
  }
  const configurationLoader = new ConfigurationLoader(
    new ApiRepositoryFileReader(options.createApiClient),
    options.pluginRegistry
  );
  const dependencies: CloudFunctionDependencies = {
    webhookSecret: options.webhookSecret,
    engine: new CoreEngine(options.pluginRegistry),
    configurationLoader: configurationLoader,
    createGitHubClient: (repository: RepositoryContext) =>
      new OppiabotGitHubClient(options.createApiClient(repository), repository)
  };
  return createCloudFunctionHandler(dependencies);
}

/**
 * Builds a GitHub API client authenticated with a token.
 *
 * This is one way a deployment can supply `createApiClient`; the entrypoint
 * does not depend on it. The returned client exposes only the `request`
 * operation the client abstraction uses.
 *
 * @param {string} githubToken - Token used for outbound GitHub API requests.
 * @returns {GitHubApiClient} A GitHub API client.
 */
export function createTokenApiClient(githubToken: string): GitHubApiClient {
  const octokit = getOctokit(githubToken);
  return {
    async request<TData>(
      route: string,
      parameters: Record<string, unknown>
    ): Promise<{ status: number; data: TData }> {
      const request = octokit.request as unknown as (
        route: string,
        parameters: Record<string, unknown>
      ) => Promise<{ status: number; data: unknown }>;
      const response = await request(route, parameters);
      return { status: response.status, data: response.data as TData };
    }
  };
}

/**
 * Returns whether an error represents a `404 Not Found` from GitHub.
 *
 * @param {unknown} error - The error thrown by the GitHub API client.
 * @returns {boolean} Whether the error is a 404.
 */
function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { status?: unknown }).status === 404
  );
}
