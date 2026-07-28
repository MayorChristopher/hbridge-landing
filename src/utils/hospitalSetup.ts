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
  owner_user_id?: string | null;
  [key: string]: any;
}

/**
 * If the current account is ALSO a practitioner (has a `doctors` row), makes
 * sure they show up as active staff at their own hospital instead of the
 * doctor-side UI treating their own facility as a stranger's — a hospital
 * admin who is also its head practitioner shouldn't have to "request to
 * join" themselves. Silently a no-op for accounts with no doctor role.
 */
async function ensureOwnerStaffLink(hospitalId: string, userId: string): Promise<void> {
  const { data: doctor } = await supabase
    .from('doctors').select('id').eq('user_id', userId).maybeSingle();
  if (!doctor) return;

  const { data: existing } = await supabase
    .from('hospital_staff').select('id, status')
    .eq('hospital_id', hospitalId).eq('doctor_id', doctor.id).maybeSingle();

  if (existing) {
    if (existing.status !== 'active') {
      await supabase.from('hospital_staff')
        .update({ status: 'active', joined_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return;
  }

  await supabase.from('hospital_staff').insert({
    hospital_id: hospitalId,
    doctor_id: doctor.id,
    status: 'active',
    role: 'Owner',
    requested_by: 'hospital',
    invited_at: new Date().toISOString(),
    joined_at: new Date().toISOString(),
  });
}

/**
 * Finds a hospital by name (case-insensitive), or creates it with valid
 * required fields. Every hospitals.insert() in the app should go through
 * this — five separate ad-hoc versions of this used to exist, each missing
 * required NOT NULL fields or using invalid enum values, causing silent
 * failures that left hospital admin accounts without a real hospitals row.
 *
 * Also claims/sets `owner_user_id` for the current account and ensures a
 * self staff-link if they're also a practitioner (see ensureOwnerStaffLink).
 */
export async function getOrCreateHospitalRow(hospitalName: string): Promise<HospitalRow | null> {
  const name = hospitalName.trim();
  if (!name) return null;

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  const { data: existing } = await supabase
    .from('hospitals').select('*').ilike('name', name).maybeSingle();

  if (existing) {
    // Backfill ownership for hospitals created before owner_user_id existed,
    // or found via name match without one set yet.
    if (userId && !existing.owner_user_id) {
      await supabase.from('hospitals').update({ owner_user_id: userId }).eq('id', existing.id);
      existing.owner_user_id = userId;
    }
    if (userId) await ensureOwnerStaffLink(existing.id, userId);
    return existing;
  }

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
      owner_user_id: userId ?? null,
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  if (created && userId) await ensureOwnerStaffLink(created.id, userId);
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
