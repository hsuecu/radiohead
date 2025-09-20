import { ymd, ymdHMS } from "./time";

export function buildCloudPath(station: string, date = new Date(), categoryCode: string) {
  const { y, m, d } = ymd(date);
  return `/${station}/${y}/${m}/${d}/${categoryCode}/`;
}

export function buildFilename(station: string, code: string, date = new Date(), user: string, version = 1) {
  const { y, m, d, hh, mm, ss } = ymdHMS(date);
  const stamp = `${y}${m}${d}_${hh}${mm}${ss}`;
  return `${station}_${code}_${stamp}_${user}_v${version}.wav`;
}
