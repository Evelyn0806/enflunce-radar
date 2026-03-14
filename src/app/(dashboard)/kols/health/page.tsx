import { supabase } from '@/lib/supabase'
import HealthClient from './HealthClient'

export default async function HealthPage() {
  const { data: kols } = await supabase
    .from('kols')
    .select('id, x_handle, display_name, avatar_url, followers_count, tier')
    .order('followers_count', { ascending: false })

  return <HealthClient kols={kols ?? []} />
}
