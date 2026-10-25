export type ScreenLayout = { padding: number; gap: number; board: number };

/** 只使用安全區內的容器尺寸及已量測固定區塊，不重複扣除安全區。 */
export function screenLayout(width: number, height: number, header = 0, footer = 0): ScreenLayout {
  const padding = height < 650 || width < 360 ? 10 : 16;
  const gap = height < 650 ? 6 : 10;
  const board = Math.max(0, Math.min(432, width - padding * 2, height - padding * 2 - header - footer - gap * 2));
  return { padding, gap, board };
}

export type InfoSection = { title: string; text: string };

/** 先以保守字寬估計分頁；畫面還會以實際文字量測繼續拆分過高的頁面。 */
export function paginateSections(sections: InfoSection[], width: number, height: number, fontScale: number): InfoSection[] {
  const columns = Math.max(1, Math.floor(width / (16 * fontScale * 1.1)));
  const lines = Math.max(1, Math.floor(height / (25 * fontScale)) - 1);
  const capacity = Math.max(1, columns * lines);
  return sections.flatMap(/** 每個主題至少佔一頁，不遺漏任何字元。 */ section => {
    const characters = Array.from(section.text), pages: InfoSection[] = [];
    for (let i = 0; i < characters.length; i += capacity) pages.push({ title: section.title, text: characters.slice(i, i + capacity).join('') });
    return pages.length ? pages : [{ ...section }];
  });
}

/** 實際量測仍超高時再對半拆分，保留 Unicode 字元與全部內容。 */
export function splitPage(page: InfoSection): InfoSection[] {
  const chars = Array.from(page.text), midpoint = Math.ceil(chars.length / 2);
  return chars.length <= 1 ? [page] : [{ ...page, text: chars.slice(0, midpoint).join('') }, { ...page, text: chars.slice(midpoint).join('') }];
}
