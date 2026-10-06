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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ChangedFile,
  GitHubApiClient,
  GitHubApiResponse,
  Issue,
  OppiabotGitHubClient,
  OppiabotGitHubClientError,
  PullRequest
} from '../../src/core/oppiabot_github_client';
import { RepositoryContext } from '../../src/types';

/**
 * Records every request made to the fake GitHub API client so that tests can
 * assert both the returned value and the request that produced it.
 */
class FakeGitHubApiClient implements GitHubApiClient {
  /** Requests made to the fake client, in order. */
  readonly requests: Array<{
    route: string;
    parameters: Record<string, unknown>;
  }> = [];

  /** Response returned for the listChangedFiles route, keyed by page number. */
  readonly changedFilesByPage: Map<number, ChangedFile[]> = new Map();

  /** Response returned for the listIssues route, keyed by page number. */
  readonly issuesByPage: Map<number, Issue[]> = new Map();

  async request<TData>(
    route: string,
    parameters: Record<string, unknown>
  ): Promise<GitHubApiResponse<TData>> {
    this.requests.push({route, parameters});
    if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files') {
      return {
        status: 200,
        data: this.changedFilesByPage.get(Number(parameters.page)) || []
      } as GitHubApiResponse<TData>;
    }
    if (route === 'GET /repos/{owner}/{repo}/issues') {
      return {
        status: 200,
        data: this.issuesByPage.get(Number(parameters.page)) ||
          [createIssue(1), createIssue(2)]
      } as GitHubApiResponse<TData>;
    }
    return {status: 200, data: this.responseFor(route, parameters)} as
      GitHubApiResponse<TData>;
  }

  /**
   * Returns the response data for a request.
   *
   * @param {string} route - Requested GitHub REST route.
   * @param {Object} parameters - Request parameters.
   * @returns {unknown} The response data for the route.
   */
  private responseFor(
    route: string,
    parameters: Record<string, unknown>
  ): unknown {
    switch (route) {
      case 'GET /repos/{owner}/{repo}/pulls/{pull_number}':
        return createPullRequest(Number(parameters.pull_number));
      case 'GET /repos/{owner}/{repo}/pulls':
        return [createPullRequest(101), createPullRequest(102)];
      case 'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews':
        return [{state: 'APPROVED', user: {login: 'reviewer'}}];
      case 'GET /repos/{owner}/{repo}/issues/{issue_number}':
        return createIssue(Number(parameters.issue_number));
      case 'GET /repos/{owner}/{repo}/issues':
        return [createIssue(1), createIssue(2)];
      case 'GET /search/issues':
        return {total_count: 1, items: [{number: 7, title: 'A pull request'}]};
      case 'GET /repos/{owner}/{repo}/commits/{ref}':
        return {
          sha: String(parameters.ref),
          commit: {
            message: 'A commit message',
            author: {date: '2026-10-01'},
            committer: {date: '2026-10-02'}
          }
        };
      default:
        return {};
    }
  }

  /**
   * Returns the parameters of the last recorded request.
   *
   * @returns {Object} The recorded parameters.
   */
  getLastParameters(): Record<string, unknown> {
    return this.requests[this.requests.length - 1].parameters;
  }
}

/**
 * Creates a pull request for use in tests.
 *
 * @param {number} number - Pull request number.
 * @returns {PullRequest} The pull request under test.
 */
function createPullRequest(number: number): PullRequest {
  return {
    number,
    state: 'open',
    title: `Pull request ${number}`,
    body: 'A pull request body',
    draft: false,
    merged: false,
    labels: [{name: 'bug'}],
    assignees: [{login: 'assignee'}],
    requested_reviewers: [{login: 'reviewer'}],
    head: {sha: 'abc123'},
    base: {ref: 'develop'}
  };
}

/**
 * Creates an issue for use in tests.
 *
 * @param {number} number - Issue number.
 * @returns {Issue} The issue under test.
 */
function createIssue(number: number): Issue {
  return {
    number,
    state: 'open',
    title: `Issue ${number}`,
    body: 'An issue body',
    labels: [],
    assignees: []
  };
}

/**
 * Creates a client backed by a fake GitHub API client.
 *
 * @returns {Object} The client and its fake, for assertions.
 */
function createClient(): {
  client: OppiabotGitHubClient;
  api: FakeGitHubApiClient;
} {
  const api = new FakeGitHubApiClient();
  const client = new OppiabotGitHubClient(
    api,
    new RepositoryContext('oppia', 'oppiabot', 'develop')
  );
  return {client, api};
}

describe('OppiabotGitHubClient', () => {
  describe('getRepository', () => {
    it('returns the repository the client operates on', () => {
      const {client} = createClient();
      assert.strictEqual(client.getRepository().getFullName(), 'oppia/oppiabot');
    });
  });

  describe('read operations', () => {
    it('retrieves a pull request scoped to the repository', async () => {
      const {client, api} = createClient();
      const pullRequest = await client.getPullRequest(42);
      assert.strictEqual(pullRequest.number, 42);
      assert.deepStrictEqual(api.getLastParameters(), {
        owner: 'oppia',
        repo: 'oppiabot',
        pull_number: 42
      });
    });

    it('lists open pull requests by default', async () => {
      const {client, api} = createClient();
      const pullRequests = await client.listPullRequests();
      assert.strictEqual(pullRequests.length, 2);
      assert.strictEqual(api.getLastParameters().state, 'open');
    });

    it('lists pull requests in a requested state', async () => {
      const {client, api} = createClient();
      await client.listPullRequests('closed');
      assert.strictEqual(api.getLastParameters().state, 'closed');
    });

    it('lists the reviews on a pull request', async () => {
      const {client} = createClient();
      const reviews = await client.listPullRequestReviews(42);
      assert.deepStrictEqual(reviews, [
        {state: 'APPROVED', user: {login: 'reviewer'}}
      ]);
    });

    it('retrieves an issue scoped to the repository', async () => {
      const {client, api} = createClient();
      const issue = await client.getIssue(7);
      assert.strictEqual(issue.number, 7);
      assert.deepStrictEqual(api.getLastParameters(), {
        owner: 'oppia',
        repo: 'oppiabot',
        issue_number: 7
      });
    });

    it('lists open issues by default', async () => {
      const {client, api} = createClient();
      const issues = await client.listIssues();
      assert.strictEqual(issues.length, 2);
      assert.strictEqual(api.getLastParameters().state, 'open');
    });

    it('requests a second page when the first page is full', async () => {
      const {client, api} = createClient();
      api.issuesByPage.set(1, Array.from(
        {length: 100},
        (_value, index) => createIssue(index + 1)
      ));
      api.issuesByPage.set(2, [createIssue(101)]);
      const issues = await client.listIssues();
      assert.strictEqual(issues.length, 101);
      assert.deepStrictEqual(
        api.requests.map((request) => request.parameters.page),
        [1, 2]
      );
    });

    it('requests each issue page exactly once', async () => {
      const {client, api} = createClient();
      api.issuesByPage.set(1, [createIssue(1)]);
      await client.listIssues();
      assert.strictEqual(api.requests.length, 1);
    });

    it('scopes a search query to the repository', async () => {
      const {client, api} = createClient();
      const result = await client.searchIssuesAndPullRequests(
        'is:pr review:approved'
      );
      assert.strictEqual(result.total_count, 1);
      assert.strictEqual(
        api.getLastParameters().q,
        'is:pr review:approved repo:oppia/oppiabot'
      );
    });

    it('retrieves a commit by ref', async () => {
      const {client} = createClient();
      const commit = await client.getCommit('abc123');
      assert.strictEqual(commit.sha, 'abc123');
      assert.strictEqual(commit.commit.message, 'A commit message');
    });

    it('exposes the author date a stale check compares against', async () => {
      const {client} = createClient();
      const commit = await client.getCommit('abc123');
      assert.strictEqual(commit.commit.author.date, '2026-10-01');
    });

    it('uses the expected route for each read operation', async () => {
      const {client, api} = createClient();
      await client.getPullRequest(1);
      await client.listPullRequests();
      await client.listPullRequestReviews(1);
      await client.listIssues();
      await client.searchIssuesAndPullRequests('is:issue');
      await client.getCommit('abc123');
      assert.deepStrictEqual(
        api.requests.map((request) => request.route),
        [
          'GET /repos/{owner}/{repo}/pulls/{pull_number}',
          'GET /repos/{owner}/{repo}/pulls',
          'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
          'GET /repos/{owner}/{repo}/issues',
          'GET /search/issues',
          'GET /repos/{owner}/{repo}/commits/{ref}'
        ]
      );
    });

    it('exposes pull requests returned by the issues endpoint', async () => {
      const {client, api} = createClient();
      api.request = async <TData>() => ({
        status: 200,
        data: [
          {...createIssue(1)},
          {
            ...createIssue(2),
            pull_request: {html_url: 'https://github.com/oppia/oppiabot/pull/2'}
          }
        ] as unknown as TData
      });
      const issues = await client.listIssues();
      assert.strictEqual(issues.length, 2);
      assert.ok(issues[1].pull_request);
      assert.strictEqual(issues[0].pull_request, undefined);
    });

    it('wraps a failed read request in a client error', async () => {
      const {client, api} = createClient();
      api.request = async () => {
        throw new Error('Not Found');
      };
      await assert.rejects(
        () => client.getPullRequest(42),
        (err: Error) => (
          err instanceof OppiabotGitHubClientError &&
          err.message.includes('Not Found')
        )
      );
    });

    it('preserves the underlying error as the cause', async () => {
      const {client, api} = createClient();
      const underlyingError = new Error('Bad credentials');
      api.request = async () => {
        throw underlyingError;
      };
      await assert.rejects(
        () => client.getPullRequest(42),
        (err: OppiabotGitHubClientError) => err.cause === underlyingError
      );
    });
  });

  describe('listChangedFiles', () => {
    it('returns the changed files from a single page', async () => {
      const {client, api} = createClient();
      api.changedFilesByPage.set(1, [
        {filename: 'a.py', additions: 1, deletions: 0, status: 'modified'}
      ]);
      const changedFiles = await client.listChangedFiles(42);
      assert.deepStrictEqual(changedFiles, [
        {filename: 'a.py', additions: 1, deletions: 0, status: 'modified'}
      ]);
    });

    it('returns no files when the pull request has no changed files', async () => {
      const {client} = createClient();
      const changedFiles = await client.listChangedFiles(42);
      assert.deepStrictEqual(changedFiles, []);
    });

    it('requests every page when a page is full', async () => {
      const {client, api} = createClient();
      const fullPage = Array.from(
        {length: 100},
        (_value, index) => ({
          filename: `file-${index}.py`,
          additions: 1,
          deletions: 0,
          status: 'modified'
        })
      );
      api.changedFilesByPage.set(1, fullPage);
      api.changedFilesByPage.set(2, [
        {filename: 'last.py', additions: 1, deletions: 0, status: 'added'}
      ]);
      const changedFiles = await client.listChangedFiles(42);
      assert.strictEqual(changedFiles.length, 101);
      assert.deepStrictEqual(
        api.requests.map((request) => request.parameters.page),
        [1, 2]
      );
    });

    it('requests each page exactly once', async () => {
      const {client, api} = createClient();
      api.changedFilesByPage.set(1, [
        {filename: 'a.py', additions: 1, deletions: 0, status: 'modified'}
      ]);
      await client.listChangedFiles(42);
      assert.strictEqual(api.requests.length, 1);
    });
  });

  describe('mutations', () => {
    it('posts a comment on an issue', async () => {
      const {client, api} = createClient();
      const status = await client.createComment(7, 'A comment');
      assert.strictEqual(status, 200);
      assert.deepStrictEqual(api.getLastParameters(), {
        owner: 'oppia',
        repo: 'oppiabot',
        issue_number: 7,
        body: 'A comment'
      });
    });

    it('adds labels to an issue', async () => {
      const {client, api} = createClient();
      await client.addLabels(7, ['bug', 'needs-review']);
      assert.deepStrictEqual(
        api.getLastParameters().labels,
        ['bug', 'needs-review']
      );
    });

    it('removes a label from an issue', async () => {
      const {client, api} = createClient();
      await client.removeLabel(7, 'bug');
      assert.strictEqual(api.getLastParameters().name, 'bug');
    });

    it('adds assignees to an issue', async () => {
      const {client, api} = createClient();
      await client.addAssignees(7, ['reviewer']);
      assert.deepStrictEqual(api.getLastParameters().assignees, ['reviewer']);
    });

    it('removes assignees from an issue', async () => {
      const {client, api} = createClient();
      await client.removeAssignees(7, ['reviewer']);
      assert.deepStrictEqual(api.getLastParameters().assignees, ['reviewer']);
    });

    it('closes an issue', async () => {
      const {client, api} = createClient();
      await client.closeIssue(7);
      assert.deepStrictEqual(api.getLastParameters(), {
        owner: 'oppia',
        repo: 'oppiabot',
        issue_number: 7,
        state: 'closed'
      });
    });

    it('uses the expected route for each mutation', async () => {
      const {client, api} = createClient();
      await client.createComment(7, 'A comment');
      await client.addLabels(7, ['bug']);
      await client.removeLabel(7, 'bug');
      await client.addAssignees(7, ['reviewer']);
      await client.removeAssignees(7, ['reviewer']);
      await client.closeIssue(7);
      assert.deepStrictEqual(
        api.requests.map((request) => request.route),
        [
          'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
          'POST /repos/{owner}/{repo}/issues/{issue_number}/labels',
          'DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}',
          'POST /repos/{owner}/{repo}/issues/{issue_number}/assignees',
          'DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees',
          'PATCH /repos/{owner}/{repo}/issues/{issue_number}'
        ]
      );
    });

    it('wraps a failed mutation in a client error', async () => {
      const {client, api} = createClient();
      api.request = async () => {
        throw new Error('Validation Failed');
      };
      await assert.rejects(
        () => client.createComment(7, 'A comment'),
        (err: Error) => (
          err instanceof OppiabotGitHubClientError &&
          err.message.includes('Validation Failed')
        )
      );
    });
  });
});
