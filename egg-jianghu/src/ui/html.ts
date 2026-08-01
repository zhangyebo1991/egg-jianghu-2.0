export const escapeHtml = (value: string): string => value.replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
})[character] ?? character)

export const formatNumber = (value: number): string => Math.floor(value).toLocaleString('zh-CN')

export const percent = (value: number, maximum: number): number =>
  maximum <= 0 ? 0 : Math.max(0, Math.min(100, value / maximum * 100))
