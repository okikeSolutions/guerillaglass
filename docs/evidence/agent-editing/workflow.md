# Storyboard and revision workflow proof

The source is an 8-second synthetic recording with a red left half and blue right half. This proves the handoff and edit/camera mechanics; sampled frames do not establish production editorial quality.

1. `agent:workflow prepare` produced a saved snapshot, brief and timestamped source frames.
2. A storyboard agent inspected the snapshot, brief and source samples, then authored a 3-second storyboard retaining `result-left`, `pause`, `setup-right` and `repeat-right`.
3. A separate editing agent ran `agent:workflow propose`. Native validation succeeded; only the result end and gap duration changed.
4. In the packaged macOS app, the native file picker imported that storyboard. The proposal view showed intent, differences and source/revision validation. Apply stayed disabled until explicit confirmation. Applying saved the native project and refreshed the editor timeline.
5. The editing agent rendered the saved revision. FFprobe reported exactly 3 seconds. All four midpoint images were inspected: red result, black gap, blue setup, blue repeated footage. A render-bound `changes_requested` report requested a half-second intro and 3x setup zoom. No editorial approval was recorded.
6. A fresh source snapshot and that feedback went to the storyboard agent. The revised storyboard retained every ID, changed the intro end from 6.75 to 6.5, and changed setup zoom from 2x to 3x. The editing agent compiled/native-validated it.
7. The final packaged app imported, validated, reviewed and explicitly applied the correction. Its timeline showed clips/gap at 0–0.5, 0.5–0.75, 0.75–1.75 and 1.75–2.75 seconds. Expanded camera details showed the 2x-to-3x change before approval.
8. The corrected saved revision was rendered. Its receipt confirms every retained ID and camera/range correction. FFprobe reported 83 frames at 30 fps, 2.766667 seconds; this differs from the 2.75-second logical program by 0.016667 seconds, less than one frame. All four midpoint samples had the expected red/black/blue/blue colors. The final review template remains incomplete pending full-video review.

Negative checks rejected wrong edit revisions, wrong render identities for exports of the same edit, unknown scene IDs and incomplete review templates. Browser coverage also checks invalid JSON, native validation failure, unsaved editor state, post-validation editor changes, explicit confirmation, and native-menu/shortcut saves during pending proposal work. A bridge test verifies path-free validation/apply responses and native stale-apply errors. Schema tests cover implicit full-source comparisons and render/review bindings.

Native screenshots captured through the permissioned Peekaboo GUI bridge:

- `proposal-review.png`: collapsed JSON input, validation and scene intent.
- `proposal-confirmation.png`: before/after ranges and camera values with explicit confirmation.
- `proposal-applied.png`: the corrected editable timeline.
