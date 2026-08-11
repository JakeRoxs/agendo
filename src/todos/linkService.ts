import * as vscode from "vscode";
import { ConfigService } from "./configService";
import { isTodoFileName } from "./todoModel";
import { out } from "../output";

/** A todo file that references another todo by its (now stale) filename. */
export interface LinkReference {
    uri: vscode.Uri;
    /** Number of times the stale name appears in the file. */
    count: number;
}

/**
 * Detects cross-reference links between todo files. On a move/rename, other
 * todos may still point at the old filename/path; this service finds those
 * references so the user can be warned (v1 flags, it does not auto-rewrite).
 */
export class LinkService {
    constructor(private readonly config: ConfigService) {}

    /** Folders (relative to the root) to scan for referencing todos. */
    private scanFolders(): string[] {
        return [
            "",
            this.config.completeFolder,
            this.config.cancelledFolder,
            this.config.backlogFolder,
        ];
    }

    /**
     * Find todo files (other than `excludeUri`) whose body contains the given
     * old filename, indicating a link that broke when the file was moved/renamed.
     */
    async findReferencesToName(
        oldFileName: string,
        excludeUri: vscode.Uri
    ): Promise<LinkReference[]> {
        const rootUri = this.config.getRootUri();
        if (!rootUri || !oldFileName) {
            return [];
        }

        const references: LinkReference[] = [];
        const excluded = excludeUri.toString();

        for (const folder of this.scanFolders()) {
            const dir = folder ? vscode.Uri.joinPath(rootUri, folder) : rootUri;
            references.push(
                ...(await this.scanFolderForName(dir, oldFileName, excluded))
            );
        }

        return references;
    }

    /** Scan a single folder for todo files referencing `oldFileName`. */
    private async scanFolderForName(
        dir: vscode.Uri,
        oldFileName: string,
        excluded: string
    ): Promise<LinkReference[]> {
        let entries: [string, vscode.FileType][];
        try {
            entries = await vscode.workspace.fs.readDirectory(dir);
        } catch {
            return [];
        }

        const references: LinkReference[] = [];
        for (const [name, type] of entries) {
            if (type !== vscode.FileType.File || !isTodoFileName(name)) {
                continue;
            }
            const fileUri = vscode.Uri.joinPath(dir, name);
            if (fileUri.toString() === excluded) {
                continue;
            }
            try {
                const bytes = await vscode.workspace.fs.readFile(fileUri);
                const text = Buffer.from(bytes).toString("utf8");
                const count = countOccurrences(text, oldFileName);
                if (count > 0) {
                    references.push({ uri: fileUri, count });
                }
            } catch (error) {
                out`Failed to scan ${name} for links: ${error}`;
            }
        }
        return references;
    }

    /**
     * Warn the user (non-blocking) when a moved/renamed todo still has inbound
     * references from other todos, offering to open the first referrer.
     */
    async warnOnBrokenReferences(
        oldFileName: string,
        newUri: vscode.Uri
    ): Promise<void> {
        const references = await this.findReferencesToName(oldFileName, newUri);
        if (references.length === 0) {
            return;
        }

        const total = references.reduce((sum, r) => sum + r.count, 0);
        const fileWord = references.length === 1 ? "file" : "files";
        const choice = await vscode.window.showWarningMessage(
            `Moved/renamed "${oldFileName}" is still referenced in ${references.length} other todo ${fileWord} (${total} link${total === 1 ? "" : "s"}). These links may now be broken.`,
            "Show Referrers"
        );
        if (choice === "Show Referrers") {
            await vscode.commands.executeCommand(
                "workbench.action.findInFiles",
                {
                    query: oldFileName,
                    triggerSearch: true,
                    isRegex: false,
                }
            );
        }
    }
}

function countOccurrences(haystack: string, needle: string): number {
    if (!needle) {
        return 0;
    }
    let count = 0;
    let index = haystack.indexOf(needle);
    while (index !== -1) {
        count++;
        index = haystack.indexOf(needle, index + needle.length);
    }
    return count;
}
