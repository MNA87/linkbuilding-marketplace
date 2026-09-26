#!/usr/bin/env python3
"""BTC-EUR backtest op historische Bitvavo-data.

Haalt dagcandles op via de openbare Bitvavo API (geen key nodig) en vergelijkt
een paar eenvoudige strategieen met kopen-en-vasthouden, inclusief fees.

Gebruik:
    python3 backtest_btc.py              # data ophalen + rapport
    python3 backtest_btc.py --csv x.csv  # eigen CSV (timestamp_ms,open,high,low,close,volume)

Alleen standaardbibliotheek, geen extra packages nodig.
"""

import argparse
import csv
import json
import math
import time
import urllib.request
from datetime import datetime, timezone

API = "https://api.bitvavo.com/v2"
FEE = 0.0025  # Bitvavo taker-fee (hoogste tier), per transactie
START_CAPITAL = 1000.0


# ---------- data ----------

def fetch_candles(market="BTC-EUR", interval="1d"):
    """Haalt alle beschikbare dagcandles op (API geeft max 1440 per verzoek, nieuwste eerst)."""
    rows, end = [], int(time.time() * 1000)
    while True:
        url = f"{API}/{market}/candles?interval={interval}&limit=1440&end={end}"
        with urllib.request.urlopen(url, timeout=30) as resp:
            batch = json.load(resp)
        if not batch:
            break
        rows.extend(batch)
        oldest = int(batch[-1][0])
        if len(batch) < 1440:
            break
        end = oldest - 1
        time.sleep(0.2)
    candles = {int(r[0]): tuple(float(x) for x in r[1:6]) for r in rows}
    return [(ts, *candles[ts]) for ts in sorted(candles)]


def load_csv(path):
    with open(path) as f:
        return [tuple([int(r[0])] + [float(x) for x in r[1:6]]) for r in csv.reader(f) if r and r[0].isdigit()]


def save_csv(candles, path):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["timestamp_ms", "open", "high", "low", "close", "volume"])
        w.writerows(candles)


# ---------- indicatoren ----------

def sma(values, n):
    out, s = [None] * len(values), 0.0
    for i, v in enumerate(values):
        s += v
        if i >= n:
            s -= values[i - n]
        if i >= n - 1:
            out[i] = s / n
    return out


def rsi(values, n=14):
    out = [None] * len(values)
    gain = loss = 0.0
    for i in range(1, len(values)):
        d = values[i] - values[i - 1]
        g, l = max(d, 0.0), max(-d, 0.0)
        if i <= n:
            gain += g / n
            loss += l / n
        else:
            gain = (gain * (n - 1) + g) / n
            loss = (loss * (n - 1) + l) / n
        if i >= n:
            out[i] = 100.0 if loss == 0 else 100 - 100 / (1 + gain / loss)
    return out


# ---------- strategieen: geven per dag gewenste positie (True = in BTC) ----------

def strat_hold(closes):
    return [True] * len(closes)


def strat_sma_cross(closes, fast=50, slow=200):
    f, s = sma(closes, fast), sma(closes, slow)
    return [bool(f[i] and s[i] and f[i] > s[i]) for i in range(len(closes))]


def strat_price_above_sma(closes, n=200):
    m = sma(closes, n)
    return [bool(m[i] and closes[i] > m[i]) for i in range(len(closes))]


def strat_rsi(closes, low=30, high=70):
    r, pos, out = rsi(closes), False, []
    for v in r:
        if v is not None:
            if not pos and v < low:
                pos = True
            elif pos and v > high:
                pos = False
        out.append(pos)
    return out


def simulate(closes, signal):
    """Signaal op slot van dag i wordt uitgevoerd op slot van dag i (geen look-ahead in indicatoren)."""
    cash, btc, trades, equity = START_CAPITAL, 0.0, 0, []
    for price, want in zip(closes, signal):
        if want and btc == 0:
            btc, cash, trades = cash * (1 - FEE) / price, 0.0, trades + 1
        elif not want and btc > 0:
            cash, btc, trades = btc * price * (1 - FEE), 0.0, trades + 1
        equity.append(cash + btc * price)
    return equity, trades, sum(signal) / len(signal)


def simulate_dca(closes, every=7):
    """Elke week een vast bedrag kopen; totaal ingelegd = START_CAPITAL."""
    n_buys = math.ceil(len(closes) / every)
    per_buy = START_CAPITAL / n_buys
    cash, btc, equity = START_CAPITAL, 0.0, []
    for i, price in enumerate(closes):
        if i % every == 0:
            btc += per_buy * (1 - FEE) / price
            cash -= per_buy
        equity.append(cash + btc * price)
    return equity, n_buys, 1.0


# ---------- statistiek ----------

def stats(equity, days):
    total = equity[-1] / equity[0] - 1
    years = days / 365.25
    cagr = (equity[-1] / equity[0]) ** (1 / years) - 1 if years > 0 and equity[-1] > 0 else float("nan")
    peak, mdd = equity[0], 0.0
    for v in equity:
        peak = max(peak, v)
        mdd = min(mdd, v / peak - 1)
    rets = [equity[i] / equity[i - 1] - 1 for i in range(1, len(equity)) if equity[i - 1] > 0]
    mean = sum(rets) / len(rets)
    sd = math.sqrt(sum((r - mean) ** 2 for r in rets) / len(rets))
    sharpe = mean / sd * math.sqrt(365) if sd > 0 else 0.0
    return total, cagr, mdd, sharpe


# Signalen worden op de volledige historie berekend en daarna per periode
# geevalueerd, zodat indicatoren in een deelperiode niet eerst hoeven op te warmen.
STRATEGIES = [
    ("Kopen & vasthouden", strat_hold),
    ("Wekelijks inleggen (DCA)", None),
    ("SMA 50/200 crossover", strat_sma_cross),
    ("Koers boven SMA 200", strat_price_above_sma),
    ("RSI 30/70", strat_rsi),
]


def pct(x):
    return "n.v.t." if x != x else f"{x * 100:+.1f}%"


def fmt_date(ts):
    return datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%Y-%m-%d")


def report(all_candles, lo, hi, title):
    all_closes = [c[4] for c in all_candles]
    candles, closes = all_candles[lo:hi], all_closes[lo:hi]
    days = (candles[-1][0] - candles[0][0]) / 86_400_000
    lines = [f"### {title}: {fmt_date(candles[0][0])} t/m {fmt_date(candles[-1][0])} ({len(candles)} dagen)", "",
             "| Strategie | Rendement | Per jaar | Max daling | Sharpe | Transacties | Tijd in markt |",
             "|---|---:|---:|---:|---:|---:|---:|"]
    for name, fn in STRATEGIES:
        if fn is None:
            eq, trades, exposure = simulate_dca(closes)
        else:
            eq, trades, exposure = simulate(closes, fn(all_closes)[lo:hi])
        total, cagr, mdd, sharpe = stats(eq, days)
        lines.append(f"| {name} | {pct(total)} | {pct(cagr)} | {pct(mdd)} | {sharpe:.2f} | {trades} | {exposure * 100:.0f}% |")
    return "\n".join(lines)


def yearly(candles):
    by_year = {}
    for c in candles:
        by_year.setdefault(datetime.fromtimestamp(c[0] / 1000, tz=timezone.utc).year, []).append(c[4])
    lines = ["### BTC per kalenderjaar", "", "| Jaar | Start | Eind | Rendement |", "|---|---:|---:|---:|"]
    for y, cl in sorted(by_year.items()):
        lines.append(f"| {y} | €{cl[0]:,.0f} | €{cl[-1]:,.0f} | {pct(cl[-1] / cl[0] - 1)} |")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", help="lees candles uit CSV i.p.v. API")
    ap.add_argument("--out", default="rapport_btc.md")
    args = ap.parse_args()

    if args.csv:
        candles = load_csv(args.csv)
    else:
        candles = fetch_candles()
        save_csv(candles, "btc_eur_1d.csv")

    split = int(len(candles) * 0.7)
    parts = [
        f"# BTC-EUR backtest (fee {FEE * 100:.2f}% per transactie, startkapitaal €{START_CAPITAL:,.0f})", "",
        report(candles, 0, len(candles), "Hele periode"), "",
        report(candles, 0, split, "Eerste 70% (in-sample)"), "",
        report(candles, split, len(candles), "Laatste 30% (out-of-sample)"), "",
        yearly(candles), "",
        "_Historische resultaten zijn geen garantie voor de toekomst. Geen beleggingsadvies._",
    ]
    text = "\n".join(parts)
    with open(args.out, "w") as f:
        f.write(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
