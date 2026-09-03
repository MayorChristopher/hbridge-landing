# Waitlist Implementation Findings & Deferrals (HL-003)

## 1. Unhandled Rejection in `useWaitlistCounts`
- **Observation:** The `useWaitlistCounts` hook currently leaves network rejections unhandled in UI rendering.
- **Decision / Deferral:** Deferred to a subsequent cleanup task as it falls outside the core waitlist submission form scope.

## 2. Review Findings & Deferrals
- **Connection Bounding:** Deferred; network requests can hang without a timeout or settlement, leaving the submit button stuck. This is a failure mode of the submit action that was outside the original agreed case, and it is tracked for a follow-up fix.
- **Unique Constraint (`23505`):** Deferred; the branch promises an "already on the waitlist" state, but making that real requires a database migration, which is outside the scope of a landing-page ticket.
- **Automated Verification:** Deferred as its own future test-suite task; HL-004 is dedicated solely to walking the live site and shipping, not building a test runner.