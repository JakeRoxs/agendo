/**
 * Command identifiers for the Agendo extension.
 *
 * Commands follow the format: "agendo.commandName".
 */
export enum Command {
  Refresh = "agendo.refresh",
  ShowDigest = "agendo.showDigest",
  OpenBoard = "agendo.openBoard",
  Filter = "agendo.filter",
  Search = "agendo.search",
  ClearSearch = "agendo.clearSearch",
  ClearFilters = "agendo.clearFilters",
  CreateTodo = "agendo.createTodo",
  OpenPreview = "agendo.openPreview",
  SetStatusPending = "agendo.setStatus.pending",
  SetStatusReady = "agendo.setStatus.ready",
  SetStatusBacklogged = "agendo.setStatus.backlogged",
  SetStatusComplete = "agendo.setStatus.complete",
  SetStatusCancelled = "agendo.setStatus.cancelled",
  SetPriority = "agendo.setPriority",
  SetDependency = "agendo.setDependency",
  SetGroup = "agendo.setGroup",
  ChooseRoot = "agendo.chooseRoot",
  ToggleGitignore = "agendo.toggleGitignore",
  TogglePreview = "agendo.togglePreview",
  SetDefaultRoot = "agendo.setDefault.root",
  SetDefaultPriority = "agendo.setDefault.priority",
  SetDefaultPreview = "agendo.setDefault.preview",
  EnableSkill = "agendo.enableSkill",
  UpdateSkill = "agendo.updateSkill",
  CollapseNode = "agendo.collapseNode",
  ExpandNode = "agendo.expandNode",
}
