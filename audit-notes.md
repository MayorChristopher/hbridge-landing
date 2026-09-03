# Marketing Site Audit Notes

## Candidate Gaps
1. **Waitlist Form Unhandled Error State**: On `/download` (`company-site/src/components/waitlist-form.tsx`), a network-level connection failure leaves the submit button permanently disabled in a "submitting" state without catching the error or offering recovery.
2. **Hero Section Role Guidance**: The main landing page CTAs lack explicit role-based routing for hospital administrators.
3. **Privacy Policy Stub Content**: The privacy policy page contains placeholder text instead of full policy terms.
