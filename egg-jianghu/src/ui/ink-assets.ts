/** 新美术可分批放入此目录；没有重绘的条目继续使用原素材。 */
const images = import.meta.glob<string>('../assets/ink/**/*.{png,webp}', { eager: true, import: 'default' })

export const inkAsset = (key: string): string | undefined =>
  images[`../assets/ink/${key}.webp`] ?? images[`../assets/ink/${key}.png`]

let absoluteUrls: Set<string> | undefined

export const markInkImages = (root: HTMLElement): void => {
  const urls = absoluteUrls ??= new Set(Object.values(images).map(url => new URL(url, document.baseURI).href))
  for (const image of root.querySelectorAll<HTMLImageElement>('img')) {
    if (urls.has(image.src)) image.dataset.inkAsset = 'true'
    else delete image.dataset.inkAsset
  }
}
