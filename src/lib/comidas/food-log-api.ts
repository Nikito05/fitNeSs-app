import { createClient } from '@/lib/supabase/client'
import type { MacroAmounts } from './food-calculation'

export type FoodLogEntry = {
  id: string
  logDate: string
  name: string
  quantityG: number
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
  source: 'custom' | 'off'
  foodId: string | null
  offBarcode: string | null
}

export type CreateFoodLogEntryInput = {
  logDate: string
  name: string
  quantityG: number
  macros: MacroAmounts
  source: 'custom' | 'off'
  foodId: string | null
  offBarcode: string | null
}

type FoodLogEntryRow = {
  id: string
  log_date: string
  name: string
  quantity_g: number
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
  source: 'custom' | 'off'
  food_id: string | null
  off_barcode: string | null
}

function mapRow(row: FoodLogEntryRow): FoodLogEntry {
  return {
    id: row.id,
    logDate: row.log_date,
    name: row.name,
    quantityG: row.quantity_g,
    calories: row.calories,
    proteinG: row.protein_g,
    fatG: row.fat_g,
    carbsG: row.carbs_g,
    source: row.source,
    foodId: row.food_id,
    offBarcode: row.off_barcode,
  }
}

const SELECT_COLUMNS =
  'id, log_date, name, quantity_g, calories, protein_g, fat_g, carbs_g, source, food_id, off_barcode'

export async function listFoodLogForDate(date: string): Promise<FoodLogEntry[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { data, error } = await supabase
    .from('food_log_entries')
    .select(SELECT_COLUMNS)
    .eq('user_id', user.id)
    .eq('log_date', date)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapRow)
}

export async function createFoodLogEntry(input: CreateFoodLogEntryInput): Promise<FoodLogEntry> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { data, error } = await supabase
    .from('food_log_entries')
    .insert({
      user_id: user.id,
      log_date: input.logDate,
      name: input.name,
      quantity_g: input.quantityG,
      calories: input.macros.calories,
      protein_g: input.macros.proteinG,
      fat_g: input.macros.fatG,
      carbs_g: input.macros.carbsG,
      source: input.source,
      food_id: input.foodId,
      off_barcode: input.offBarcode,
    })
    .select(SELECT_COLUMNS)
    .single()

  if (error) throw error

  return mapRow(data)
}

export async function updateFoodLogEntryQuantity(
  id: string,
  quantityG: number,
  macros: MacroAmounts
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('food_log_entries')
    .update({
      quantity_g: quantityG,
      calories: macros.calories,
      protein_g: macros.proteinG,
      fat_g: macros.fatG,
      carbs_g: macros.carbsG,
    })
    .eq('id', id)

  if (error) throw error
}

export async function deleteFoodLogEntry(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('food_log_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
