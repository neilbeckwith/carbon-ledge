/* Carbon Ledger — country CO2 ledger.
   Data: data.json, built from Our World in Data / Global Carbon Budget.
   Units in the file are Mt CO2. 1 Gt = 1,000 Mt.
   Live counter: spreads the latest annual world rate evenly across the year.
   It is an estimate, not a measurement. */
let DATA = null;
let selectedYear = 2025;
let showAll = false;
let selectedCountry = null; // iso code
let compareSlots = ["CHN", "", ""]; // up to 3 iso codes, one per picker slot; China pre-selected
const COMPARE_COLORS = ["#b7791f", "#2b6cb0", "#a33"];

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 0) => n == null || isNaN(n) ? "—" : Number(n).toLocaleString("en-CA", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtMt = (n) => fmt(n, 0);
const pct = (n) => n == null || isNaN(n) ? "—" : (n > 0 ? "+" : "") + n.toFixed(1) + "%";

function seriesValue(country, year) {
  const p = country.series.find((s) => s[0] === year);
  return p ? p[1] : null;
}
function cumulativeTo(country, year) {
  let s = 0, seen = false;
  for (const [y, v] of country.series) { if (y <= year) { s += v; seen = true; } }
  return seen ? s : null;
}
function yoy(country, year) {
  const cur = seriesValue(country, year), prev = seriesValue(country, year - 1);
  if (cur == null || prev == null || prev === 0) return null;
  return (cur - prev) / prev * 100;
}

function drawChart() {
  const svg = $("worldChart");
  const W = 900, H = 320, PL = 56, PR = 16, PT = 18, PB = 34;
  const world = DATA.world.filter((w) => w.co2 != null);
  const maxV = Math.max(...world.map((w) => w.co2));
  const x = (y) => PL + (y - 1750) / (2025 - 1750) * (W - PL - PR);
  const y = (v) => PT + (1 - v / (maxV * 1.05)) * (H - PT - PB);
  const line = (pts) => pts.map((p, i) => (i ? "L" : "M") + x(p[0]).toFixed(1) + "," + y(p[1]).toFixed(1)).join(" ");
  let s = "";
  // gridlines + labels
  for (let g = 0; g <= 4; g++) {
    const v = maxV * g / 4, yy = y(v);
    s += `<line x1="${PL}" y1="${yy}" x2="${W - PR}" y2="${yy}" stroke="#e3eae6"/><text x="${PL - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#5a6b64">${fmt(v)}</text>`;
  }
  for (const yr of [1750, 1850, 1900, 1950, 2000, 2025]) {
    s += `<text x="${x(yr)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="#5a6b64">${yr}</text>`;
  }
  s += `<text x="${PL}" y="${PT - 4}" font-size="11" fill="#5a6b64">Mt CO₂ per year</text>`;
  s += `<path d="${line(world.map((w) => [w.year, w.co2]))}" fill="none" stroke="#0b6b4a" stroke-width="2.5"/>`;
  // Compare: up to 3 countries on the same world scale, so they are directly
  // comparable with the world and each other. While a comparison is set, the
  // single-country own-scale overlay below is suppressed to avoid mixing scales.
  const cmp = compareSlots.filter(Boolean);
  if (cmp.length) {
    cmp.forEach((iso, i) => {
      const c = DATA.countries.find((cc) => cc.iso === iso);
      if (!c) return;
      const pts = c.series.filter((p) => p[0] >= 1750 && p[1] != null);
      s += `<path d="${line(pts)}" fill="none" stroke="${COMPARE_COLORS[i]}" stroke-width="2"/>`;
    });
    $("legendCountrySw").style.display = "none";
    $("legendCountry").textContent = "";
    $("compareLegend").innerHTML = cmp.map((iso, i) => {
      const c = DATA.countries.find((cc) => cc.iso === iso);
      return c ? `<span class="sw cmp${i + 1}"></span> ${c.name} (${fmtMt(c.latest)} Mt in ${c.latest_year})` : "";
    }).join("");
  } else if (selectedCountry) {
    const c = DATA.countries.find((cc) => cc.iso === selectedCountry);
    if (c) {
      const pts = c.series.filter((p) => p[0] >= 1750);
      // country values are far smaller than world; draw on its own scale, dashed, for shape
      const cmax = Math.max(...pts.map((p) => p[1]));
      const cy = (v) => PT + (1 - v / (cmax * 1.05)) * (H - PT - PB);
      s += `<path d="${pts.map((p, i) => (i ? "L" : "M") + x(p[0]).toFixed(1) + "," + cy(p[1]).toFixed(1)).join(" ")}" fill="none" stroke="#b7791f" stroke-width="2" stroke-dasharray="5 3"/>`;
      $("legendCountrySw").style.display = "";
      $("legendCountry").textContent = c.name + " (own scale, dashed)";
    }
    $("compareLegend").innerHTML = "";
  } else {
    $("legendCountrySw").style.display = "";
    $("legendCountry").textContent = "Selected country";
    $("compareLegend").innerHTML = "";
  }
  svg.innerHTML = s;
  const w25 = world.find((w) => w.year === 2025), w24 = world.find((w) => w.year === 2024);
  $("worldStats").innerHTML =
    `<span>1750: ${fmtMt(world[0].co2)} Mt</span><span>1950: ${fmtMt((world.find((w) => w.year === 1950) || {}).co2)} Mt</span>` +
    `<span>2000: ${fmtMt((world.find((w) => w.year === 2000) || {}).co2)} Mt</span><span>2024: ${fmtMt(w24.co2)} Mt</span>` +
    `<span>2025: ${fmtMt(w25.co2)} Mt (${pct(w25.growth)} vs 2024)</span><span>Cumulative 1750–2025: ${fmtMt(w25.cum)} Mt</span>`;
}

/* Compare up to 3 countries on the world chart. */
function populateCompareSelects() {
  const opts = [{ iso: "", name: "—" }].concat(
    DATA.countries.slice().sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ iso: c.iso, name: c.name })));
  ["compare1", "compare2", "compare3"].forEach((id, i) => {
    const sel = $(id);
    sel.innerHTML = opts.map((o) => `<option value="${o.iso}">${o.name}</option>`).join("");
    sel.value = compareSlots[i] || "";
  });
}
function onCompareChange(slot) {
  const iso = $("compare" + (slot + 1)).value;
  // a country can only appear once — clear it from the other slots
  if (iso) {
    for (let i = 0; i < 3; i++) {
      if (i !== slot && compareSlots[i] === iso) {
        compareSlots[i] = "";
        $("compare" + (i + 1)).value = "";
      }
    }
  }
  compareSlots[slot] = iso;
  drawChart();
}
function clearCompare() {
  compareSlots = ["", "", ""];
  ["compare1", "compare2", "compare3"].forEach((id) => { $(id).value = ""; });
  drawChart();
}

/* CSV export — pure client-side, no new dependencies. */
function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadCsv(filename, header, rows) {
  const lines = [header.map(csvEscape).join(",")].concat(rows.map((r) => r.map(csvEscape).join(",")));
  const blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function downloadTableCsv() {
  const rows = currentRows();
  downloadCsv(`carbon-ledger-countries-${selectedYear}.csv`,
    ["Country", "ISO", "Emissions (Mt CO2)", "Share of world (%)", "YoY (%)", "Per person (t CO2)", "Cumulative (Mt CO2)", "Share of cumulative (%)"],
    rows.map((r) => [r.c.name, r.c.iso, +r.v.toFixed(3), r.share == null ? null : +r.share.toFixed(2),
      r.growth == null ? null : +r.growth.toFixed(1), r.percap == null ? null : +r.percap.toFixed(2),
      r.cum == null ? null : +r.cum.toFixed(3), r.cumShare == null ? null : +r.cumShare.toFixed(2)]));
}
function downloadCountryCsv() {
  if (!selectedCountry) return;
  const c = DATA.countries.find((cc) => cc.iso === selectedCountry);
  if (!c) return;
  downloadCsv(`carbon-ledger-${c.iso.toLowerCase()}-history.csv`,
    ["Year", "Emissions (Mt CO2)", "YoY (%)", "Cumulative (Mt CO2)"],
    c.series.map(([yr, v]) => {
      const g = yoy(c, yr);
      return [yr, +v.toFixed(3), g == null ? null : +g.toFixed(1), +cumulativeTo(c, yr).toFixed(3)];
    }));
}

function currentRows() {
  const q = ($("search").value || "").toLowerCase();
  const worldYear = DATA.world.find((w) => w.year === selectedYear);
  const worldCo2 = worldYear ? worldYear.co2 : null;
  const worldCum = worldYear ? worldYear.cum : null;
  let rows = DATA.countries.map((c) => {
    const v = seriesValue(c, selectedYear);
    if (v == null) return null;
    const cum = cumulativeTo(c, selectedYear);
    return {
      c, v,
      share: worldCo2 ? v / worldCo2 * 100 : null,
      growth: yoy(c, selectedYear),
      cum,
      cumShare: worldCum && cum != null ? cum / worldCum * 100 : null,
      percap: selectedYear === DATA.meta.latest_year ? c.per_capita : null,
    };
  }).filter(Boolean);
  if (q) rows = rows.filter((r) => r.c.name.toLowerCase().includes(q) || r.c.iso.toLowerCase().includes(q));
  const sort = $("sort").value;
  if (sort === "name") rows.sort((a, b) => a.c.name.localeCompare(b.c.name));
  else if (sort === "growth") rows.sort((a, b) => (b.growth ?? -1e9) - (a.growth ?? -1e9));
  else if (sort === "cumulative") rows.sort((a, b) => (b.cum ?? 0) - (a.cum ?? 0));
  else if (sort === "percapita") rows.sort((a, b) => (b.percap ?? -1) - (a.percap ?? -1));
  else rows.sort((a, b) => b.v - a.v);
  return rows;
}

function renderTable() {
  const rows = currentRows();
  const total = rows.length;
  const shown = showAll ? rows : rows.slice(0, 25);
  $("tableMeta").textContent = `${total} ${total === 1 ? "country" : "countries"} with data in ${selectedYear}${showAll ? "" : " — showing top 25 by the current sort"}. Click a row for that country's detail.`;
  $("tbody").innerHTML = shown.map((r, i) => {
    const g = r.growth;
    const cls = g == null ? "" : g >= 0 ? "pos" : "neg";
    return `<tr data-iso="${r.c.iso}"><td>${i + 1}</td><td>${r.c.name} <span style="color:#5a6b64">${r.c.iso}</span></td>` +
      `<td>${fmtMt(r.v)}</td><td>${r.share == null ? "—" : r.share.toFixed(2) + "%"}</td>` +
      `<td class="${cls}">${pct(g)}</td><td>${r.percap == null ? "—" : r.percap.toFixed(2)}</td>` +
      `<td>${fmtMt(r.cum)}</td><td>${r.cumShare == null ? "—" : r.cumShare.toFixed(2) + "%"}</td></tr>`;
  }).join("");
  document.querySelectorAll("#tbody tr").forEach((tr) => tr.addEventListener("click", () => selectCountry(tr.dataset.iso)));
}

function selectCountry(iso) {
  selectedCountry = iso;
  const c = DATA.countries.find((cc) => cc.iso === iso);
  if (!c) return;
  drawChart();
  $("downloadCountryCsv").disabled = false;
  const last10 = c.series.filter((p) => p[0] > DATA.meta.latest_year - 10).slice().reverse();
  const rows = last10.map(([yr, v]) => {
    const g = yoy(c, yr);
    return `<tr><td>${yr}</td><td>${fmtMt(v)}</td><td class="${g == null ? "" : g >= 0 ? "pos" : "neg"}">${pct(g)}</td><td>${fmtMt(cumulativeTo(c, yr))}</td></tr>`;
  }).join("");
  $("detail").innerHTML =
    `<h3>${c.name} (${c.iso})</h3>` +
    `<p>Latest year in the dataset: ${c.latest_year} — <strong>${fmtMt(c.latest)} Mt</strong> (${c.share == null ? "—" : c.share.toFixed(2) + "%"} of the world), ` +
    `${pct(c.growth_prct)} vs the previous year, ${c.per_capita == null ? "—" : c.per_capita.toFixed(2)} t per person, cumulative ${fmtMt(c.cumulative)} Mt.</p>` +
    `<p class="caption">Annual emissions and YoY % for ${c.name}. Source: Our World in Data / Global Carbon Budget.</p>` +
    `<div class="table-wrap"><table><thead><tr><th>Year</th><th>Emissions (Mt)</th><th>YoY %</th><th>Cumulative (Mt)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  $("detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function startCounter() {
  // 2025 world total, spread evenly. 2025 is not a leap year.
  const annualTonnes = 38995105000;
  const ratePerSec = annualTonnes / (365 * 24 * 3600); // ≈ 1,237 t/s
  const cumulativeEnd2025Mt = 1886832.625;
  const start2026 = Date.UTC(2026, 0, 1);
  const openedAt = Date.now();
  $("rateLine").textContent = `${fmt(ratePerSec, 0)} tonnes per second (2025 world rate, spread evenly)`;
  function tick() {
    const now = Date.now();
    const sinceOpenedT = ratePerSec * (now - openedAt) / 1000;
    $("sinceOpened").textContent = `${fmt(sinceOpenedT, 1)} t`;
    const elapsed2026Sec = Math.max(0, (now - start2026) / 1000);
    const cumT = cumulativeEnd2025Mt * 1000 + ratePerSec * elapsed2026Sec;
    $("cumulativeLive").textContent = `${fmt(cumT / 1e9, 3)} Gt`;
    $("cumulativeSub").textContent = `1,886,833 Mt at end-2025 + ${fmt(ratePerSec * elapsed2026Sec / 1e6, 1)} Mt estimated in 2026 to date`;
  }
  tick();
  setInterval(tick, 250);
}

async function init() {
  const res = await fetch("data.json");
  DATA = await res.json();
  selectedYear = DATA.meta.latest_year;
  $("latestYear").textContent = DATA.meta.latest_year;
  $("yearRange").max = DATA.meta.latest_year;
  $("yearRange").value = selectedYear;
  const w = DATA.world.find((x) => x.year === DATA.meta.latest_year);
  if (w) {
    $("world2025").textContent = `${fmtMt(w.co2)} Mt`;
    $("worldYoY").textContent = `${pct(w.growth)} vs ${DATA.meta.latest_year - 1}`;
  }
  drawChart();
  renderTable();
  startCounter();
  populateCompareSelects();
  drawChart(); // re-draw with the pre-selected comparison (China)
  $("yearRange").addEventListener("input", (e) => { selectedYear = Number(e.target.value); $("yearLabel").textContent = selectedYear; renderTable(); });
  $("search").addEventListener("input", renderTable);
  $("sort").addEventListener("change", renderTable);
  $("showAll").addEventListener("click", () => { showAll = !showAll; $("showAll").textContent = showAll ? "Show top 25" : "Show all countries"; renderTable(); });
  $("downloadCsv").addEventListener("click", downloadTableCsv);
  $("downloadCountryCsv").addEventListener("click", downloadCountryCsv);
  $("compare1").addEventListener("change", () => onCompareChange(0));
  $("compare2").addEventListener("change", () => onCompareChange(1));
  $("compare3").addEventListener("change", () => onCompareChange(2));
  $("clearCompare").addEventListener("click", clearCompare);
  $("pickChina").addEventListener("click", () => selectCountry("CHN"));
}
init().catch((e) => { document.querySelector("main").insertAdjacentHTML("afterbegin", `<p class="note">Could not load data.json — ${e.message}. Serve this folder over HTTP (not file://) or check the data file.</p>`); });
