# Known issues

Open problems that have been investigated but not yet fixed. Each entry records
what was observed, what the code does, the best current theory, and what still
needs testing. Line numbers refer to the commit named in each entry.

---

## Em dashes survive the server-side dash strip when the continuation loop runs

**Status:** open, not fixed. Investigated 2026-09-16 against `main` at `8098d1c`.

### What was observed

A test-mode reading contained a raw em dash despite the unconditional dash strip in
the generate route:

> …a shadow aspect at play—a hesitancy to embrace potential endings…

- Reading `1f22470b-9b74-4cda-b62b-844cdf572fc6`, `is_test = true`, created
  2026-09-16 11:51 UTC, Core tier (`character_target` 6000).
- The character is **U+2014 EM DASH**, the exact character the strip regex targets. It
  is not a lookalike. The reading contains two, at character offsets 4799 and 6090.
  Both are in the main body; the future section starts at 6133 and has none.
- The audit caught it: `audit_checks` has `stray_dashes` as `fail` ("2 em/en dashes
  survived stripping"), score 76 (amber). `voice_drift` also failed on this reading.

### Where the stripping code lives

`app/api/readings/generate/route.ts`, lines 206–213:

```ts
// Server-side dash removal (safety net — fires regardless of model compliance)
let rawReading = _rawText
  .replace(/—/g, ', ')
  .replace(/–/g, ', ')
  .replace(/\s,\s/g, ', ')
  .replace(/,\s*,/g, ',')
rawReading = rawReading.replace(/^Oracle Card[,\s]+/gm, 'Oracle Card: ')
```

The same four `.replace` calls are copied into `lib/daily-message/generate-for-date.ts`
(lines 81–84) and `app/api/daily-message/generate-batch/route.ts` (lines 84–87).

### Where it runs in the pipeline

In order, within `POST /api/readings/generate`:

| Step | Lines | Text it works on | Dash-stripped? |
|---|---|---|---|
| 1. `generateFullReading()`: one model call (main body, plus future, oracle and ritual sections when requested) | 194 | model output `_rawText` | — |
| 2. **Dash strip** | 206–213 | `_rawText` → `rawReading` | **yes** |
| 3. Split into `mainBody` + `addons` at the first add-on marker | 234–241 | `rawReading` | (already stripped) |
| 4. **Continuation loop**: up to 2 calls (4 at ≥10k target) while `mainBody` < 85% of target | 247–265 | new model output appended to `mainBody` | **no** |
| 5. Reassemble `mainBody + addons` | 268 | | no |
| 6. Ritual hard cut | 270–296 | | no |
| 7. Truncation passes (end marker, sign-off, sentence trim, closing lines) | 302–315 | | no |
| 8. Strip model sign-off, append template sign-off and disclaimer | 323–340 | | no |
| 9. Audit (`stray_dashes` check) | 354+ | final `generatedReading` | detects only |

So the strip runs once, on the **first** model output, **before** the continuation
loop. Continuation text is appended at line 259
(`mainBody = mainBody + '\n\n' + cleanContinuation`) and never goes through the strip.
Nothing after step 2 removes dashes.

The future, oracle and ritual sections are **not** built separately. They come back
in the single step-1 call, so they are stripped. `future-section.ts` only builds prompt
instructions.

### Theory, and the evidence that confirms it

**Theory:** the dashes were written by the continuation call and bypassed the strip
because it had already run.

This is confirmed for this reading by the Vercel runtime logs for the request
(`POST /api/readings/generate`, 2026-09-16 11:50:39 UTC, deployment
`dpl_HJK1VW5BQiGLgWypkE5WbEL3VCAc`):

```
[generate] Prompt length (chars): 30016
Continuation check: 2920 / 6000 needs: true
Continuation 1 generated: 3228 chars
rawReading after append: main body now 6132 chars
Main body: 6132 chars / 6000 target — PASS (total: 7389 chars)
Audit: 76/100 (amber) — stray_dashes, voice_drift
```

- The prompt length (30016) matches the saved reading's `generated_prompt`, so this is
  the same request.
- The first-call main body was 2920 characters. The saved text has a paragraph break at
  exactly offset 2920, which is where the continuation was joined with `\n\n`.
- The continuation occupies offsets 2922–6132. Both em dashes (4799 and 6090) fall
  inside it, and none appear in the stripped first-call text (0–2920) or the future
  section.

**Why the continuation writes dashes and banned wording:** the continuation prompt
(line 254) includes neither `WRITING_STYLE_GUIDE` nor the `ZERO TOLERANCE DASH RULE`
from `lib/ai/prompts/builder.ts`. It also literally suggests exploring "the shadow
aspect of a card". "shadow aspect" is on the style guide's banned list, and it is the
phrase in the observed sentence. This probably also explains the `voice_drift` failure
on the same reading.

### Secondary gaps found (not the cause of this instance)

1. **The regex only covers U+2014 and U+2013.** It misses other dash-like characters a
   model could emit: U+2015 horizontal bar, U+2012 figure dash, U+2212 minus sign,
   U+FE58 small em dash, U+FE63 small hyphen-minus, U+FF0D fullwidth hyphen-minus,
   U+2E3A two-em dash, and ASCII stand-ins such as ` -- ` or ` - `. The audit's
   `STRAY_DASH` in `lib/ai/audit/deterministic.ts` uses the same two characters, so it
   would not catch these either. Any broader set must leave real hyphens alone
   (U+2010, U+2011 and the ASCII hyphen inside words like "self-worth").
   A scan of the live database on 2026-09-16 found only U+2014 in saved readings: both
   non-deleted readings with text contain it, and neither contains any other character
   from the list above.
2. **Save Draft writes client-supplied text unstripped.**
   `app/api/readings/save-draft/route.ts` line 134 stores `f.generatedReading` as sent
   by the browser. A dash typed or pasted in the review editor is saved as-is. It
   doesn't go through the generate route or the audit.
3. **The cleanup replacements leave messy output in two cases** (reproduced by running
   the exact replace chain in Node; not yet seen in a saved reading):
   - A dash opening a paragraph: `"First paragraph.\n\n— a line"` becomes
     `"First paragraph.\n,  a line"`. `\s,\s` matches the second newline, so the blank
     line becomes a single line break, and the line starts with a comma and two spaces.
   - A spaced dash: `"at play — a hesitancy"` becomes `"at play,  a hesitancy"`, with a
     double space. An unspaced dash (`"play—a"`) comes out clean: `"play, a"`.
4. **One other affected reading, not confirmed.** Reading
   `fc5cc68d-7a44-4758-b7fc-4c3ca6bee019` (2026-09-05, Premium target 12000) also has
   one em dash and a failed `stray_dashes` check. Its runtime logs were not checked;
   they are likely past Vercel's log retention.

### What would need testing to confirm and scope it

1. **Reproduce offline.** Run the route's post-processing with a stubbed first call
   whose main body is under 85% of target, and a stubbed continuation containing `—`.
   Expect the dash to survive to `generatedReading`. Then check that the same input
   with no continuation needed comes out clean.
2. **How often it happens.** Pull the `Continuation check: … needs: true` log lines
   alongside readings whose `audit_checks` show `stray_dashes` failing. If continuation
   is the only path, every `stray_dashes` failure from the generate route should line
   up with a continuation. The one logged case also suggests continuation is common:
   `maxTokens` is `characterTarget / 3 + 500` (2500 for a 6000 target), and the first
   call returned less than half the target.
3. **Readings with no continuation.** Look for `stray_dashes` failures on readings where
   the logs show `needs: false`. Any such case would mean there's a second path.
4. **Other dash characters.** Feed the strip and `STRAY_DASH` text containing each
   character in the secondary-gaps list, and confirm what is and isn't removed or
   detected.
5. **Save Draft.** Edit a reading to include `—`, save it, and check `generated_reading`.
6. **Daily messages.** Both daily-message paths make one call and then strip, with no
   continuation, so they should not be affected. Confirm with a generated message.

### Possible fix directions (not implemented)

- Run the dash strip on the final text after continuation and truncation, before the
  sign-off is appended and the audit runs, instead of (or as well as) on the first
  output.
- Move the strip into one shared helper used by the generate route, both
  daily-message paths and the audit's `STRAY_DASH`, so the character sets can't drift
  apart.
- Give the continuation prompt the dash rule (or the full style guide), and remove the
  "shadow aspect" wording from it.
