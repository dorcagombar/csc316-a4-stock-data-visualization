# Stock Insight — Milestone 1 (MVP)

This repository contains a working prototype (MVP) for the CSC316 Interactive Visualization assignment, due Oct 17.

## Project structure
```
StockInsight/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  ├─ main.js          # D3 visualization logic
│  ├─ data-sample.js   # loads local JSON sample (fallback)
│  └─ data-api.js      # Alpha Vantage API loader (demo key)
├─ data/
│  └─ stocks-sample.json
└─ readme.md           # this file
```

## Running locally
1. Unzip and open `index.html` in a modern browser. If `fetch` fails from local files, run a local server:
   ```bash
   python -m http.server
   ```
   then visit `http://localhost:8000`.
2. By default, the page loads the sample JSON and also attempts to fetch real data from Alpha Vantage
   (demo key) via `js/data-api.js`. If the API fails or rate limits, the page will continue to use the sample data.
3. Interact with the chart by selecting a company and range.

## Alpha Vantage integration
- The demo API key is used in `js/data-api.js`. For reliable usage, register at https://www.alphavantage.co/ and replace the `API_KEY`.
- Free-tier limits apply. Consider caching or a small backend proxy for heavy usage.

## Submission checklist for Oct 17
- [x] Working interactive prototype (line chart + interactions)
- [x] README in English with run instructions and structure
- [x] Sample data included under `data/`
- [x] Clear, commented code in `js/main.js`
- [x] Alpha Vantage example integration (`js/data-api.js`) with demo key and graceful fallback

## Next steps
- Add multiple symbols in the same chart (comparison)
- Add zoom & pan, moving averages, indicators
- Implement a small server-side cache to avoid rate limiting during demos

---
