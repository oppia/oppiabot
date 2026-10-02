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
 * @fileoverview Oppiabot GitHub API client.
 */

import { RepositoryContext } from '../types/repository';

/**
 * GitHub resource states used when listing issues and pull requests.
 */
export type ResourceState = 'open' | 'closed' | 'all';

/**
 * A GitHub user reference as returned by the GitHub API.
 */
export interface GitHubUser {
  login: string;
}

/**
 * A GitHub label as returned by the GitHub API.
 */
export interface GitHubLabel {
  name: string;
}

/**
 * A GitHub pull request as returned by the GitHub API.
 *
 * Only the fields required by the migrated workflows are represented, so that
 * plugins depend on a stable shape rather than the full API response.
 */
export interface PullRequest {
  number: number;
  state: string;
  title: string;
  body: string | null;
  draft: boolean;
  merged: boolean;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  requested_reviewers: GitHubUser[];
  head: {
    sha: string;
  };
  base: {
    ref: string;
  };
}

/**
 * A GitHub pull request review as returned by the GitHub API.
 */
export interface PullRequestReview {
  state: string;
  user: GitHubUser | null;
}

/**
 * A file changed in a pull request, as returned by the GitHub API.
 */
export interface ChangedFile {
  filename: string;
  additions: number;
  deletions: number;
  status: string;
  patch?: string;
}

/**
 * A GitHub commit as returned by the GitHub API.
 */
export interface Commit {
  sha: string;
  commit: {
    message: string;
    committer: {
      date: string;
    } | null;
  };
}

/**
 * A GitHub issue as returned by the GitHub API.
 */
export interface Issue {
  number: number;
  state: string;
  title: string;
  body: string | null;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
}

/**
 * A single result from a GitHub search query.
 */
export interface SearchResult {
  total_count: number;
  items: Array<{
    number: number;
    title: string;
  }>;
}

/**
 * A file read from a repository, as returned by the GitHub API.
 */
export interface RepositoryFile {
  content: string;
  encoding: string;
}

/**
 * The GitHub REST routes used by the migrated workflows.
 */
const ROUTES = {
  getPullRequest: 'GET /repos/{owner}/{repo}/pulls/{pull_number}',
  listPullRequests: 'GET /repos/{owner}/{repo}/pulls',
  listPullRequestReviews:
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
  listChangedFiles:
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
  getIssue: 'GET /repos/{owner}/{repo}/issues/{issue_number}',
  listIssues: 'GET /repos/{owner}/{repo}/issues',
  createComment:
    'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
  addLabels: 'POST /repos/{owner}/{repo}/issues/{issue_number}/labels',
  removeLabel:
    'DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}',
  addAssignees: 'POST /repos/{owner}/{repo}/issues/{issue_number}/assignees',
  removeAssignees:
    'DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees',
  updateIssue: 'PATCH /repos/{owner}/{repo}/issues/{issue_number}',
  searchIssuesAndPullRequests: 'GET /search/issues',
  getCommit: 'GET /repos/{owner}/{repo}/commits/{ref}',
  getFileContent: 'GET /repos/{owner}/{repo}/contents/{path}',
};

/**
 * A response from the GitHub API.
 */
export interface GitHubApiResponse<TData> {
  status: number;
  data: TData;
}

/**
 * The GitHub API operations required by the migrated workflows.
 *
 * Octokit exposes these through its request method, which is the one part of
 * its API surface that is identical across the versions used by the legacy
 * runtimes: the endpoint-method helpers differ between Octokit releases, but
 * request accepts a route and parameters in all of them. Declaring this
 * interface lets the client be constructed with an Octokit instance from
 * either runtime without an adapter, and lets tests provide a fake.
 */
export interface GitHubApiClient {
  request<TData>(
    route: string,
    parameters: Record<string, unknown>
  ): Promise<GitHubApiResponse<TData>>;
}

/**
 * Maximum number of results GitHub returns per page for most list operations.
 *
 * getAllChangedFiles in the legacy implementation relies on this value, so the
 * client uses the same page size when reading a pull request's changed files.
 */
const MAX_RESULTS_PER_PAGE = 100;

/**
 * Provides a common interface for GitHub API operations performed by Oppiabot
 * plugins.
 *
 * Plugins use this abstraction instead of accessing Octokit or
 * runtime-specific GitHub clients directly. The client is runtime-independent:
 * it is constructed with a repository and a GitHub API client, so the same
 * client works for webhook executions and scheduled executions.
 *
 * Every operation is scoped to the repository the client was constructed with,
 * matching the scoping the legacy implementations performed through
 * context.repo(). Read operations return the response data directly, so
 * plugins do not need to know how the underlying client wraps results.
 */
export class OppiabotGitHubClient {
  constructor(
    private readonly api: GitHubApiClient,
    private readonly repository: RepositoryContext
  ) {}

  /**
   * Returns the repository this client operates on.
   *
   * @returns {RepositoryContext} The repository context for the client.
   */
  getRepository(): RepositoryContext {
    return this.repository;
  }

  /**
   * Retrieves a pull request.
   *
   * @param {number} pullRequestNumber - Number of the pull request.
   * @returns {Promise<PullRequest>} The requested pull request.
   * @throws {OppiabotGitHubClientError} if the pull request cannot be read.
   */
  async getPullRequest(pullRequestNumber: number): Promise<PullRequest> {
    return this.request<PullRequest>(ROUTES.getPullRequest, {
      pull_number: pullRequestNumber
    });
  }

  /**
   * Lists pull requests in the repository.
   *
   * @param {ResourceState} [state] - State of the pull requests to list.
   *   Defaults to 'open'.
   * @returns {Promise<PullRequest[]>} The matching pull requests.
   * @throws {OppiabotGitHubClientError} if the pull requests cannot be read.
   */
  async listPullRequests(
    state: ResourceState = 'open'
  ): Promise<PullRequest[]> {
    return this.request<PullRequest[]>(ROUTES.listPullRequests, {
      state,
      per_page: MAX_RESULTS_PER_PAGE
    });
  }

  /**
   * Lists the reviews submitted on a pull request.
   *
   * @param {number} pullRequestNumber - Number of the pull request.
   * @returns {Promise<PullRequestReview[]>} The reviews on the pull request.
   * @throws {OppiabotGitHubClientError} if the reviews cannot be read.
   */
  async listPullRequestReviews(
    pullRequestNumber: number
  ): Promise<PullRequestReview[]> {
    return this.request<PullRequestReview[]>(
      ROUTES.listPullRequestReviews,
      {pull_number: pullRequestNumber}
    );
  }

  /**
   * Lists the files changed in a pull request.
   *
   * The GitHub API returns at most 100 files per page, so all pages are read
   * to return the complete list.
   *
   * @param {number} pullRequestNumber - Number of the pull request.
   * @returns {Promise<ChangedFile[]>} All files changed in the pull request.
   * @throws {OppiabotGitHubClientError} if the changed files cannot be read.
   */
  async listChangedFiles(pullRequestNumber: number): Promise<ChangedFile[]> {
    const changedFiles: ChangedFile[] = [];
    let page = 1;
    let pageCount: number;
    do {
      const filesInPage = await this.request<ChangedFile[]>(
        ROUTES.listChangedFiles,
        {
          pull_number: pullRequestNumber,
          per_page: MAX_RESULTS_PER_PAGE,
          page
        }
      );
      changedFiles.push(...filesInPage);
      pageCount = filesInPage.length;
      page++;
    } while (pageCount === MAX_RESULTS_PER_PAGE);
    return changedFiles;
  }

  /**
   * Retrieves an issue.
   *
   * @param {number} issueNumber - Number of the issue.
   * @returns {Promise<Issue>} The requested issue.
   * @throws {OppiabotGitHubClientError} if the issue cannot be read.
   */
  async getIssue(issueNumber: number): Promise<Issue> {
    return this.request<Issue>(ROUTES.getIssue, {issue_number: issueNumber});
  }

  /**
   * Lists issues in the repository.
   *
   * @param {ResourceState} [state] - State of the issues to list. Defaults to
   *   'open'.
   * @returns {Promise<Issue[]>} The matching issues.
   * @throws {OppiabotGitHubClientError} if the issues cannot be read.
   */
  async listIssues(state: ResourceState = 'open'): Promise<Issue[]> {
    return this.request<Issue[]>(ROUTES.listIssues, {
      state,
      per_page: MAX_RESULTS_PER_PAGE
    });
  }

  /**
   * Searches issues and pull requests in the repository.
   *
   * The query is scoped to the repository the client was constructed with, so
   * a caller cannot search another repository by mistake.
   *
   * @param {string} query - Search query, without the repository qualifier.
   * @returns {Promise<SearchResult>} The matching search results.
   * @throws {OppiabotGitHubClientError} if the search cannot be performed.
   */
  async searchIssuesAndPullRequests(query: string): Promise<SearchResult> {
    return this.request<SearchResult>(ROUTES.searchIssuesAndPullRequests, {
      q: `${query} repo:${this.repository.getFullName()}`
    });
  }

  /**
   * Retrieves a commit.
   *
   * @param {string} sha - Commit SHA or ref.
   * @returns {Promise<Commit>} The requested commit.
   * @throws {OppiabotGitHubClientError} if the commit cannot be read.
   */
  async getCommit(sha: string): Promise<Commit> {
    return this.request<Commit>(ROUTES.getCommit, {ref: sha});
  }

  /**
   * Reads a file from the repository's default branch.
   *
   * @param {string} filePath - Repository-relative path of the file.
   * @returns {Promise<string>} The decoded file contents.
   * @throws {OppiabotGitHubClientError} if the file cannot be read or its
   *   encoding is not supported.
   */
  async getFileContent(filePath: string): Promise<string> {
    const file = await this.request<RepositoryFile>(
      ROUTES.getFileContent,
      {path: filePath, ref: this.repository.default_branch}
    );
    if (file.encoding !== 'base64') {
      throw new OppiabotGitHubClientError(
        `Unsupported encoding '${file.encoding}' for file '${filePath}'.`
      );
    }
    return Buffer.from(file.content, 'base64').toString('utf-8');
  }

  /**
   * Posts a comment on an issue or pull request.
   *
   * @param {number} issueNumber - Number of the issue or pull request.
   * @param {string} body - Comment body in Markdown.
   * @returns {Promise<number>} The HTTP status of the request.
   * @throws {OppiabotGitHubClientError} if the request fails.
   */
  async createComment(issueNumber: number, body: string): Promise<number> {
    return this.mutate(ROUTES.createComment, {
      issue_number: issueNumber,
      body
    });
  }

  /**
   * Adds labels to an issue or pull request.
   *
   * @param {number} issueNumber - Number of the issue or pull request.
   * @param {string[]} labels - Labels to add.
   * @returns {Promise<number>} The HTTP status of the request.
   * @throws {OppiabotGitHubClientError} if the request fails.
   */
  async addLabels(issueNumber: number, labels: string[]): Promise<number> {
    return this.mutate(ROUTES.addLabels, {
      issue_number: issueNumber,
      labels
    });
  }

  /**
   * Removes a label from an issue or pull request.
   *
   * @param {number} issueNumber - Number of the issue or pull request.
   * @param {string} label - Label to remove.
   * @returns {Promise<number>} The HTTP status of the request.
   * @throws {OppiabotGitHubClientError} if the request fails.
   */
  async removeLabel(issueNumber: number, label: string): Promise<number> {
    return this.mutate(ROUTES.removeLabel, {
      issue_number: issueNumber,
      name: label
    });
  }

  /**
   * Adds assignees to an issue or pull request.
   *
   * @param {number} issueNumber - Number of the issue or pull request.
   * @param {string[]} assignees - Usernames to assign.
   * @returns {Promise<number>} The HTTP status of the request.
   * @throws {OppiabotGitHubClientError} if the request fails.
   */
  async addAssignees(issueNumber: number, assignees: string[]): Promise<number> {
    return this.mutate(ROUTES.addAssignees, {
      issue_number: issueNumber,
      assignees
    });
  }

  /**
   * Removes assignees from an issue or pull request.
   *
   * @param {number} issueNumber - Number of the issue or pull request.
   * @param {string[]} assignees - Usernames to unassign.
   * @returns {Promise<number>} The HTTP status of the request.
   * @throws {OppiabotGitHubClientError} if the request fails.
   */
  async removeAssignees(
    issueNumber: number,
    assignees: string[]
  ): Promise<number> {
    return this.mutate(ROUTES.removeAssignees, {
      issue_number: issueNumber,
      assignees
    });
  }

  /**
   * Closes an issue or pull request.
   *
   * @param {number} issueNumber - Number of the issue or pull request.
   * @returns {Promise<number>} The HTTP status of the request.
   * @throws {OppiabotGitHubClientError} if the request fails.
   */
  async closeIssue(issueNumber: number): Promise<number> {
    return this.mutate(ROUTES.updateIssue, {
      issue_number: issueNumber,
      state: 'closed'
    });
  }

  /**
   * Performs a read request scoped to the client's repository.
   *
   * @param {string} route - GitHub REST route to request.
   * @param {Object} [parameters] - Route parameters and query parameters.
   * @returns {Promise<TData>} The response data.
   * @throws {OppiabotGitHubClientError} if the request fails.
   */
  private async request<TData>(
    route: string,
    parameters: Record<string, unknown> = {}
  ): Promise<TData> {
    const response = await this.send<TData>(route, parameters);
    return response.data;
  }

  /**
   * Performs a mutation scoped to the client's repository.
   *
   * @param {string} route - GitHub REST route to request.
   * @param {Object} [parameters] - Route parameters and request body.
   * @returns {Promise<number>} The HTTP status of the request.
   * @throws {OppiabotGitHubClientError} if the request fails.
   */
  private async mutate(
    route: string,
    parameters: Record<string, unknown> = {}
  ): Promise<number> {
    const response = await this.send(route, parameters);
    return response.status;
  }

  /**
   * Sends a request scoped to the client's repository.
   *
   * @param {string} route - GitHub REST route to request.
   * @param {Object} parameters - Route parameters and query parameters.
   * @returns {Promise<Object>} The response from the GitHub API.
   * @throws {OppiabotGitHubClientError} if the request fails.
   */
  private async send<TData>(
    route: string,
    parameters: Record<string, unknown>
  ): Promise<GitHubApiResponse<TData>> {
    try {
      return await this.api.request<TData>(route, {
        owner: this.repository.owner,
        repo: this.repository.name,
        ...parameters
      });
    } catch (error) {
      throw new OppiabotGitHubClientError(
        'The GitHub API request failed: ' + (
          error instanceof Error ? error.message : String(error)
        ),
        error
      );
    }
  }
}

/**
 * Error thrown when a GitHub API request made through the
 * OppiabotGitHubClient fails.
 */
export class OppiabotGitHubClientError extends Error {
  constructor(
    message: string,
    /** The underlying error thrown by the GitHub API client. */
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'OppiabotGitHubClientError';
  }
}