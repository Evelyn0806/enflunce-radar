import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Kol } from '@/types'
import KolDetailClient from './KolDetailClient'

export default async function KolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data, error } = await supabase
    .from('kols_with_computed')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) notFound()

  const { data: collabs } = await supabase
    .from('collaborations')
    .select('*')
    .eq('kol_id', id)
    .order('created_at', { ascending: false })

  const { data: logs } = await supabase
    .from('communication_logs')
    .select('*')
    .eq('kol_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <KolDetailClient
      kol={data as Kol}
      collabs={collabs ?? []}
      logs={logs ?? []}
    />
  )
}
