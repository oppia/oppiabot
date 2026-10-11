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
   * Returns the configuration associated with a specific plugin.
   *
   * @param {string} pluginName - Name of the plugin.
   * @returns {PluginConfiguration | undefined} Configuration associated with
   *   the requested plugin, or undefined if the plugin is not configured.
   */
  getPluginConfiguration(
    pluginName: string
  ): PluginConfiguration | undefined {
    return this.plugins[pluginName];
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
