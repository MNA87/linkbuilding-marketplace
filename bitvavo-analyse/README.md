# Bitvavo BTC-analyse

Backtest van eenvoudige strategieën op historische BTC-EUR dagkoersen van Bitvavo
(openbare API, geen key nodig), inclusief 0,25% fee per transactie.

```bash
python3 bitvavo-analyse/backtest_btc.py
```

Maakt `btc_eur_1d.csv` (ruwe data) en `rapport_btc.md` (resultaten) aan.
Vergelijkt: kopen & vasthouden, wekelijks inleggen, SMA 50/200, koers boven SMA 200 en RSI 30/70,
over de hele periode, een in-sample (eerste 70%) en out-of-sample (laatste 30%) deel, plus per jaar.

Geen beleggingsadvies.
