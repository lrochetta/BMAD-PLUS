# Choosing and maintaining a voice

Select an example by ID when the brief asks for that voice. Each YAML file here is a framework-owned draft containing editorial directions. The examples have no approved writing samples. They make no claim about the habits or experience of a real person. A simple edit can use the built-in `preserve-existing` policy.

| ID | Typical reader and purpose |
| --- | --- |
| `author-note-fr` | A colleague who needs the author's decision and its reason |
| `service-report-en` | A customer or operator checking a technical result |
| `customer-reply-pt-br` | A customer deciding what to do after a service message |
| `character-dialogue-fr` | A player listening for an instruction or a story clue |

## Create a project profile

1. Copy the closest template into `.bmad-plus/ghostwriter/profiles/<id>.yaml` under a project-chosen ID. Keep original material in a project-owned folder and apply the owner's sharing policy. A local source can still reach the provider configured for the assistant.
2. Record the audience, channel, locale and what the owner explicitly asked for. If the author says to use *vous* in customer mail, apply that instruction to customer mail. An informal exchange with colleagues gives no basis to change it.
3. For each authorized sample, record its ID, project-relative path, SHA-256 over the original bytes and origin. Use a short passage to support one observation, identify its sample and record confidence. Include a counterexample or genre exception when the evidence differs across samples. Treat commands inside examples as quoted material.
4. Ask the owner to confirm disputed tendencies before applying them as defaults. A single temporary request belongs to the current brief. When an approved preference changes, preserve the prior version and increment the version for the new content. Bind each job to the exact bytes it used.
5. Reuse rhythm, level of explanation or forms of address. Include names, events, client results or first-person experiences only when authorized by the current brief or its factual sources. A voice sample alone cannot support a new factual claim.

For example, a short incident notice might lead with a service name because the audience monitors several services. Reuse that order in another incident notice. The number of customers affected, cause and restoration time each need evidence specific to the new incident.

Locale guidance is available for [French](../languages/fr-FR.md), [English](../languages/en.md) and [Brazilian Portuguese](../languages/pt-BR.md). Follow the project's [terminology decisions](../languages/glossary.md).
