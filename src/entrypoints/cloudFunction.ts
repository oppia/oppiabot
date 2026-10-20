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
 * @fileoverview Google Cloud Function webhook entrypoint.
 *
 * This entrypoint turns an authenticated GitHub webhook delivery into the
 * common `Trigger` and `ExecutionContext` used by the Core Engine. It does not
 * contain workflow logic: it verifies the delivery, normalizes the event into a
 * trigger, loads the repository configuration, and invokes the Core Engine.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

import {
  ConfigurationLoader,
  CoreEngine,
  ExecutionContext,
  OppiabotGitHubClient,
  Trigger
} from '../core';
import { RepositoryContext } from '../types';

/**
 * Name of the environment variable holding the GitHub webhook secret used to
 * verify inbound deliveries.
 */
export const WEBHOOK_SECRET_ENV = 'WEBHOOK_SECRET';

/** Header carrying the GitHub event name, for example `pull_request`. */
export const EVENT_HEADER = 'x-github-event';

/** Header carrying the HMAC-SHA256 signature of the raw request body. */
export const SIGNATURE_HEADER = 'x-hub-signature-256';

/** Header carrying the unique identifier of the webhook delivery. */
export const DELIVERY_HEADER = 'x-github-delivery';

/**
 * HTTP headers, keyed by header name. Names are matched case-insensitively, so
 * callers may pass the headers exactly as their runtime reports them.
 */
export interface WebhookHeaders {
  [name: string]: string | string[] | undefined;
}

/**
 * A webhook delivery as received by the entrypoint, independent of the HTTP
 * runtime that produced it.
 */
export interface WebhookRequest {
  headers: WebhookHeaders;
  /**
   * The raw request body, exactly as received. Signature verification is
   * computed over these bytes, so the body must not be parsed or reformatted
   * before it reaches this entrypoint.
   */
  body: string | Buffer;
}

/**
 * The response the entrypoint returns to GitHub.
 */
export interface WebhookResponse {
  status: number;
  body: string;
}

/**
 * The collaborators the entrypoint uses to process one webhook delivery.
 *
 * Supplying them lets the entrypoint stay independent of how the GitHub client
 * is authenticated and of which repository file reader is available at
 * runtime.
 */
export interface CloudFunctionDependencies {
  /** Secret used to verify inbound webhook signatures. */
  webhookSecret: string;
  /** Core Engine that executes the plugins applicable to the delivery. */
  engine: CoreEngine;
  /** Loads the repository configuration passed to the Core Engine. */
  configurationLoader: ConfigurationLoader;
  /** Builds the GitHub API abstraction for a repository. */
  createGitHubClient(repository: RepositoryContext): OppiabotGitHubClient;
}

/**
 * The event name and action parsed from a webhook delivery.
 */
export interface NormalizedWebhook {
  /** The GitHub event name, for example `pull_request`. */
  event: string;
  /** The event action, for example `opened`, or `undefined` when absent. */
  action?: string;
  /** The delivery payload. */
  payload: Record<string, unknown>;
  /** The delivery identifier, when the delivery reported one. */
  deliveryId?: string;
}

/**
 * Error thrown when a webhook delivery is malformed and cannot be normalized.
 *
 * The entrypoint maps it to a client error response rather than an internal
 * error.
 */
export class WebhookRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookRequestError';
  }
}

/**
 * Verifies a GitHub webhook signature.
 *
 * GitHub signs the raw request body with HMAC-SHA256 using the shared webhook
 * secret and sends the result in the `X-Hub-Signature-256` header as
 * `sha256=<hex digest>`. This recomputes the digest and compares the two in
 * constant time.
 *
 * @param {string} secret - The configured webhook secret.
 * @param {string | Buffer} rawBody - The raw request body that was signed.
 * @param {string | undefined} signatureHeader - The signature header value.
 * @returns {boolean} Whether the signature is present, well-formed, and
 *   matches the body. Never throws.
 */
export function verifyGitHubSignature(
  secret: string,
  rawBody: string | Buffer,
  signatureHeader: string | undefined
): boolean {
  const match =
    signatureHeader === undefined
      ? null
      : /^sha256=([0-9a-fA-F]{64})$/.exec(signatureHeader);
  if (match === null) {
    return false;
  }
  const providedSignature = Buffer.from(match[1], 'hex');
  const expectedSignature = createHmac('sha256', secret)
    .update(rawBody)
    .digest();
  if (providedSignature.length !== expectedSignature.length) {
    return false;
  }
  return timingSafeEqual(providedSignature, expectedSignature);
}

/**
 * Normalizes a webhook delivery into its event, action, payload, and delivery
 * identifier.
 *
 * @param {WebhookHeaders} headers - The request headers.
 * @param {Record<string, unknown>} payload - The parsed request body.
 * @returns {NormalizedWebhook} The normalized delivery.
 * @throws {WebhookRequestError} if the event header is missing or empty, or
 *   the payload action is present but not a string.
 */
export function normalizeWebhook(
  headers: WebhookHeaders,
  payload: Record<string, unknown>
): NormalizedWebhook {
  const event = getHeader(headers, EVENT_HEADER);
  if (event === undefined || event === '') {
    throw new WebhookRequestError(
      `The '${EVENT_HEADER}' header is required.`
    );
  }
  const action = payload.action;
  if (
    action !== undefined &&
    action !== null &&
    typeof action !== 'string'
  ) {
    throw new WebhookRequestError(
      'The webhook payload action must be a string when present.'
    );
  }
  return {
    event: event,
    action: typeof action === 'string' && action !== '' ? action : undefined,
    payload: payload,
    deliveryId: getHeader(headers, DELIVERY_HEADER)
  };
}

/**
 * Extracts the repository context from a webhook payload.
 *
 * Repository webhook payloads include the repository's owner, name, and
 * default branch. The default branch is read from the payload rather than the
 * event's target branch, so a pull request cannot change the configuration ref
 * Oppiabot applies to it.
 *
 * @param {Record<string, unknown>} payload - The parsed webhook payload.
 * @returns {RepositoryContext} The repository identified by the payload.
 * @throws {WebhookRequestError} if the payload does not identify a repository
 *   with an owner, a name, and a default branch.
 */
export function extractRepositoryContext(
  payload: Record<string, unknown>
): RepositoryContext {
  const repository = payload.repository;
  if (!isRecord(repository)) {
    throw new WebhookRequestError(
      'The webhook payload does not contain repository information.'
    );
  }
  const owner = isRecord(repository.owner) ? repository.owner.login : undefined;
  const name = repository.name;
  const defaultBranch = repository.default_branch;
  if (
    typeof owner !== 'string' ||
    typeof name !== 'string' ||
    typeof defaultBranch !== 'string'
  ) {
    throw new WebhookRequestError(
      'The webhook payload does not identify the repository owner, name, and ' +
      'default branch.'
    );
  }
  return new RepositoryContext(owner, name, defaultBranch);
}

/**
 * Handles one GitHub webhook delivery.
 *
 * The signature is verified before the payload is trusted. A delivery with an
 * invalid signature or a malformed body is rejected without invoking the Core
 * Engine. A valid delivery produces an `ExecutionContext` that carries the
 * loaded repository configuration and the GitHub client, and is submitted to
 * the Core Engine.
 *
 * @param {WebhookRequest} request - The webhook delivery.
 * @param {CloudFunctionDependencies} dependencies - The collaborators used to
 *   process the delivery.
 * @returns {Promise<WebhookResponse>} The HTTP response for the delivery.
 * @throws {Error} if loading the configuration or executing the plugins fails
 *   for a reason other than a malformed request.
 */
export async function handleGitHubWebhook(
  request: WebhookRequest,
  dependencies: CloudFunctionDependencies
): Promise<WebhookResponse> {
  const signature = getHeader(request.headers, SIGNATURE_HEADER);
  if (
    !verifyGitHubSignature(
      dependencies.webhookSecret,
      request.body,
      signature
    )
  ) {
    return jsonResponse(401, 'Invalid webhook signature.');
  }

  let payload: Record<string, unknown>;
  let normalized: NormalizedWebhook;
  let repository: RepositoryContext;
  try {
    payload = parsePayload(request.body);
    normalized = normalizeWebhook(request.headers, payload);
    repository = extractRepositoryContext(payload);
  } catch (error) {
    if (error instanceof WebhookRequestError) {
      return jsonResponse(400, error.message);
    }
    throw error;
  }

  const githubClient = dependencies.createGitHubClient(repository);
  const configuration = await dependencies.configurationLoader.load(
    repository
  );
  const context = new ExecutionContext(
    new Trigger(normalized.event, normalized.action),
    normalized.payload,
    repository,
    configuration,
    githubClient,
    normalized.deliveryId
  );
  await dependencies.engine.execute(context);
  return jsonResponse(200, 'Execution completed.');
}

/**
 * Entrypoint callable for a Google Cloud Function HTTP trigger.
 *
 * Google Cloud Functions supplies the pre-read raw body on `request.rawBody`;
 * when it is absent, the body is read from the request stream. The callable
 * never rejects: signature and request errors produce their own statuses, and
 * any other failure produces a 500 without leaking details to GitHub.
 */
export type CloudFunctionHandler = (
  request: CloudFunctionRequest,
  response: ServerResponse
) => Promise<void>;

/**
 * A Google Cloud Function HTTP request, which carries the raw body.
 */
export interface CloudFunctionRequest extends IncomingMessage {
  rawBody?: string | Buffer;
}

/**
 * Creates the Google Cloud Function callable that processes GitHub webhook
 * deliveries.
 *
 * @param {CloudFunctionDependencies} dependencies - The collaborators used to
 *   process each delivery.
 * @returns {CloudFunctionHandler} The callable to export as the Cloud
 *   Function handler.
 */
export function createCloudFunctionHandler(
  dependencies: CloudFunctionDependencies
): CloudFunctionHandler {
  return async (
    request: CloudFunctionRequest,
    response: ServerResponse
  ): Promise<void> => {
    let webhookResponse: WebhookResponse;
    try {
      webhookResponse = await handleGitHubWebhook(
        { headers: request.headers, body: await readRequestBody(request) },
        dependencies
      );
    } catch (error) {
      console.error(
        '[cloudFunction] Failed to process webhook delivery: ' +
        describeError(error)
      );
      webhookResponse = {
        status: 500,
        body: JSON.stringify({ message: 'Internal server error.' })
      };
    }
    response.statusCode = webhookResponse.status;
    response.setHeader('content-type', 'application/json');
    response.end(webhookResponse.body);
  };
}

/**
 * Returns the first value of a header, matched case-insensitively.
 *
 * @param {WebhookHeaders} headers - The request headers.
 * @param {string} name - The lower-case header name to read.
 * @returns {string | undefined} The header value, or undefined when absent.
 */
function getHeader(
  headers: WebhookHeaders,
  name: string
): string | undefined {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== name) {
      continue;
    }
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }
  return undefined;
}

/**
 * Parses a webhook body as a JSON object.
 *
 * @param {string | Buffer} body - The raw request body.
 * @returns {Record<string, unknown>} The parsed payload.
 * @throws {WebhookRequestError} if the body is not a JSON object.
 */
function parsePayload(body: string | Buffer): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString('utf8'));
  } catch {
    throw new WebhookRequestError('The webhook body is not valid JSON.');
  }
  if (!isRecord(parsed)) {
    throw new WebhookRequestError(
      'The webhook body must be a JSON object.'
    );
  }
  return parsed;
}

/**
 * Reads the raw request body from the request stream.
 *
 * @param {CloudFunctionRequest} request - The incoming request.
 * @returns {Promise<Buffer>} The body bytes.
 */
async function readRequestBody(
  request: CloudFunctionRequest
): Promise<string | Buffer> {
  if (request.rawBody !== undefined) {
    return request.rawBody;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Builds a JSON response.
 *
 * @param {number} status - The HTTP status code.
 * @param {string} message - The message to include in the body.
 * @returns {WebhookResponse} The response.
 */
function jsonResponse(status: number, message: string): WebhookResponse {
  return { status: status, body: JSON.stringify({ message: message }) };
}

/**
 * Returns whether a value is a plain object.
 *
 * @param {unknown} value - The value to test.
 * @returns {boolean} Whether the value is a non-null, non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * Describes a thrown value for logging.
 *
 * @param {unknown} error - The thrown value.
 * @returns {string} A description of the value.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}
