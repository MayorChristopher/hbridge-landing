-- Staff self-service "I'm on duty at this facility right now" toggle,
-- separate from (and in addition to) the admin-assigned weekly shift blocks.
-- Sticks on until the staff member turns it off themselves.

alter table hospital_staff
  add column if not exists on_duty boolean not null default false;

-- The existing "doctor_manage_own_staff_row" policy (20260720000001) already
-- lets a doctor update their own hospital_staff row, which covers toggling
-- this column -- no new policy needed.
