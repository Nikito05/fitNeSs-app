import { createClient } from '@/lib/supabase/client'

export type CustomFood = {
  id: string
  name: string
  caloriesPer100g: number
  proteinPer100g: number
  fatPer100g: number
  carbsPer100g: number
  typicalPortionG: number | null
}

export type CustomFoodInput = {
  name: string
  caloriesPer100g: number
  proteinPer100g: number
  fatPer100g: number
  carbsPer100g: number
  typicalPortionG: number | null
}

type CustomFoodRow = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  fat_per_100g: number
  carbs_per_100g: number
  typical_portion_g: number | null
}

function mapRow(row: CustomFoodRow): CustomFood {
  return {
    id: row.id,
    name: row.name,
    caloriesPer100g: row.calories_per_100g,
    proteinPer100g: row.protein_per_100g,
    fatPer100g: row.fat_per_100g,
    carbsPer100g: row.carbs_per_100g,
    typicalPortionG: row.typical_portion_g,
  }
}

const SELECT_COLUMNS = 'id, name, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, typical_portion_g'

export async function listCustomFoods(): Promise<CustomFood[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { data, error } = await supabase
    .from('foods')
    .select(SELECT_COLUMNS)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapRow)
}

export async function createCustomFood(input: CustomFoodInput): Promise<CustomFood> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { data, error } = await supabase
    .from('foods')
    .insert({
      user_id: user.id,
      name: input.name,
      calories_per_100g: input.caloriesPer100g,
      protein_per_100g: input.proteinPer100g,
      fat_per_100g: input.fatPer100g,
      carbs_per_100g: input.carbsPer100g,
      typical_portion_g: input.typicalPortionG,
    })
    .select(SELECT_COLUMNS)
    .single()

  if (error) throw error

  return mapRow(data)
}

export async function updateCustomFood(id: string, input: CustomFoodInput): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { error } = await supabase
    .from('foods')
    .update({
      name: input.name,
      calories_per_100g: input.caloriesPer100g,
      protein_per_100g: input.proteinPer100g,
      fat_per_100g: input.fatPer100g,
      carbs_per_100g: input.carbsPer100g,
      typical_portion_g: input.typicalPortionG,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
}

export async function deactivateCustomFood(id: string): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No hay usuario autenticado.')

  const { error } = await supabase
    .from('foods')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
}
