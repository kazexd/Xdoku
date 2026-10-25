// 每個色區固定使用一個獨有色彩，以色相及明度差異區分最多十隻貓。
export const REGION_COLORS = [
  '#F2A7B5', '#F7BC72', '#F4E66B', '#B9D96B', '#68C99B',
  '#76D5DE', '#83B0EF', '#B79AEA', '#DADDE3', '#C99B78',
] as const;
export const MARK_COLOR = '#29352E';

/** 依色區編號取得唯一底色；拒絕越界編號，避免循環配色讓不同貓共用同色。 */
export function regionColor(region: number): string {
  if (!Number.isInteger(region) || region < 0 || region >= REGION_COLORS.length) {
    throw new RangeError('Region must be an integer from 0 to 9');
  }
  return REGION_COLORS[region];
}
