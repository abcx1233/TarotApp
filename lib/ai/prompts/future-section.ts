const FUTURE_STYLE_RULES = `FUTURE SECTION STYLE

Write the title as plain text on its own line, followed by a blank line, then begin the prose. No markdown, no headers, no symbols. Like this:

What I'm Sensing: The Next 6 Months

In the first part of this period...

The future section must flow as continuous prose — not a list of months, not a structured report, not a timeline.

Write as if you are actively channelling and sensing what is coming. You are tuning in — not filing a report.

WHAT IT MUST DO:
- Flow as connected paragraphs with no month name headers
- Use natural time language: "in the first part of this period", "as this moves forward", "around the middle of this", "towards the end of this period", "there's a moment coming that feels significant — watch for it"
- Reference specific cards from this spread to anchor every energy shift — do not write generic future energy
- Build naturally: early period first, then middle, then end — without rigid headers
- Include the specified number of "watch for this" moments — something specific the person should be alert to, tied to a named card
- Close with the specified number of short punchy lines that land as final truth — not a summary

WHAT IT MUST NOT DO:
- Use month names as headers or labels (no "June", "July", "August" etc)
- Feel like a structured report or calendar
- Use the phrases: "this is a good time to", "the energy starts to", "as we move into"
- Repeat the same energy or theme across multiple periods
- Write anything that isn't directly connected to the actual cards in this spread

VOICE — write as if speaking directly:
"In the first part of this period I'm sensing..."
"Something shifts around the middle of this — there's a restlessness coming through the [card name] that feels important"
"Watch for a moment that arrives suddenly — the [card name] in your spread suggests something unexpected that ultimately redirects you"
"By the time this period closes, the energy around you feels noticeably different to where you are now"

EXAMPLE OF CORRECT STYLE — STUDY AND REPLICATE:
"In the first part of this period, the Emperor's energy is asking you to make decisions you've been putting off. There's something about establishing firmer ground — financially, emotionally, or in a relationship — that can't wait much longer. This isn't about being harsh. It's about being clear.

As this moves forward, I'm sensing a shift. The High Priestess starts to come through more strongly, pulling you inward. Something you've been avoiding knowing about yourself begins to surface. Watch for a quiet moment — it might arrive unexpectedly — where something just clicks into place. That's the moment this reading has been pointing toward.

By the later part of this period the 3 of Cups energy arrives and it feels lighter. There are people around you who want to celebrate where you've arrived. Let them.

You are not the same person you were at the start of this.
The cards don't ask you to have it figured out.
They ask you to keep moving.
That's enough."

EXAMPLE OF WRONG STYLE — DO NOT DO THIS:
"### What I'm Sensing: The Next 6 Months

**June**
The Emperor's presence is strong, calling for decisive actions and boundaries.

**July**
The High Priestess asks you to go inward."`

interface TierConfig {
  label: string
  chars: string
  paragraphs: string
  watchMoments: string
  closingLines: string
  depth: string
}

function getTierConfig(tier?: string): TierConfig {
  switch (tier) {
    case 'mini':
      return {
        label: 'Mini',
        chars: '400-600',
        paragraphs: '2-3',
        watchMoments: 'one',
        closingLines: '2-3',
        depth: 'concise and focused',
      }
    case 'premium':
      return {
        label: 'Premium',
        chars: '1200-1600',
        paragraphs: '4-6',
        watchMoments: 'two or three',
        closingLines: '4-5',
        depth: 'deeply explored',
      }
    case 'celtic_cross':
      return {
        label: 'Celtic Cross',
        chars: '700-1000',
        paragraphs: '3-4',
        watchMoments: 'one or two',
        closingLines: '3-4',
        depth: 'developed',
      }
    default:
      return {
        label: 'Core',
        chars: '700-1000',
        paragraphs: '3-4',
        watchMoments: 'one or two',
        closingLines: '3-4',
        depth: 'developed',
      }
  }
}

function tierInstruction(tc: TierConfig, title: string, coverageGuide: string): string {
  return `After the main body of the reading, write a future section. The title is: ${title}

${FUTURE_STYLE_RULES}

${coverageGuide}

The future section for this ${tc.label} reading should be approximately ${tc.chars} characters — ${tc.depth}. Write ${tc.paragraphs} flowing paragraphs. Include ${tc.watchMoments} "watch for this" moment tied to a specific named card from this spread.

Close with ${tc.closingLines} short punchy lines. The most honest lines in the entire reading. No new information — just the truth landing.`
}

export function buildFutureSectionInstruction(
  _now: Date = new Date(),
  futureTimeframe?: string,
  tier?: string
): string {
  const tc = getTierConfig(tier)

  if (futureTimeframe === 'Next 3 months') {
    return tierInstruction(
      tc,
      'What I\'m Sensing: The Next 3 Months',
      'Cover the arc of the next 3 months in flowing prose: the early weeks, a mid-period shift, and the closing energy.'
    )
  }

  if (futureTimeframe === 'Next 6 months') {
    return tierInstruction(
      tc,
      'What I\'m Sensing: The Next 6 Months',
      'Cover the arc of the next 6 months in flowing prose: early period energy, a meaningful mid-period shift, and the energy as the period closes.'
    )
  }

  if (futureTimeframe === 'Rest of the year') {
    return tierInstruction(
      tc,
      'What I\'m Sensing: The Rest of Your Year',
      'Cover the remaining months of this year as a flowing narrative — how the energy builds, where it shifts, and how it resolves as the year closes.'
    )
  }

  if (futureTimeframe === 'Full 12 months') {
    return tierInstruction(
      tc,
      'What I\'m Sensing: The Year Ahead',
      'Cover the full year in flowing prose across four natural phases: the early months, the spring-into-summer energy, the autumn shift, and the year\'s end. Show the overall arc and transformation.'
    )
  }

  if (futureTimeframe === '24 months') {
    return tierInstruction(
      tc,
      'What I\'m Sensing: The Next Two Years',
      'Write Year 1 as a detailed flowing narrative — early period, mid-period shift, and closing energy — with specific card references throughout. Write Year 2 as a broader sense of direction and themes rather than detailed prediction.'
    )
  }

  // Default: no timeframe selected — cover energy moving forward through to year end
  return tierInstruction(
    tc,
    'What I\'m Sensing Ahead',
    'Cover the energy moving forward in flowing prose — through to the end of the year. Use natural time markers without month headers.'
  )
}
