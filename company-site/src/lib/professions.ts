// Mirrors the real profession taxonomy from the app's SignUpScreen
// (src/screens/SignUpScreen.tsx PROFESSIONS) — same 15 regulated Nigerian
// health professions, so the waitlist form matches what the app actually
// supports rather than a generic specialty list.
export const PROFESSIONS = [
  "Doctor",
  "Dentist",
  "Nurse / Midwife",
  "Pharmacist",
  "Medical Laboratory Scientist",
  "Physiotherapist",
  "Radiographer",
  "Optometrist",
  "Community Health Officer",
  "Dietitian / Nutritionist",
  "Occupational Therapist",
  "Prosthetist / Orthotist",
  "Medical Records Officer",
  "Environmental Health Officer",
  "Other Health Professional",
] as const;
