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
 * @fileoverview Public exports for the Oppiabot Core Engine and Plugin
 * Framework.
 */

export { Trigger, TriggerValidationError } from './trigger';
export { ExecutionContext, ExecutionContextValidationError }
  from './execution_context';
export {
  OppiabotPlugin,
  PluginAction,
  PluginConfigurationError,
  PluginExecutionError,
  PluginRegistrationMetadata,
  PluginResolutionError,
  PluginResult
} from './plugin';
export { PluginRegistry } from './pluginRegistry';
export { CoreEngine } from './engine';
export {
  OppiabotGitHubClient,
  OppiabotGitHubClientError
} from './oppiabot_github_client';
