import * as vscode from "vscode";
import { Command } from "../commands";
import type { SkillManager, SkillStatus } from "./skillManager";

interface SkillStatusNode {
  status?: SkillStatus;
}

/** Single-row tree provider shown beneath the Agendo Todos view. */
export class SkillStatusTreeProvider implements vscode.TreeDataProvider<SkillStatusNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    SkillStatusNode | undefined
  >();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly skill: SkillManager) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  async getChildren(): Promise<SkillStatusNode[]> {
    try {
      return [{ status: await this.skill.getStatus() }];
    } catch {
      return [{}];
    }
  }

  getTreeItem(node: SkillStatusNode): vscode.TreeItem {
    const { status } = node;
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
}
