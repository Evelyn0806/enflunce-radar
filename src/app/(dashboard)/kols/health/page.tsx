import { supabase } from '@/lib/supabase'
import HealthClient from './HealthClient'

export default async function HealthPage() {
  // Only show KOLs that have active/planned collaborations (CRM managed)
  const { data: collabs } = await supabase
    .from('collaborations')
    .select('kol_id')
    .in('status', ['planned', 'active'])

  const kolIds = [...new Set((collabs ?? []).map((c) => c.kol_id))]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let kols: any[] = []

  if (kolIds.length > 0) {
    const { data } = await supabase
      .from('kols')
      .select('id, x_handle, display_name, avatar_url, followers_count, tier')
      .in('id', kolIds)
      .order('followers_count', { ascending: false })
    kols = data ?? []
  }

  return <HealthClient kols={kols} />
}
