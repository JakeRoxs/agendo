import * as vscode from "vscode";
import { Settings } from "./configuration";

/**
 * Output channel for this extension.
 * Uses the extension identifier for the channel name.
 */
export const outputChannel = vscode.window.createOutputChannel(Settings.Identifier);

// Overload for template literals
export function out(strings: TemplateStringsArray, ...values: any[]): void;
// Overload for simple strings with placeholders
export function out(message: string, ...args: any[]): void;

/**
 * Unified output function that supports both template literals and placeholder strings.
 */
export function out(first: string | TemplateStringsArray, ...rest: any[]): void {
    let formattedMessage: string;

    if (Array.isArray(first) && "raw" in first) {
        formattedMessage = String.raw({ raw: first as TemplateStringsArray }, ...rest);
    } else if (typeof first === "string") {
        const message = first;
        const args = rest;
        formattedMessage = args.length > 0
            ? message.replace(/{(\d+)}/g, (match, index) => {
                const argIndex = parseInt(index, 10);
                return typeof args[argIndex] !== "undefined" ? args[argIndex] : match;
            })
            : message;
    } else {
        return;
    }

    outputChannel.appendLine(formattedMessage);
}

/**
 * Show the output channel in the VSCode UI.
 */
export function showOutputChannel() {
    outputChannel.show();
}
