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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ConfigSchema,
  ConfigurationValidationError,
  RepositoryConfiguration
} from '../../src/types';

describe('ConfigSchema', () => {
  const schema = new ConfigSchema(
    {
      stale_days: { type: 'number' },
      stale_label: { type: 'string', enum: ['stale', 'inactive'] },
      enabled: { type: 'boolean' },
    },
    ['stale_days']
  );

  it('validates a conforming configuration', () => {
    assert.doesNotThrow(() => {
      schema.validate({
        stale_days: 7,
        stale_label: 'stale',
        enabled: true,
      });
    });
  });

  it('throws when a required field is missing', () => {
    assert.throws(
      () => schema.validate({ stale_label: 'stale' }),
      (err) => (
        err instanceof ConfigurationValidationError &&
        err.message.includes('stale_days')
      )
    );
  });

  it('throws when an unsupported field is provided', () => {
    assert.throws(
      () => schema.validate({ stale_days: 7, unknown_field: 1 }),
      (err) => (
        err instanceof ConfigurationValidationError &&
        err.message.includes('unknown_field')
      )
    );
  });

  it('throws when a field value has the wrong type', () => {
    assert.throws(
      () => schema.validate({ stale_days: 'seven' }),
      (err) => (
        err instanceof ConfigurationValidationError &&
        err.message.includes('stale_days')
      )
    );
  });

  it('rejects null for an object-typed field', () => {
    const objectSchema = new ConfigSchema(
      { options: { type: 'object' } },
      []
    );
    assert.throws(
      () => objectSchema.validate({ options: null }),
      (err) => (
        err instanceof ConfigurationValidationError &&
        err.message.includes('options')
      )
    );
  });

  it('throws when a field value is not in the allowed enum', () => {
    assert.throws(
      () => schema.validate({ stale_days: 7, stale_label: 'urgent' }),
      (err) => (
        err instanceof ConfigurationValidationError &&
        err.message.includes('stale_label')
      )
    );
  });

  it('accepts an empty schema', () => {
    const emptySchema = new ConfigSchema({}, []);
    assert.doesNotThrow(() => emptySchema.validate({}));
  });

  it('rejects an inherited Object property as an unsupported field', () => {
    assert.throws(
      () => schema.validate({ stale_days: 7, toString: 'x' }),
      (err) => (
        err instanceof ConfigurationValidationError &&
        err.message.includes('toString')
      )
    );
  });

  it('does not treat an inherited Object property as a required field', () => {
    const requiredSchema = new ConfigSchema({}, ['constructor']);
    assert.throws(
      () => requiredSchema.validate({}),
      (err) => (
        err instanceof ConfigurationValidationError &&
        err.message.includes('constructor')
      )
    );
  });
});

describe('RepositoryConfiguration', () => {
  it('does not return an inherited Object property as a plugin config', () => {
    const configuration = new RepositoryConfiguration('1.0', {});
    assert.equal(
      configuration.getPluginConfiguration('constructor'),
      undefined
    );
    assert.equal(
      configuration.getPluginConfiguration('toString'),
      undefined
    );
  });
});
