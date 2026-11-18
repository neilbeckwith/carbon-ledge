#!/usr/bin/env python3
"""Build data.json for Carbon Ledger from the Our World in Data CO2 dataset.

Source: Our World in Data, CO2 and greenhouse gas emissions dataset,
based on the Global Carbon Budget (Global Carbon Project).
CSV: https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv
Columns used: country, year, iso_code, co2 (Mt), co2_growth_prct,
cumulative_co2 (Mt), co2_per_capita (t), share_global_co2 (%),
co2_including_luc, cumulative_co2_including_luc.

Scope: territorial CO2 from fossil fuels and industry (coal, oil, gas,
flaring, cement and other industrial processes). Land-use change is
shown separately, not in the headline country totals.
Run: python3 scripts/fetch_data.py  -> writes data.json
"""
import csv, json
from pathlib import Path

SRC = "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv"
ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "owid-co2-data.csv"
OUT = ROOT / "data.json"

def f(v):
    try:
        return float(v) if v not in ("", None) else None
    except ValueError:
        return None

def main():
    if not CSV_PATH.exists():
        import urllib.request
        CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading {SRC}")
        urllib.request.urlretrieve(SRC, CSV_PATH)
    rows = list(csv.DictReader(open(CSV_PATH, newline="", encoding="utf-8")))
    world = []
    countries = {}
    for r in rows:
        year = int(r["year"])
        co2 = f(r["co2"])
        if r["country"] == "World":
            world.append({
                "year": year, "co2": co2,
                "cum": f(r["cumulative_co2"]),
                "growth": f(r["co2_growth_prct"]),
                "per_capita": f(r["co2_per_capita"]),
                "co2_incl_luc": f(r["co2_including_luc"]),
                "cum_incl_luc": f(r["cumulative_co2_including_luc"]),
            })
            continue
        iso = r["iso_code"]
        if not iso:
            continue  # aggregates / regions, no ISO code
        c = countries.setdefault(iso, {"name": r["country"], "iso": iso, "series": []})
        if co2 is not None:
            c["series"].append([year, round(co2, 3)])
        c.setdefault("by_year", {})[year] = {
            "co2": co2, "growth": f(r["co2_growth_prct"]),
            "cum": f(r["cumulative_co2"]),
            "per_capita": f(r["co2_per_capita"]),
            "share": f(r["share_global_co2"]),
        }
    world.sort(key=lambda x: x["year"])
    latest_year = max(w["year"] for w in world if w["co2"] is not None)
    out_countries = []
    for c in countries.values():
        by = c.pop("by_year")
        if latest_year not in by or by[latest_year]["co2"] is None:
            yrs = [y for y, v in by.items() if v["co2"] is not None]
            if not yrs:
                continue
            ly = max(yrs)
        else:
            ly = latest_year
        s = by[ly]
        out_countries.append({
            "name": c["name"], "iso": c["iso"],
            "latest_year": ly, "latest": s["co2"],
            "growth_prct": s["growth"], "cumulative": s["cum"],
            "per_capita": s["per_capita"], "share": s["share"],
            "series": sorted(c["series"]),
        })
    out_countries.sort(key=lambda x: x["latest"], reverse=True)
    data = {
        "meta": {
            "title": "Carbon Ledger — annual CO2 emissions by country",
            "source": "Our World in Data, CO2 and greenhouse gas emissions dataset, based on the Global Carbon Budget (Global Carbon Project)",
            "source_url": "https://ourworldindata.org/co2-and-greenhouse-gas-emissions",
            "dataset_url": SRC,
            "latest_year": latest_year,
            "coverage": "1750-2025",
            "countries_in_latest_year": sum(1 for c in out_countries if c["latest_year"] == latest_year),
            "countries_total": len(out_countries),
            "units": "co2 in million tonnes (Mt); 1 Gt = 1,000 Mt",
            "scope": "Territorial CO2 from fossil fuels and industry (coal, oil, gas, flaring, cement and other industrial processes). Excludes land-use change unless stated, and excludes other greenhouse gases.",
        },
        "world": world,
        "countries": out_countries,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data), encoding="utf-8")
    w = world[-1]
    print(f"latest_year={latest_year} world_co2_Mt={w['co2']} growth%={w['growth']} cumulative_Mt={w['cum']}")
    print(f"countries={len(out_countries)} in latest year={data['meta']['countries_in_latest_year']}")
    print(f"wrote {OUT} ({OUT.stat().st_size/1024:.0f} KB)")

if __name__ == "__main__":
    main()
