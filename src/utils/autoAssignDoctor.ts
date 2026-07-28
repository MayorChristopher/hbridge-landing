// Auto-routing for "Quick Consultation" — from the practitioner meeting:
// "an agent or admin should initially pick calls to manage bookings and
// connect patients to available doctors, similar to a secretary in an
// office." Rather than inventing a new human dispatcher role (a much larger
// feature — new staff type, permissions, hiring flow), this automates the
// same outcome: the patient doesn't pick a specific doctor up front, the
// system assigns whoever is verified, available, and least busy right now.
import { supabase } from '../lib/supabase';

export interface AssignableDoctor {
  id: string;
  user_id: string;
  full_name: string;
  title: string | null;
  specialization: string;
  profile_image: string | null;
  consultation_fee: number | null;
  activeCount: number;
}

/**
 * Picks the best available verified doctor for an immediate request,
 * optionally narrowed by specialty. "Best" = fewest current active
 * consultations (pending/confirmed/in_progress) among online, available,
 * verified doctors — a simple, fair load-balancing rule rather than
 * anything that favors one doctor over another arbitrarily.
 *
 * requestingUserId is required so a multi-role account (also a doctor
 * themselves) can never be auto-assigned to their own request — same class
 * of bug as self-booking, just via the auto-routing path instead of manual
 * search.
 */
export async function findAvailableDoctor(specialty: string | undefined, requestingUserId: string): Promise<AssignableDoctor | null> {
  let query = supabase
    .from('doctors')
    .select('id, user_id, full_name, title, specialization, profile_image, consultation_fee')
    .eq('verification_status', 'verified')
    .eq('is_available', true)
    .neq('user_id', requestingUserId);
  if (specialty) query = query.ilike('specialization', `%${specialty}%`);

  const { data: candidates } = await query.limit(50);
  if (!candidates || candidates.length === 0) return null;

  const ids = candidates.map(d => d.id);
  const { data: active } = await supabase
    .from('consultations')
    .select('doctor_id')
    .in('doctor_id', ids)
    .in('status', ['pending', 'confirmed', 'scheduled', 'in_progress']);

  const loadByDoctor = new Map<string, number>();
  (active || []).forEach((c: any) => loadByDoctor.set(c.doctor_id, (loadByDoctor.get(c.doctor_id) || 0) + 1));

  const ranked = candidates
    .map(d => ({ ...d, activeCount: loadByDoctor.get(d.id) || 0 }))
    .sort((a, b) => a.activeCount - b.activeCount);

  return ranked[0];
}
