import { supabase } from '@/lib/supabase'
import CompetitorClient from './CompetitorClient'

export default async function CompetitorPage() {
  const { data: kols } = await supabase
    .from('kols')
    .select('id, x_handle, display_name, avatar_url, followers_count, competitor_affiliations')
    .order('followers_count', { ascending: false })

  const filtered = (kols ?? []).filter(k => k.competitor_affiliations && k.competitor_affiliations.length > 0)

  return <CompetitorClient kols={filtered} />
}
