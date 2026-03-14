import { supabase } from '@/lib/supabase'
import { Collaboration, Kol } from '@/types'
import CrmClient from './CrmClient'

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ kol?: string; status?: string }>
}) {
  const params = await searchParams

  // Fetch collaborations with KOL info
  let query = supabase
    .from('collaborations')
    .select('*, kol:kols(id, x_handle, display_name, avatar_url, tier, status_flag)')
    .order('created_at', { ascending: false })

  if (params.kol) query = query.eq('kol_id', params.kol)
  if (params.status) query = query.eq('status', params.status)

  const { data: collabs } = await query

  // KOL list for selector
  const { data: kols } = await supabase
    .from('kols')
    .select('id, x_handle, display_name, status')
    .in('status', ['watching', 'negotiating', 'active'])
    .order('followers_count', { ascending: false })

  return (
    <CrmClient
      collabs={(collabs ?? []) as (Collaboration & { kol: Pick<Kol, 'id' | 'x_handle' | 'display_name' | 'avatar_url' | 'tier' | 'status_flag'> })[]}
      kols={(kols ?? []) as Pick<Kol, 'id' | 'x_handle' | 'display_name' | 'status'>[]}
      filterKolId={params.kol}
    />
  )
}
