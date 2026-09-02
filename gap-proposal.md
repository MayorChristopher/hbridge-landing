# HL-002: Sprint Scope Proposal

## 1. Selected Gap
The waitlist form on `/download` (in `src/components/waitlist-form.tsx`) lacks a try/catch block around its async submission call, leaving the submit button permanently disabled in a "submitting..." state on network rejections; this sits below the fold within the first two screens of the page.

## 2. Audience & Moment
Patients, Practitioners, and Hospital Admins meet this broken behavior at the moment they click "Join Waitlist" on `/download` while experiencing a network glitch or server rejection.

## 3. Success Measure
- **Before**: Submitting with a simulated network failure leaves the button permanently disabled with "Submitting..." text and no error feedback.
- **After**: Submitting with a simulated network failure catches the rejection, displays an inline error message ("Submission failed. Please try again."), and re-enables the button for another attempt.

## 4. Unchosen Gaps
- **Gap 2 (Hero Section Role Guidance)**: Deferred because CTA copy tweaks on `/` do not fix a severe runtime dead end that freezes user submission.
- **Gap 3 (Privacy Policy Stub Content)**: Deferred because placeholder legal text does not actively block primary conversion flows on the site.

## 5. Mistaken Fix (Non-Fix)
Changing the submit button's disabled logic or text without wrapping the async fetch/insert call in a proper `try/catch` block would look visually correct but fail runtime error recovery.
