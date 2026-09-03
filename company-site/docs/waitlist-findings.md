# Waitlist Implementation Findings & Deferrals (HL-003)

## 1. Unhandled Rejection in `useWaitlistCounts`
- **Observation:** The `useWaitlistCounts` hook currently leaves network rejections unhandled in UI rendering.
- **Decision / Deferral:** Deferred to a subsequent cleanup ticket as it falls outside the core waitlist submission form scope, but recorded here for tracking.

## 2. Additional Review Items
- **Connection Bounding:** Standard fetch timeouts are handled at the Supabase client level.
- **Unique Constraint (`23505`):** Handled via the PostgreSQL error code mapping in the form submission logic.
- **Automated Verification:** E2E error-path testing is deferred to subsequent verification tasks (HL-004).