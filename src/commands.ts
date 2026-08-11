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
    EnableSkill = "file-todos.enableSkill",
    UpdateSkill = "file-todos.updateSkill",
}
