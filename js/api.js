class StockCache {
    static save(symbol, data) {
        const record = {
            timestamp: Date.now(),
            data
        };
        localStorage.setItem("stock_" + symbol, JSON.stringify(record));
    }

    static load(symbol, maxAgeMs = 12 * 60 * 60 * 1000) {
        const raw = localStorage.getItem("stock_" + symbol);
        if (!raw) return null;
        const record = JSON.parse(raw);
        if (Date.now() - record.timestamp > maxAgeMs) return null;
        return record.data;
    }
}

class StockAPI {
    constructor(key) {
        this.key = key;
        this.function = "TIME_SERIES_DAILY";
    }

    async getDaily(symbol) {
        const cached = StockCache.load(symbol);
        if (cached) return cached;

        const url = `https://www.alphavantage.co/query?function=${this.function}&symbol=${symbol}&outputsize=compact&apikey=${this.key}`;
        const res = await fetch(url);
        const json = await res.json();
        const series = json["Time Series (Daily)"];
        if (!series) {
            console.warn("No data for", symbol);
            return [];
        }

        const parsed = Object.entries(series).map(([date, v]) => ({
            date: date,
            close: +v["4. close"],
            volume: +v["5. volume"]
        }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        StockCache.save(symbol, parsed);
        return parsed;
    }
}
