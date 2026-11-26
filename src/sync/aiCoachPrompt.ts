import {
  AI_COACH_CONFIG_FILE_NAME,
  AI_COACH_FOLDER_NAME,
  AI_COACH_INSTRUCTIONS_FILE_NAME,
  AI_COACH_REPORT_FILE_PREFIX,
  AI_COACH_REPORT_FILES_TO_KEEP,
  AI_COACH_SNAPSHOT_FILE_NAME,
} from './aiCoachDrive'

// The routine's actual task logic — NOT part of the one-time setup prompt below. This is pushed
// to ${AI_COACH_INSTRUCTIONS_FILE_NAME} by the app itself (see pushInstructions in
// aiCoachDrive.ts, called from useAiCoach on every sign-in), and the routine re-reads it fresh on
// every run rather than ever being given a frozen copy. That split is the whole point: changing
// what the coach does (like this file) ships to every signed-in device automatically, same as
// any other app update — it never requires anyone to re-paste the setup prompt again. Only
// changes to the one-time shell below (buildAiCoachSetupPrompt) would need that, and that shell
// is meant to stay so generic it should basically never need to change.
export function buildAiCoachInstructions(): string {
  // The browser's own zone, not a hardcoded one — this file gets pushed from whichever device's
  // signed-in browser last ran useAiCoach, so it naturally follows that person if they travel,
  // and it's correct for every user regardless of where they are (this isn't a single-user app).
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return `In the "${AI_COACH_FOLDER_NAME}" Google Drive folder you're already in, read these two files:
- ${AI_COACH_SNAPSHOT_FILE_NAME} — my workout history and current plans, written by my workout app. Read-only for you. Its "exercises" field is the full exercise catalog (not just ones I've logged), so it has an id for anything you might want to newly recommend. Each catalog entry has an "equipment" array (what it actually requires — gates whether I can do it at all) and may have an "optionalEquipment" array (makes it harder, e.g. a weight belt for a pull-up, but never required).
- ${AI_COACH_CONFIG_FILE_NAME} — notes from me for you (goals, injuries, current focus), an "equipment" list of equipment ids I have access to (from the same vocabulary as the catalog's "equipment"/"optionalEquipment" — if this list is empty or missing, I haven't set one, so assume I have full gym access rather than nothing), plus a "declinedSuggestions" list of plan suggestions I've already dismissed. Each entry has a "key", a "summary", and a "status" of either "never" (don't suggest it again, ever) or "snoozed" (don't suggest it again until the date in its "snoozedUntil" field, formatted YYYY-MM-DD, has passed). Read-only for you, but always use what's currently in these files, not anything you remember from a previous run — both can change between runs, and so can this very file.

Wherever these instructions say "today's date" or "the last 7 days" (here and below), that means the date in the ${timeZone} timezone specifically — not UTC, not any other default. Get this right at a run close to midnight: if you used the wrong zone there, the report could land on the wrong day or double up with yesterday's.

Then create a new file in that same folder named "${AI_COACH_REPORT_FILE_PREFIX}<today's date, YYYY-MM-DD>.md" (don't edit or overwrite any existing file — always create a new one) containing your daily review as plain markdown text (not JSON, just the markdown itself).

In the review, cover: what was trained in the last 7 days vs the prior few weeks, overall consistency, any personal bests (heavier weight or more reps than before on the same exercise), which muscle groups (using the exercise metadata in ${AI_COACH_SNAPSHOT_FILE_NAME}) got trained vs neglected, and 2-3 concrete suggestions for the coming week. Fold in anything relevant from ${AI_COACH_CONFIG_FILE_NAME}'s notes, and only suggest exercises whose "equipment" I actually have per its "equipment" list (an empty/missing list means don't restrict). Tone: encouraging and specific, like a good coach — not clinical.

Formatting: plain markdown only — "#"/"##" headings, short paragraphs, "**bold**" for emphasis, "-" bullet lists. No tables, nested lists, links, images, or code blocks.

Also create a second new file in that same folder named "${AI_COACH_REPORT_FILE_PREFIX}<the same date>.json" (same rule — never edit or overwrite an existing file) containing one JSON object with two arrays:
{"planSuggestions": [...], "weightSuggestions": [...]}

"planSuggestions" — structural plan-change suggestions: adding a neglected exercise to one of my plans, or changing an exercise's target sets/rep range. Never a weight-only suggestion — those go in "weightSuggestions" below. Each item:
{"templateName": "<must exactly match one of ${AI_COACH_SNAPSHOT_FILE_NAME}'s templates[].name>", "exerciseId": "<id from ${AI_COACH_SNAPSHOT_FILE_NAME}'s exercises catalog>", "action": "add_exercise" or "change_target", "target": {"sets": <number>, "repsMin": <number>, "repsMax": <number>}, "startWeightKg": <number, only for add_exercise — your best guess at a safe starting weight>, "detail": "<one sentence, human-readable, explaining the suggestion>"}
Skip any suggestion whose combination of action, templateName and exerciseId matches a "key" (formatted as "action:templateName:exerciseId") already in ${AI_COACH_CONFIG_FILE_NAME}'s "declinedSuggestions" with status "never", or with status "snoozed" and a "snoozedUntil" date that hasn't passed yet — I've already said no to those for now.
For "add_exercise", only propose exercises whose catalog "equipment" is fully covered by ${AI_COACH_CONFIG_FILE_NAME}'s "equipment" list — unless that list is empty or missing, in which case don't restrict by equipment at all. Never gate on "optionalEquipment"; it's a bonus, not a requirement.

"weightSuggestions" — per-exercise weight nudges, meant to be shown right there in the workout log the next time I do that exercise. Each item:
{"exerciseId": "<id from ${AI_COACH_SNAPSHOT_FILE_NAME}'s exercises catalog>", "suggestedWeightKg": <number>, "detail": "<a complete, display-ready sentence — it's shown to me verbatim, not summarized>"}
The app already has a simple built-in rule that notices when every set of an exercise hit the top of its rep range at the same weight. Your job here is the cases that rule can't see: use your fuller judgment (personal bests on related lifts, multi-week trends, my notes in ${AI_COACH_CONFIG_FILE_NAME}) to suggest a specific next weight, including for exercises that simple rule wouldn't catch.

If there's nothing worth suggesting in either array, use an empty array "[]" for it, not nothing.

After writing both new files, check the folder for other files whose names start with "${AI_COACH_REPORT_FILE_PREFIX}" — separately for the ".md" ones and the ".json" ones, if either group has more than ${AI_COACH_REPORT_FILES_TO_KEEP} files, delete that group's oldest ones so only its most recent ${AI_COACH_REPORT_FILES_TO_KEEP} remain.`
}

// The one-time setup prompt a user pastes into a Claude surface that supports Routines
// (claude.ai/code/routines). Deliberately generic and stable: it never describes the actual
// task, only "go read it fresh and do what it says" — so the Routine it creates never goes
// stale no matter how many times buildAiCoachInstructions above changes later. Re-running this
// is still safe (it updates the existing routine rather than duplicating it) but shouldn't
// normally be necessary again after the first time.
export function buildAiCoachSetupPrompt(): string {
  return `Set up a daily AI fitness coach for me using Google Drive.

1. Turn on the Google Drive connector for this conversation if it isn't already on.
2. In my Google Drive (My Drive, not a shared drive), find the folder named exactly "${AI_COACH_FOLDER_NAME}". Inside it, read the file "${AI_COACH_INSTRUCTIONS_FILE_NAME}" — it's plain text describing exactly what to do. Follow it exactly, as if it were pasted directly into this conversation right now.
3. Do that once right now, so I have a review today.
4. Then set this up to repeat automatically: create a Claude Code Routine (not a one-off chat, and not a Cowork or Desktop local task — a Routine, since those run unattended in the cloud with connectors already on) named exactly "Flex Daily Coach", scheduled to run daily, just after midnight (e.g. 12:15am) in my local timezone. If a routine with that exact name already exists, update it instead of making a duplicate. Its instructions should be exactly this, word for word — not a copy of what "${AI_COACH_INSTRUCTIONS_FILE_NAME}" currently says, since that file's content can change later and the routine needs to notice: "In my Google Drive, find the folder named exactly '${AI_COACH_FOLDER_NAME}', read the file '${AI_COACH_INSTRUCTIONS_FILE_NAME}' fresh (it may have changed since last time — always follow the current version, never one you remember from a previous run), and follow it exactly for this run."
5. If you're ever asked to approve Google Drive access for an unattended/scheduled run, choose the option that allows it for all future runs, not just this one — otherwise tomorrow's run will stall waiting on an approval nobody is there to give.

Once the routine is created I don't need to do anything else — it'll keep following whatever "${AI_COACH_INSTRUCTIONS_FILE_NAME}" currently says, automatically, even as that changes.`
}
