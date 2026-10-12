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
 * @fileoverview Loading and validation of the repository-specific Oppiabot
 * configuration stored in .github/oppiabot.yml.
 */

import { load as parseYaml } from 'js-yaml';

import { PluginRegistry } from './pluginRegistry';
import { RepositoryContext } from '../types/repository';
import {
  ConfigSchema,
  ConfigurationValidationError,
  PluginConfiguration,
  RepositoryConfiguration
} from '../types/repository_configuration';

/**
 * Path of the repository-specific Oppiabot configuration file, relative to the
 * root of the repository.
 */
export const OPPIABOT_CONFIG_PATH = '.github/oppiabot.yml';

/**
 * Version applied when the configuration file does not declare one. Repositories
 * do not need to declare a version until the configuration schema changes in a
 * way that requires one.
 */
export const DEFAULT_CONFIGURATION_VERSION = '1.0';

/**
 * Fields supported at the top level of the Oppiabot configuration schema. These
 * fields are owned by Oppiabot core, so any other field is rejected rather than
 * ignored.
 */
const SUPPORTED_CONFIGURATION_FIELDS = ['version', 'plugins'];

/**
 * Fields supported for the configuration of a single plugin. These fields are
 * owned by Oppiabot core, so any other field is rejected rather than ignored.
 * Plugin-specific values belong under the settings field, where the
 * configuration schema declared by the plugin governs them.
 */
const SUPPORTED_PLUGIN_FIELDS = ['enabled', 'dry_run', 'settings'];

/**
 * Reads the contents of a file in a repository at a specific ref.
 *
 * The runtime entrypoints implement this port using the mechanism available in
 * their runtime, so that the Core Engine does not depend on a particular
 * GitHub client or on the local file system.
 */
export interface RepositoryFileReader {
  /**
   * Reads a text file from a repository at the given ref.
   *
   * @param {RepositoryContext} repository - Repository containing the file.
   * @param {string} filePath - Repository-relative path of the file.
   * @param {string} ref - Git ref to read the file at, such as a branch name or
   *   a commit SHA.
   * @returns {Promise<string | undefined>} The file contents, or undefined when
   *   the repository does not contain the file at the given ref.
   * @throws {Error} if the file cannot be read.
   */
  readRepositoryFile(
    repository: RepositoryContext,
    filePath: string,
    ref: string
  ): Promise<string | undefined>;
}

/**
 * Loads the repository-specific Oppiabot configuration.
 *
 * The configuration is read from .github/oppiabot.yml on the repository's
 * default branch. The ref is always taken from the RepositoryContext and is
 * never taken from the incoming event payload, so that a pull request cannot
 * change the configuration that Oppiabot applies to it.
 *
 * The loader performs no caching: every load call reads and parses the file
 * again, so a configuration change is picked up on subsequent calls.
 *
 * Repositories opt in to Oppiabot by adding the configuration file. A
 * repository without the file has not opted in, so it resolves to a
 * configuration with no enabled plugins rather than to a load failure.
 *
 * The loader applies a strict schema to the fields Oppiabot owns, and a
 * migration-tolerant schema to the plugins themselves:
 *
 * - The supported top-level fields, and the supported fields of a plugin
 *   configuration, are fixed by Oppiabot core. Any other field is rejected, so
 *   that a mistyped field such as plugin instead of plugins cannot silently
 *   leave the repository with no enabled plugins.
 * - Plugin names are not rejected when no such plugin is registered. A
 *   repository may declare a plugin before Oppiabot registers it, and only
 *   registered plugins are executed. The shape of the configuration of an
 *   unregistered plugin is still validated, but its settings are not validated
 *   against any plugin configuration schema.
 * - Plugin-specific settings are validated against the configuration schema
 *   declared by the registered plugin, which rejects unsupported settings.
 */
export class ConfigurationLoader {
  constructor(
    /** Reads the configuration file from the target repository. */
    private readonly fileReader: RepositoryFileReader,
    /** Provides the configuration schema declared by each registered plugin. */
    private readonly pluginRegistry: PluginRegistry
  ) {}

  /**
   * Loads and validates the repository-specific Oppiabot configuration.
   *
   * @param {RepositoryContext} repository - Repository information required to
   *   load the Oppiabot configuration.
   * @returns {Promise<RepositoryConfiguration>} The validated repository
   *   configuration containing the enabled plugins and their settings.
   * @throws {RepositoryContextValidationError} if the repository information is
   *   invalid and therefore does not identify a configuration to load.
   * @throws {ConfigurationLoadError} if the configuration file cannot be loaded
   *   or cannot be parsed as YAML.
   * @throws {ConfigurationValidationError} if the configuration does not
   *   satisfy the Oppiabot configuration schema, or if an enabled plugin's
   *   settings do not satisfy the schema declared by that plugin.
   */
  async load(repository: RepositoryContext): Promise<RepositoryConfiguration> {
    repository.validate();
    const configuration = this.toRepositoryConfiguration(
      await this.readConfigurationFile(repository)
    );
    configuration.validate(this.collectPluginConfigSchemas());
    return configuration;
  }

  /**
   * Reads the raw configuration file for a repository.
   *
   * @param {RepositoryContext} repository - Repository to read the
   *   configuration file from.
   * @returns {Promise<string | undefined>} The file contents, or undefined when
   *   the repository does not contain the configuration file.
   * @throws {ConfigurationLoadError} if the file cannot be retrieved.
   */
  private async readConfigurationFile(
    repository: RepositoryContext
  ): Promise<string | undefined> {
    let contents: string | undefined;
    try {
      contents = await this.fileReader.readRepositoryFile(
        repository,
        OPPIABOT_CONFIG_PATH,
        repository.default_branch
      );
    } catch (error) {
      const errorMessage = (
        error instanceof Error ? error.message : String(error)
      );
      throw new ConfigurationLoadError(
        `Could not load ${OPPIABOT_CONFIG_PATH} from ` +
        `${repository.getFullName()} at ref ${repository.default_branch}: ` +
        errorMessage
      );
    }
    return contents;
  }

  /**
   * Converts the raw configuration file contents into a repository
   * configuration.
   *
   * @param {string | undefined} contents - The raw configuration file contents,
   *   or undefined when the repository has no configuration file.
   * @returns {RepositoryConfiguration} The parsed repository configuration.
   * @throws {ConfigurationLoadError} if the contents are not valid YAML.
   * @throws {ConfigurationValidationError} if the contents do not match the
   *   structure of the Oppiabot configuration schema.
   */
  private toRepositoryConfiguration(
    contents: string | undefined
  ): RepositoryConfiguration {
    if (contents === undefined) {
      return new RepositoryConfiguration(
        DEFAULT_CONFIGURATION_VERSION,
        Object.create(null)
      );
    }
    const document = this.parseYamlDocument(contents);
    if (document === undefined || document === null) {
      return new RepositoryConfiguration(
        DEFAULT_CONFIGURATION_VERSION,
        Object.create(null)
      );
    }
    if (!this.isMapping(document)) {
      throw new ConfigurationValidationError(
        `${OPPIABOT_CONFIG_PATH} must define a mapping of configuration ` +
        'fields.'
      );
    }
    const fields = document as Record<string, unknown>;
    this.rejectUnsupportedFields(
      fields,
      SUPPORTED_CONFIGURATION_FIELDS,
      'The configuration'
    );
    return new RepositoryConfiguration(
      this.toVersion(fields.version),
      this.toPluginConfigurations(fields.plugins)
    );
  }

  /**
   * Rejects every declared field that the configuration schema does not
   * support.
   *
   * @param {Record<string, unknown>} fields - The declared fields.
   * @param {string[]} supportedFields - The fields the schema supports.
   * @param {string} subject - Description of where the fields were declared,
   *   used to make the error message identify the offending declaration.
   * @throws {ConfigurationValidationError} if an unsupported field is declared.
   */
  private rejectUnsupportedFields(
    fields: Record<string, unknown>,
    supportedFields: string[],
    subject: string
  ): void {
    const unsupportedFields = Object.keys(fields).filter(
      (field) => !supportedFields.includes(field)
    );
    if (unsupportedFields.length === 0) {
      return;
    }
    throw new ConfigurationValidationError(
      `${subject} in ${OPPIABOT_CONFIG_PATH} must only define the following ` +
      `fields: ${supportedFields.join(', ')}. Unsupported fields: ` +
      `${unsupportedFields.join(', ')}.`
    );
  }

  /**
   * Parses the configuration file contents as YAML.
   *
   * Parsing uses the default YAML schema, which resolves plain scalars and
   * merge keys but does not construct executable values. Repository
   * configuration therefore cannot define custom YAML tags.
   *
   * @param {string} contents - The raw configuration file contents.
   * @returns {unknown} The parsed YAML document.
   * @throws {ConfigurationLoadError} if the contents are not valid YAML.
   */
  private parseYamlDocument(contents: string): unknown {
    try {
      return parseYaml(contents);
    } catch (error) {
      const errorMessage = (
        error instanceof Error ? error.message : String(error)
      );
      throw new ConfigurationLoadError(
        `Could not parse ${OPPIABOT_CONFIG_PATH} as YAML: ${errorMessage}`
      );
    }
  }

  /**
   * Validates and returns the declared configuration schema version.
   *
   * The version is not coerced from another type. An unquoted numeric version is
   * rejected because it cannot be distinguished from an equivalent version
   * written differently, such as 2 and 2.0.
   *
   * @param {unknown} version - The declared version field.
   * @returns {string} The declared version, or the default version when the
   *   field is not declared.
   * @throws {ConfigurationValidationError} if the declared version is not a
   *   non-empty string.
   */
  private toVersion(version: unknown): string {
    if (version === undefined) {
      return DEFAULT_CONFIGURATION_VERSION;
    }
    if (typeof version !== 'string' || version.trim() === '') {
      throw new ConfigurationValidationError(
        `${OPPIABOT_CONFIG_PATH} must define version as a non-empty string.`
      );
    }
    return version;
  }

  /**
   * Validates and returns the per-plugin configuration declared in the
   * configuration file.
   *
   * @param {unknown} plugins - The declared plugins field.
   * @returns {Record<string, PluginConfiguration>} The plugin configuration,
   *   keyed by plugin name.
   * @throws {ConfigurationValidationError} if the field is not a mapping of
   *   plugin names to plugin configuration.
   */
  private toPluginConfigurations(
    plugins: unknown
  ): Record<string, PluginConfiguration> {
    if (plugins === undefined) {
      return {};
    }
    if (!this.isMapping(plugins)) {
      throw new ConfigurationValidationError(
        `${OPPIABOT_CONFIG_PATH} must define plugins as a mapping of plugin ` +
        'names to plugin configuration.'
      );
    }
    const configurations: Record<string, PluginConfiguration> =
      Object.create(null);
    for (const [pluginName, pluginConfiguration] of Object.entries(
      plugins as Record<string, unknown>
    )) {
      if (pluginName.trim() === '') {
        throw new ConfigurationValidationError(
          `${OPPIABOT_CONFIG_PATH} must not define a plugin with an empty name.`
        );
      }
      configurations[pluginName] = this.toPluginConfiguration(
        pluginName,
        pluginConfiguration
      );
    }
    return configurations;
  }

  /**
   * Validates and returns the configuration declared for a single plugin.
   *
   * The enabled flag must be declared explicitly so that a repository never
   * enables a plugin by omission. The dry_run flag and the settings object are
   * optional and default to executing live with no plugin-specific settings.
   *
   * @param {string} pluginName - Name of the plugin being configured.
   * @param {unknown} pluginConfiguration - The declared plugin configuration.
   * @returns {PluginConfiguration} The parsed plugin configuration.
   * @throws {ConfigurationValidationError} if the declared configuration does
   *   not match the structure of the Oppiabot configuration schema.
   */
  private toPluginConfiguration(
    pluginName: string,
    pluginConfiguration: unknown
  ): PluginConfiguration {
    if (!this.isMapping(pluginConfiguration)) {
      throw new ConfigurationValidationError(
        `The configuration for plugin ${pluginName} in ` +
        `${OPPIABOT_CONFIG_PATH} must define a mapping of configuration ` +
        'fields.'
      );
    }
    const fields = pluginConfiguration as Record<string, unknown>;
    this.rejectUnsupportedFields(
      fields,
      SUPPORTED_PLUGIN_FIELDS,
      `The configuration for plugin ${pluginName}`
    );
    if (typeof fields.enabled !== 'boolean') {
      throw new ConfigurationValidationError(
        `The configuration for plugin ${pluginName} in ` +
        `${OPPIABOT_CONFIG_PATH} must define a boolean enabled field.`
      );
    }
    return {
      enabled: fields.enabled,
      dry_run: this.toDryRunFlag(pluginName, fields.dry_run),
      settings: this.toSettings(pluginName, fields.settings)
    };
  }

  /**
   * Validates and returns the declared Dry-Run flag of a plugin.
   *
   * @param {string} pluginName - Name of the plugin being configured.
   * @param {unknown} dryRun - The declared dry_run field.
   * @returns {boolean} The declared flag, or false when the field is not
   *   declared.
   * @throws {ConfigurationValidationError} if the declared flag is not a
   *   boolean.
   */
  private toDryRunFlag(pluginName: string, dryRun: unknown): boolean {
    if (dryRun === undefined) {
      return false;
    }
    if (typeof dryRun !== 'boolean') {
      throw new ConfigurationValidationError(
        `The configuration for plugin ${pluginName} in ` +
        `${OPPIABOT_CONFIG_PATH} must define a boolean dry_run field.`
      );
    }
    return dryRun;
  }

  /**
   * Validates and returns the plugin-specific settings of a plugin.
   *
   * @param {string} pluginName - Name of the plugin being configured.
   * @param {unknown} settings - The declared settings field.
   * @returns {Record<string, unknown>} The declared settings, or an empty object
   *   when the field is not declared.
   * @throws {ConfigurationValidationError} if the declared settings are not an
   *   object.
   */
  private toSettings(
    pluginName: string,
    settings: unknown
  ): Record<string, unknown> {
    if (settings === undefined) {
      return {};
    }
    if (!this.isMapping(settings)) {
      throw new ConfigurationValidationError(
        `The configuration for plugin ${pluginName} in ` +
        `${OPPIABOT_CONFIG_PATH} must define a settings object.`
      );
    }
    return settings as Record<string, unknown>;
  }

  /**
   * Collects the configuration schema declared by each registered plugin.
   *
   * @returns {Record<string, ConfigSchema>} The registered plugin configuration
   *   schemas, keyed by plugin name.
   */
  private collectPluginConfigSchemas(): Record<string, ConfigSchema> {
    // Null-prototype dictionaries, because plugin names come from repository
    // configuration. A name such as constructor or __proto__ must resolve to a
    // declared schema or to nothing, never to an inherited Object property.
    const schemas: Record<string, ConfigSchema> = Object.create(null);
    for (const plugin of this.pluginRegistry.getAllPlugins()) {
      schemas[plugin.name] = plugin.configSchema;
    }
    return schemas;
  }

  /**
   * Returns whether a parsed YAML value is a mapping of fields.
   *
   * @param {unknown} value - The parsed YAML value.
   * @returns {boolean} Whether the value is an object and not a list.
   */
  private isMapping(value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.prototype.toString.call(value) === '[object Object]'
    );
  }
}

/**
 * Error thrown when the repository configuration file cannot be loaded.
 */
export class ConfigurationLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationLoadError';
  }
}
