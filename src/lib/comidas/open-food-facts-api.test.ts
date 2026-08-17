import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchOffProductsByText, getOffProductByBarcode } from './open-food-facts-api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchOffProductsByText', () => {
  it('mapea productos de una respuesta de búsqueda con datos completos', async () => {
    const fixture = {
      products: [
        {
          code: '1234567890123',
          product_name: 'Yogur natural',
          nutriments: {
            'energy-kcal_100g': 61,
            proteins_100g: 3.5,
            fat_100g: 3.2,
            carbohydrates_100g: 4.7,
          },
          serving_quantity: 125,
        },
      ],
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(fixture) }))

    const result = await searchOffProductsByText('yogur')

    expect(result).toEqual([
      {
        code: '1234567890123',
        productName: 'Yogur natural',
        nutriments: {
          'energy-kcal_100g': 61,
          proteins_100g: 3.5,
          fat_100g: 3.2,
          carbohydrates_100g: 4.7,
        },
        servingQuantity: 125,
      },
    ])
  })

  it('devuelve lista vacía si la respuesta no trae "products"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }))

    const result = await searchOffProductsByText('algo raro')

    expect(result).toEqual([])
  })

  it('lanza un error si la respuesta no es ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }))

    await expect(searchOffProductsByText('yogur')).rejects.toThrow()
  })
})

describe('getOffProductByBarcode', () => {
  it('mapea un producto encontrado, incluyendo serving_quantity como string', () => {
    const fixture = {
      status: 1,
      product: {
        code: '9999999999999',
        product_name: 'Barrita de cereal',
        nutriments: {
          'energy-kcal_100g': 400,
          proteins_100g: 8,
          fat_100g: 12,
          carbohydrates_100g: 60,
        },
        serving_quantity: '30',
      },
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(fixture) }))

    return getOffProductByBarcode('9999999999999').then((result) => {
      expect(result).toEqual({
        code: '9999999999999',
        productName: 'Barrita de cereal',
        nutriments: {
          'energy-kcal_100g': 400,
          proteins_100g: 8,
          fat_100g: 12,
          carbohydrates_100g: 60,
        },
        servingQuantity: 30,
      })
    })
  })

  it('devuelve null si el producto no existe en Open Food Facts (status 0)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 0 }) }))

    const result = await getOffProductByBarcode('0000000000000')

    expect(result).toBeNull()
  })

  it('lanza un error si la respuesta no es ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }))

    await expect(getOffProductByBarcode('123')).rejects.toThrow()
  })
})
