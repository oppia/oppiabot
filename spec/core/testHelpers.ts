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

import {
  ExecutionContext,
  Trigger
} from '../../src/core';
import {
  RepositoryConfiguration,
  RepositoryContext
} from '../../src/types';

/**
 * Creates an initialized ExecutionContext for use in tests.
 *
 * @param {Trigger} trigger - The trigger to associate with the context.
 * @param {Object} [overrides] - Optional field overrides.
 * @returns {ExecutionContext} A valid ExecutionContext.
 */
export function createExecutionContext(
  trigger: Trigger,
  overrides: Partial<
    Pick<ExecutionContext, 'payload' | 'repository' | 'configuration'>
  > = {}
): ExecutionContext {
  const repository = overrides.repository || (
    new RepositoryContext('oppia', 'oppiabot', 'develop')
  );
  const configuration = overrides.configuration || (
    new RepositoryConfiguration('1.0', {})
  );
  return new ExecutionContext(
    trigger,
    overrides.payload || {},
    repository,
    configuration
  );
}
