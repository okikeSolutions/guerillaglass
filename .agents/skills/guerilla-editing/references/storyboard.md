# Storyboard agent

Input: creative brief, `review.json`, source recording and source samples. For revisions also read the previous storyboard and render feedback.

Inspect the recording before selecting ranges. Produce `storyboard.json` conforming to `EditStoryboard` in `packages/engine-contract/src/domains/editWorkflow.ts`. Copy `revision` into `baseRevision` and preserve `sourceRevision`. Every scene has a title, editorial purpose, and `item` using the existing timeline clip/gap format. Times are source seconds. Scene order is program order. Include all scenes to retain, including intentional gaps. Add bounded camera keyframes only when framing has a clear purpose.

Use existing scene IDs for retained scenes. Make new IDs for new scenes. Explain how each requested correction changes its scene. Avoid inventing content absent from the recording. If the brief requires unavailable content, report the missing source instead of fabricating a scene.

Completion: each scene has inspected source evidence or is an intentional gap; ranges fit the source; retained IDs survive; the storyboard addresses the brief. Hand the file and unresolved editorial questions to the editing agent. Leave the saved project unchanged.
