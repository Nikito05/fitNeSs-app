'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  scaleToQuantity,
  mapOffProductToPer100g,
  extractOffServingGrams,
  type MacroAmountsPer100g,
  type OffProduct,
} from '@/lib/comidas/food-calculation'
import { searchOffProductsByText, getOffProductByBarcode } from '@/lib/comidas/open-food-facts-api'
import { listCustomFoods, type CustomFood } from '@/lib/comidas/custom-foods-api'
import { createFoodLogEntry } from '@/lib/comidas/food-log-api'
import { CustomFoodsManager } from './custom-foods-manager'
import { BarcodeScanner } from './barcode-scanner'

type SelectedItem = {
  name: string
  per100g: MacroAmountsPer100g
  typicalPortionG: number | null
  source: 'custom' | 'off'
  foodId: string | null
  offBarcode: string | null
}

export function FoodSearchDialog({
  logDate,
  onClose,
  onAdded,
}: {
  logDate: string
  onClose: () => void
  onAdded: () => void
}) {
  const [view, setView] = useState<'search' | 'manage' | 'scan' | 'quantity'>('search')
  const [query, setQuery] = useState('')
  const [customFoods, setCustomFoods] = useState<CustomFood[]>([])
  const [offResults, setOffResults] = useState<OffProduct[]>([])
  const [isSearchingOff, setIsSearchingOff] = useState(false)
  const [offError, setOffError] = useState<string | null>(null)
  const [barcodeNotFound, setBarcodeNotFound] = useState(false)
  const [incompleteProductFound, setIncompleteProductFound] = useState(false)
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [quantityG, setQuantityG] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    listCustomFoods()
      .then(setCustomFoods)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (view !== 'search' || query.trim() === '') {
      setOffResults([])
      return
    }

    setIsSearchingOff(true)
    setOffError(null)
    const timeout = setTimeout(() => {
      searchOffProductsByText(query)
        .then(setOffResults)
        .catch(() => setOffError('No pudimos buscar en Open Food Facts.'))
        .finally(() => setIsSearchingOff(false))
    }, 400)

    return () => clearTimeout(timeout)
  }, [query, view])

  const filteredCustomFoods = customFoods.filter((food) =>
    food.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  function selectCustomFood(food: CustomFood) {
    setSelected({
      name: food.name,
      per100g: {
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g,
        fatPer100g: food.fatPer100g,
        carbsPer100g: food.carbsPer100g,
      },
      typicalPortionG: food.typicalPortionG,
      source: 'custom',
      foodId: food.id,
      offBarcode: null,
    })
    setQuantityG(food.typicalPortionG != null ? String(food.typicalPortionG) : '')
    setView('quantity')
  }

  function selectOffProduct(product: OffProduct) {
    const per100g = mapOffProductToPer100g(product)
    if (!per100g) return

    const servingGrams = extractOffServingGrams(product)
    setSelected({
      name: product.productName ?? 'Producto sin nombre',
      per100g,
      typicalPortionG: servingGrams,
      source: 'off',
      foodId: null,
      offBarcode: product.code,
    })
    setQuantityG(servingGrams != null ? String(servingGrams) : '')
    setView('quantity')
  }

  async function handleBarcodeDetected(barcode: string) {
    setView('search')
    setBarcodeNotFound(false)
    setIncompleteProductFound(false)
    setOffError(null)
    try {
      const product = await getOffProductByBarcode(barcode)
      if (!product) {
        setBarcodeNotFound(true)
        return
      }
      if (!mapOffProductToPer100g(product)) {
        setIncompleteProductFound(true)
        return
      }
      selectOffProduct(product)
    } catch {
      setOffError('No pudimos buscar en Open Food Facts.')
    }
  }

  async function handleConfirmQuantity() {
    if (!selected) return
    const quantity = Number(quantityG)
    if (!quantity || quantity <= 0) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const macros = scaleToQuantity(selected.per100g, quantity)
      await createFoodLogEntry({
        logDate,
        name: selected.name,
        quantityG: quantity,
        macros,
        source: selected.source,
        foodId: selected.foodId,
        offBarcode: selected.offBarcode,
      })
      onAdded()
      onClose()
    } catch {
      setSaveError('No pudimos guardar el alimento.')
    } finally {
      setIsSaving(false)
    }
  }

  if (view === 'manage') {
    return (
      <div className="flex flex-col gap-4">
        <CustomFoodsManager onSelect={selectCustomFood} />
        <Button type="button" variant="outline" onClick={() => setView('search')}>
          Volver a buscar
        </Button>
      </div>
    )
  }

  if (view === 'scan') {
    return <BarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setView('search')} />
  }

  if (view === 'quantity' && selected) {
    const preview = quantityG ? scaleToQuantity(selected.per100g, Number(quantityG)) : null

    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">{selected.name}</p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="entryQuantity">Cantidad (g)</Label>
          <Input
            id="entryQuantity"
            type="number"
            step="1"
            value={quantityG}
            onChange={(e) => setQuantityG(e.target.value)}
            autoFocus
          />
        </div>
        {preview && (
          <p className="text-sm text-muted-foreground">
            {Math.round(preview.calories)} kcal · P {Math.round(preview.proteinG)}g · G{' '}
            {Math.round(preview.fatG)}g · C {Math.round(preview.carbsG)}g
          </p>
        )}
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        <div className="flex gap-2">
          <Button type="button" disabled={isSaving} onClick={handleConfirmQuantity}>
            {isSaving ? 'Guardando...' : 'Agregar'}
          </Button>
          <Button type="button" variant="outline" onClick={() => setView('search')}>
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Input placeholder="Buscar alimento..." value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setView('scan')}>
          Escanear código de barras
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setView('manage')}>
          Mis alimentos
        </Button>
      </div>

      {barcodeNotFound && (
        <p className="text-sm text-amber-600">
          No encontramos ese producto en Open Food Facts. Probá buscarlo por texto o cargalo como alimento
          propio.
        </p>
      )}

      {incompleteProductFound && (
        <p className="text-sm text-amber-600">
          Este producto no tiene datos nutricionales completos en Open Food Facts. Probá cargarlo como
          alimento propio.
        </p>
      )}

      {filteredCustomFoods.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Mis alimentos</p>
          {filteredCustomFoods.map((food) => (
            <button
              key={food.id}
              type="button"
              className="text-left text-sm underline"
              onClick={() => selectCustomFood(food)}
            >
              {food.name}
            </button>
          ))}
        </div>
      )}

      {isSearchingOff && <p className="text-sm text-muted-foreground">Buscando en Open Food Facts...</p>}
      {offError && <p className="text-sm text-red-600">{offError}</p>}

      {offResults.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Open Food Facts</p>
          {offResults.map((product) => {
            const per100g = mapOffProductToPer100g(product)
            return (
              <button
                key={product.code}
                type="button"
                disabled={!per100g}
                className="text-left text-sm underline disabled:text-muted-foreground disabled:no-underline"
                onClick={() => selectOffProduct(product)}
              >
                {product.productName ?? 'Producto sin nombre'}
                {!per100g && ' (datos incompletos)'}
              </button>
            )
          })}
        </div>
      )}

      <Button type="button" variant="outline" onClick={onClose}>
        Cerrar
      </Button>
    </div>
  )
}
