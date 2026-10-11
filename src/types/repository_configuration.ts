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
 * @fileoverview Repository configuration domain objects.
 */

/**
 * Represents the validation rule for a single configuration field.
 *
 * A property descriptor defines the expected type and, when provided, the
 * allowed values for a configuration field.
 */
export interface ConfigSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object';
  enum?: Array<string | number>;
}

/**
 * Represents the validation schema used by a plugin to validate its
 * repository-specific configuration.
 */
export class ConfigSchema {
  constructor(
    /**
     * The supported configuration fields and their validation rules, keyed by
     * field name. Each entry is the rule for one field: its expected type and,
     * when the field accepts only a fixed set of values, that set. See
     * `ConfigSchemaProperty` for the rule's shape.
     */
    public readonly properties: Record<string, unknown>,
    /**
     * Defines the required configuration fields for the plugin.
     */
    public readonly required: string[]
  ) {}

  /**
   * Validates plugin configuration against the schema.
   *
   * @param {Record<string, unknown>} config - Plugin-specific configuration
   *   values to validate.
   * @throws {ConfigurationValidationError} if the configuration does not
   *   satisfy the schema requirements.
   */
  validate(config: Record<string, unknown>): void {
    for (const field of this.required) {
      if (!Object.prototype.hasOwnProperty.call(config, field)) {
        throw new ConfigurationValidationError(
          `Missing required configuration field: ${field}.`
        );
      }
    }
    for (const [key, value] of Object.entries(config)) {
      if (!Object.prototype.hasOwnProperty.call(this.properties, key)) {
        throw new ConfigurationValidationError(
          `Unsupported configuration field: ${key}.`
        );
      }
      this.validateFieldValue(key, value);
    }
  }

  /**
   * Validates a single configuration field value against its schema rule.
   *
   * @param {string} key - The name of the configuration field.
   * @param {unknown} value - The value of the configuration field.
   * @throws {ConfigurationValidationError} if the value does not satisfy the
   *   field's schema rule.
   */
  private validateFieldValue(key: string, value: unknown): void {
    const property = this.properties[key] as ConfigSchemaProperty;
    if (property.type !== undefined && typeof value !== property.type) {
      throw new ConfigurationValidationError(
        `Configuration field ${key} must be of type ${property.type}, ` +
        `received ${typeof value}.`
      );
    }
    if (
      property.enum !== undefined && !property.enum.includes(value as never)
    ) {
      throw new ConfigurationValidationError(
        `Configuration field ${key} must be one of ` +
        `${property.enum.join(', ')}.`
      );
    }
  }
}

/**
 * Represents repository-specific configuration for an enabled plugin.
 */
export interface PluginConfiguration {
  /** Whether the plugin is enabled for the repository. */
  enabled: boolean;
  /** Whether the plugin should execute in Dry-Run mode. */
  dry_run: boolean;
  /** Plugin-specific configuration values. */
  settings: Record<string, unknown>;
}

/**
 * Represents the Oppiabot configuration for a repository, loaded from
 * .github/oppiabot.yml.
 */
export class RepositoryConfiguration {
  constructor(
    /**
     * Version of the Oppiabot configuration schema.
     */
    public readonly version: string,
    /**
     * Plugin-specific configuration loaded from .github/oppiabot.yml.
     */
    public readonly plugins: Record<string, PluginConfiguration>
  ) {}

  /**
   * Validates the repository configuration against the Oppiabot configuration
   * schema.
   *
   * Every configured plugin must declare a boolean enabled flag, a boolean
   * dry_run flag, and a settings object. When the caller supplies the schemas
   * of the registered plugins, each enabled plugin's settings are additionally
   * validated against that plugin's own ConfigSchema.
   *
   * @param {Record<string, ConfigSchema>} pluginConfigSchemas - Maps a plugin
   *   name to the ConfigSchema declared by that plugin. The configuration
   *   loader passes these so that plugin-specific rules are enforced.
   * @throws {ConfigurationValidationError} if the version is empty, if a
   *   plugin configuration is structurally invalid, or if an enabled plugin's
   *   configuration does not satisfy the expected plugin configuration schema.
   */
  validate(pluginConfigSchemas: Record<string, ConfigSchema> = {}): void {
    if (this.version === '') {
      throw new ConfigurationValidationError(
        'The repository configuration must define a version.'
      );
    }
    for (const [pluginName, pluginConfiguration] of Object.entries(
      this.plugins
    )) {
      this.validatePluginStructure(pluginName, pluginConfiguration);
      if (!pluginConfiguration.enabled) {
        continue;
      }
      this.validatePluginSettings(
        pluginName,
        pluginConfiguration,
        pluginConfigSchemas[pluginName]
      );
    }
  }

  /**
   * Validates the structure of a single plugin's configuration.
   *
   * @param {string} pluginName - The name of the plugin being validated.
   * @param {PluginConfiguration} pluginConfiguration - The configuration
   *   associated with the plugin.
   * @throws {ConfigurationValidationError} if a required field is missing or
   *   has the wrong type.
   */
  private validatePluginStructure(
    pluginName: string,
    pluginConfiguration: PluginConfiguration
  ): void {
    if (typeof pluginConfiguration.enabled !== 'boolean') {
      throw new ConfigurationValidationError(
        `The configuration for plugin ${pluginName} must define a boolean ` +
        'enabled field.'
      );
    }
    if (typeof pluginConfiguration.dry_run !== 'boolean') {
      throw new ConfigurationValidationError(
        `The configuration for plugin ${pluginName} must define a boolean ` +
        'dry_run field.'
      );
    }
    if (
      typeof pluginConfiguration.settings !== 'object' ||
      pluginConfiguration.settings === null
    ) {
      throw new ConfigurationValidationError(
        `The configuration for plugin ${pluginName} must define a settings ` +
        'object.'
      );
    }
  }

  /**
   * Validates an enabled plugin's settings against the plugin's ConfigSchema.
   *
   * @param {string} pluginName - The name of the plugin being validated.
   * @param {PluginConfiguration} pluginConfiguration - The configuration
   *   associated with the plugin.
   * @param {ConfigSchema} configSchema - The schema declared by the plugin, or
   *   undefined when the plugin is not registered.
   * @throws {ConfigurationValidationError} if the settings do not satisfy the
   *   plugin's configuration schema.
   */
  private validatePluginSettings(
    pluginName: string,
    pluginConfiguration: PluginConfiguration,
    configSchema?: ConfigSchema
  ): void {
    if (configSchema === undefined) {
      return;
    }
    try {
      configSchema.validate(pluginConfiguration.settings);
    } catch (error) {
      const errorMessage = (
        error instanceof Error ? error.message : String(error)
      );
      throw new ConfigurationValidationError(
        `The configuration for plugin ${pluginName} is invalid: ` +
        errorMessage
      );
    }
  }

  /**
   * Returns the configuration associated with a specific plugin.
   *
   * @param {string} pluginName - Name of the plugin.
   * @param {Record<string, ConfigSchema>} pluginConfigSchemas - Maps a plugin
   *   name to the ConfigSchema declared by that plugin. The configuration
   *   loader passes these so that plugin-specific rules are enforced.
   * @returns {PluginConfiguration} Configuration associated with the requested
   *   plugin.
   * @throws {ConfigurationValidationError} if the plugin is not configured, or
   *   if the plugin configuration does not satisfy the plugin's configuration
   *   schema.
   */
  getPluginConfiguration(
    pluginName: string,
    pluginConfigSchemas: Record<string, ConfigSchema> = {}
  ): PluginConfiguration {
    const pluginConfiguration = this.plugins[pluginName];
    if (pluginConfiguration === undefined) {
      throw new ConfigurationValidationError(
        `The plugin ${pluginName} is not configured in this repository.`
      );
    }
    this.validatePluginStructure(pluginName, pluginConfiguration);
    this.validatePluginSettings(
      pluginName,
      pluginConfiguration,
      pluginConfigSchemas[pluginName]
    );
    return pluginConfiguration;
  }
}

/**
 * Error thrown when repository configuration does not satisfy the Oppiabot
 * configuration schema.
 */
export class ConfigurationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationValidationError';
  }
}
