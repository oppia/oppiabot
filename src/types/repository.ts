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
 * @fileoverview RepositoryContext domain object.
 */

/**
 * Represents repository information required during Oppiabot execution.
 *
 * The runtime entrypoint populates `default_branch` from the event or from a
 * repository metadata lookup before repository configuration is loaded; when
 * the event does not carry it, the entrypoint reads it through the GitHub API.
 */
export class RepositoryContext {
  constructor(
    /**
     * The account or organization that owns the repository, as used in GitHub
     * API paths.
     */
    public readonly owner: string,
    /**
     * The repository name, without the owner prefix.
     */
    public readonly name: string,
    /**
     * The repository's default branch, such as 'master' or 'main'.
     */
    public readonly default_branch: string
  ) {}

  /**
   * Returns the repository's full name in `owner/name` form.
   *
   * @returns {string} The repository identifier used in GitHub API paths and
   *   log messages, for example 'oppia/oppia'.
   */
  getFullName(): string {
    return `${this.owner}/${this.name}`;
  }

  /**
   * Validates the repository context domain object.
   *
   * @throws {RepositoryContextValidationError} if the owner, name, or default
   *   branch is undefined, null, or empty.
   */
  validate(): void {
    const invalidFields: string[] = [];
    if (this.owner === undefined || this.owner === null || this.owner === '') {
      invalidFields.push('owner');
    }
    if (this.name === undefined || this.name === null || this.name === '') {
      invalidFields.push('name');
    }
    if (
      this.default_branch === undefined ||
      this.default_branch === null ||
      this.default_branch === ''
    ) {
      invalidFields.push('default_branch');
    }
    if (invalidFields.length > 0) {
      throw new RepositoryContextValidationError(
        'The repository context contains empty fields: ' +
        invalidFields.join(', ') + '.'
      );
    }
  }
}

/**
 * Error thrown when a RepositoryContext is invalid.
 */
export class RepositoryContextValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryContextValidationError';
  }
}
