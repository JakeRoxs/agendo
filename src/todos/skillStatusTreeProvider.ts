import * as vscode from "vscode";
import { Command } from "../commands";
import type { CanvasManager, CanvasStatus } from "./canvasManager";
import { versionRelationship } from "./componentVersions";
import { type ConfigService, type ViewMode, viewModeLabel } from "./configService";
import type { SkillManager, SkillStatus } from "./skillManager";
import { compareVersions } from "./skillManager";

type SkillStatusNode =
  | { kind: "skill"; status?: SkillStatus }
  | { kind: "canvas"; status?: CanvasStatus }
  | { kind: "viewMode"; mode: ViewMode };

/**
 * Footer panel beneath the Agendo Todos view. Surfaces lightweight status
 * information — the bundled skill/canvas state and the active view mode.
 */
export class SkillStatusTreeProvider implements vscode.TreeDataProvider<SkillStatusNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    SkillStatusNode | undefined
  >();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(
    private readonly skill: SkillManager,
    private readonly config: ConfigService,
    private readonly canvas: CanvasManager,
  ) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  async getChildren(): Promise<SkillStatusNode[]> {
    const nodes: SkillStatusNode[] = [];
    try {
      nodes.push({ kind: "skill", status: await this.skill.getStatus() });
    } catch {
      nodes.push({ kind: "skill" });
    }
    try {
      nodes.push({ kind: "canvas", status: await this.canvas.getStatus() });
    } catch {
      nodes.push({ kind: "canvas" });
    }
    nodes.push({ kind: "viewMode", mode: this.config.viewMode });
    return nodes;
  }

  getTreeItem(node: SkillStatusNode): vscode.TreeItem {
    if (node.kind === "viewMode") {
      return this.viewModeItem(node);
    }
    if (node.kind === "canvas") {
      return this.canvasItem(node.status);
    }
    return this.skillItem(node.status);
  }

  private canvasItem(status?: CanvasStatus): vscode.TreeItem {
    const command = { command: Command.ManageCanvas, title: "Manage Canvas" };
    if (!status) {
      const item = new vscode.TreeItem("Canvas status unknown");
      item.iconPath = new vscode.ThemeIcon("warning");
      item.command = command;
      return item;
    }
    if (!status.installed) {
      const item = new vscode.TreeItem("Install work-session canvas");
      item.description = `Bundled v${status.bundledVersion ?? "?"}`;
      item.iconPath = new vscode.ThemeIcon("cloud-download");
      item.tooltip = this.canvasTooltip(status);
      item.command = command;
      return item;
    }
    const item = new vscode.TreeItem(`Canvas v${status.installedVersion ?? "?"}`);
    item.command = command;
    item.tooltip = this.canvasTooltip(status);
    if (this.sourceUpdateAvailable(status)) {
      item.description = `Source v${status.sourceVersion} available`;
      item.iconPath = new vscode.ThemeIcon("sync");
    } else if (status.updateAvailable) {
      item.description = `Bundled v${status.bundledVersion ?? "?"} available`;
      item.iconPath = new vscode.ThemeIcon("sync");
    } else if (
      status.installedVersion &&
      status.bundledVersion &&
      compareVersions(status.installedVersion, status.bundledVersion) > 0
    ) {
      item.description = `Installed v${status.installedVersion} newer than bundled v${status.bundledVersion ?? "?"}`;
      item.iconPath = new vscode.ThemeIcon("pass-filled");
    } else {
      item.description = this.bundleDescription(status);
      item.iconPath = new vscode.ThemeIcon("pass-filled");
    }
    return item;
  }

  private canvasTooltip(status: CanvasStatus): string {
    const installed = `Installed version: ${status.installed ? (status.installedVersion ?? "unknown") : "not installed"}`;
    const bundled = `Bundled version (included in extension): ${status.bundledVersion ?? "?"}`;
    const source =
      status.sourceError ||
      (status.sourceVersion
        ? `last checked v${status.sourceVersion} (${versionRelationship(status.installedVersion, status.sourceVersion)})`
        : "source version not checked");
    return `${installed}\n${bundled}\nSource: GitHub main by default; ${source}.\nConfigured source: ${status.sourceUrl || "not configured"}\nVersion equality does not establish content equality or installation origin.\nClick to review versions and actions without installing.`;
  }

  private skillItem(status?: SkillStatus): vscode.TreeItem {
    const command = { command: Command.ManageSkill, title: "Manage Skill" };
    if (!status) {
      const item = new vscode.TreeItem("Skill status unknown");
      item.iconPath = new vscode.ThemeIcon("warning");
      item.tooltip = "Agendo could not read the installed or bundled skill version.";
      item.command = command;
      return item;
    }

    if (status.updateAvailable || this.sourceUpdateAvailable(status)) {
      const item = new vscode.TreeItem(`Skill v${status.installedVersion ?? "?"}`);
      item.description = this.sourceUpdateAvailable(status)
        ? `Source v${status.sourceVersion} available`
        : `Bundled v${status.bundledVersion ?? "?"} available`;
      item.iconPath = new vscode.ThemeIcon("sync");
      item.tooltip = this.skillTooltip(status);
      item.command = command;
      return item;
    }

    if (status.installed) {
      const item = new vscode.TreeItem(`Skill v${status.installedVersion ?? "?"}`);
      item.iconPath = new vscode.ThemeIcon("pass-filled");
      item.tooltip = this.skillTooltip(status);
      item.command = command;
      if (
        status.installedVersion &&
        status.bundledVersion &&
        compareVersions(status.installedVersion, status.bundledVersion) > 0
      ) {
        item.description = `Installed v${status.installedVersion} newer than bundled v${status.bundledVersion ?? "?"}`;
      } else {
        item.description = this.bundleDescription(status);
      }
      return item;
    }

    const item = new vscode.TreeItem("Install Agendo skill");
    item.description = `Bundled v${status.bundledVersion ?? "?"}`;
    item.iconPath = new vscode.ThemeIcon("cloud-download");
    item.tooltip = this.skillTooltip(status);
    item.command = command;
    return item;
  }

  private skillTooltip(status: SkillStatus): string {
    return this.canvasTooltip(status);
  }

  private sourceUpdateAvailable(status: SkillStatus | CanvasStatus): boolean {
    return Boolean(
      status.installed &&
        status.installedVersion &&
        status.sourceVersion &&
        compareVersions(status.sourceVersion, status.installedVersion) > 0,
    );
  }

  private bundleDescription(status: SkillStatus | CanvasStatus): string {
    if (!status.installedVersion || !status.bundledVersion) return "Version comparison unknown";
    return status.installedVersion === status.bundledVersion
      ? `v${status.bundledVersion}`
      : `Differs from bundled v${status.bundledVersion}`;
  }

  private viewModeItem(node: { kind: "viewMode"; mode: ViewMode }): vscode.TreeItem {
    const item = new vscode.TreeItem("View");
    item.description = viewModeLabel(node.mode);
    item.iconPath = new vscode.ThemeIcon(this.viewModeIcon(node.mode));
    item.tooltip = "How todos open. Select to change.";
    item.command = { command: Command.SetViewMode, title: "Set View Mode" };
    return item;
  }

  private viewModeIcon(mode: ViewMode): string {
    if (mode === "editor") {
      return "edit";
    }
    if (mode === "previewEditor") {
      return "open-preview";
    }
    if (mode === "default") {
      return "settings";
    }
    if (mode === "canvas") {
      return "dashboard";
    }
    return "preview";
  }
}
