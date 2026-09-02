# HL-002: Gap Proposal

## 1. Selected Gap
The waitlist form on `/download` (in `company-site/src/components/waitlist-form.tsx`) lacks a try/catch block around its async submission call, leaving the submit button permanently disabled in a submitting state when a network-level rejection occurs; this sits below the fold within the first two screens of the page.

## 2. Audience & Moment
Patients meet this broken behavior at the moment they submit the waitlist form on `/download` while experiencing an unexpected network transport failure.

## 3. Success Measure
- **Before**: Submitting the form during a network-level connection failure leaves the submit button permanently disabled in a submitting state with no error feedback or recovery option.
- **After**: Submitting the form during a network-level connection failure catches the thrown rejection, displays an inline error message ("Submission failed. Please try again."), and re-enables the button for another attempt.

## 4. Unchosen Gaps
- **Gap 2 (Hero Section Role Guidance)**: Deferred because CTA copy adjustments on `/` do not fix a severe runtime dead end that freezes user submission (ref: `audit-notes.md`).
- **Gap 3 (Privacy Policy Stub Content)**: Deferred because placeholder legal text does not actively block primary conversion flows on the site (ref: `audit-notes.md`).

## 5. Mistaken Fix (Non-Fix)
Changing the submit button's disabled logic or text without wrapping the async fetch/insert call in a proper `try/catch` block would look visually correct but fail runtime error recovery.

## 6. Manager Agreement
Agreed in writing by Engineering Manager Adaeze on Blacksmith:
> "I recommend we select Candidate Gap 1 (Waitlist Form Unhandled Error State)... high-impact quick win that fits perfectly within sprint constraints." — Adaeze, Sprint 01 Scope Alignment
