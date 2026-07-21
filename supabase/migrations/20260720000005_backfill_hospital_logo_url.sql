-- Hospital admins could already upload a photo before hospitals.logo_url
-- existed as a write target for it (it only went to profiles.profile_image).
-- Messaging/Conversation now reads logo_url for the facility avatar, so any
-- hospital whose admin already has a photo but no logo_url needs a one-time
-- backfill -- this is the user's own already-uploaded photo, not new data.
update hospitals h
set logo_url = p.profile_image
from profiles p
where lower(p.hospital_name) = lower(h.name)
  and (p.user_type = 'hospital_admin' or 'hospital_admin' = any(p.user_types))
  and p.profile_image is not null
  and h.logo_url is null;
