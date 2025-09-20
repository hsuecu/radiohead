export function pad(n: number, l = 2) {
  return n.toString().padStart(l, "0");
}
export function ymd(date = new Date()) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return { y, m, d };
}
export function ymdHMS(date = new Date()) {
  const { y, m, d } = ymd(date);
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return { y, m, d, hh, mm, ss };
}
