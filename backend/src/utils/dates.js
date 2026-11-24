/* Date helpers. Dates are ISO strings: 'YYYY-MM-DD' for days, full ISO for timestamps. */
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

/* Monday-anchored week ending (Sunday) for a given date */
function weekEnding(d) {
  const x = new Date(d || today());
  const day = x.getUTCDay();                 // 0 Sun
  const add = day === 0 ? 0 : 7 - day;
  x.setUTCDate(x.getUTCDate() + add);
  return x.toISOString().slice(0, 10);
}

const isSunday = wk => /^\d{4}-\d{2}-\d{2}$/.test(wk) && new Date(wk + 'T00:00:00Z').getUTCDay() === 0;

module.exports = { now, today, weekEnding, isSunday };
