import { createClient } from "@/lib/supabase/client";

export async function logAudit(action: string, tableName: string = '', recordId: string = '', oldData: Record<string, unknown> | null = null, newData: Record<string, unknown> | null = null) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  await supabase.from('audit_logs').insert({
    user_id: user?.id || '00000000-0000-0000-0000-000000000000',
    action,
    table_name: tableName,
    record_id: recordId,
    old_data: oldData,
    new_data: newData,
    user_agent: navigator.userAgent,
  });
}
