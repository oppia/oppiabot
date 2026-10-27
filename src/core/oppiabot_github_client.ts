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
 * A GitHub pull request as returned by the GitHub API list endpoint.
 *
 * Only the fields declared here are typed; the runtime object is the full
 * GitHub response and may carry more. `draft`, `assignees`, and
 * `requested_reviewers` are optional because GitHub may omit them. The merge
 * state (`merged`, `mergeable`) is not in GitHub's documented list response
 * schema; it is declared on `PullRequestDetails`, which `getPullRequest`
 * returns.
 */
export interface PullRequest {
  number: number;
  state: string;
  title: string;
  body: string | null;
  draft?: boolean;
  /**
   * The account that opened the pull request, or null when GitHub cannot
   * associate it with an account.
   */
  user: GitHubUser | null;
  labels: GitHubLabel[];
  assignees?: GitHubUser[] | null;
  requested_reviewers?: GitHubUser[] | null;
  head: {
    sha: string;
  };
  base: {
    ref: string;
  };
}

/**
 * A single GitHub pull request as returned by `getPullRequest`, which includes
 * the merge state that GitHub's documented list response schema omits.
 */
export interface PullRequestDetails extends PullRequest {
  merged: boolean;
  /**
   * Whether the pull request can be merged. Null while GitHub is still
   * computing mergeability; request the pull request again to read the result.
   */
  mergeable: boolean | null;
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
 *
 * The top-level `author` and `committer` are the GitHub accounts associated
 * with the commit; the nested `commit.author` and `commit.committer` are the
 * author and committer metadata recorded in the commit itself, which GitHub
 * does not associate with accounts.
 */
export interface Commit {
  sha: string;
  /**
   * The GitHub account associated with the commit's author, or null when
   * GitHub cannot associate the commit with an account.
   */
  author: GitHubUser | null;
  /**
   * The GitHub account associated with the commit's committer, or null when
   * GitHub cannot associate the commit with an account.
   */
  committer: GitHubUser | null;
  commit: {
    message: string;
    /**
     * The author metadata recorded in the commit itself, as pushed.
     */
    author: {
      name: string;
      email: string;
      date: string;
    };
    /**
     * The committer metadata recorded in the commit itself, as pushed.
     */
    committer: {
      name: string;
      email: string;
      date: string;
    };
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
   * endpoint returns pull requests as well as issues, so `getIssue` can
   * return a pull request when the number refers to one. `listIssues` filters
   * these results out, so they are never observed there.
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
 * The GitHub REST routes that OppiabotGitHubClient sends requests to.
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
 * It has the shape of the `request` method of an Octokit instance, so a
 * runtime provides one by wrapping the Octokit instance it already has. Tests
 * substitute a fake.
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
 * A GitHub mutation that a Dry-Run execution would have performed.
 *
 * The route and parameters describe the exact request the client would have
 * sent to GitHub. The parameters include the repository's owner and name, so a
 * recorded mutation is self-contained and can be compared with the legacy
 * behavior without consulting the client.
 */
export interface RecordedGitHubMutation {
  /** GitHub REST route of the intended request. */
  route: string;
  /** Fully scoped path parameters, query parameters, and request body. */
  parameters: Record<string, unknown>;
}

/**
 * Options that control how OppiabotGitHubClient executes requests.
 */
export interface OppiabotGitHubClientOptions {
  /**
   * Whether mutations are recorded instead of sent to GitHub. Defaults to
   * `false`, so a client performs mutations unless Dry-Run is requested.
   */
  dryRun?: boolean;
}

/**
 * The HTTP status returned by a mutation intercepted in Dry-Run mode.
 *
 * Dry-Run treats an intercepted mutation as successful so that a plugin can
 * continue evaluating the rest of the workflow. No request is sent to GitHub.
 */
const DRY_RUN_RESPONSE_STATUS = 200;

/**
 * Maximum number of results GitHub returns per page for most list operations.
 *
 * Used as the page size by the operations that read every matching record
 * (`listIssues`, `listPullRequests`, `listPullRequestReviews`, and
 * `listChangedFiles`), to detect a full page and request the next one, and as
 * the requested page size for the single-page search operation
 * (`searchIssuesAndPullRequests`). 100 is the largest page size GitHub's REST
 * API accepts.
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
 *
 * A client constructed with `dryRun: true` still performs reads, so plugins
 * can evaluate the current repository state, but intercepts every mutation.
 * An intercepted mutation is logged, recorded in `getRecordedMutations()`,
 * and reported as successful without contacting GitHub. This lets a migrated
 * plugin run against live events while the legacy implementation remains the
 * only one changing repository state.
 */
export class OppiabotGitHubClient {
  /** Mutations intercepted in Dry-Run mode, in execution order. */
  private readonly recordedMutations: RecordedGitHubMutation[] = [];
  /** Whether mutations are intercepted instead of sent to GitHub. */
  private readonly dryRun: boolean;

  constructor(
    private readonly api: GitHubApiClient,
    private readonly repository: RepositoryContext,
    options: OppiabotGitHubClientOptions = {}
  ) {
    this.dryRun = options.dryRun ?? false;
  }

  /**
   * Returns the repository this client operates on.
   *
   * @returns {RepositoryContext} The repository context for the client.
   */
  getRepository(): RepositoryContext {
    return this.repository;
  }

  /**
   * Returns whether this client intercepts mutations.
   *
   * @returns {boolean} `true` when mutations are recorded instead of sent to
   *   GitHub.
   */
  isDryRun(): boolean {
    return this.dryRun;
  }

  /**
   * Returns the mutations intercepted by this client.
   *
   * The returned array and its parameters are copies, so changing them does
   * not affect the client. Use it to report the intended actions of a Dry-Run
   * execution, for example when comparing a migrated plugin with the legacy
   * implementation.
   *
   * @returns {readonly RecordedGitHubMutation[]} The recorded mutations, in
   *   execution order.
   */
  getRecordedMutations(): readonly RecordedGitHubMutation[] {
    return this.recordedMutations.map((mutation) => ({
      route: mutation.route,
      parameters: this.copyParameters(mutation.parameters)
    }));
  }

  /**
   * Returns a client for the same repository and GitHub API that intercepts
   * mutations.
   *
   * The returned client has its own mutation recording, so each plugin can be
   * given an independent Dry-Run client. There is deliberately no operation
   * that turns a Dry-Run client back into a live client, so plugin code cannot
   * opt out of the mode the Core Engine selected.
   *
   * @returns {OppiabotGitHubClient} A Dry-Run client.
   */
  asDryRun(): OppiabotGitHubClient {
    return new OppiabotGitHubClient(
      this.api,
      this.repository,
      {dryRun: true}
    );
  }

  /**
   * Retrieves a pull request.
   *
   * @param {number} pullRequestNumber - Number of the pull request.
   * @returns {Promise<PullRequestDetails>} The requested pull request,
   *   including its merge state.
   * @throws {OppiabotGitHubClientError} if the pull request cannot be read.
   */
  async getPullRequest(
    pullRequestNumber: number
  ): Promise<PullRequestDetails> {
    return this.request<PullRequestDetails>(ROUTES.getPullRequest, {
      pull_number: pullRequestNumber
    });
  }

  /**
   * Lists pull requests in the repository.
   *
   * Every page is read because scheduled plugins sweep the repository's open
   * pull requests (for example the stale pull request sweeper), and a single
   * page would silently omit the remainder. GitHub's list response schema has
   * no merge state; call `getPullRequest` for `merged` and `mergeable`.
   *
   * @param {ResourceState} [state] - State of the pull requests to list.
   *   Defaults to 'open'.
   * @returns {Promise<PullRequest[]>} All matching pull requests.
   * @throws {OppiabotGitHubClientError} if the pull requests cannot be read.
   */
  async listPullRequests(
    state: ResourceState = 'open'
  ): Promise<PullRequest[]> {
    return this.listAllPages<PullRequest>(ROUTES.listPullRequests, {state});
  }

  /**
   * Lists the reviews submitted on a pull request.
   *
   * Every page is read because plugins evaluate the complete review state of
   * a pull request (for example the reviewer lag monitor), and a truncated
   * review list would misrepresent that state.
   *
   * @param {number} pullRequestNumber - Number of the pull request.
   * @returns {Promise<PullRequestReview[]>} All reviews on the pull request.
   * @throws {OppiabotGitHubClientError} if the reviews cannot be read.
   */
  async listPullRequestReviews(
    pullRequestNumber: number
  ): Promise<PullRequestReview[]> {
    return this.listAllPages<PullRequestReview>(
      ROUTES.listPullRequestReviews,
      {pull_number: pullRequestNumber}
    );
  }

  /**
   * Lists the files changed in a pull request.
   *
   * Every page is read because plugins evaluate the complete changed-file set
   * (for example review dismissal for late file changes), and a truncated
   * file list would miss files that require action.
   *
   * @param {number} pullRequestNumber - Number of the pull request.
   * @returns {Promise<ChangedFile[]>} All files changed in the pull request.
   * @throws {OppiabotGitHubClientError} if the changed files cannot be read.
   */
  async listChangedFiles(pullRequestNumber: number): Promise<ChangedFile[]> {
    return this.listAllPages<ChangedFile>(ROUTES.listChangedFiles, {
      pull_number: pullRequestNumber
    });
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
   * The GitHub issues endpoint returns pull requests as well as issues, so
   * pull requests are filtered out of the result, matching the behavior of
   * the legacy `getAllOpenIssues()` helper that migrated plugins are used to;
   * plugins that need pull requests call `listPullRequests`. Every page is
   * read because the repository-wide issue list is used by scheduled plugins
   * that must see all open issues, and a single page would silently omit the
   * remainder.
   *
   * @param {ResourceState} [state] - State of the issues to list. Defaults to
   *   'open'.
   * @returns {Promise<Issue[]>} All matching issues, excluding pull requests.
   * @throws {OppiabotGitHubClientError} if the issues cannot be read.
   */
  async listIssues(state: ResourceState = 'open'): Promise<Issue[]> {
    const issues = await this.listAllPages<Issue>(ROUTES.listIssues, {state});
    return issues.filter((issue) => issue.pull_request === undefined);
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
   * In Dry-Run mode the request is recorded and logged instead of sent, and
   * the mutation is reported as successful. The plugin therefore observes the
   * same control flow as a live run without changing repository state.
   *
   * @param {string} route - GitHub REST route to request.
   * @param {Object} [parameters] - Route parameters and request body.
   * @returns {Promise<number>} The HTTP status of the successful response, or
   *   `DRY_RUN_RESPONSE_STATUS` for an intercepted mutation.
   * @throws {OppiabotGitHubClientError} if the request fails.
   */
  private async mutate(
    route: string,
    parameters: Record<string, unknown> = {}
  ): Promise<number> {
    if (this.dryRun) {
      this.recordMutation(route, parameters);
      return DRY_RUN_RESPONSE_STATUS;
    }
    const response = await this.send(route, parameters);
    return response.status;
  }

  /**
   * Records and logs one intended mutation without sending it to GitHub.
   *
   * @param {string} route - GitHub REST route of the intended request.
   * @param {Object} parameters - Route parameters and request body.
   */
  private recordMutation(
    route: string,
    parameters: Record<string, unknown>
  ): void {
    const scopedParameters = this.copyParameters(
      this.scopedParameters(parameters)
    );
    this.recordedMutations.push({
      route,
      parameters: scopedParameters
    });
    console.log(
      `[OppiabotGitHubClient] Dry-Run: ${route} ` +
      JSON.stringify(scopedParameters)
    );
  }

  /**
   * Copies request parameters so a record cannot change after it is made.
   *
   * @param {Object} parameters - Route parameters and request body.
   * @returns {Object} A deep copy of the parameters.
   */
  private copyParameters(
    parameters: Record<string, unknown>
  ): Record<string, unknown> {
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parameters)) {
      copy[key] = this.copyParameterValue(value);
    }
    return copy;
  }

  /**
   * Copies one request parameter, including arrays and plain objects.
   *
   * @param {unknown} value - A request parameter value.
   * @returns {unknown} A copy of the value.
   */
  private copyParameterValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.copyParameterValue(entry));
    }
    if (value === null || typeof value !== 'object') {
      return value;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return value;
    }
    return this.copyParameters(value as Record<string, unknown>);
  }

  /**
   * Adds the client's repository to request parameters.
   *
   * @param {Object} parameters - Route parameters and request body.
   * @returns {Object} The parameters with `owner` and `repo` added.
   */
  private scopedParameters(
    parameters: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      owner: this.repository.owner,
      repo: this.repository.name,
      ...parameters
    };
  }

  /**
   * Reads every page of a list route scoped to the client's repository.
   *
   * Requests `MAX_RESULTS_PER_PAGE` results per page and keeps requesting the
   * next page while a returned page is full.
   *
   * @param {string} route - GitHub REST route to request.
   * @param {Object} parameters - Route parameters and query parameters, other
   *   than the page size and page number.
   * @returns {Promise<TData[]>} Every matching record across all pages.
   * @throws {OppiabotGitHubClientError} if any page cannot be read.
   */
  private async listAllPages<TData>(
    route: string,
    parameters: Record<string, unknown>
  ): Promise<TData[]> {
    const results: TData[] = [];
    let page = 1;
    let pageCount: number;
    do {
      const resultsInPage = await this.request<TData[]>(route, {
        ...parameters,
        per_page: MAX_RESULTS_PER_PAGE,
        page
      });
      results.push(...resultsInPage);
      pageCount = resultsInPage.length;
      page++;
    } while (pageCount === MAX_RESULTS_PER_PAGE);
    return results;
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
      return await this.api.request<TData>(
        route,
        this.scopedParameters(parameters)
      );
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
