import { supabase } from '@/lib/supabase'
import ContentClient from './ContentClient'

export default async function ContentPage() {
  const { data: kols } = await supabase
    .from('kols')
    .select('id, x_handle, display_name, avatar_url, followers_count')
    .order('followers_count', { ascending: false })

  return <ContentClient kols={kols ?? []} />
}
