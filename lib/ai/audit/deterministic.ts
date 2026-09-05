import { cardKey, findMentionedCards, mentionsCard } from './card-matching'
import { type AuditCheck, fail, notApplicable, pass } from './types'

export interface DeterministicAuditInput {
  /** The finished reading, post-truncation, with sign-off and disclaimer appended. */
  finalText: string
  /** Cards actually drawn for this reading, excluding the bottom-of-deck card. */
  drawnCards: string[]
  bottomCard?: string | null
  oracleCardName?: string | null
  includeOracleCard: boolean
  includeEnergyCleansing: boolean
  characterTarget: number
  /** Resolved sign-off, including the route's fallback when no template sets one. */
  signOffText: string
  disclaimerText?: string | null
}

/**
 * Section markers that end the main reading body. Mirrors getMainBodyLength() in
 * app/api/readings/generate/route.ts — kept as a copy rather than an import so
 * the audit never reaches into a route module, at the cost of having to move
 * with it if those markers ever change.
 */
const ADDON_MARKERS = ["\n\nWhat I'm Sensing", '\n\nOracle Card', '\n\nA Ritual For You']

const ORACLE_HEADING = /^Oracle Card\s*[:—–-]/m
const RITUAL_HEADING = 'a ritual for you'
const STRAY_DASH = /[—–]/g

/** Undersize threshold: the route's own continuation loop targets 0.85 × target. */
const LENGTH_FLOOR_RATIO = 0.85

/**
 * Length of the reading body proper — excluding add-on sections, the sign-off
 * and the disclaimer — so a reading is not credited for length it gained from
 * paid extras or boilerplate.
 */
export function mainBodyLength(
  text: string,
  signOffText: string,
  disclaimerText?: string | null
): number {
  let end = text.length

  for (const marker of ADDON_MARKERS) {
    const idx = text.indexOf(marker)
    if (idx !== -1 && idx < end) end = idx
  }

  for (const trailing of [signOffText, disclaimerText]) {
    const needle = trailing?.trim()
    if (!needle) continue
    const idx = text.lastIndexOf(needle)
    if (idx !== -1 && idx < end) end = idx
  }

  return text.slice(0, end).trim().length
}

function list(names: string[], max = 3): string {
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`
}

/**
 * Checks 1a and 1b. The allowed set is the drawn cards plus the bottom-of-deck
 * card and the oracle card — all three were given to the model as legitimate.
 *
 * Only the drawn cards are *required* to appear. The bottom-of-deck card is
 * context rather than something the reading must name, so its absence is not an
 * omission; the oracle card is covered by its own add-on check.
 */
function checkCardFidelity(input: DeterministicAuditInput): [AuditCheck, AuditCheck] {
  const allowed = new Set<string>()
  for (const name of input.drawnCards) allowed.add(cardKey(name))
  if (input.bottomCard?.trim()) allowed.add(cardKey(input.bottomCard))
  if (input.oracleCardName?.trim()) allowed.add(cardKey(input.oracleCardName))

  const hallucinated = findMentionedCards(input.finalText).filter(
    (name) => !allowed.has(cardKey(name))
  )

  const omitted = input.drawnCards.filter(
    (name) => name.trim() && !mentionsCard(input.finalText, name)
  )

  return [
    hallucinated.length > 0
      ? fail(
          'card_hallucination',
          `Mentions ${list(hallucinated)} — not drawn for this reading.`
        )
      : pass('card_hallucination'),
    omitted.length > 0
      ? fail('card_omission', `${list(omitted)} never mentioned in the reading.`)
      : pass('card_omission'),
  ]
}

/**
 * Check 2. Both add-ons write a literal heading, so their presence is testable.
 *
 * The oracle heading is matched tolerantly on purpose. The prompt asks for
 * "Oracle Card — [name]", but route.ts rewrites that to "Oracle Card: [name]"
 * while repairing em-dash stripping, so the text on disk never actually carries
 * the documented form. Matching only what the prompt specifies would report
 * this add-on missing on every single reading.
 */
function checkAddons(input: DeterministicAuditInput): [AuditCheck, AuditCheck] {
  let oracle: AuditCheck
  if (!input.includeOracleCard) {
    oracle = notApplicable('addon_oracle')
  } else if (!ORACLE_HEADING.test(input.finalText)) {
    oracle = fail('addon_oracle', 'Oracle card was ordered but no oracle section is in the text.')
  } else {
    oracle = pass('addon_oracle')
  }

  let cleansing: AuditCheck
  if (!input.includeEnergyCleansing) {
    cleansing = notApplicable('addon_energy_cleansing')
  } else if (!input.finalText.toLowerCase().includes(RITUAL_HEADING)) {
    cleansing = fail(
      'addon_energy_cleansing',
      'Energy cleansing was ordered but no ritual section is in the text.'
    )
  } else {
    cleansing = pass('addon_energy_cleansing')
  }

  return [oracle, cleansing]
}

/** Check 3. Safety net for a continuation loop that did not bring the body up to target. */
function checkLength(input: DeterministicAuditInput): AuditCheck {
  if (!input.characterTarget || input.characterTarget <= 0) return notApplicable('length')

  const actual = mainBodyLength(input.finalText, input.signOffText, input.disclaimerText)
  const floor = Math.floor(input.characterTarget * LENGTH_FLOOR_RATIO)
  if (actual >= floor) return pass('length')

  const shortBy = Math.round((1 - actual / input.characterTarget) * 100)
  return fail(
    'length',
    `Body is ${actual.toLocaleString()} chars against a ${input.characterTarget.toLocaleString()} target — ${shortBy}% short.`
  )
}

/** Check 4. Both are appended unconditionally by the route, so absence means something ate them. */
function checkSignOffAndDisclaimer(input: DeterministicAuditInput): AuditCheck {
  const lower = input.finalText.toLowerCase()
  const missing: string[] = []

  const signOff = input.signOffText.trim()
  if (signOff && !lower.includes(signOff.toLowerCase())) missing.push('sign-off')

  const disclaimer = input.disclaimerText?.trim()
  if (disclaimer && !lower.includes(disclaimer.toLowerCase())) missing.push('disclaimer')

  if (missing.length === 0) return pass('signoff_disclaimer')
  return fail('signoff_disclaimer', `Missing the ${missing.join(' and ')} from the template.`)
}

/** Check 5. Second net under the route's own .replace(/—/g, ', ') pass. */
function checkStrayDashes(input: DeterministicAuditInput): AuditCheck {
  const matches = input.finalText.match(STRAY_DASH)
  if (!matches) return pass('stray_dashes')

  const idx = input.finalText.search(STRAY_DASH)
  const excerpt = input.finalText
    .slice(Math.max(0, idx - 25), idx + 25)
    .replace(/\s+/g, ' ')
    .trim()
  const plural = matches.length === 1 ? 'dash' : 'dashes'
  return fail('stray_dashes', `${matches.length} em/en ${plural} survived stripping: "…${excerpt}…"`)
}

/**
 * Checks 1-5. Pure functions over the finished text — no network, no model, and
 * cheap enough to always run.
 */
export function runDeterministicChecks(input: DeterministicAuditInput): AuditCheck[] {
  const [hallucination, omission] = checkCardFidelity(input)
  const [oracle, cleansing] = checkAddons(input)
  return [
    hallucination,
    omission,
    oracle,
    cleansing,
    checkLength(input),
    checkSignOffAndDisclaimer(input),
    checkStrayDashes(input),
  ]
}
