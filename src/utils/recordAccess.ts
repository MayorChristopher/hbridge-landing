import { supabase } from '../lib/supabase';

type RecordUrlRequest =
  | { context: 'medical_record'; recordId: string }
  | { context: 'conversation_attachment'; messageId: string };

export async function getSignedFileUrl(request: RecordUrlRequest): Promise<string> {
  const { data, error } = await supabase.functions.invoke('get-record-url', { body: request });
  if (error || !data?.url) {
    throw new Error(data?.message || error?.message || 'Could not access this file');
  }
  return data.url as string;
}
