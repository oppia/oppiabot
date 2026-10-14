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
 * default_branch is populated by the runtime entrypoint or repository
 * metadata lookup before repository configuration is loaded.
 */
export class RepositoryContext {
  constructor(
    public readonly owner: string,
    public readonly name: string,
    public readonly default_branch: string
  ) {}

  /**
   * Returns the repository identifier.
   *
   * @returns {string} The repository identifier. Example: "owner/name".
   */
  getFullName(): string {
    return `${this.owner}/${this.name}`;
  }
}
