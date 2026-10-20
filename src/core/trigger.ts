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
 * @fileoverview Trigger domain object.
 */

/**
 * The event that caused one Oppiabot execution.
 *
 * A trigger pairs an event name with an optional action. A webhook entrypoint
 * builds one from the names GitHub reports (`pull_request` + `opened`); a
 * scheduled entrypoint builds one from `'schedule'` and the workflow's name.
 * A plugin lists the triggers it handles in `supportedTriggers`, and the
 * registry selects a plugin when one of those triggers matches the incoming
 * trigger (see `matches`).
 */
export class Trigger {
  constructor(
    /**
     * The event name, without an action: `'pull_request'` for a
     * `pull_request` delivery, `'issues'` for `issues`, or `'schedule'` for a
     * scheduled run. Must be a non-empty string (enforced by `validate`).
     */
    public readonly event: string,
    /**
     * The action within the event, or `undefined`. For a webhook this is the
     * GitHub action (`'opened'`, `'assigned'`); for a scheduled run it is the
     * workflow's schedule name (`'stale-sweep'`). `undefined` means "every
     * action of this event"; when defined it must be non-empty (enforced by
     * `validate`).
     */
    public readonly action?: string
  ) {}

  /**
   * Returns this trigger's string key: `event` when `action` is `undefined`,
   * otherwise `event.action`.
   *
   * Two triggers share a key only when they are identical. A key therefore
   * cannot express that one trigger covers several actions, so use `matches`
   * to decide whether a plugin supports a trigger.
   *
   * @returns {string} The key, e.g. `'issues'`, `'pull_request.opened'`, or
   *   `'schedule.stale-sweep'`.
   */
  toKey(): string {
    if (this.action === undefined) {
      return this.event;
    }
    return `${this.event}.${this.action}`;
  }

  /**
   * Returns whether `other` is covered by this trigger.
   *
   * It is covered when both triggers have the same `event`, and either this
   * trigger has no `action` (so it covers every action) or its `action` equals
   * `other.action`.
   *
   * The relation is not symmetric when exactly one trigger has an action: an
   * action-less trigger matches an action-specific one but not vice versa.
   * Call it as `supportedTrigger.matches(incomingTrigger)`.
   *
   * @param {Trigger} other - The trigger to test against.
   * @returns {boolean} Whether `other` is covered by this trigger.
   */
  matches(other: Trigger): boolean {
    if (this.event !== other.event) {
      return false;
    }
    if (this.action === undefined) {
      return true;
    }
    return this.action === other.action;
  }

  /**
   * Validates that this trigger represents a usable event.
   *
   * @throws {TriggerValidationError} if `event` is `undefined`, `null`, or
   *   empty, or if `action` is defined and is `null` or empty.
   */
  validate(): void {
    if (
      this.event === undefined ||
      this.event === null ||
      this.event === ''
    ) {
      throw new TriggerValidationError(
        'The trigger event must be a non-empty string.'
      );
    }
    if (
      this.action !== undefined &&
      (this.action === null || this.action === '')
    ) {
      throw new TriggerValidationError(
        'The trigger action must be a non-empty string when provided.'
      );
    }
  }
}

/**
 * Error thrown when a Trigger is invalid.
 */
export class TriggerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TriggerValidationError';
  }
}
