// ═══════════════════════════════════════════════════════════════════════════════
//  AGE, BYOB & BAR HOURS — the rules a night out must respect, per state.
//  India has no single drinking age: each state's excise law sets it (18 to 25),
//  bars check ID, and BYOB is regulated differently in each state. Every entry
//  carries a source and a `checked` date, and needs the same yearly look as the
//  dry days (lib/drydays.js). Shown as information, never as legal advice.
//  Pure (no Capacitor), so node --test covers it.
// ═══════════════════════════════════════════════════════════════════════════════

export const AGE_LINE = "For adults of legal drinking age (18 to 25, depending on the state)";

// Bodies: v1.5 track C.
/** @returns {{ state: string, age: number, beer?: number, note: string, source: string, checked: string, status: string }|null} */
export function ageFor(citySlug) { return null; }

/** @returns {{ state: string, text: string, source: string, status: string }|null} */
export function byobRule(citySlug) { return null; }

/** @returns {{ text: string, status: string }|null} "usually closes …" — the venue's own hours win */
export function usualClose(citySlug) { return null; }
