-- On-duty now requires hospital confirmation: a doctor requests to go on
-- duty (on_duty_requested_at set), and only becomes visibly "on duty"
-- (on_duty = true) once the hospital admin approves. Going OFF duty stays
-- self-service -- no one needs permission to step away.

alter table hospital_staff
  add column if not exists on_duty_requested_at timestamptz;
