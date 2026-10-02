# Agendo sub-agent workflow (runSubagent)

This workflow applies only when the host supports `runSubagent` and has an `agendo` sub-agent
installed. These are internal agent handoffs, not CLI or extension commands. When unavailable, use
the file workflows in SKILL.md.

1. From your task agent (e.g., `coding` or `review`), call `agendo` as a sub-agent to fetch todo metadata.
   - Example: `runSubagent({ agentName: "agendo", prompt: "show status 021" })`
   - Verify `status`, `priority`, `dependencies`, Resume Context, and the latest Work Log entry.

2. (Optional) Signal in-progress status:
   - `runSubagent({ agentName: "agendo", prompt: "update 021 status in-progress" })`

3. Append work log entries incrementally:
   - `runSubagent({ agentName: "agendo", prompt: "append 021 work log: added server-side protobuf handling, 2026-03-29, tests added" })`

4. Keep work log entries structured (date, author, actions, tests, results, learnings).
   - Include branch/PR references and commands run (`ctest`, `dotnet test`, etc.).

5. Resolve and complete:
   - First move/rename the todo from `ready` to `complete`, before any final content edit.
   - Then call: `runSubagent({ agentName: "agendo", prompt: "complete 021 summary: fixes + tests passed; the todo has already moved to its complete path, so edit only that path" })`

> This workflow is intended for a parent skill/agent orchestrating code tasks; `agendo` is invoked
> as a child skill for data updates and audit-safe state changes.
