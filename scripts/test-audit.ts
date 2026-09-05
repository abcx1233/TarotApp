/**
 * Behavioural tests for the post-generation reading audit (lib/ai/audit).
 *
 *   npx tsx scripts/test-audit.ts
 *
 * No test framework — a plain script with a five-line harness, runnable by hand.
 * Exits 0 when everything passes, 1 on the first failing run, so it also works
 * as a pre-commit or CI step if that is ever wanted.
 *
 * Fully offline. OPENAI_API_KEY is deleted below, which makes getOpenAIClient()
 * throw before any request is made, so the model-backed checks exercise their
 * degraded path without a network call or a penny of spend.
 *
 * ── Why this file exists ──────────────────────────────────────────────────────
 * Card matching is the part of the audit most likely to regress quietly. It has
 * to tell "you'll find strength in this" from the card Strength, and treat
 * "6 of Cups" and "Six of Cups" as the same card. Both behaviours are invisible
 * until they are wrong, and then they are wrong on every reading. RERUN THIS
 * AFTER ANY CHANGE TO data/tarot-cards.ts — renaming a card, or adding one whose
 * name is an ordinary English word, is exactly what breaks it.
 *
 * If a card name that doubles as a common word is added to the catalogue, it
 * also needs adding to AMBIGUOUS_CARD_NAMES in lib/ai/audit/card-matching.ts, or
 * ordinary prose will start registering as a card mention.
 */

// Must happen before the audit modules resolve their client.
delete process.env.OPENAI_API_KEY

import { findMentionedCards, mentionsCard } from '@/lib/ai/audit/card-matching'
import { mainBodyLength, runDeterministicChecks } from '@/lib/ai/audit/deterministic'
import { auditReading, scoreToBand, type AuditCheck } from '@/lib/ai/audit'

let passed = 0
let failed = 0

function t(name: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++
    return
  }
  failed++
  console.log(`  ✗ ${name}`)
  console.log(`      expected  ${JSON.stringify(expected)}`)
  console.log(`      actual    ${JSON.stringify(actual)}`)
}

function section(name: string): void {
  console.log(`\n${name}`)
}

/** Collapse a check list to { id: status } for compact assertions. */
function statuses(checks: AuditCheck[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of checks) out[c.id] = c.status
  return out
}

/** A clean reading: two drawn cards, both mentioned, no add-ons, correct trailer. */
const BASE = {
  finalText:
    'The Tower fell. The 3 of Wands waits.\n\nWith love and light ✨\n\nFor entertainment only.',
  drawnCards: ['The Tower', '3 of Wands'],
  bottomCard: null as string | null,
  oracleCardName: null as string | null,
  includeOracleCard: false,
  includeEnergyCleansing: false,
  characterTarget: 30,
  signOffText: 'With love and light ✨',
  disclaimerText: 'For entertainment only.',
  topic: 'Career',
  questionOrFocus: null as string | null,
  specificQuestion: null as string | null,
}

async function main(): Promise<void> {
  // ── Card matching ──────────────────────────────────────────────────────────
  section('Card matching')
  t('exact major arcana', mentionsCard('The Tower appeared today.', 'The Tower'), true)

  // The ambiguity rule: these Majors are ordinary English words, so only the
  // canonical capitalisation counts as a card reference.
  t('lowercase prose is not Strength', mentionsCard("you'll find strength in this", 'Strength'), false)
  t('capitalised Strength is Strength', mentionsCard('Strength sits beside it.', 'Strength'), true)
  t('lowercase prose is not Death', mentionsCard('the death of that idea', 'Death'), false)

  // Rank normalisation: the catalogue uses numerals, models often write words.
  t('numeral card, numeral text', mentionsCard('The 6 of Cups shows up.', '6 of Cups'), true)
  t('numeral card, worded text', mentionsCard('The Six of Cups shows up.', '6 of Cups'), true)
  t('worded rank, lowercase', mentionsCard('the six of cups shows up', '6 of Cups'), true)
  t('court card', mentionsCard('Queen of Swords is here.', 'Queen of Swords'), true)

  // Word boundaries, both directions.
  t('not a substring hit', mentionsCard('Ace of Cupsy', 'Ace of Cups'), false)
  t('"ten years" is not a card', mentionsCard('ten years ago', '10 of Cups'), false)

  // Unambiguous names never occur in prose, so case does not matter for them.
  t('unambiguous major, any case', mentionsCard('the high priestess watches', 'The High Priestess'), true)

  t(
    'catalogue scan finds exactly the referenced cards',
    findMentionedCards('The Tower fell, and Strength held. Also the 3 of Wands.').sort(),
    ['3 of Wands', 'Strength', 'The Tower']
  )

  // ── Body length ────────────────────────────────────────────────────────────
  section('Main body length')
  t(
    'stops at the ritual marker, excludes the sign-off',
    mainBodyLength(
      'Body text here.\n\nA Ritual For You\nritual stuff\n\nWith love and light',
      'With love and light',
      null
    ),
    'Body text here.'.length
  )

  // ── Deterministic checks ───────────────────────────────────────────────────
  section('Deterministic checks')
  t('a clean reading passes everything applicable', statuses(runDeterministicChecks(BASE)), {
    card_hallucination: 'pass',
    card_omission: 'pass',
    addon_oracle: 'n-a',
    addon_energy_cleansing: 'n-a',
    length: 'pass',
    signoff_disclaimer: 'pass',
    stray_dashes: 'pass',
  })

  t(
    'a card that was never drawn fails',
    statuses(
      runDeterministicChecks({
        ...BASE,
        finalText: BASE.finalText.replace('The Tower fell.', 'The Tower fell and Death arrived.'),
      })
    ).card_hallucination,
    'fail'
  )

  // The bottom-of-deck card is context the model was given: legitimate to name,
  // never required to name.
  t(
    'mentioning the bottom card is allowed',
    statuses(
      runDeterministicChecks({
        ...BASE,
        bottomCard: 'The Star',
        finalText: BASE.finalText.replace('The Tower fell.', 'The Tower fell under The Star.'),
      })
    ).card_hallucination,
    'pass'
  )
  t(
    'omitting the bottom card is not an omission',
    statuses(runDeterministicChecks({ ...BASE, bottomCard: 'The Star' })).card_omission,
    'pass'
  )
  t(
    'omitting a drawn card fails',
    statuses(
      runDeterministicChecks({ ...BASE, drawnCards: ['The Tower', '3 of Wands', 'The Moon'] })
    ).card_omission,
    'fail'
  )

  t(
    'ordered oracle card with no section fails',
    statuses(
      runDeterministicChecks({ ...BASE, includeOracleCard: true, oracleCardName: 'Trust' })
    ).addon_oracle,
    'fail'
  )

  // route.ts rewrites the em-dash heading to a colon while repairing dash
  // stripping, so the colon form is what actually reaches the database. Both
  // must pass or this check fails on every single reading.
  t(
    'oracle heading with a colon passes',
    statuses(
      runDeterministicChecks({
        ...BASE,
        includeOracleCard: true,
        oracleCardName: 'Trust',
        finalText: `${BASE.finalText}\n\nOracle Card: Trust\nmore text`,
      })
    ).addon_oracle,
    'pass'
  )
  t(
    'oracle heading with an em dash passes',
    statuses(
      runDeterministicChecks({
        ...BASE,
        includeOracleCard: true,
        oracleCardName: 'Trust',
        finalText: `${BASE.finalText}\n\nOracle Card — Trust\nmore text`,
      })
    ).addon_oracle,
    'pass'
  )

  t(
    'ordered energy cleansing with no ritual fails',
    statuses(runDeterministicChecks({ ...BASE, includeEnergyCleansing: true })).addon_energy_cleansing,
    'fail'
  )
  t(
    'ritual present passes',
    statuses(
      runDeterministicChecks({
        ...BASE,
        includeEnergyCleansing: true,
        finalText: `${BASE.finalText}\n\nA Ritual For You\nlight a candle`,
      })
    ).addon_energy_cleansing,
    'pass'
  )

  t(
    'body more than 15% under target fails',
    statuses(runDeterministicChecks({ ...BASE, characterTarget: 5000 })).length,
    'fail'
  )
  t(
    'missing disclaimer fails',
    statuses(runDeterministicChecks({ ...BASE, disclaimerText: 'Nowhere to be found.' }))
      .signoff_disclaimer,
    'fail'
  )
  t(
    'a surviving em dash fails',
    statuses(runDeterministicChecks({ ...BASE, finalText: `${BASE.finalText} and — this` }))
      .stray_dashes,
    'fail'
  )

  // ── Score bands ────────────────────────────────────────────────────────────
  section('Score bands')
  t('100 is green', scoreToBand(100), 'green')
  t('90 is green (lower edge)', scoreToBand(90), 'green')
  t('89 is amber (upper edge)', scoreToBand(89), 'amber')
  t('70 is amber (lower edge)', scoreToBand(70), 'amber')
  t('69 is red (upper edge)', scoreToBand(69), 'red')
  t('0 is red', scoreToBand(0), 'red')

  // ── Degraded path ──────────────────────────────────────────────────────────
  // With no API key the model call throws. The audit must survive that, say so,
  // and must not let the unrun checks read as passes.
  section('Degraded path (model call unavailable)')
  const degraded = await auditReading(BASE)
  t('does not throw', typeof degraded.score, 'number')
  t('degraded flag is set', degraded.degraded, true)
  t(
    'relevance is skipped, not passed',
    degraded.checks.find((c) => c.id === 'topic_question_relevance')?.status,
    'skipped'
  )
  t(
    'voice is skipped when no banned phrase is present',
    degraded.checks.find((c) => c.id === 'voice_drift')?.status,
    'skipped'
  )
  t('a skipped check deducts nothing', degraded.score, 100)
  t('band still reflects the deterministic result', degraded.band, 'green')
  t('all nine checks are reported', degraded.checks.length, 9)

  // ── Banned phrases without the model ───────────────────────────────────────
  // The verbatim half of the voice check is done in code, so it still works when
  // the model call has failed.
  section('Banned phrases without the model')
  const banned = await auditReading({
    ...BASE,
    finalText:
      'The Tower fell, a truly profound tapestry. The 3 of Wands waits.\n\nWith love and light ✨\n\nFor entertainment only.',
  })
  const voice = banned.checks.find((c) => c.id === 'voice_drift')
  t('voice fails on a verbatim ban', voice?.status, 'fail')
  t('the reason names the offending phrase', /profound|tapestry/.test(voice?.reason ?? ''), true)
  t('score is 100 − 12', banned.score, 88)
  t('a single style failure lands in amber, never green', banned.band, 'amber')

  // ── Stacked hard failures ──────────────────────────────────────────────────
  section('Stacked hard failures')
  const hard = await auditReading({
    ...BASE,
    finalText: 'The Tower fell and Death arrived.\n\nWith love and light ✨\n\nFor entertainment only.',
    includeOracleCard: true,
    oracleCardName: 'Trust',
    includeEnergyCleansing: true,
  })
  const hardStatuses = statuses(hard.checks)
  t('hallucination fails', hardStatuses.card_hallucination, 'fail')
  t('omission fails', hardStatuses.card_omission, 'fail')
  t('oracle add-on fails', hardStatuses.addon_oracle, 'fail')
  t('energy cleansing add-on fails', hardStatuses.addon_energy_cleansing, 'fail')
  t('score floors at 0 rather than going negative', hard.score, 0)
  t('red', hard.band, 'red')

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('\nTest run crashed:', err)
  process.exit(1)
})
