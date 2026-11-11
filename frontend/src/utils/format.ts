const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

export function getIdFromUrl(url: string): string {
  const id = url.split('/').filter(Boolean).pop();
  if (!id) throw new Error(`Cannot read an id from "${url}"`);
  return id;
}

export function toRoman(value: number): string {
  return ROMAN[value] ?? String(value);
}

export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export function withUnit(value: string, unit: string): string {
  return /^[\d.,]+$/.test(value) ? `${value} ${unit}` : value;
}
