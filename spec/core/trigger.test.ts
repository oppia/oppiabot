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
import { Trigger } from '../../src/core';

describe('Trigger', () => {
  describe('toKey', () => {
    it('returns a canonical key combining event and action', () => {
      const trigger = new Trigger('pull_request', 'opened');
      assert.strictEqual(trigger.toKey(), 'pull_request.opened');
    });

    it('returns a canonical key for scheduled triggers', () => {
      const trigger = new Trigger('schedule', 'stale-sweep');
      assert.strictEqual(trigger.toKey(), 'schedule.stale-sweep');
    });

    it('returns the event as the key when no action is provided', () => {
      const trigger = new Trigger('pull_request');
      assert.strictEqual(trigger.toKey(), 'pull_request');
    });
  });

  describe('matches', () => {
    it('matches triggers with the same event and action', () => {
      const registered = new Trigger('pull_request', 'opened');
      const incoming = new Trigger('pull_request', 'opened');
      assert.strictEqual(registered.matches(incoming), true);
    });

    it('matches an action-less registered trigger with any action', () => {
      const registered = new Trigger('pull_request');
      const incoming = new Trigger('pull_request', 'synchronize');
      assert.strictEqual(registered.matches(incoming), true);
    });

    it('does not match triggers with the same event but different action', () => {
      const registered = new Trigger('pull_request', 'opened');
      const incoming = new Trigger('pull_request', 'closed');
      assert.strictEqual(registered.matches(incoming), false);
    });

    it('does not match triggers with different events', () => {
      const registered = new Trigger('pull_request', 'opened');
      const incoming = new Trigger('issues', 'opened');
      assert.strictEqual(registered.matches(incoming), false);
    });
  });
});
