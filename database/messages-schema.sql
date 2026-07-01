-- Ensure RLS is enabled
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Patients can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can update messages in their conversations" ON messages;

-- Conversation policies
CREATE POLICY "Users can view their conversations" ON conversations FOR SELECT
  USING (
    auth.uid() = patient_id
    OR EXISTS (SELECT 1 FROM doctors WHERE doctors.id = conversations.doctor_id AND doctors.user_id = auth.uid())
  );

CREATE POLICY "Patients can create conversations" ON conversations FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Users can update their conversations" ON conversations FOR UPDATE
  USING (
    auth.uid() = patient_id
    OR EXISTS (SELECT 1 FROM doctors WHERE doctors.id = conversations.doctor_id AND doctors.user_id = auth.uid())
  );

-- Message policies
CREATE POLICY "Users can view messages in their conversations" ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.patient_id = auth.uid()
          OR EXISTS (SELECT 1 FROM doctors WHERE doctors.id = c.doctor_id AND doctors.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Users can send messages in their conversations" ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.patient_id = auth.uid()
          OR EXISTS (SELECT 1 FROM doctors WHERE doctors.id = c.doctor_id AND doctors.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Users can update messages in their conversations" ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.patient_id = auth.uid()
          OR EXISTS (SELECT 1 FROM doctors WHERE doctors.id = c.doctor_id AND doctors.user_id = auth.uid())
        )
    )
  );
