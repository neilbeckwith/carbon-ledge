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

/* Compare up to 3 countries on the world chart. The pickers are text inputs
   with a datalist, so they filter as you type (220 countries is too many to
   scroll). Typing is resolved to a country by name or ISO code. */
function populateCountryList() {
  const opts = DATA.countries.slice().sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `<option value="${c.name}" label="${c.iso}"></option>`).join("");
  $("countryList").innerHTML = opts;
  ["compare1", "compare2", "compare3"].forEach((id, i) => {
    const iso = compareSlots[i];
    $(id).value = iso ? countryName(iso) : "";
  });
}
function countryName(iso) {
  const c = DATA.countries.find((cc) => cc.iso === iso);
  return c ? c.name : "";
}
function resolveCountry(text) {
  const t = (text || "").trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  const c = DATA.countries.find((cc) => cc.name.toLowerCase() === lower || cc.iso.toLowerCase() === lower)
    || DATA.countries.find((cc) => cc.name.toLowerCase().startsWith(lower));
  return c ? c.iso : null;
}
function onCompareChange(slot) {
  const input = $("compare" + (slot + 1));
  const iso = resolveCountry(input.value);
  if (iso === null) { input.value = countryName(compareSlots[slot]); return; } // unknown text: revert
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
  input.value = countryName(iso);
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

/* Sector tap point — a transparent judgement, not a hidden score.
   Each sector is rated 1–3 on reduction potential, ease of transition and
   cost (3 = cheaper than the incumbent, 2 = adds slight cost, 1 = extensive
   innovation still needed), and the score is share × potential × ease × cost.
   The tap point is the highest score: the lowest friction and highest yield,
   not necessarily the largest share. Ratings and their basis are in the
   Methods section; the table in the panel shows every rating. */
const SECTOR_META = [
  { key: "coal", label: "Coal", potential: 3, potentialWord: "High", ease: 3, easeWord: "High", cost: 3, costWord: "Cheaper than the incumbent", stage: "Commercial", why: "91% of new renewable projects in 2024 were cheaper than the cheapest new fossil alternative (IRENA 2025).", costFigure: "Wind $34/MWh, solar $43/MWh — global average cost of new power, 2024 (IRENA 2025, measured)" },
  { key: "oil", label: "Oil", potential: 3, potentialWord: "High", ease: 2, easeWord: "Medium", cost: 2, costWord: "Adds slight cost", stage: "Commercial", why: "EVs at lifetime cost parity in much of Europe, but higher upfront price and slow fleet turnover (IEA 2024).", costFigure: "No single $/t CO₂ figure is published — about $1,200 extra to build, about $4,700 fuel savings over 8 years (ICCT 2023, estimate)" },
  { key: "gas", label: "Gas", potential: 2, potentialWord: "Medium", ease: 2, easeWord: "Medium", cost: 2, costWord: "Adds slight cost", stage: "Commercial", why: "Heat pumps are mature, but high-temperature industrial heat still needs hydrogen (IEA).", costFigure: "No single $/t CO₂ figure is published — 2–4× a gas boiler upfront, $300/yr (US) to $900/yr (Europe) lower bills (IEA 2022, estimate)" },
  { key: "cement", label: "Cement", potential: 2, potentialWord: "Medium", ease: 1, easeWord: "Low", cost: 1, costWord: "Extensive innovation still needed", stage: "Early-stage", why: "~60% is process CO₂ from calcination; CCUS costs $100–200/t and is at demonstration scale (IEA; WEF 2023).", costFigure: "$100–200/t CO₂ captured; first full-scale plant Brevik, Norway, 400,000 t/yr since 2025 (IEA 2023, estimate)" },
  { key: "flaring", label: "Flaring", potential: 1, potentialWord: "Low", ease: 3, easeWord: "High", cost: 3, costWord: "Cheaper than the incumbent", stage: "Commercial", why: "Captured gas has market value — about 40% of oil-and-gas methane abatement costs nothing net, and 74% is available at $10/t CO₂e or less (IEA).", costFigure: "About $0/t net for ~40% of abatement; 74% at $10/t CO₂e or less (IEA, estimate)" },
  { key: "other", label: "Other industry", potential: 2, potentialWord: "Medium", ease: 1, easeWord: "Low", cost: 1, costWord: "Extensive innovation still needed", stage: "Early-stage", why: "Hydrogen steel (H₂-DRI) is at demonstration scale and uneconomical at scale (IEA).", costFigure: "Green steel premium ~$200–300/t steel; break-even needs hydrogen at $1.63/kg or less (Rosner et al. 2023, estimate)" },
];

function sectorBreakdownHtml(c) {
  if (!c.sectors) return `<p class="note">No sector data in this build.</p>`;
  const total = c.latest;
  const rows = SECTOR_META.map((m) => {
    const v = c.sectors[m.key] == null ? 0 : c.sectors[m.key];
    const share = total ? v / total : 0;
    return { ...m, v, share, score: share * m.potential * m.ease * m.cost };
  });
  const sum = rows.reduce((a, r) => a + r.v, 0);
  const sumDiff = Math.abs(sum - total);
  const tap = rows.slice().sort((a, b) => b.score - a.score)[0];
  const largest = rows.slice().sort((a, b) => b.v - a.v)[0];
  const body = rows.map((r) =>
    `<tr${r === tap ? ' class="tap-row"' : ""}><td>${r.label}</td><td>${fmtMt(r.v)}</td>` +
    `<td>${(r.share * 100).toFixed(1)}%</td><td>${r.potentialWord}</td><td>${r.easeWord}</td>` +
    `<td>${r.costWord}</td><td>${r.costFigure}</td><td>${r.stage}</td><td>${r.score.toFixed(1)}</td></tr>`).join("");
  return `<h3>Sector breakdown — ${c.latest_year}</h3>` +
    `<p class="caption">Share of the country's fossil-and-industry total, with the tap-point ratings (1–3) and score. Score = share × reduction potential × ease × cost. Sources and the rating basis are in Methods &amp; sources.</p>` +
    `<div class="table-wrap"><table><thead><tr><th>Sector</th><th>Mt CO₂</th><th>Share</th><th>Reduction potential</th><th>Ease</th><th>Cost</th><th>Cost of the solution</th><th>Stage</th><th>Score</th></tr></thead><tbody>${body}</tbody>` +
    `<tfoot><tr><td><strong>Sectors sum</strong></td><td><strong>${fmtMt(sum)}</strong></td><td><strong>${(sum / total * 100).toFixed(1)}%</strong></td><td colspan="6">Total ${fmtMt(total)} Mt — ${sumDiff < 0.5 ? "sums to the total ✓" : "differs by " + fmt(sumDiff, 1) + " Mt"}</td></tr></tfoot></table></div>` +
    `<p class="caption"><strong>What each row means.</strong> Coal — CO₂ from burning coal. Oil — from burning oil, petrol and diesel. Gas — from burning natural gas. Cement — from making cement, mostly the chemistry of limestone, not the fuel burned. Flaring — from burning off gas at oil and gas sites. Other industry — from other industrial processes, such as steel and chemicals. <strong>What each rating means.</strong> Reduction potential — how much of the sector's CO₂ the alternatives could remove. Ease — how fast and simply the switch can be made. Cost — what the solution costs compared with the incumbent. Cost of the solution — the sourced cost figure for the sector's main alternative, with its year and source; where no single published figure exists, that is stated. Stage — how mature the technology is: commercial means bought and sold today, early-stage means demonstration or pilot. Score — share × reduction potential × ease × cost; higher wins.</p>` +
    `<p class="note tap"><strong>Tap point: ${tap.label}.</strong> Highest score (${tap.score.toFixed(1)}) — ${tap.potentialWord.toLowerCase()} reduction potential, ${tap.easeWord.toLowerCase()} ease, ${tap.costWord.toLowerCase()}, ${tap.stage.toLowerCase()} technology. ${tap.why}` +
    (tap !== largest ? ` ${tap.label} is not the largest share — ${largest.label} is (${fmtMt(largest.v)} Mt, ${(largest.share * 100).toFixed(1)}%) — but it wins on lower friction and higher yield.` : ` It is also the largest share, so the easy cut is the big cut.`) + `</p>`;
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
    `<p class="caption">Annual emissions and YoY % for ${c.name}. Year is the calendar year. Emissions (Mt) is territorial CO₂ from fossil fuels and industry that year. YoY % is the change vs the previous year. Cumulative (Mt) is the sum of the country's annual emissions from 1750 to that year. Source: Our World in Data / Global Carbon Budget.</p>` +
    `<div class="table-wrap"><table><thead><tr><th>Year</th><th>Emissions (Mt)</th><th>YoY %</th><th>Cumulative (Mt)</th></tr></thead><tbody>${rows}</tbody></table></div>` +
    sectorBreakdownHtml(c) +
    (c.luc != null ? `<p class="note">Natural net carbon: ${c.name}'s land was a net ${c.luc > 0 ? "source" : c.luc < 0 ? "sink" : "balance"} of ${c.luc > 0 ? "+" : ""}${fmt(c.luc, 0)} Mt CO₂ in ${c.latest_year} — <a href="#luc-h">see Natural net carbon →</a></p>` : "");
  $("detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* Natural net carbon — net land-use-change CO2 per country, latest year.
   Net only: positive = net source, negative = net sink. No gross split
   exists in the dataset, so none is shown. */
let lucShowAll = false;
function lucRows() {
  const q = ($("lucSearch").value || "").toLowerCase();
  let rows = DATA.countries.filter((c) => c.luc != null).map((c) => ({ c, luc: c.luc }));
  if (q) rows = rows.filter((r) => r.c.name.toLowerCase().includes(q) || r.c.iso.toLowerCase().includes(q));
  rows.sort((a, b) => b.luc - a.luc);
  return rows;
}
function renderLuc() {
  const rows = lucRows();
  const shown = lucShowAll ? rows : rows.slice(0, 15);
  $("lucBody").innerHTML = shown.map((r, i) =>
    `<tr><td>${i + 1}</td><td>${r.c.name} <span style="color:#5a6b64">${r.c.iso}</span></td>` +
    `<td class="${r.luc > 0 ? "neg" : r.luc < 0 ? "pos" : ""}">${r.luc > 0 ? "+" : ""}${fmt(r.luc, 0)}</td>` +
    `<td>${r.luc > 0 ? "Net source" : r.luc < 0 ? "Net sink" : "Balanced"}</td></tr>`).join("");
  const nSrc = rows.filter((r) => r.luc > 0).length, nSnk = rows.filter((r) => r.luc < 0).length;
  const withData = DATA.countries.filter((c) => c.luc != null).length;
  $("lucMeta").textContent = `${withData} of ${DATA.countries.length} countries have net land-use-change data for ${DATA.meta.latest_year} — ${nSrc} net sources, ${nSnk} net sinks. Showing the 15 largest net sources first${lucShowAll ? "" : "; use Show all countries for the full list"}.`;
  const w = DATA.world.find((x) => x.year === DATA.meta.latest_year);
  const topSrc = rows[0], topSnk = rows[rows.length - 1];
  $("lucCards").innerHTML =
    `<div class="card"><div class="label">World net land-use change, ${DATA.meta.latest_year}</div><div class="num">${w && w.luc != null ? "+" + fmt(w.luc, 0) + " Mt" : "—"}</div><div class="sub">Net source — fossil ${fmtMt(w.co2)} Mt + land-use ${fmt(w.luc, 0)} Mt = ${fmtMt(w.co2_incl_luc)} Mt including land-use change</div></div>` +
    `<div class="card"><div class="label">Largest net source</div><div class="num">${topSrc ? topSrc.c.name : "—"}</div><div class="sub">${topSrc ? "+" + fmt(topSrc.luc, 0) + " Mt in " + DATA.meta.latest_year : ""}</div></div>` +
    `<div class="card"><div class="label">Largest net sink</div><div class="num">${topSnk ? topSnk.c.name : "—"}</div><div class="sub">${topSnk ? fmt(topSnk.luc, 0) + " Mt in " + DATA.meta.latest_year : ""}</div></div>` +
    `<div class="card"><div class="label">Countries without a value</div><div class="num">${DATA.countries.length - withData}</div><div class="sub">Mostly small territories, plus Taiwan, Hong Kong and Macao — a gap, not zero</div></div>`;
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
  renderLuc();
  startCounter();
  populateCountryList();
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
  $("inspectCountry").addEventListener("change", () => {
    const iso = resolveCountry($("inspectCountry").value);
    if (iso) selectCountry(iso);
    else $("inspectCountry").value = selectedCountry ? countryName(selectedCountry) : "";
  });
  $("lucSearch").addEventListener("input", renderLuc);
  $("lucShowAll").addEventListener("click", () => { lucShowAll = !lucShowAll; $("lucShowAll").textContent = lucShowAll ? "Show top 15" : "Show all countries"; renderLuc(); });
  $("pickChina").addEventListener("click", () => selectCountry("CHN"));
}
init().catch((e) => { document.querySelector("main").insertAdjacentHTML("afterbegin", `<p class="note">Could not load data.json — ${e.message}. Serve this folder over HTTP (not file://) or check the data file.</p>`); });
