import * as vscode from "vscode";
import { Command } from "../commands";
import { type ConfigService, type ViewMode, viewModeLabel } from "./configService";
import type { SkillManager, SkillStatus } from "./skillManager";

type SkillStatusNode =
  | { kind: "skill"; status?: SkillStatus }
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
    nodes.push({ kind: "viewMode", mode: this.config.viewMode });
    return nodes;
  }

  getTreeItem(node: SkillStatusNode): vscode.TreeItem {
    if (node.kind === "viewMode") {
      return this.viewModeItem(node);
    }
    return this.skillItem(node.status);
  }

  private skillItem(status?: SkillStatus): vscode.TreeItem {
    if (!status) {
      const item = new vscode.TreeItem("Skill status unknown");
      item.iconPath = new vscode.ThemeIcon("warning");
      item.tooltip = "Agendo could not read the installed or bundled skill version.";
      item.command = { command: Command.EnableSkill, title: "Check Agendo Skill" };
      return item;
    }

    if (status.updateAvailable) {
      const item = new vscode.TreeItem(`Skill v${status.installedVersion ?? "?"}`);
      item.description = `v${status.bundledVersion ?? "?"} available`;
      item.iconPath = new vscode.ThemeIcon("cloud-download");
      item.tooltip = "Select to install the bundled Agendo skill update.";
      item.command = { command: Command.EnableSkill, title: "Update Agendo Skill" };
      return item;
    }

    if (status.installed) {
      const item = new vscode.TreeItem(`Skill v${status.installedVersion ?? "?"}`);
      item.description = "Installed";
      item.iconPath = new vscode.ThemeIcon("pass-filled");
      item.tooltip = "The installed Agendo skill matches the bundled version.";
      item.command = { command: Command.EnableSkill, title: "Check Agendo Skill" };
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
    return "preview";
  }
}
