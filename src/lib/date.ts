export function todayLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftLocalDate(date: string, deltaDays: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(year, month - 1, day + deltaDays)
  const shiftedYear = shifted.getFullYear()
  const shiftedMonth = String(shifted.getMonth() + 1).padStart(2, '0')
  const shiftedDay = String(shifted.getDate()).padStart(2, '0')
  return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`
}
