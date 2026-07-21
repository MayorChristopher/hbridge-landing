import { supabase } from '../lib/supabase';

// hospitals.type/category are NOT NULL with CHECK constraints. These are the
// only two values guaranteed valid regardless of what the real facility
// turns out to be — the admin corrects them properly during profile setup.
export const HOSPITAL_TYPE_DEFAULT = 'private';
export const HOSPITAL_CATEGORY_DEFAULT = 'general';
export const PENDING = 'Pending';

export interface HospitalRow {
  id: string;
  name: string;
  type: string;
  category: string;
  address: string;
  city: string;
  state: string;
  [key: string]: any;
}

/**
 * Finds a hospital by name (case-insensitive), or creates it with valid
 * required fields. Every hospitals.insert() in the app should go through
 * this — five separate ad-hoc versions of this used to exist, each missing
 * required NOT NULL fields or using invalid enum values, causing silent
 * failures that left hospital admin accounts without a real hospitals row.
 */
export async function getOrCreateHospitalRow(hospitalName: string): Promise<HospitalRow | null> {
  const name = hospitalName.trim();
  if (!name) return null;

  const { data: existing } = await supabase
    .from('hospitals').select('*').ilike('name', name).maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('hospitals')
    .insert({
      name,
      type: HOSPITAL_TYPE_DEFAULT,
      category: HOSPITAL_CATEGORY_DEFAULT,
      address: PENDING,
      city: PENDING,
      state: PENDING,
      is_active: true,
      rating: 0,
      total_reviews: 0,
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return created;
}

/** True only once the facility has entered a real physical location. */
export function isHospitalSetupComplete(hospital: Partial<HospitalRow> | null | undefined): boolean {
  if (!hospital) return false;
  return (
    !!hospital.address && hospital.address !== PENDING &&
    !!hospital.city && hospital.city !== PENDING &&
    !!hospital.state && hospital.state !== PENDING
  );
}
