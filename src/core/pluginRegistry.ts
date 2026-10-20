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
 * @fileoverview Plugin registration and resolution.
 */

import { OppiabotPlugin, PluginResolutionError }
  from './plugin';
import { PluginRegistrationMetadata } from './plugin';
import { Trigger } from './trigger';

/**
 * Maintains the list of available Oppiabot plugins and resolves the plugins
 * applicable to a given execution.
 *
 * Plugins are explicitly registered with the registry during application
 * initialization. Each registration provides the plugin metadata, supported
 * trigger keys, configuration schema, and execution handler.
 */
export class PluginRegistry {
  private readonly pluginsByName: Map<string, OppiabotPlugin>;

  constructor() {
    this.pluginsByName = new Map<string, OppiabotPlugin>();
  }

  /**
   * Registers a plugin with the registry.
   *
   * @param {OppiabotPlugin} plugin - The plugin to register.
   * @throws {PluginResolutionError} if a plugin with the same name is already
   *   registered.
   */
  register(plugin: OppiabotPlugin): void {
    if (this.pluginsByName.has(plugin.name)) {
      throw new PluginResolutionError(
        `A plugin named '${plugin.name}' is already registered.`
      );
    }
    this.pluginsByName.set(plugin.name, plugin);
  }

  /**
   * Returns the registration metadata of a registered plugin.
   *
   * @param {string} name - Name of the plugin.
   * @returns {PluginRegistrationMetadata | undefined} The plugin registration
   *   metadata, or undefined if no plugin with the given name is registered.
   */
  getRegistration(name: string): PluginRegistrationMetadata | undefined {
    const plugin = this.pluginsByName.get(name);
    if (plugin === undefined) {
      return undefined;
    }
    return this.toRegistrationMetadata(plugin);
  }

  /**
   * Returns all registered plugins.
   *
   * @returns {OppiabotPlugin[]} All registered plugins.
   */
  getAllPlugins(): OppiabotPlugin[] {
    return Array.from(this.pluginsByName.values());
  }

  /**
   * Resolves the registered plugins whose supported triggers match the given
   * trigger.
   *
   * A registered trigger with an explicitly specified action matches only the
   * corresponding event and action. A registered trigger without an action
   * matches all actions for the specified event.
   *
   * @param {Trigger} trigger - The trigger received by the Core Engine.
   * @returns {OppiabotPlugin[]} The plugins applicable to the trigger.
   */
  resolvePlugins(trigger: Trigger): OppiabotPlugin[] {
    return this.getAllPlugins().filter(
      (plugin) => plugin.supportedTriggers.some(
        (supportedTrigger) => supportedTrigger.matches(trigger)
      )
    );
  }

  /**
   * Converts a plugin into its registration metadata representation.
   *
   * @param {OppiabotPlugin} plugin - The plugin to convert.
   * @returns {PluginRegistrationMetadata} The plugin registration metadata.
   */
  private toRegistrationMetadata(
    plugin: OppiabotPlugin
  ): PluginRegistrationMetadata {
    return {
      name: plugin.name,
      supportedTriggers: plugin.supportedTriggers,
      configSchema: plugin.configSchema,
    };
  }
}
