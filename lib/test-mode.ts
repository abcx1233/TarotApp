// Test Mode is scoped to one browser session, not stored in the database: a
// session cookie (no Expires / Max-Age) that the browser drops when it closes.
// Read server-side by app/dashboard/layout.tsx so the banner is right on first
// paint, and set/cleared client-side by the Settings toggle. Deliberately not
// app_settings.test_mode_enabled — that single row was shared by every browser,
// so one person leaving Test Mode on flipped it on for everyone.
export const TEST_MODE_COOKIE = 'reader_test_mode'
