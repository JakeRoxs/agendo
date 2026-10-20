import * as vscode from "vscode";
import { Command } from "../commands";
import type { CanvasManager, CanvasStatus } from "./canvasManager";
import { type ConfigService, type ViewMode, viewModeLabel } from "./configService";
import type { SkillManager, SkillStatus } from "./skillManager";

type SkillStatusNode =
  | { kind: "skill"; status?: SkillStatus }
  | { kind: "canvas"; status?: CanvasStatus }
  | { kind: "viewMode"; mode: ViewMode };

/**
 * Footer panel beneath the Agendo Todos view. Surfaces lightweight status
 * information — the bundled skill state and the active view mode.
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
    const command = { command: Command.InstallCanvas, title: "Install Work Session Canvas" };
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
      item.tooltip = "Install the Copilot work-session canvas for all workspaces.";
      item.command = command;
      return item;
    }
    const item = new vscode.TreeItem(`Canvas v${status.installedVersion ?? "?"}`);
    item.command = command;
    if (status.updateAvailable) {
      item.description = `Bundled v${status.bundledVersion ?? "?"} available`;
      item.iconPath = new vscode.ThemeIcon("sync");
      item.tooltip = "A newer work-session canvas is bundled. Select to update it.";
    } else {
      item.description = "Installed";
      item.iconPath = new vscode.ThemeIcon("pass-filled");
      item.tooltip = "The work-session canvas matches the bundled version. Select to reinstall.";
    }
    return item;
  }

  private skillItem(status?: SkillStatus): vscode.TreeItem {
    if (!status) {
      const item = new vscode.TreeItem("Skill status unknown");
      item.iconPath = new vscode.ThemeIcon("warning");
      item.tooltip = "Agendo could not read the installed or bundled skill version.";
      item.command = { command: Command.EnableSkill, title: "Check Agendo Skill" };
      return item;
    }

    const versionLabel = status.fromSource ? " (Source)" : "";

    if (status.updateAvailable) {
      const item = new vscode.TreeItem(`Skill v${status.installedVersion ?? "?"}${versionLabel}`);
      item.description = `Bundled v${status.bundledVersion ?? "?"} available`;
      item.iconPath = new vscode.ThemeIcon("sync");
      item.tooltip =
        "The version bundled with this extension is newer than the installed skill. Select to install the bundled version.";
      item.command = { command: Command.EnableSkill, title: "Install Bundled Agendo Skill" };
      return item;
    }

    if (status.installed) {
      const item = new vscode.TreeItem(`Skill v${status.installedVersion ?? "?"}${versionLabel}`);
      item.description = "Installed";
      item.iconPath = new vscode.ThemeIcon("pass-filled");
      item.tooltip = status.fromSource
        ? "The Agendo skill was updated from source and differs from the bundled version."
        : "The installed Agendo skill matches the bundled version.";
      item.command = { command: Command.UpdateSkill, title: "Update Agendo Skill" };
      return item;
    }

    const item = new vscode.TreeItem("Install Agendo skill");
    item.description = `Bundled v${status.bundledVersion ?? "?"}`;
    item.iconPath = new vscode.ThemeIcon("cloud-download");
    item.tooltip = "Select to install the bundled Agendo skill.";
    item.command = { command: Command.EnableSkill, title: "Install Agendo Skill" };
    return item;
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
