import { supabase } from '@/lib/supabase'
import XHuntClient from './XHuntClient'

export default async function XHuntPage() {
  const { data: kols } = await supabase
    .from('kols')
    .select('id, x_handle, display_name, avatar_url, followers_count, xhunt_rank_zh, xhunt_rank_en, language')
    .order('followers_count', { ascending: false })

  const filtered = (kols ?? []).filter(k => k.xhunt_rank_zh || k.xhunt_rank_en)

  return <XHuntClient kols={filtered} />
}
