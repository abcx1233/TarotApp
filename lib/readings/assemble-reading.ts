import { AI_CONFIG } from '@/lib/ai/config'
import { buildContinuationPrompt, CONTINUATION_SYSTEM_PROMPT } from '@/lib/ai/prompts/builder'
import { stripReadingDashes } from '@/lib/text/dashes'

/** Same shape as chatComplete, injected so tests can stub the model. */
export type CompleteFn = (systemPrompt: string, userMessage: string, maxTokens?: number) => Promise<string>

export interface AssembleReadingInput {
  /** The first generation call's output, untouched. */
  rawText: string
  characterTarget: number
  /** Cards the continuation may mention, as given to the first call. */
  cardList: string
  /** reading_templates.signoff_text for the default template. */
  templateSignOff?: string | null
  /** reading_templates.disclaimer_text for the default template. */
  disclaimerText?: string | null
  /** Makes continuation calls. chatComplete in production. */
  complete: CompleteFn
}

export interface AssembledReading {
  /** The finished text to save and show: body, add-ons, sign-off, disclaimer. */
  generatedReading: string
  /** The sign-off actually appended. */
  templateSignOff: string
  /** Continuation calls made (including one that threw). */
  continuationAttempts: number
}

function trimAtSentence(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  // Protect the future section and ritual — trim only the main body up to the earliest protected marker
  const protectedMarkers = ["\n\nWhat I'm Sensing", '\n\nA Ritual For You']
  let splitIdx = -1
  for (const marker of protectedMarkers) {
    const idx = text.indexOf(marker)
    if (idx !== -1 && (splitIdx === -1 || idx < splitIdx)) splitIdx = idx
  }
  if (splitIdx !== -1) {
    const body = text.slice(0, splitIdx)
    const tail = text.slice(splitIdx)
    if (body.length <= maxLength) return text // body fits; preserve protected sections as-is
    const sub = body.slice(0, maxLength)
    for (let i = sub.length - 1; i >= 0; i--) {
      if (['.', '!', '?'].includes(sub[i])) return sub.slice(0, i + 1) + tail
    }
    return sub + tail
  }
  const sub = text.slice(0, maxLength)
  for (let i = sub.length - 1; i >= 0; i--) {
    if (['.', '!', '?'].includes(sub[i])) return sub.slice(0, i + 1)
  }
  return sub
}

function truncateAtEndMarker(text: string): string {
  const idx = text.indexOf('[END OF READING]')
  if (idx === -1) return text
  return text.slice(0, idx).trimEnd()
}

function truncateAfterSignOff(text: string, templateSignOff?: string): string {
  const lower = text.toLowerCase()

  // Check variants shortest-first so 'with love and light' matches before longer forms.
  // Always include the template sign-off text as the highest-priority candidate.
  const variants: string[] = [
    'with love and light',
    'with love and light ✨',
    'with love and light.',
  ]
  if (templateSignOff?.trim()) {
    const t = templateSignOff.trim().toLowerCase()
    if (!variants.includes(t)) variants.unshift(t)
  }

  let truncateAt = -1
  for (const variant of variants) {
    const idx = lower.indexOf(variant)
    if (idx !== -1) {
      truncateAt = idx + variant.length
      break
    }
  }

  if (truncateAt !== -1) {
    return text.slice(0, truncateAt).trimEnd()
  }

  return text
}

function truncateAfterClosingLines(text: string): string {
  const paragraphs = text.split(/\n\n+/)
  let lastShortSeqEnd = -1
  let i = 0

  while (i < paragraphs.length) {
    const trimmed = paragraphs[i].trim()
    if (trimmed.length > 0 && trimmed.length < 100) {
      let j = i
      while (j < paragraphs.length && paragraphs[j].trim().length < 100 && paragraphs[j].trim().length > 0) {
        j++
      }
      const seqLen = j - i
      // 3+ consecutive short paragraphs followed by longer content = likely closing lines mid-reading.
      // But if that longer content is the ritual or future section, it's legitimate — don't cut it.
      if (seqLen >= 3 && j < paragraphs.length) {
        const nextPara = paragraphs[j].trim()
        const isLegitFollower =
          nextPara.startsWith('A Ritual For You') ||
          nextPara.startsWith("What I'm Sensing") ||
          nextPara.startsWith('Oracle Card')
        if (!isLegitFollower) {
          lastShortSeqEnd = j - 1
        }
      }
      i = j
    } else {
      i++
    }
  }

  if (lastShortSeqEnd !== -1) {
    return paragraphs.slice(0, lastShortSeqEnd + 1).join('\n\n')
  }

  return text
}

function getMainBodyLength(text: string): number {
  const markers = ["\n\nWhat I'm Sensing", '\n\nOracle Card', '\n\nA Ritual For You']
  let earliest = text.length
  for (const marker of markers) {
    const idx = text.indexOf(marker)
    if (idx !== -1 && idx < earliest) earliest = idx
  }
  return earliest
}

/**
 * Turn the first generation call's output into the finished reading: dash
 * strip, continuation loop (when the main body is short), add-on reassembly,
 * ritual cut, truncation passes, then sign-off and disclaimer.
 *
 * Several model calls can contribute to the result, so dashes are stripped on
 * the fully assembled text right before the sign-off is appended: that final
 * pass is the one that guarantees what gets saved. The early pass on the first
 * call's text is kept so the continuation continues from clean text and the
 * truncation heuristics see the same text as before.
 */
export async function assembleReadingText(input: AssembleReadingInput): Promise<AssembledReading> {
  const { characterTarget, complete } = input

  // Early dash pass on the first call's text (see above; not the final one)
  let rawReading = stripReadingDashes(input.rawText)

  const minLength = Math.floor(characterTarget * 0.85)
  const maxLength = Math.ceil(characterTarget * 1.15)

  // Split rawReading into main body and add-on sections (oracle, ritual, future).
  // Continuations must be appended to the main body only — not after the ritual —
  // otherwise getMainBodyLength() never grows and the loop runs without effect.
  const addonMarkers = ["\n\nWhat I'm Sensing", '\n\nOracle Card', '\n\nA Ritual For You']
  let addonStart = rawReading.length
  for (const marker of addonMarkers) {
    const idx = rawReading.indexOf(marker)
    if (idx !== -1 && idx < addonStart) addonStart = idx
  }
  let mainBody = rawReading.slice(0, addonStart)
  const addons = rawReading.slice(addonStart)

  console.log('Continuation check:', mainBody.length, '/', characterTarget, 'needs:', mainBody.length < characterTarget * 0.85)

  const maxAttempts = characterTarget >= 10000 ? 4 : 2
  let attempts = 0
  while (mainBody.length < minLength && attempts < maxAttempts) {
    attempts++
    const currentLength = mainBody.length
    const tail = mainBody.slice(-2000)
    try {
      const continuationText = await complete(
        CONTINUATION_SYSTEM_PROMPT,
        buildContinuationPrompt({ currentLength, minLength, cardList: input.cardList, tail }),
        AI_CONFIG.maxTokens
      )
      console.log(`Continuation ${attempts} generated:`, continuationText.length, 'chars')
      const cleanContinuation = continuationText.replace(/\[END OF READING\]/g, '').trim()
      mainBody = mainBody + '\n\n' + cleanContinuation
      console.log('rawReading after append: main body now', mainBody.length, 'chars')
      console.log(`After continuation ${attempts}:`, mainBody.length, '/', characterTarget, 'chars')
    } catch {
      break
    }
  }

  // Reassemble with add-ons now that the main body is at target length
  rawReading = mainBody + addons

  // Hard-cut ritual to at most 700 chars of content after the heading.
  // Runs once after all continuations are complete.
  const ritualIdx = rawReading.indexOf('A Ritual For You')
  if (ritualIdx !== -1) {
    const contentStart = rawReading.indexOf('\n', ritualIdx)
    if (contentStart !== -1) {
      // Find the FIRST sentence end after at least 150 chars of ritual content.
      // Using indexOf (not lastIndexOf) so we cut at the end of the first paragraph,
      // not the end of a second paragraph that the model may have added.
      let cutPoint = -1
      for (let i = contentStart + 150; i < Math.min(contentStart + 700, rawReading.length); i++) {
        const ch = rawReading[i]
        if (ch === '.' || ch === '!' || ch === '?') {
          cutPoint = i + 1
          break
        }
      }
      if (cutPoint !== -1) {
        const removed = rawReading.slice(cutPoint)
        if (removed.trim().length > 50) {
          console.log('Ritual paragraph kept:', rawReading.slice(ritualIdx, ritualIdx + 300))
          rawReading = rawReading.slice(0, cutPoint)
          console.log('Ritual hard cut at:', cutPoint, 'removed:', removed.trim().length, 'chars')
        }
      }
    }
  }

  console.log('Future section included:', rawReading.includes("What I'm Sensing"))
  console.log('END OF READING marker found:', rawReading.includes('[END OF READING]'))
  console.log('Raw text last 200 chars:', rawReading.slice(-200))

  // Truncate at [END OF READING] marker (primary mechanism), then sign-off detection
  let finalReading = truncateAtEndMarker(rawReading)
  finalReading = truncateAfterSignOff(finalReading, input.templateSignOff ?? undefined)

  if (finalReading.length > maxLength) {
    finalReading = trimAtSentence(finalReading, maxLength)
  }

  // Heuristic closing-lines detection (catches cases where marker was not used)
  finalReading = truncateAfterClosingLines(finalReading)

  // Final safety pass: marker then sign-off
  finalReading = truncateAtEndMarker(finalReading)
  finalReading = truncateAfterSignOff(finalReading, input.templateSignOff ?? undefined)

  const mainBodyLength = getMainBodyLength(finalReading)
  const lengthStatus =
    mainBodyLength < minLength ? 'SHORT' :
    mainBodyLength > maxLength ? 'TRIMMED' : 'PASS'
  console.log(`Main body: ${mainBodyLength} chars / ${characterTarget} target — ${lengthStatus} (total: ${finalReading.length} chars)`)

  // Strip any sign-off the model may have added, then always append the template sign-off.
  const templateSignOff = input.templateSignOff?.trim() || 'With love and light ✨'
  const signOffVariants = [
    'with love and light',
    'with love and light ✨',
    'with love and light.',
  ]
  let generatedReading = finalReading
  for (const variant of signOffVariants) {
    const idx = generatedReading.toLowerCase().lastIndexOf(variant.toLowerCase())
    if (idx !== -1) {
      generatedReading = generatedReading.slice(0, idx).trimEnd()
    }
  }
  // Final dash pass on the fully assembled text, whichever calls produced it.
  // The sign-off and disclaimer are appended after it: they are the reader's
  // own template text, not model output.
  generatedReading = stripReadingDashes(generatedReading)

  generatedReading = generatedReading + '\n\n' + templateSignOff
  if (input.disclaimerText?.trim()) {
    generatedReading += `\n\n${input.disclaimerText.trim()}`
  }

  return { generatedReading, templateSignOff, continuationAttempts: attempts }
}
