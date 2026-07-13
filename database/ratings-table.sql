-- ─────────────────────────────────────────────────────────────────────────────
-- Ratings table — single source of truth for doctor ratings
-- One row per patient per doctor (upsert replaces on re-rating)
-- Trigger keeps doctors.average_rating + total_reviews always in sync
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Table
CREATE TABLE IF NOT EXISTS ratings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  doctor_id   UUID        NOT NULL REFERENCES doctors(id)   ON DELETE CASCADE,
  rating      INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, doctor_id)
);

-- 2. Row-level security
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ratings"
  ON ratings FOR SELECT USING (true);

CREATE POLICY "Patients can insert their own rating"
  ON ratings FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can update their own rating"
  ON ratings FOR UPDATE USING (auth.uid() = patient_id);

-- 3. Trigger function — recalculates average after every insert or update
CREATE OR REPLACE FUNCTION refresh_doctor_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE doctors
  SET
    average_rating = (
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM ratings
      WHERE doctor_id = NEW.doctor_id
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM ratings
      WHERE doctor_id = NEW.doctor_id
    )
  WHERE id = NEW.doctor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger
DROP TRIGGER IF EXISTS trg_refresh_doctor_rating ON ratings;

CREATE TRIGGER trg_refresh_doctor_rating
  AFTER INSERT OR UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION refresh_doctor_rating();
