# HL-001: Marketing Site Audit Notes

## 1. Page Inventory
- **Home Page (`/`)**: Introduces the Hbridge platform and core capabilities; Target Audience: General Visitors / Patients / Practitioners.
- **Product (`/product`)**: Details key EHR software features and clinical tools; Target Audience: Practitioners / Hospital Admins.
- **Practitioners (`/practitioners`)**: Showcases clinical workflow tools for healthcare providers; Target Audience: Doctors & Nurses.
- **Hospitals (`/hospitals`)**: Explains the enterprise EHR platform and deployment options; Target Audience: Hospital Admins / Procurement.
- **Community (`/community`)**: Shares user network highlights and platform updates; Target Audience: All Users.
- **About Us (`/about`)**: Outlines company mission and team background; Target Audience: General Visitors.
- **Careers (`/careers`)**: Displays open job positions and hiring process; Target Audience: Applicants / General Visitors.
- **Contact (`/contact`)**: Provides support contact info and inquiry form; Target Audience: General Visitors.
- **Privacy Policy (`/privacy`)**: Outlines data collection, user rights, and privacy handling practices; Target Audience: All Visitors / Legal.
- **Terms of Service (`/terms`)**: Sets platform usage rules and legal disclaimers; Target Audience: All Visitors / Legal.
- **Download / Waitlist (`/download`)**: Hosts the primary waitlist form (`waitlist-form.tsx`) for early access; Target Audience: Patients, Practitioners, Hospital Admins.

## 2. Desktop & Mobile Walkthrough
- **Desktop (1440px Navigation & Links)**: Tested header nav links (`/`, `/product`, `/practitioners`, `/hospitals`, `/community`, `/about`, `/careers`, `/contact`), primary hero CTAs, and footer legal links (`/privacy`, `/terms`). All routes load correctly without broken links or wrong destinations.
- **Mobile (375px Responsive Test)**: Header hamburger menu opens and closes cleanly; navigation links remain fully clickable; form controls on `/download` scale smoothly to phone viewports without horizontal scrolling or UI overlap.
- **Broken Control / Dead End**: In `company-site/src/components/waitlist-form.tsx` (line 91), the async insert operation lacks a try/catch block. On network rejection, an unhandled error leaves status as "submitting" and line 236 keeps the submit button permanently disabled.

## 3. First Screen Evaluation
- **Evaluation**: The homepage above-the-fold area introduces the platform clearly, but lacks clear CTA pathways for enterprise/hospital admin roles.
- **Evidence**: The primary hero button directs users straight to `/download`, leaving enterprise admins without tailored landing guidance.

## 4. Candidate Gaps (Sprint Scope)
1. **Waitlist Form Unhandled Error State**: Network/server failures cause the form to freeze permanently in a "submitting" state; impacts all user roles; located **below the fold (requires a scroll past the first screen)** on `/download`. (Fit: Inline try/catch block in `waitlist-form.tsx`).
2. **Hero Section Role Guidance**: Visiting hospital admins lack clear role-specific CTAs above the fold on `/`; hurts enterprise lead conversion; located **above the fold on the homepage first screen (`/`)**. (Fit: Micro-adjustment to hero CTA copy and routing).
3. **Header Navigation Active Route Indicator**: Navigating between pages provides no active link highlighting in the main header, leaving visitors unsure of their active location; located **above the fold across all header-enabled pages**. (Fit: Simple active state check using `usePathname` in `site-header.tsx`).

## 5. Waitlist Form Testing
- **Patient Role**: Success displays confirmation message; Error triggers unhandled rejection and locks button in "submitting" state.
- **Practitioner Role**: Success records submission; Error locks button in "submitting" state.
- **Hospital Admin Role**: Success records submission; Error locks button in "submitting" state.
