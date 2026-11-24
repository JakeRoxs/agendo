import type * as vscode from "vscode";

/**
 * Keys persisted in the extension's user-global memento (`context.globalState`).
 * One key per component keeps skill and canvas notifications tracked
 * independently so a dismissed skill notice does not suppress the canvas notice
 * and vice versa.
 */
export const SKILL_NOTIFIED_VERSION_KEY = "agendo.skillLastNotifiedBundledVersion";
export const CANVAS_NOTIFIED_VERSION_KEY = "agendo.canvasLastNotifiedBundledVersion";

/**
 * The last bundled version for which a component's update notice was shown.
 * `undefined` when no notice has been recorded yet.
 */
export async function getNotifiedBundledVersion(
  context: vscode.ExtensionContext,
  key: string,
): Promise<string | undefined> {
  return context.globalState.get<string>(key) ?? undefined;
}

/**
 * Record that a notice for the given bundled version has been shown so it is not
 * repeated until a newer bundled version ships. A persistence failure is
 * non-fatal: the caller still shows the notice rather than silently suppressing
 * it.
 */
export async function recordNotifiedBundledVersion(
  context: vscode.ExtensionContext,
  key: string,
  version: string,
): Promise<void> {
  await context.globalState.update(key, version);
}
