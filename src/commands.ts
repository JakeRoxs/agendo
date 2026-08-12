/**
 * Command identifiers for the File Todos extension.
 *
 * Commands follow the format: "file-todos.commandName".
 */
export enum Command {
    Refresh = "file-todos.refresh",
    Filter = "file-todos.filter",
    Search = "file-todos.search",
    ClearFilters = "file-todos.clearFilters",
    CreateTodo = "file-todos.createTodo",
    OpenPreview = "file-todos.openPreview",
    SetStatusPending = "file-todos.setStatus.pending",
    SetStatusReady = "file-todos.setStatus.ready",
    SetStatusBacklogged = "file-todos.setStatus.backlogged",
    SetStatusComplete = "file-todos.setStatus.complete",
    SetStatusCancelled = "file-todos.setStatus.cancelled",
    SetPriority = "file-todos.setPriority",
    ChooseRoot = "file-todos.chooseRoot",
    ToggleGitignore = "file-todos.toggleGitignore",
    TogglePreview = "file-todos.togglePreview",
    SetDefaultRoot = "file-todos.setDefault.root",
    SetDefaultPriority = "file-todos.setDefault.priority",
    SetDefaultPreview = "file-todos.setDefault.preview",
    EnableSkill = "file-todos.enableSkill",
    UpdateSkill = "file-todos.updateSkill",
}
