# Waitlist Implementation Findings & Deferrals (HL-003)

## 1. Unhandled Rejection in `useWaitlistCounts`
- **Observation:** The `useWaitlistCounts` hook currently leaves network rejections unhandled in UI rendering.
- **Decision / Deferral:** Deferred to a subsequent cleanup task as it falls outside the core waitlist submission form scope.

## 2. Review Items & Deferrals
- **Connection Bounding:** Deferred; standard fetch timeouts without an explicit custom wrapper are outside the scope of this slice.
- **Unique Constraint (`23505`):** Deferred; error code mapping for database constraints is not implemented since the constraint is handled at the database migration layer rather than this code slice.
- **Automated Verification:** Deferred; automated test runner setup is out of scope for this task and belongs to future validation tasks.