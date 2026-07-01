-- Allow doctors to insert/update their own row
CREATE POLICY "Doctors can insert own row"
ON doctors FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Doctors can update own row"
ON doctors FOR UPDATE
USING (user_id = auth.uid());

-- Allow everyone to read verified doctors (for patient search)
DROP POLICY IF EXISTS "Anyone can view verified doctors" ON doctors;
CREATE POLICY "Anyone can view verified doctors"
ON doctors FOR SELECT
USING (true);
