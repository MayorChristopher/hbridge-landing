/** Returns a display name with an appropriate professional prefix,
 *  without doubling "Dr. Dr." when the DB value already includes a title. */
export function drName(
  fullName: string | null | undefined,
  title?: string | null,
): string {
  if (!fullName) return 'Medical Practitioner';
  // Strip all leading title prefixes first (handles accidental doubles like "DR. DR. Ella")
  let name = fullName.trim();
  let prev: string;
  do {
    prev = name;
    name = name.replace(/^(dr\.?|prof\.?|nurse\.?|pharm\.?|physio\.?|rad\.?)\s+/i, '').trim();
  } while (name !== prev);
  const t = (title || 'Dr.').trim();
  return `${t.endsWith('.') ? t : t + '.'} ${name}`;
}
