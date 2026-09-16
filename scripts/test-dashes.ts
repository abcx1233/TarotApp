/**
 * Behavioural tests for dash stripping (lib/text/dashes.ts) and the reading
 * pipeline that applies it (lib/readings/assemble-reading.ts).
 *
 *   npx tsx scripts/test-dashes.ts
 *
 * No test framework, same five-line harness as scripts/test-audit.ts. Exits 0
 * when everything passes, 1 otherwise. Fully offline: every model call is a
 * stub passed in as `complete`, and nothing touches Supabase.
 *
 * ── Why this file exists ──────────────────────────────────────────────────────
 * Readings were saved with em dashes despite the route's dash strip, because the
 * strip ran on the first model call's text before the continuation loop added
 * more (see docs/known-issues.md on docs/dash-bug-notes). The sections below
 * follow that document's six "what would need testing" scenarios, then cover
 * the widened character set, the cleanup artifacts and the continuation prompt.
 *
 * Dash characters are built from code points rather than typed, so a test can't
 * silently compare an em dash with a look-alike.
 */

delete process.env.OPENAI_API_KEY

import { runDeterministicChecks, type DeterministicAuditInput } from '@/lib/ai/audit/deterministic'
import { BANNED_PHRASES } from '@/lib/ai/audit/banned-phrases'
import { BANNED_VOCABULARY, DASH_RULE, buildContinuationPrompt, buildPrompt } from '@/lib/ai/prompts/builder'
import { assembleReadingText, type CompleteFn } from '@/lib/readings/assemble-reading'
import { buildDraftReadingPayload } from '@/lib/readings/draft-payload'
import { stripDashes, stripReadingDashes } from '@/lib/text/dashes'
import type { ReadingFormState } from '@/types'

const log = console.log
let passed = 0
let failed = 0

function t(name: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++
    return
  }
  failed++
  log(`  ✗ ${name}`)
  log(`      expected  ${JSON.stringify(expected)}`)
  log(`      actual    ${JSON.stringify(actual)}`)
}

function section(name: string): void {
  log(`\n${name}`)
}

const ch = (codePoint: number) => String.fromCharCode(codePoint)
const hex = (codePoint: number) => `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`

const EM = ch(0x2014)
const EN = ch(0x2013)

/** Every character the strip must treat as a dash. */
const DASH_CODE_POINTS = [0x2012, 0x2013, 0x2014, 0x2015, 0x2212, 0x2e3a, 0x2e3b, 0xfe58, 0xfe63, 0xff0d]
/** Any of the above, or "--": what must never survive into a saved reading. */
const ANY_DASH = new RegExp(`[${DASH_CODE_POINTS.map(ch).join('')}]|--`)

/** The audit's stray-dash verdict for a piece of text. */
function strayDashStatus(text: string): string {
  const input: DeterministicAuditInput = {
    finalText: text,
    drawnCards: [],
    includeOracleCard: false,
    includeEnergyCleansing: false,
    characterTarget: 1,
    signOffText: '',
  }
  return runDeterministicChecks(input).find((c) => c.id === 'stray_dashes')?.status ?? 'missing'
}

/** A continuation stub that returns `texts` in turn and records every call. */
function stubModel(texts: Array<string | Error>): { complete: CompleteFn; calls: Array<{ system: string; user: string }> } {
  const calls: Array<{ system: string; user: string }> = []
  const complete: CompleteFn = async (system, user) => {
    calls.push({ system, user })
    const next = texts[Math.min(calls.length - 1, texts.length - 1)]
    if (next instanceof Error) throw next
    return next
  }
  return { complete, calls }
}

/** Run the pipeline with its console.log progress lines muted. */
async function assemble(rawText: string, characterTarget: number, complete: CompleteFn) {
  console.log = () => {}
  try {
    return await assembleReadingText({
      rawText,
      characterTarget,
      cardList: 'The Tower, The Star, The Moon (bottom of deck)',
      templateSignOff: 'With love and light',
      disclaimerText: 'For entertainment only.',
      complete,
    })
  } finally {
    console.log = log
  }
}

/** `n` sentences of plain prose, about 85 characters each. */
const prose = (n: number, word: string) =>
  Array.from({ length: n }, (_, i) => `The ${word} keeps returning in sentence ${i} because you already know what it is asking.`).join(' ')

async function main(): Promise<void> {
  // ── 1. Reproduce: dashes written by a continuation call ────────────────────
  // The reported bug. The first call's main body is under 85% of target, so the
  // pipeline makes a continuation call, and that call's text contains em dashes.
  // Before the fix they reached generatedReading; the early strip had already run.
  section('1. Continuation text is stripped')
  const shortFirstCall =
    `${prose(20, 'Tower')}\n\nWhat I'm Sensing: The Next 3 Months\n\nThe weeks ahead move quickly.\n\n[END OF READING]`
  const dashedContinuation =
    `There is a shadow aspect at play${EM}a hesitancy to embrace potential endings. ${prose(40, 'Star')}\n\n` +
    `This matters ${EM} more than you admit.\n\n[END OF READING]`
  const reproModel = stubModel([dashedContinuation])
  const repro = await assemble(shortFirstCall, 6000, reproModel.complete)
  t('the continuation loop actually ran', repro.continuationAttempts, 1)
  t('and its text reaches the output', repro.generatedReading.includes('There is a shadow aspect at play'), true)
  t('no dash from the continuation survives', ANY_DASH.test(repro.generatedReading), false)
  t(
    'the reported sentence comes out as clean prose',
    repro.generatedReading.includes('a shadow aspect at play, a hesitancy to embrace potential endings.'),
    true
  )
  t('a spaced dash in the continuation leaves no double space', repro.generatedReading.includes('This matters, more than you admit.'), true)
  t('the audit agrees', strayDashStatus(repro.generatedReading), 'pass')

  const longFirstCall = `${prose(64, 'Tower')} It is${EM}and always was${EM}yours.\n\n[END OF READING]`
  const noContinuationModel = stubModel([new Error('must not be called')])
  const noContinuation = await assemble(longFirstCall, 6000, noContinuationModel.complete)
  t('the same text with no continuation needed makes no call', noContinuationModel.calls.length, 0)
  t('and also comes out clean', noContinuation.generatedReading.includes('It is, and always was, yours.'), true)

  // ── 2. Frequency: every continuation, however many run ─────────────────────
  // Continuation is common (a 6000 target got a 2920-character first body in the
  // logged case), and a 12k Premium reading can make four calls. Every one of
  // them has to be covered, including a loop cut short by a failing call.
  section('2. Every continuation call is covered')
  // The future section keeps [END OF READING] out of the main body. Without an
  // add-on after the body, continuations land after the marker and truncation
  // discards them (a separate, pre-existing problem), which would make these
  // assertions pass without testing anything.
  const tinyFirstCall = `${prose(5, 'Moon')}\n\nWhat I'm Sensing: The Year Ahead\n\nThe year turns.\n\n[END OF READING]`
  const shortDashedChunk = `Another layer${EN}deeper this time. ${prose(15, 'Moon')}`
  const premiumModel = stubModel([shortDashedChunk])
  const premium = await assemble(tinyFirstCall, 12000, premiumModel.complete)
  t('a 12k reading makes all four continuation calls', premium.continuationAttempts, 4)
  t(
    'all four continuations reach the output',
    premium.generatedReading.split('Another layer, deeper this time.').length - 1,
    4
  )
  t('no dash from any of the four survives', ANY_DASH.test(premium.generatedReading), false)

  const failingModel = stubModel([shortDashedChunk, new Error('model unavailable')])
  const cutShort = await assemble(tinyFirstCall, 12000, failingModel.complete)
  t('a loop cut short by a failing call stops at the failure', cutShort.continuationAttempts, 2)
  t('the one continuation that arrived reaches the output', cutShort.generatedReading.includes('Another layer, deeper this time.'), true)
  t('and is still stripped', ANY_DASH.test(cutShort.generatedReading), false)

  // ── 3. No second path: dashes anywhere in a single-call reading ────────────
  // With no continuation, every section of the first call is covered: main
  // body, Oracle Card heading and section, ritual, future section and closing
  // lines. The final pass runs on the whole assembled text, so there is no
  // section it can miss.
  section('3. Every section of a single-call reading is covered')
  // In the order the prompt asks for: body and closing lines, Oracle Card,
  // future section, then the ritual last (the pipeline cuts after its first
  // paragraph).
  const allSections =
    `${prose(64, 'Tower')} Something shifts${EM}slowly.\n\n` +
    `You know.\n\nYou always did${EM}\n\nThat is enough.\n\n` +
    `Oracle Card ${EM} Trust\nTrust asks you${EN}gently${EN}to stop testing it.\n\n` +
    `What I'm Sensing: The Next 3${EN}6 Months\n\nThe spring brings movement${EM}finally.\n\n` +
    `A Ritual For You\nLight a candle${EM}just one. ${prose(2, 'candle')}\n\n[END OF READING]`
  const singleCallModel = stubModel([new Error('must not be called')])
  const singleCall = await assemble(allSections, 6000, singleCallModel.complete)
  t('no continuation call was made', singleCallModel.calls.length, 0)
  t('no dash survives in any section', ANY_DASH.test(singleCall.generatedReading), false)
  t('the Oracle Card heading is restored with a colon', singleCall.generatedReading.includes('\n\nOracle Card: Trust\n'), true)
  t('the future heading range reads naturally', singleCall.generatedReading.includes("What I'm Sensing: The Next 3 to 6 Months"), true)
  t('the audit agrees', strayDashStatus(singleCall.generatedReading), 'pass')
  t(
    'the template sign-off and disclaimer are appended after the final pass',
    singleCall.generatedReading.endsWith('\n\nWith love and light\n\nFor entertainment only.'),
    true
  )

  // ── 4. Other dash characters: stripped and detected ─────────────────────────
  // The strip and the audit's STRAY_DASH share one character set, so everything
  // the strip removes is also what the audit flags if it ever gets through.
  section('4. Widened character set: stripped and detected')
  for (const codePoint of DASH_CODE_POINTS) {
    t(`${hex(codePoint)} is stripped`, stripDashes(`at play${ch(codePoint)}a hesitancy`), 'at play, a hesitancy')
    t(`${hex(codePoint)} is detected by the audit`, strayDashStatus(`at play${ch(codePoint)}a hesitancy`), 'fail')
  }
  t('ASCII "--" is stripped', stripDashes('at play--a hesitancy'), 'at play, a hesitancy')
  t('ASCII " -- " is stripped', stripDashes('at play -- a hesitancy'), 'at play, a hesitancy')
  t('ASCII "---" is stripped', stripDashes('at play---a hesitancy'), 'at play, a hesitancy')
  t('ASCII "--" is detected by the audit', strayDashStatus('at play--a hesitancy'), 'fail')

  const hyphenated = `self-worth, March-May, well${ch(0x2010)}being, non${ch(0x2011)}stop`
  t('real hyphens are left alone', stripDashes(hyphenated), hyphenated)
  t('and are not flagged by the audit', strayDashStatus(hyphenated), 'pass')
  t('a spaced single ASCII hyphen is left alone', stripDashes('spring (March - May)'), 'spring (March - May)')

  // ── 5. Save Draft ───────────────────────────────────────────────────────────
  // Save Draft stored the browser's text as-is. It now gets the same final pass.
  section('5. Save Draft stores stripped text')
  const draftForm = (generatedReading: string | null) =>
    ({ generatedReading, bottomCard: { name: '', orientation: 'upright' }, cards: [] }) as unknown as ReadingFormState
  t(
    'an edited draft with dashes is saved stripped',
    buildDraftReadingPayload(draftForm(`Pasted in${EM}by hand.\n\n${EN} and this too`), 'order-1', null).generated_reading,
    'Pasted in, by hand.\n\nAnd this too'
  )
  t(
    'the Oracle Card heading is restored the same way',
    buildDraftReadingPayload(draftForm(`Body.\n\nOracle Card ${EM} Trust\nText.`), 'order-1', null).generated_reading,
    'Body.\n\nOracle Card: Trust\nText.'
  )
  t('a draft with no reading yet stays null', buildDraftReadingPayload(draftForm(null), 'order-1', null).generated_reading, null)
  t('an empty reading stays empty', buildDraftReadingPayload(draftForm(''), 'order-1', null).generated_reading, '')
  t('clean text is saved unchanged', buildDraftReadingPayload(draftForm('Clean text.'), 'order-1', null).generated_reading, 'Clean text.')

  // ── 6. Daily messages ───────────────────────────────────────────────────────
  // Both daily-message paths make one model call, then stripDashes(...).trim().
  // They have no continuation, so they were never affected by the bug itself;
  // they now share the widened set and the artifact fixes. The paths call
  // Supabase directly, so this covers the transformation they apply, not the
  // wiring.
  section('6. Daily-message text')
  t(
    'a daily message is stripped and trimmed as both paths do',
    stripDashes(`${EM} Today asks for patience${EM}not force.\n\nThe Star ${ch(0x2015)} hope, quietly.\n`).trim(),
    'Today asks for patience, not force.\n\nThe Star, hope, quietly.'
  )

  // ── Cleanup artifacts ───────────────────────────────────────────────────────
  // A stripped dash must leave ordinary prose, not a mark of its own.
  section('Cleanup: no artifacts left behind')
  t('dash opening a paragraph: no comma, blank line kept, capitalised', stripDashes(`First paragraph.\n\n${EM} a line`), 'First paragraph.\n\nA line')
  t('dash opening the text', stripDashes(`${EM} a line`), 'A line')
  t('spaced dash: single space', stripDashes(`at play ${EM} a hesitancy`), 'at play, a hesitancy')
  t('unspaced dash', stripDashes(`at play${EM}a hesitancy`), 'at play, a hesitancy')
  t('dash with space on one side only', stripDashes(`at play ${EM}a hesitancy`), 'at play, a hesitancy')
  t('dash ending a line: nothing left', stripDashes(`It ended ${EM}\n\nNext`), 'It ended\n\nNext')
  t('dash ending the text', stripDashes(`It ended${EM}`), 'It ended')
  t('dash before a full stop', stripDashes(`wait${EM}.`), 'wait.')
  t('dash before a comma', stripDashes(`wait ${EM}, then`), 'wait, then')
  t('dash after a full stop', stripDashes(`It ended.${EM}Then`), 'It ended. Then')
  t('dash after a comma: no double comma', stripDashes(`slowly, ${EM} then`), 'slowly, then')
  t('dash after an opening bracket', stripDashes(`(${EM}quietly)`), '(quietly)')
  t('dash before a closing straight quote', stripDashes(`She said "wait${EM}" and left`), 'She said "wait" and left')
  t('dash before an opening straight quote', stripDashes(`The message is${EM}"stop"`), 'The message is, "stop"')
  t('number range', stripDashes(`the next 3${EN}6 months`), 'the next 3 to 6 months')
  t('spaced number range', stripDashes(`from 2025 ${EN} 2026`), 'from 2025 to 2026')
  t('two dashes in a row count once', stripDashes(`a ${EM} ${EM} b and c${EM}${EM}d`), 'a, b and c, d')
  t('divider line removed, one paragraph break kept', stripDashes('A\n\n---\n\nB'), 'A\n\nB')
  t('consecutive divider lines', stripDashes(`A\n---\n${EM}${EM}\nB`), 'A\n\nB')
  t('divider at the start and end', stripDashes('---\n\nA\n\n---'), 'A')
  t('Oracle heading on its own line is not joined to the next', stripReadingDashes(`Oracle Card ${EM}\nTrust`), 'Oracle Card\nTrust')
  t('an existing colon heading is unchanged', stripReadingDashes('Oracle Card: Trust'), 'Oracle Card: Trust')
  t('text without dashes is unchanged, line breaks included', stripDashes("That's enough.  \nKeep going.\n\nNew para."), "That's enough.  \nKeep going.\n\nNew para.")

  const messy = `${EM} one ${EM}${EM} two.${EM}Three (${EM}four${EM}) "five${EM}"\n---\n6${EN}7 --\n${EN}`
  t('stripping is idempotent', stripDashes(stripDashes(messy)), stripDashes(messy))
  t('and leaves no dash, double space or space before a comma', /--|  | ,/.test(stripDashes(messy)) || ANY_DASH.test(stripDashes(messy)), false)

  // ── Continuation prompt ─────────────────────────────────────────────────────
  // The continuation now carries the style guide's banned vocabulary and the
  // dash rule, and no longer suggests a banned phrase itself.
  section('Continuation prompt')
  const continuationPrompt = buildContinuationPrompt({
    currentLength: 2920,
    minLength: 5100,
    cardList: 'The Tower, The Star',
    tail: 'TAIL OF THE READING',
  })
  t('includes the dash rule', continuationPrompt.includes(DASH_RULE), true)
  t('includes the banned vocabulary', continuationPrompt.includes(BANNED_VOCABULARY), true)
  t('the rules come before the reading tail', continuationPrompt.indexOf(DASH_RULE) < continuationPrompt.indexOf('TAIL OF THE READING'), true)
  t('still ends with the tail', continuationPrompt.endsWith('...\nTAIL OF THE READING'), true)
  t('still names the lengths and cards', ['2920', '5100', '2180', 'The Tower, The Star'].every((s) => continuationPrompt.includes(s)), true)
  const ownInstructions = continuationPrompt
    .replace(BANNED_VOCABULARY, '')
    .replace(DASH_RULE, '')
    .replace('TAIL OF THE READING', '')
    .toLowerCase()
  t(
    'its own instructions use no banned phrase ("shadow aspect" was one)',
    BANNED_PHRASES.filter((phrase) => ownInstructions.includes(phrase)),
    []
  )
  t('the pipeline sends exactly this prompt', reproModel.calls[0]?.user.includes(DASH_RULE) && reproModel.calls[0]?.user.includes(BANNED_VOCABULARY), true)

  const mainPrompt = buildPrompt({
    tonePresetText: 'Warm.',
    characterTarget: 6000,
    topic: 'Love',
    cards: [{ name: 'The Tower', orientation: 'upright' }],
    bottomCard: { name: 'The Star', orientation: 'upright' },
  })
  t('the main prompt still carries both, from the same constants', mainPrompt.includes(DASH_RULE) && mainPrompt.includes(BANNED_VOCABULARY), true)

  log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.log = log
  console.error('\nTest run crashed:', err)
  process.exit(1)
})
