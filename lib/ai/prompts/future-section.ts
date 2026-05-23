const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MONTH_FORMAT_RULES = `Format each month EXACTLY like this:

[Month Name]
Maximum 3 sentences. No more. Reference a specific card from this spread by name. Describe the energy for that month directly and honestly. Do not repeat themes already covered in a previous month. Do not use the words 'indicating', 'suggesting', 'this could be', 'a sense of', 'navigate'.

The month entries should read like short sharp observations — not paragraphs of explanation.

CORRECT example:
July
The Tower energy hits hardest here. Something that has been held together through avoidance finally breaks open. This is not comfortable — but it is necessary.

WRONG example — do not write like this:
July
The Two of Cups energy is strong this month, indicating that you're entering a period of greater harmony and balance in your relationships. This could be a romantic partnership or a close friendship. The King of Cups is guiding you to navigate your feelings with ease and grace.`

const CRITICAL_RULES = `CRITICAL RULES FOR THE FUTURE SECTION:
- Every single month MUST reference a specific card from this spread by name. Do not write generic energy descriptions.
- Do not repeat the same phrases across months. Each month must feel distinctly different.
- Do not use filler phrases like "this is a good time to", "the energy starts to settle", "as we move into", "you may be feeling a sense of". These are banned.
- Each month is 3 sentences maximum. Specific and direct. Not vague.
- The months should build on each other narratively — show a journey unfolding, not isolated snapshots.`

function quarterSummary(months: string[]): string {
  if (months.length <= 3) return months.join(', ')
  const q1 = months.slice(0, 3)
  const q2 = months.slice(3, 6)
  const q3 = months.slice(6, 9)
  const q4 = months.slice(9, 12)
  const quarters = [q1, q2, q3, q4].filter((q) => q.length > 0)
  return quarters.map((q) => q.join('–')).join(', ')
}

export function buildFutureSectionInstruction(
  now: Date = new Date(),
  futureTimeframe?: string
): string {
  const currentMonthIdx = now.getMonth()
  const allFutureMonths = MONTH_NAMES.slice(currentMonthIdx) // current month through December

  // Helper to generate next N month names from today
  function nextMonths(n: number): string[] {
    const result: string[] = []
    for (let i = 0; i < n; i++) {
      result.push(MONTH_NAMES[(currentMonthIdx + i) % 12])
    }
    return result
  }

  if (futureTimeframe === 'Next 3 months') {
    const months = nextMonths(3)
    return `After the main body of the reading, write a future section titled 'Future Energy — Next 3 Months'.

${CRITICAL_RULES}

Cover the next 3 months in order: ${months.join(', ')}.

${MONTH_FORMAT_RULES}

After the final month, close with 2-3 punchy lines. The most direct and honest lines in the entire reading. No new information. Just the truth landing finally.`
  }

  if (futureTimeframe === 'Next 6 months') {
    const months = nextMonths(6)
    return `After the main body of the reading, write a future section titled 'Future Energy — Next 6 Months'.

${CRITICAL_RULES}

Cover the next 6 months in order: ${months.join(', ')}.

${MONTH_FORMAT_RULES}

After the final month, close with 2-3 punchy lines. The most direct and honest lines in the entire reading. No new information. Just the truth landing finally.`
  }

  if (futureTimeframe === 'Rest of the year') {
    const months = allFutureMonths
    return `After the main body of the reading, write a future section titled 'Future Energy — Rest of the Year'.

${CRITICAL_RULES}

Cover each remaining month of this year in order: ${months.join(', ')}.

${MONTH_FORMAT_RULES}

After the final month, close with 3-5 punchy lines. The most direct and honest lines in the entire reading. No new information. Just the truth landing finally.`
  }

  if (futureTimeframe === 'Full 12 months') {
    const months = nextMonths(12)
    const q1 = months.slice(0, 3).join(', ')
    const q2 = months.slice(3, 6).join(', ')
    const q3 = months.slice(6, 9).join(', ')
    const q4 = months.slice(9, 12).join(', ')
    return `After the main body of the reading, write a future section titled 'Future Energy — The Year Ahead'.

${CRITICAL_RULES}

Cover the next 12 months grouped into four quarters. For each quarter, name the months covered and write 3 sentences max referencing specific cards from this spread.

Quarter 1: ${q1}
Quarter 2: ${q2}
Quarter 3: ${q3}
Quarter 4: ${q4}

Format each quarter as:
[Quarter label: e.g. "Months 1–3 (June–August)"]
3 sentences referencing specific cards. Direct and honest.

After the final quarter, close with 3-5 punchy lines. The most direct and honest lines in the entire reading. No new information. Just the truth landing finally.`
  }

  if (futureTimeframe === '24 months') {
    const year1Months = nextMonths(12)
    const y1q1 = year1Months.slice(0, 3).join(', ')
    const y1q2 = year1Months.slice(3, 6).join(', ')
    const y1q3 = year1Months.slice(6, 9).join(', ')
    const y1q4 = year1Months.slice(9, 12).join(', ')
    return `After the main body of the reading, write a future section titled 'Future Energy — The Next 2 Years'.

${CRITICAL_RULES}

YEAR 1 — broken into four quarters, 3 sentences each, referencing specific cards:
Quarter 1: ${y1q1}
Quarter 2: ${y1q2}
Quarter 3: ${y1q3}
Quarter 4: ${y1q4}

Format Year 1 quarters as:
[Quarter label: e.g. "Year 1, Months 1–3 (June–August)"]
3 sentences referencing specific cards. Direct and honest.

YEAR 2 — broader overview only:
Write 2-3 sentences covering the overall themes and direction for the second year. Reference the cards already read where they speak to longer patterns. Do not break into months or quarters.

After the Year 2 overview, close with 3-5 punchy lines. The most direct and honest lines in the entire reading. No new information. Just the truth landing finally.`
  }

  // Default: month-by-month through December (no timeframe selected, or "Rest of the year" fallback)
  const months = allFutureMonths
  return `After the main body of the reading, write a future section titled 'Future Energy'.

${CRITICAL_RULES}

Break the future down month by month from the current month through to December of this year. Cover these months in order: ${months.join(', ')}.

${MONTH_FORMAT_RULES}

After the final month, close with 3-5 short punchy lines that summarise the overall energy. These should be the most direct and honest lines in the entire reading. No new information. Just the truth landing finally.

Example of CORRECT closing lines:
"You are not the same person you were at the start of this year.

The cards are not asking you to be fearless. They are asking you to move anyway.

What is being built here is real. Let it take the time it needs."

Example of WRONG closing lines — do not write like this:
"You are on a path of great discovery and exploration. Trust in the universe and know that endless possibilities await you. You are strong, you are capable, and you are enough."`
}
