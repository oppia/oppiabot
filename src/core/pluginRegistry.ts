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
 * Holds the registered Oppiabot plugins and resolves those that apply to an
 * execution.
 *
 * Register every plugin once during initialization with `register()`. The Core
 * Engine then calls `resolvePlugins()` per execution; see that method for the
 * resolution contract.
 */
export class PluginRegistry {
  private readonly pluginsByName: Map<string, OppiabotPlugin>;

  constructor() {
    this.pluginsByName = new Map<string, OppiabotPlugin>();
  }

  /**
   * Registers `plugin`.
   *
   * @param {OppiabotPlugin} plugin - The plugin to register; its `name` is the
   *   key used by the other methods.
   * @throws {PluginResolutionError} if a plugin with the same `name` is already
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
   * Returns the registration metadata of the plugin named `name`.
   *
   * @param {string} name - The plugin name to look up.
   * @returns {PluginRegistrationMetadata | undefined} The metadata, or
   *   `undefined` if no plugin of that name is registered.
   */
  getRegistration(name: string): PluginRegistrationMetadata | undefined {
    const plugin = this.pluginsByName.get(name);
    if (plugin === undefined) {
      return undefined;
    }
    return this.toRegistrationMetadata(plugin);
  }

  /**
   * Returns all registered plugins in registration order.
   *
   * @returns {OppiabotPlugin[]} A new array; mutating it does not affect the
   *   registry.
   */
  getAllPlugins(): OppiabotPlugin[] {
    return Array.from(this.pluginsByName.values());
  }

  /**
   * Returns the registered plugins that apply to `context`.
   *
   * A plugin applies when both of these hold:
   *
   * - Its `supportedTriggers` contains a trigger that matches
   *   `context.trigger` (see `Trigger.matches`). A trigger with no action
   *   matches every action of its event.
   * - `context.configuration` enables it (see `isEnabled`).
   *
   * Only registered plugins are considered; a plugin named in the
   * configuration but not registered is ignored. The returned plugins are in
   * registration order, and each appears at most once.
   *
   * @param {ExecutionContext} context - The execution context. Only its
   *   `trigger` and `configuration` are read.
   * @returns {OppiabotPlugin[]} The applicable plugins.
   * @throws {PluginResolutionError} if such a plugin's configuration is
   *   invalid (see `isEnabled`).
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
   * Returns whether `plugin` supports `trigger`.
   *
   * @param {OppiabotPlugin} plugin - The plugin to test.
   * @param {Trigger} trigger - The trigger to match.
   * @returns {boolean} `true` if any entry of `plugin.supportedTriggers`
   *   matches `trigger`.
   */
  private supportsTrigger(plugin: OppiabotPlugin, trigger: Trigger): boolean {
    return plugin.supportedTriggers.some(
      (supportedTrigger) => supportedTrigger.matches(trigger)
    );
  }

  /**
   * Returns whether `context.configuration` enables `plugin`.
   *
   * The result is `true` only when `context.configuration` is defined, has an
   * own entry for `plugin.name` whose value is an object with `enabled: true`,
   * and that entry passes `getPluginConfiguration` for `plugin.configSchema`.
   * In every other case the result is `false`.
   *
   * @param {OppiabotPlugin} plugin - The plugin to test.
   * @param {ExecutionContext} context - The execution context.
   * @returns {boolean} Whether the plugin is enabled.
   * @throws {PluginResolutionError} if the plugin is enabled but its
   *   configuration is structurally invalid or fails `plugin.configSchema`.
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
    let pluginConfiguration: PluginConfiguration;
    try {
      pluginConfiguration = configuration.getPluginConfiguration(
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
    return pluginConfiguration.enabled;
  }

  /**
   * Returns the registration metadata view of `plugin`.
   *
   * @param {OppiabotPlugin} plugin - The plugin to describe.
   * @returns {PluginRegistrationMetadata} `plugin`'s name, supported triggers,
   *   and configuration schema.
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
