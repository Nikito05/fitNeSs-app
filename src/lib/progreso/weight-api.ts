import { createClient } from '@/lib/supabase/client'
import { todayLocalDate } from '@/lib/date'

export type WeightLog = {
  id: string
  logDate: string
  weightKg: number
}

export async function getTodayWeight(): Promise<WeightLog | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const today = todayLocalDate()

  const { data, error } = await supabase
    .from('body_weight_logs')
    .select('id, log_date, weight_kg')
    .eq('user_id', user.id)
    .eq('log_date', today)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return { id: data.id, logDate: data.log_date, weightKg: data.weight_kg }
}

export async function saveTodayWeight(weightKg: number): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const today = todayLocalDate()

  const { data: existing, error: findError } = await supabase
    .from('body_weight_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('log_date', today)
    .maybeSingle()

  if (findError) throw findError

  if (existing) {
    const { error } = await supabase
      .from('body_weight_logs')
      .update({ weight_kg: weightKg })
      .eq('id', existing.id)

    if (error) throw error
    return
  }

  const { error } = await supabase.from('body_weight_logs').insert({
    user_id: user.id,
    log_date: today,
    weight_kg: weightKg,
  })

  if (error) throw error
}

export async function listWeightHistory(): Promise<WeightLog[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { data, error } = await supabase
    .from('body_weight_logs')
    .select('id, log_date, weight_kg')
    .eq('user_id', user.id)
    .order('log_date', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    logDate: row.log_date,
    weightKg: row.weight_kg,
  }))
}
