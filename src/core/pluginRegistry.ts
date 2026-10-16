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
 * @fileoverview Plugin registration and trigger-based resolution.
 */

import { OppiabotPlugin, PluginResolutionError }
  from './plugin';
import { PluginRegistrationMetadata } from './plugin';
import { Trigger } from './trigger';
import { ExecutionContext } from './execution_context';
import { PluginConfiguration } from '../types/repository_configuration';

/**
 * Maintains the list of available Oppiabot plugins and resolves the plugins
 * applicable to a given execution.
 *
 * Plugins are explicitly registered during application initialization, each
 * with a name, supported triggers, configuration schema, and execute handler.
 *
 * The Core Engine asks the registry which plugins apply to an execution via
 * `resolvePlugins()`: a plugin applies only when a registered trigger matches
 * the received trigger and the repository configuration enables it.
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
   * Resolves the registered plugins applicable to the current execution.
   *
   * A plugin applies when both of these hold:
   *
   * - The received trigger matches a supported trigger, using
   *   `Trigger.matches()` (an action-less registered trigger matches every
   *   action of its event), not a canonical-key comparison.
   * - The repository configuration enables the plugin. A context without a
   *   configuration enables nothing; a plugin that is absent from the
   *   configuration, or configured with `enabled: false`, is not executed.
   *
   * Only registered plugins are considered. A configured plugin the registry
   * does not know about is ignored, so configuration may declare a plugin
   * before it is registered.
   *
   * @param {ExecutionContext} context - Execution context carrying the
   *   trigger to match and the repository configuration that enables plugins.
   * @returns {OppiabotPlugin[]} The applicable plugins, in registration order.
   * @throws {PluginResolutionError} if an enabled plugin's configuration
   *   cannot be resolved against the schema the plugin registered.
   */
  resolvePlugins(context: ExecutionContext): OppiabotPlugin[] {
    const applicablePlugins: OppiabotPlugin[] = [];
    for (const plugin of this.getAllPlugins()) {
      if (!this.supportsTrigger(plugin, context.trigger)) {
        continue;
      }
      if (!this.isEnabled(plugin, context)) {
        continue;
      }
      applicablePlugins.push(plugin);
    }
    return applicablePlugins;
  }

  /**
   * Returns whether a plugin declares support for the given trigger.
   *
   * @param {OppiabotPlugin} plugin - The registered plugin.
   * @param {Trigger} trigger - The trigger received by the Core Engine.
   * @returns {boolean} Whether any of the plugin's supported triggers match.
   */
  private supportsTrigger(plugin: OppiabotPlugin, trigger: Trigger): boolean {
    return plugin.supportedTriggers.some(
      (supportedTrigger) => supportedTrigger.matches(trigger)
    );
  }

  /**
   * Returns whether the repository configuration enables a plugin.
   *
   * A plugin is enabled only when the configuration declares it with the
   * literal value `enabled: true`. Any other value, including a malformed one
   * such as a string, is not treated as enabled; malformed configuration is
   * rejected upstream by `ExecutionContext.validate()`. A context without a
   * configuration enables nothing.
   *
   * When the context has been validated, a present configuration is already
   * structurally valid, so this method only validates the plugin's own
   * settings against the schema the plugin registered.
   *
   * @param {OppiabotPlugin} plugin - The registered plugin.
   * @param {ExecutionContext} context - The execution context.
   * @returns {boolean} Whether the plugin is enabled for this execution.
   * @throws {PluginResolutionError} if the plugin is enabled but its settings
   *   do not satisfy the schema the plugin registered.
   */
  private isEnabled(
    plugin: OppiabotPlugin,
    context: ExecutionContext
  ): boolean {
    const configuration = context.configuration;
    if (configuration === undefined) {
      return false;
    }
    if (
      !Object.prototype.hasOwnProperty.call(configuration.plugins, plugin.name)
    ) {
      return false;
    }
    const declaredConfiguration = configuration.plugins[plugin.name] as
      PluginConfiguration | null | undefined;
    if (
      declaredConfiguration === null ||
      declaredConfiguration === undefined ||
      declaredConfiguration.enabled !== true
    ) {
      return false;
    }
    try {
      configuration.getPluginConfiguration(
        plugin.name,
        { [plugin.name]: plugin.configSchema }
      );
    } catch (error) {
      const errorMessage = (
        error instanceof Error ? error.message : String(error)
      );
      throw new PluginResolutionError(
        `Could not resolve plugin '${plugin.name}' for trigger ` +
        `'${context.trigger.toKey()}': ${errorMessage}`
      );
    }
    return true;
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
