// Debug Message Routing Issue
// Add this to MessagesScreen.tsx temporarily to see what's happening

const debugConversations = async (userId: string) => {
  console.log('🔍 DEBUG: Current user ID:', userId);
  
  // Check if user is a doctor
  const { data: doctorCheck } = await supabase
    .from('doctors')
    .select('id, user_id')
    .eq('user_id', userId)
    .single();
  console.log('👨‍⚕️ Doctor check:', doctorCheck);
  
  // Check all conversations
  const { data: allConvs } = await supabase
    .from('conversations')
    .select('*')
    .or(`patient_id.eq.${userId},doctor_id.eq.${doctorCheck?.id || 'none'}`);
  console.log('💬 All conversations:', allConvs);
  
  // Check all messages
  const { data: allMsgs } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('📨 Recent messages:', allMsgs);
  
  return allConvs;
};