import { supabase } from '@/lib/supabase'
import CompetitorClient from './CompetitorClient'

export const dynamic = 'force-dynamic'

export default async function CompetitorPage() {
  const { data: kols } = await supabase
    .from('kols')
    .select('id, x_handle, display_name, avatar_url, followers_count, competitor_affiliations')
    .not('x_handle', 'like', '__competitor__%')
    .order('followers_count', { ascending: false })

  const filtered = (kols ?? []).filter(k => k.competitor_affiliations && k.competitor_affiliations.length > 0)

  return <CompetitorClient kols={filtered} />
}
