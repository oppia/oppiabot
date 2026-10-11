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
 * A webhook entrypoint builds one from the event and action names GitHub sent
 * with the delivery; a scheduled entrypoint builds one from its workflow's
 * schedule name. The entrypoint passes it to `CoreEngine.execute`, which uses
 * it to decide which registered plugins run.
 */
export class Trigger {
  constructor(
    /**
     * The event name, without an action: 'pull_request' for a
     * `pull_request.opened` delivery, 'issues' for `issues.assigned`, or
     * 'schedule' for a scheduled run. Pass the name the platform reported;
     * there is nothing to normalize first.
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
   * Returns a string key that represents this trigger.
   *
   * The key is `event` when this trigger has no action, and `event.action`
   * otherwise. Use it to describe or log a trigger, or to compare two triggers
   * for exact equality. Do not use it to decide whether a plugin supports a
   * trigger: equal keys only identify identical triggers, so a key comparison
   * misses a trigger without an action that supports every action of its event.
   * Use `matches()` for that check.
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
   * Returns whether this trigger matches another trigger.
   *
   * A trigger matches another trigger when the event names are equal and
   * either this trigger has no action or its action equals the other trigger's
   * action. A registered trigger without an action therefore matches all
   * actions for its event.
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
   * @throws {TriggerValidationError} if the event is empty or the optional
   *   action is provided but empty.
   */
  validate(): void {
    if (this.event === '') {
      throw new TriggerValidationError(
        'The trigger event must be a non-empty string.'
      );
    }
    if (this.action !== undefined && this.action === '') {
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
