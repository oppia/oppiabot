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
  DeferredExecutionRequest,
  DeferredExecutionValidationError,
  TimeoutDeferredExecutionScheduler
} from '../../src/core';
import { captureLogs } from './engineTestHelpers';
import { waitFor } from './testHelpers';

describe('DeferredExecutionRequest', () => {
  describe('validate', () => {
    it('accepts a positive finite delay', () => {
      const request = new DeferredExecutionRequest(180000);
      assert.doesNotThrow(() => request.validate());
    });

    it('rejects a delay of zero', () => {
      const request = new DeferredExecutionRequest(0);
      assert.throws(
        () => request.validate(),
        (err: Error) => (
          err instanceof DeferredExecutionValidationError &&
          err.message.includes('greater than zero')
        )
      );
    });

    it('rejects a negative delay', () => {
      const request = new DeferredExecutionRequest(-1000);
      assert.throws(
        () => request.validate(),
        (err: Error) => (
          err instanceof DeferredExecutionValidationError &&
          err.message.includes('greater than zero')
        )
      );
    });

    it('rejects a delay that is not a finite number', () => {
      for (const delayMs of [
        NaN,
        Infinity,
        '180000',
        undefined
      ] as unknown as number[]) {
        const request = new DeferredExecutionRequest(delayMs);
        assert.throws(
          () => request.validate(),
          (err: Error) => (
            err instanceof DeferredExecutionValidationError &&
            err.message.includes('finite number')
          )
        );
      }
    });
  });
});

describe('TimeoutDeferredExecutionScheduler', () => {
  it('resolves promptly and runs the deferred work after the delay', async () => {
    const scheduler = new TimeoutDeferredExecutionScheduler();
    const timeline: string[] = [];

    await scheduler.schedule(new DeferredExecutionRequest(20), async () => {
      timeline.push('ran');
    });
    timeline.push('scheduled');

    assert.deepStrictEqual(timeline, ['scheduled']);
    await waitFor(() => timeline.includes('ran'));
  });

  it('logs a deferred work failure instead of raising it', async () => {
    const { logs, restore } = captureLogs();
    try {
      const scheduler = new TimeoutDeferredExecutionScheduler();
      await scheduler.schedule(new DeferredExecutionRequest(1), async () => {
        throw new Error('deferred boom');
      });

      await waitFor(() => logs.some((line) => line.includes('deferred boom')));
      assert.ok(
        logs.some((line) => line.includes('A deferred execution failed'))
      );
    } finally {
      restore();
    }
  });
});
