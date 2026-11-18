# carbon-ledge

Carbon Ledger — annual CO₂ emissions by country, 1750–2025.

## What it shows

- **Every country** — 220 countries with data in 2025, in a searchable, sortable table for any year from 1950–2025 (slider).
- **Year-over-year %** — change vs the previous year, computed from the annual series, for every country and for the world.
- **Historic trend** — world annual emissions 1750–2025, with a selected country's trend overlaid (own scale, dashed).
- **Cumulative emissions** — per country and world, summed from 1750; including land-use change shown separately.
- **Accumulated atmosphere carbon** — cumulative fossil CO₂ (1,887 Gt to end-2025), cumulative including land-use change (2,780 Gt), and a model estimate of the airborne share, checked against the observed Mauna Loa concentration.
- **Active ledger (live counter)** — tonnes emitted since the page opened, and a live running cumulative total since 1750. This spreads the latest annual world rate evenly across the year; it is an estimate, not a measurement.

## Data

Source: Our World in Data CO₂ dataset, based on the Global Carbon Budget (Global Carbon Project). Latest year: 2025.

- World 2025: 38,995 Mt CO₂, +0.9% vs 2024; cumulative fossil CO₂ since 1750: 1,886,833 Mt.
- China 2025: 12,417 Mt (31.8%), +0.1%; United States 5,036 Mt (12.9%), +2.5%; India 3,203 Mt (8.2%), +0.9%.
- Scope: territorial CO₂ from fossil fuels and industry. Land-use change and other greenhouse gases are excluded from headline totals unless stated.

`data.json` is built by `scripts/fetch_data.py` from the Our World in Data CSV (`https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv`). Re-run it to refresh the data when a new Global Carbon Budget is published. Sources are credited in the captions on the page and in the Methods section.

## Run locally

```bash
python3 -m http.server 8000
# open http://127.0.0.1:8000/
```

No build step, no dependencies. `index.html` + `styles.css` + `app.js` + `data.json`.

## Deploy

- **GitHub Pages:** the workflow `.github/workflows/deploy-pages.yml` publishes this repo root to GitHub Pages on every push to `main`. Enable Pages in the repo settings (Source: GitHub Actions) once, then it deploys automatically.
- **Any static host** (Vercel, Netlify, etc.): publish this folder as-is.
