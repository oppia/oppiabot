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
 * Declares only the fields the migrated workflows read; the runtime object is
 * the full GitHub API response and may carry additional fields.
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
    /**
     * The commit author as resolved by GitHub, or null when GitHub cannot
     * associate the commit with an account.
     */
    author: {
      date: string;
    } | null;
    /**
     * The commit committer as resolved by GitHub, or null when GitHub cannot
     * associate the commit with an account.
     */
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
  /**
   * Present only when the resource is a pull request. The GitHub issues
   * endpoint returns both issues and pull requests, so callers that need only
   * issues filter on this property.
   */
  pull_request?: {
    html_url?: string;
  };
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
};

/**
 * A response from the GitHub API.
 */
export interface GitHubApiResponse<TData> {
  status: number;
  data: TData;
}

/**
 * The GitHub API client that OppiabotGitHubClient sends requests through.
 *
 * This is the `request` method of an Octokit instance, which has the same
 * signature across the Octokit versions used by the webhook and scheduled
 * runtimes, so a runtime can construct OppiabotGitHubClient with the Octokit
 * version it already uses without an adapter. Tests substitute a fake.
 */
export interface GitHubApiClient {
  /**
   * Sends a request to a GitHub REST route.
   *
   * @param {string} route - Route in the form 'METHOD /path', with `{owner}`,
   *   `{repo}`, and any other path placeholders left for GitHub to resolve.
   * @param {Record<string, unknown>} parameters - Path parameters, query
   *   parameters, and request body fields. OppiabotGitHubClient supplies
   *   `owner` and `repo` from the repository it was constructed with.
   * @returns {Promise<GitHubApiResponse<TData>>} The HTTP status of the
   *   response and its body.
   * @throws {Error} if the request does not succeed. Octokit rejects with a
   *   RequestError for a non-2xx response; OppiabotGitHubClient relies on that
   *   rejection, so a client that resolves for error responses would surface
   *   failed operations as successes.
   */
  request<TData>(
    route: string,
    parameters: Record<string, unknown>
  ): Promise<GitHubApiResponse<TData>>;
}

/**
 * Maximum number of results GitHub returns per page for most list operations.
 *
 * Used as the page size by the loops that paginate (`listIssues` and
 * `listChangedFiles`), to detect a full page and request the next one, and as
 * the requested page size for the single-page operations (`listPullRequests`,
 * `listPullRequestReviews`, and `searchIssuesAndPullRequests`). The value
 * matches the page size the legacy implementations used.
 */
const MAX_RESULTS_PER_PAGE = 100;

/**
 * Performs GitHub API operations for Oppiabot plugins.
 *
 * Plugins use this client instead of calling Octokit or a runtime-specific
 * GitHub client directly. It is constructed with a GitHubApiClient and the
 * RepositoryContext it operates on, so the same class works in every runtime.
 *
 * Every route is scoped to the client's repository: the owner and repo from
 * the RepositoryContext are added to the parameters of each request. Read
 * methods resolve with the response body; mutation methods resolve with the
 * HTTP status of the successful response. When a request fails, the injected
 * GitHubApiClient rejects, and the method raises OppiabotGitHubClientError
 * with that rejection as its cause.
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
   * @returns {Promise<PullRequest[]>} Up to one page (`MAX_RESULTS_PER_PAGE`)
   *   of matching pull requests; a repository with more matching pull requests
   *   than fit on one page is truncated.
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
   * @returns {Promise<PullRequestReview[]>} At most `MAX_RESULTS_PER_PAGE`
   *   reviews; a pull request with more reviews than that is truncated,
   *   because this method reads a single page.
   * @throws {OppiabotGitHubClientError} if the reviews cannot be read.
   */
  async listPullRequestReviews(
    pullRequestNumber: number
  ): Promise<PullRequestReview[]> {
    return this.request<PullRequestReview[]>(
      ROUTES.listPullRequestReviews,
      {pull_number: pullRequestNumber, per_page: MAX_RESULTS_PER_PAGE}
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
   * The GitHub API returns pull requests through this endpoint as well, so the
   * returned list is not limited to issues. Every page is read because the
   * repository-wide issue list is used by scheduled plugins that must see all
   * open issues, and a single page would silently omit the remainder.
   *
   * @param {ResourceState} [state] - State of the issues to list. Defaults to
   *   'open'.
   * @returns {Promise<Issue[]>} The matching issues, including any pull
   *   requests returned by the endpoint.
   * @throws {OppiabotGitHubClientError} if the issues cannot be read.
   */
  async listIssues(state: ResourceState = 'open'): Promise<Issue[]> {
    const issues: Issue[] = [];
    let page = 1;
    let pageCount: number;
    do {
      const issuesInPage = await this.request<Issue[]>(ROUTES.listIssues, {
        state,
        per_page: MAX_RESULTS_PER_PAGE,
        page
      });
      issues.push(...issuesInPage);
      pageCount = issuesInPage.length;
      page++;
    } while (pageCount === MAX_RESULTS_PER_PAGE);
    return issues;
  }

  /**
   * Searches issues and pull requests in the repository.
   *
   * A `repo:` qualifier for the repository the client was constructed with is
   * appended to the caller's query. The caller should not add its own `repo:`
   * qualifier.
   *
   * @param {string} query - Search query, without the repository qualifier.
   * @returns {Promise<SearchResult>} Up to `MAX_RESULTS_PER_PAGE` of the
   *   matching search results; `total_count` counts all matching issues and
   *   pull requests in the repository, not just the returned page.
   * @throws {OppiabotGitHubClientError} if the search cannot be performed.
   */
  async searchIssuesAndPullRequests(query: string): Promise<SearchResult> {
    return this.request<SearchResult>(ROUTES.searchIssuesAndPullRequests, {
      q: `${query} repo:${this.repository.getFullName()}`,
      per_page: MAX_RESULTS_PER_PAGE
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
   * Posts a comment on an issue or pull request.
   *
   * @param {number} issueNumber - Number of the issue or pull request.
   * @param {string} body - Comment body in Markdown.
   * @returns {Promise<number>} The HTTP status of the successful response.
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
   * @returns {Promise<number>} The HTTP status of the successful response.
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
   * @returns {Promise<number>} The HTTP status of the successful response.
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
   * @returns {Promise<number>} The HTTP status of the successful response.
   * @throws {OppiabotGitHubClientError} if the request fails.
   */
  async addAssignees(
    issueNumber: number,
    assignees: string[]
  ): Promise<number> {
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
   * @returns {Promise<number>} The HTTP status of the successful response.
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
   * @returns {Promise<number>} The HTTP status of the successful response.
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
   * @returns {Promise<number>} The HTTP status of the successful response.
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
   * @returns {Promise<GitHubApiResponse<TData>>} The GitHub API response, with
   *   its status and data.
   * @throws {OppiabotGitHubClientError} if the request fails, wrapping the
   *   error raised by the GitHub API client.
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
        `The GitHub API request to ${route} failed: ` + (
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
