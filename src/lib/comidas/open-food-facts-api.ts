import type { OffProduct } from './food-calculation'

const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl'
const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product'

type OffApiProduct = {
  code?: string
  product_name?: string
  nutriments?: OffProduct['nutriments']
  serving_quantity?: number | string
}

function mapApiProduct(raw: OffApiProduct): OffProduct {
  let servingQuantity: number | null = null
  if (typeof raw.serving_quantity === 'number') {
    servingQuantity = raw.serving_quantity
  } else if (typeof raw.serving_quantity === 'string' && raw.serving_quantity !== '') {
    const parsed = Number(raw.serving_quantity)
    servingQuantity = Number.isNaN(parsed) ? null : parsed
  }

  return {
    code: raw.code ?? '',
    productName: raw.product_name ?? null,
    nutriments: raw.nutriments ?? {},
    servingQuantity,
  }
}

export async function searchOffProductsByText(query: string): Promise<OffProduct[]> {
  const url = `${OFF_SEARCH_URL}?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,nutriments,serving_quantity`

  const response = await fetch(url)
  if (!response.ok) throw new Error('No pudimos buscar en Open Food Facts.')

  const data = await response.json()
  const products = Array.isArray(data.products) ? data.products : []

  return products.map(mapApiProduct)
}

export async function getOffProductByBarcode(barcode: string): Promise<OffProduct | null> {
  const url = `${OFF_PRODUCT_URL}/${encodeURIComponent(barcode)}.json?fields=code,product_name,nutriments,serving_quantity`

  const response = await fetch(url)
  if (!response.ok) throw new Error('No pudimos buscar en Open Food Facts.')

  const data = await response.json()
  if (data.status === 0 || !data.product) return null

  return mapApiProduct(data.product)
}
