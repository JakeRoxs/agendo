/**
 * Command identifiers for the Agendo extension.
 *
 * Commands follow the format: "agendo.commandName".
 */
export enum Command {
    Refresh = "agendo.refresh",
    Filter = "agendo.filter",
    Search = "agendo.search",
    ClearFilters = "agendo.clearFilters",
    CreateTodo = "agendo.createTodo",
    OpenPreview = "agendo.openPreview",
    SetStatusPending = "agendo.setStatus.pending",
    SetStatusReady = "agendo.setStatus.ready",
    SetStatusBacklogged = "agendo.setStatus.backlogged",
    SetStatusComplete = "agendo.setStatus.complete",
    SetStatusCancelled = "agendo.setStatus.cancelled",
    SetPriority = "agendo.setPriority",
    ChooseRoot = "agendo.chooseRoot",
    ToggleGitignore = "agendo.toggleGitignore",
    TogglePreview = "agendo.togglePreview",
    SetDefaultRoot = "agendo.setDefault.root",
    SetDefaultPriority = "agendo.setDefault.priority",
    SetDefaultPreview = "agendo.setDefault.preview",
    EnableSkill = "agendo.enableSkill",
    UpdateSkill = "agendo.updateSkill",
}
