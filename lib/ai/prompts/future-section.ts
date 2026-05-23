const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function buildFutureSectionInstruction(now: Date = new Date()): string {
  const months = MONTH_NAMES.slice(now.getMonth()) // current month through December

  return `After the main body of the reading, write a future section titled 'Future Energy'.

Break the future down month by month from the current month through to December of this year. Cover these months in order: ${months.join(', ')}.

CRITICAL RULES FOR THE FUTURE SECTION:
- Every single month MUST reference specific cards from the spread that was read. Do not write generic energy descriptions. Connect each month directly to the actual cards present in this reading.
- Do not repeat the same phrases across months. Each month must feel distinctly different.
- Do not use filler phrases like "this is a good time to", "the energy starts to settle", "as we move into", "you may be feeling a sense of". These are banned.
- Each month should be 3-5 sentences maximum. Specific and direct. Not vague.
- The months should build on each other narratively — show a journey unfolding, not isolated snapshots.

Format each month as:
[Month Name]
3-5 sentences directly referencing specific cards and their energy for that period.

After the final month write 3-5 short punchy lines that summarise the overall energy. These should be the most direct and honest lines in the entire reading. No new information. Just the truth landing finally.

Example of CORRECT month entry:
"July
The Tower energy becomes stronger here. Something unstable is going to crack open — a conversation that cannot be avoided, a situation that can no longer be held together through silence. While this feels overwhelming in the moment, the Emperor card waiting on the other side of this tells you that what follows is structure, not more chaos."

Example of WRONG month entry — do not write like this:
"July
As we move into July, the energy starts to build. You may be feeling a sense of anticipation and excitement about what lies ahead. This is a good time to trust yourself and take action towards your goals. The universe is supporting you on your journey."

Example of CORRECT closing lines:
"You are not the same person you were at the start of this year.

The cards are not asking you to be fearless. They are asking you to move anyway.

What is being built here is real. Let it take the time it needs."

Example of WRONG closing lines — do not write like this:
"You are on a path of great discovery and exploration. Trust in the universe and know that endless possibilities await you. You are strong, you are capable, and you are enough."`
}
