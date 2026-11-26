import {
  AI_COACH_CONFIG_FILE_NAME,
  AI_COACH_FOLDER_NAME,
  AI_COACH_REPORT_FILE_PREFIX,
  AI_COACH_REPORT_FILES_TO_KEEP,
  AI_COACH_SNAPSHOT_FILE_NAME,
} from './aiCoachDrive'

// The one-time setup prompt a user pastes into a Claude surface that supports Routines
// (claude.ai/code/routines). Steps 2-8 are written to be re-read verbatim by the routine itself
// on every scheduled run, so re-running this same prompt later (e.g. to fix something) is safe —
// it updates the existing routine instead of creating a duplicate.
//
// Reports are append-only: the Drive connector can create files and edit metadata, but can't
// rewrite an existing file's content (least of all one it didn't create), so there's no fixed
// report file to update in place. Each run creates new dated files instead, and the app always
// reads the newest of each — see pullLatestReport/pullLatestCoachInsights in aiCoachDrive.ts.
export function buildAiCoachSetupPrompt(): string {
  return `Set up a daily AI fitness coach for me using Google Drive.

1. Turn on the Google Drive connector for this conversation if it isn't already on.
2. In my Google Drive (My Drive, not a shared drive), find the folder named exactly "${AI_COACH_FOLDER_NAME}". Inside it are two files:
   - ${AI_COACH_SNAPSHOT_FILE_NAME} — my workout history and current plans, written by my workout app. Read-only for you. Its "exercises" field is the full exercise catalog (not just ones I've logged), so it has an id for anything you might want to newly recommend.
   - ${AI_COACH_CONFIG_FILE_NAME} — notes from me for you (goals, injuries, current focus), plus a "declinedSuggestions" list of plan suggestions I've already dismissed. Each entry has a "key", a "summary", and a "status" of either "never" (don't suggest it again, ever) or "snoozed" (don't suggest it again until the date in its "snoozedUntil" field, formatted YYYY-MM-DD, has passed). Read-only for you, but re-read it fresh every run since both can change.
3. Read both files, then create a new file in that same folder named "${AI_COACH_REPORT_FILE_PREFIX}<today's date, YYYY-MM-DD>.md" (don't edit or overwrite any existing file — always create a new one) containing your daily review as plain markdown text (not JSON, just the markdown itself).
4. In the review, cover: what was trained in the last 7 days vs the prior few weeks, overall consistency, any personal bests (heavier weight or more reps than before on the same exercise), which muscle groups (using the exercise metadata in ${AI_COACH_SNAPSHOT_FILE_NAME}) got trained vs neglected, and 2-3 concrete suggestions for the coming week. Fold in anything relevant from ${AI_COACH_CONFIG_FILE_NAME}'s notes. Tone: encouraging and specific, like a good coach — not clinical.
5. Formatting: plain markdown only — "#"/"##" headings, short paragraphs, "**bold**" for emphasis, "-" bullet lists. No tables, nested lists, links, images, or code blocks.
6. Also create a second new file in that same folder named "${AI_COACH_REPORT_FILE_PREFIX}<the same date>.json" (same rule — never edit or overwrite an existing file) containing one JSON object with two arrays:
   {"planSuggestions": [...], "weightSuggestions": [...]}

   "planSuggestions" — structural plan-change suggestions: adding a neglected exercise to one of my plans, or changing an exercise's target sets/rep range. Never a weight-only suggestion — those go in "weightSuggestions" below. Each item:
   {"templateName": "<must exactly match one of ${AI_COACH_SNAPSHOT_FILE_NAME}'s templates[].name>", "exerciseId": "<id from ${AI_COACH_SNAPSHOT_FILE_NAME}'s exercises catalog>", "action": "add_exercise" or "change_target", "target": {"sets": <number>, "repsMin": <number>, "repsMax": <number>}, "startWeightKg": <number, only for add_exercise — your best guess at a safe starting weight>, "detail": "<one sentence, human-readable, explaining the suggestion>"}
   Skip any suggestion whose combination of action, templateName and exerciseId matches a "key" (formatted as "action:templateName:exerciseId") already in ${AI_COACH_CONFIG_FILE_NAME}'s "declinedSuggestions" with status "never", or with status "snoozed" and a "snoozedUntil" date that hasn't passed yet — I've already said no to those for now.

   "weightSuggestions" — per-exercise weight nudges, meant to be shown right there in the workout log the next time I do that exercise. Each item:
   {"exerciseId": "<id from ${AI_COACH_SNAPSHOT_FILE_NAME}'s exercises catalog>", "suggestedWeightKg": <number>, "detail": "<a complete, display-ready sentence — it's shown to me verbatim, not summarized>"}
   The app already has a simple built-in rule that notices when every set of an exercise hit the top of its rep range at the same weight. Your job here is the cases that rule can't see: use your fuller judgment (personal bests on related lifts, multi-week trends, my notes in ${AI_COACH_CONFIG_FILE_NAME}) to suggest a specific next weight, including for exercises that simple rule wouldn't catch.

   If there's nothing worth suggesting in either array, use an empty array "[]" for it, not nothing.
7. After writing both new files, check the folder for other files whose names start with "${AI_COACH_REPORT_FILE_PREFIX}" — separately for the ".md" ones and the ".json" ones, if either group has more than ${AI_COACH_REPORT_FILES_TO_KEEP} files, delete that group's oldest ones so only its most recent ${AI_COACH_REPORT_FILES_TO_KEEP} remain.
8. Do all of that once right now, so I have a review today.
9. Then set this up to repeat automatically: create a Claude Code Routine (not a one-off chat, and not a Cowork or Desktop local task — a Routine, since those run unattended in the cloud with connectors already on) named exactly "Flex Daily Coach", scheduled to run daily, just after midnight (e.g. 12:15am) in my local timezone. If a routine with that exact name already exists, update it instead of making a duplicate. Its instructions should repeat steps 2-7 above on every run.
10. If you're ever asked to approve Google Drive access for an unattended/scheduled run, choose the option that allows it for all future runs, not just this one — otherwise tomorrow's run will stall waiting on an approval nobody is there to give.

Once the routine is created I don't need to do anything else — it'll keep my daily review up to date on its own.`
}
