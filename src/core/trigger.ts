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
 * The event that caused an Oppiabot execution.
 *
 * A webhook entrypoint builds one from the event and action names GitHub
 * sent; a scheduled entrypoint builds one from its workflow's schedule name.
 */
export class Trigger {
  constructor(
    /**
     * The event name, without an action: 'pull_request' for a
     * `pull_request.opened` delivery, 'issues' for `issues.assigned`, or
     * 'schedule' for a scheduled run.
     */
    public readonly event: string,
    /**
     * The action name for a GitHub event, such as 'opened' for
     * `pull_request.opened`. For a scheduled run, this is the scheduled
     * workflow's name, such as 'stale-sweep'. If `action` is `undefined`, this
     * trigger matches any action for the same event.
     */
    public readonly action?: string
  ) {}

  /**
   * Returns a string key for this trigger: the event, or `event.action` when
   * an action is set. Do not use it to test plugin support; use `matches()`.
   *
   * @returns {string} For example 'pull_request.opened', 'issues', or
   *   'schedule.stale-sweep'.
   */
  toKey(): string {
    if (this.action === undefined) {
      return this.event;
    }
    return `${this.event}.${this.action}`;
  }

  /**
   * Returns whether this trigger matches another: the events are equal, and
   * this trigger has no action or the same action.
   *
   * @param {Trigger} other - The trigger to compare against.
   * @returns {boolean} Whether this trigger matches the other trigger.
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
   * Validates the trigger domain object.
   *
   * @throws {TriggerValidationError} if the event is undefined, null, or empty,
   *   or the optional action is provided but null or empty.
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
