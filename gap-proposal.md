# HL-002: Choose the Gap and Make the Case

## 1. Selected Gap
Candidate Gap 1: Waitlist Form Unhandled Error State in `src/components/waitlist-form.tsx` on `/download`. Network and server rejections leave the form permanently stuck in a "submitting" state with a disabled submit button.

## 2. Audience & Impact
Hurts Patients, Practitioners, and Hospital Admins on `/download` who attempt to submit the waitlist form during a network glitch, completely blocking conversion.

## 3. Success Measure
- **Before**: Form submission failure permanently locks the submit button on "Submitting..." and disables further interaction.
- **After**: Form submission failure catches the error, displays a clear error state, and re-enables the submit button for retry without page refresh.

## 4. Unchosen Gaps
- **Gap 2 (Hero CTAs)**: Deferred because CTA text micro-adjustments do not fix functional runtime blockages.
- **Gap 3 (Privacy Policy Stub)**: Deferred because placeholder content does not impede core user conversion flows.
- **Non-Fix**: Changing button text without wrapping the async call in a `try/catch` block would look fixed visually but fails runtime error recovery.
