// date.js — date helpers shared by review scheduling, vocab grouping, and the check-in calendar.
// Dates are represented as 'YYYY-MM-DD' strings throughout local storage so they sort/compare as plain strings.

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function formatDate(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function today() {
  return formatDate(new Date());
}

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateStr, days) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function diffDays(fromStr, toStr) {
  const from = parseDate(fromStr);
  const to = parseDate(toStr);
  return Math.round((to - from) / 86400000);
}

// Monday-Sunday week range containing dateStr, formatted for the vocab week grouping (e.g. 2026/07/27–2026/08/02).
function getWeekRange(dateStr) {
  const d = parseDate(dateStr);
  const dow = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon..7=Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - (dow - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    key: formatDate(monday),
    label: formatSlash(monday) + '–' + formatSlash(sunday),
  };
}

function formatSlash(d) {
  return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate());
}

function getMonthKey(dateStr) {
  const d = parseDate(dateStr);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
}

function getMonthLabel(dateStr) {
  const d = parseDate(dateStr);
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
}

function getYearKey(dateStr) {
  return String(parseDate(dateStr).getFullYear());
}

function getYearLabel(dateStr) {
  return parseDate(dateStr).getFullYear() + '年';
}

// Calendar matrix for the check-in view: weeks of 7 cells (null for padding), Monday-first.
function getMonthMatrix(year, month) {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = first.getDay() === 0 ? 7 : first.getDay();
  const cells = [];
  for (let i = 1; i < firstDow; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(year + '-' + pad(month) + '-' + pad(day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

module.exports = {
  today,
  formatDate,
  parseDate,
  addDays,
  diffDays,
  getWeekRange,
  getMonthKey,
  getMonthLabel,
  getYearKey,
  getYearLabel,
  getMonthMatrix,
};
