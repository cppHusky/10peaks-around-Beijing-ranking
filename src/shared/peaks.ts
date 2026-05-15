export type Branch = {
  name: string;
  peaks: string[];
};

export const BRANCHES: Branch[] = [
  {
    name: "知名高峰",
    peaks: ["东灵山", "小五台山", "东猴顶", "雾灵山", "海坨山"],
  },
  {
    name: "特色美食",
    peaks: ["燕羽山", "长峪城", "挂壁公路", "麻田岭", "露营活动"],
  },
  {
    name: "高山草甸",
    peaks: ["天马草原", "百花山", "茶山", "大黑峰", "汗海梁"],
  },
  {
    name: "珍奇地貌",
    peaks: ["赤壁", "冰山梁", "云蒙山", "白石山"],
  },
  {
    name: "古今建筑",
    peaks: ["桦皮岭", "东甸子梁", "喜鹊梁", "云雾山", "黄草梁", "阳台山"],
  },
  {
    name: "鸟语花香",
    peaks: ["北灵山", "南灵山", "喇叭沟门", "老龙窝", "安全沟梁"],
  },
];

export const PEAKS = BRANCHES.flatMap((branch) => branch.peaks);

export const PEAK_INDEX = new Map(PEAKS.map((peak, index) => [peak, index]));

export function hasPeak(mask: number, peakIndex: number): boolean {
  return (mask & (1 << peakIndex)) !== 0;
}

export function countBits(mask: number): number {
  let value = mask >>> 0;
  let count = 0;
  while (value) {
    value &= value - 1;
    count++;
  }
  return count;
}

export function maskToPeaks(mask: number): string[] {
  return PEAKS.filter((_, index) => hasPeak(mask, index));
}

export function branchCounts(mask: number): number[] {
  let offset = 0;
  return BRANCHES.map((branch) => {
    const count = branch.peaks.reduce((sum, _peak, index) => {
      return sum + (hasPeak(mask, offset + index) ? 1 : 0);
    }, 0);
    offset += branch.peaks.length;
    return count;
  });
}
