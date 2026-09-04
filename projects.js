/*
 * projects.js — the list of projects shown on the index.
 *
 * This is the ONLY file you edit to add a project to the list.
 * index.html reads this array and builds the index automatically.
 *
 * Each entry:
 *   slug        folder name for the project, e.g. "word-counter"   (required)
 *   title       display name shown on the index                    (required)
 *   description one short line under the title                      (optional)
 *   type        a short label, e.g. "tool" / "game" / "experiment" (optional)
 *   added       ISO date "YYYY-MM-DD" — newest sorts to the top     (optional)
 *   href        override the link if it isn't at ./slug/            (optional)
 *
 * To add a project: copy a line, change the values, save. That's it.
 */
window.PROJECTS = [
  {
    slug: "ntp-tracker",
    title: "NTP Tracker",
    description: "Look up a NameThatPorn.com username and see their recent activity and comments. 18+.",
    type: "tool",
    added: "2026-09-04"
  },
  {
    slug: "invite",
    title: "The Invitation",
    description: "Pick tonight's outfit, setting, and details — get a crafted invitation to send your partner. 18+.",
    type: "app",
    added: "2026-08-03"
  },
  {
    slug: "freeuse-slots",
    title: "Tonight — Slots",
    description: "Pull the lever to spin up tonight's scene. 18+.",
    type: "app",
    added: "2026-07-26"
  },
  {
    slug: "cnc-dice",
    title: "CNC — Scenario Dice",
    description: "Roll for a CNC roleplay scenario, with safeword built in. 18+.",
    type: "app",
    added: "2026-07-26"
  },
  {
    slug: "tied",
    title: "Tied",
    description: "Bondage ideas and inspiration for couples — randomiser and reference. 18+.",
    type: "app",
    added: "2026-07-26"
  }
];
