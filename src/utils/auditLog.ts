import { supabase } from '../lib/supabase';

// Fire-and-forget PHI view logging. Postgres has no SELECT trigger, so a
// "view" event can only be captured by explicitly calling this at the
// moment a screen actually displays someone's health data. Never awaited
// by callers and never throws — logging failure should not block or slow
// down the screen it's logging.
export function logPhiView(tableName: string, recordId: string, patientUserId?: string | null) {
  supabase
    .rpc('log_phi_access', {
      p_table_name: tableName,
      p_record_id: recordId,
      p_action: 'view',
      p_patient_user_id: patientUserId ?? null,
    })
    .then(({ error }) => { if (error) console.warn('audit log failed', tableName, error.message); });
}
