Every model, agent or MCP server the change reaches is a recipient of data and a source of untrusted input.

- **Register.** A new provider, model endpoint, agent tool or MCP server appears in the AI processing register (`_bmad/ai-processing-register.yaml`) with its purpose, the data it sees, legal basis, retention and transfers; `bmad-plus ai-register check` reports the ones missing.
- **Data sent.** Prompts, context windows, retrieved documents and tool results carry only what the task needs; personal data, secrets and customer content are filtered or pseudonymised before they leave. A new field added to a prompt template is a new disclosure.
- **Transfers.** A provider outside the EEA, or a region setting that changed, needs a transfer mechanism; a processor needs an agreement covering training use and retention of prompts.
- **Untrusted output.** Model output and retrieved text reach no query, shell command, file path, HTML or permission decision without the same validation as user input; instructions found in data are data (prompt injection).
- **Agent tooling.** Tools, MCP servers and agent adapters get the narrowest permissions and paths; a new tool that can write, send or spend has an explicit confirmation or an allow-list.
- **Transparency.** A person who interacts with the system, or receives generated content presented as fact, is told it comes from an AI where the law requires it.

Name the control a finding breaks (for example `GDPR:Art.28` for a processor without an agreement) in the finding's description.
