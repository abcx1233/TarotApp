const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function buildFutureSectionInstruction(now: Date = new Date()): string {
  const months = MONTH_NAMES.slice(now.getMonth()) // current month through December

  return `After the main body of the reading, write a future section titled 'Future Energy'.

Break the future down month by month from the current month through to December of this year. Cover these months in order: ${months.join(', ')}.

Format each month as:
[Month Name]
One paragraph of 3-5 sentences describing the energy, themes and likely events for that period.

Keep each month entry concise but specific — not generic. Connect the future energy to the cards already read where possible.

After the final month, close with 3-5 short punchy lines that summarise the overall energy for the year ahead. Make this feel like a meaningful close — not a summary, more like a final truth landing.

Example format:

June
This period feels emotionally intense but clarifying. You may begin recognising where your energy has been drained. Sudden truths emerge. Something you have been avoiding becomes impossible to ignore.

July
The Tower energy becomes stronger here. Sudden changes or emotional revelations could occur. Something unstable may crack open. While overwhelming at first, this ultimately redirects your path.

[Continue through to December]

You are leaving behind survival mode and entering reconstruction.

The life that is falling away is not punishment. It is misalignment being cleared so your real future can finally begin.`
}
