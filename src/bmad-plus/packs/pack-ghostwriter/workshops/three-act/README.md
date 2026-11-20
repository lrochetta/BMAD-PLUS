# Les trois actes (The three acts)

Ghostwriter can moderate a structural workshop for a selected story, script or outline. One specialist reads the **installation** (setup), one follows the **confrontation**, and one tests the **résolution** (resolution). Each reads the whole piece. The author chooses which trade-offs fit their intent. For a debate between narrative methods, use the [three-act council seat](specialist.md).

## Prepare the reading

Put a copy of the narrative in a project-relative file such as `workshop/story.md`. Give the scenes stable identifiers, add the author's question, the audience and any fixed ending, tone or length. A missing fact goes on the open-questions list. Use the full manuscript or name the excerpt and limit conclusions accordingly. Each reader receives the same text, so review it for material the author has authorized these agents to see.

## Run two juries

Use the installed BMAD+ CLI on the project's execution host. Follow the Core swarm skill at `.agents/skills/bmad-plus-swarm/SKILL.md` for dispatch. The normal workshop takes six specialist assignments across two rounds. Use the available host sessions and the configured wave and budget limits. Account for the whole workshop before starting. If capacity is limited, queue cards within each round or offer a single-agent reading clearly labelled as such. Mark each missing seat in the result.

1. Start the proposal jury and keep its printed run ID. Run `briefs` with that ID. Dispatch each printed brief to a separate agent. Preserve the returned unit ID and the actual session or task ID. The moderator coordinates and records the replies.

   ```sh
   bmad-plus swarm init --definition .agents/skills/pack-ghostwriter/workshops/three-act/proposals.json --context story=workshop/story.md --json
   bmad-plus swarm briefs FIRST_RUN --json
   bmad-plus swarm check FIRST_RUN --json
   bmad-plus swarm tally FIRST_RUN --json
   ```

2. Read the three validated answer files in `.bmad-plus/swarm/runs/FIRST_RUN/answers/`. Verify each cited line or scene against the story. Copy the original JSON files, unchanged, to a fresh project-relative folder such as `workshop/FIRST_RUN/`, replacing `FIRST_RUN` with the actual ID everywhere. Retain each original file with its unit ID. Proceed after all three usable proposals are present. If a seat is still missing after one retry within the agreed budget, return the available proposals and mark the debate incomplete.

3. Start the objection jury using the same version of the story and the three frozen answers. Its briefs carry the real proposals. Dispatch all three and retain the session evidence for this round. Each specialist has a different peer to challenge.

   ```sh
   bmad-plus swarm init --definition .agents/skills/pack-ghostwriter/workshops/three-act/objections.json --context story=workshop/story.md --context installation=workshop/FIRST_RUN/installation.json --context confrontation=workshop/FIRST_RUN/confrontation.json --context resolution=workshop/FIRST_RUN/resolution.json --json
   bmad-plus swarm briefs SECOND_RUN --json
   bmad-plus swarm check SECOND_RUN --json
   bmad-plus swarm tally SECOND_RUN --json
   ```

4. Read all replies. Match each `target` to its assigned peer, the `cited_proposal` to the exact peer's proposal text, and its `anchor` to the story. The swarm checks answer structure. An invented quote or a missing anchor needs correction and remains unresolved until corrected. Allow at most one retry per failed seat within the agreed limit. Report each run ID, its participating seats and any unresolved checks.

## Give the decision back to the author

Start with the disclosure from the tally. For each disputed scene, put the concrete changes side by side and say what each preserves or sacrifices. Separate points all participating readers actually endorsed from open objections. A majority vote cannot settle an artistic intention. End with the smallest question the author must decide. Record that decision only if the author gives it. Editing the manuscript is a separate action.

Try the [original three-scene outline](example.md). For S2, one plausible proposal is to have Ada cut the reel herself before handing over the key. That clarifies her agency and changes what the audience knows about the missing scene. Another is to keep the cut unexplained but show her pause over the two ends before she gives Noé the key. Both can support the curtain gesture in S3. They make different promises about whether the audience will discover who made the cut. These are illustrative alternatives for the moderator, outside the specialists' briefs.
