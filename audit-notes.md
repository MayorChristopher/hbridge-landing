# HL-001: Marketing Site Audit Notes

## 1. Page Inventory
- Home Page (`/`): Introduces the Hbridge platform and core capabilities; Target Audience: General Visitors / Patients / Practitioners.
- About Us (`/about`): Explains company mission and team background; Target Audience: General Visitors.
- Features (`/features`): Details key EHR software features and clinical workflows; Target Audience: Practitioners / Hospital Admins.
- Pricing (`/pricing`): Outlines tier structures and licensing plans; Target Audience: Hospital Admins / Procurement.
- Waitlist (`/waitlist`): Collects early access requests across roles; Target Audience: Patients, Practitioners, Hospital Admins.
- Contact (`/contact`): Provides support contact info and inquiry form; Target Audience: General Visitors / Hospital Admins.
- Blog (`/blog`): Publishes product updates and healthcare insights; Target Audience: General Visitors / Industry Professionals.
- Docs (`/docs`): Provides platform documentation and integration guides; Target Audience: Technical Admins / Developers.
- Careers (`/careers`): Displays open job positions and hiring info; Target Audience: Job Applicants / General Visitors.
- Privacy Policy (`/privacy`): Outlines data handling and HIPAA compliance details; Target Audience: All Visitors / Legal.
- Terms of Service (`/terms`): Sets platform usage rules and legal disclaimers; Target Audience: All Visitors / Legal.
  
## 2. Desktop & Mobile Walkthrough
- **Desktop (1440px)**: Navigation links and layout render properly.
- **Mobile (375px)**: Navigation menu collapses cleanly; form controls remain accessible.
- **Broken Control / Dead End**: In `company-site/src/components/waitlist-form.tsx` (line 91), the async insert operation lacks a try/catch block. On error, an unhandled rejection occurs, leaving status as "submitting" and the button permanently disabled.

## 3. First Screen Evaluation
- **Evaluation**: The homepage above-the-fold area clearly states what Hbridge does, but lacks distinct direct pathways for different user roles.
- **Evidence**: The headline introduces the EHR platform clearly, but the primary CTA defaults to patient signups without immediate clarity for hospital admins or practitioners.

## 4. Candidate Gaps (Sprint Scope)
1. **Waitlist Unhandled Submission Error**: Network/server errors freeze the waitlist form button in a disabled state; hurts all visiting roles; located on the main waitlist modal. (Fit: Quick inline try/catch state reset in existing component).
2. **Hero Section Role Distinction**: Visiting hospital admins lack explicit guidance in the hero section; hurts enterprise leads; located on the Homepage First Screen. (Fit: Content/UI micro-adjustment in hero component).
3. **Footer Legal / Privacy Dead Link**: Privacy link in the footer leads to an unhandled anchor; hurts compliance-focused visitors; located in global footer. (Fit: Simple link destination update).

## 5. Waitlist Form Testing
- **Patient Role**: Success shows confirmation text; Error triggers unhandled rejection and locks button in "submitting" state.
- **Practitioner Role**: Success records submission; Error locks button in "submitting" state.
- **Hospital Admin Role**: Success records submission; Error locks button in "submitting" state.
