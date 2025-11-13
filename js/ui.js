class UI {
    constructor(api, chart) {
        this.api = api;
        this.chart = chart;

        this.symbolSelect = document.getElementById("symbol-select");
        this.rangeSelect = document.getElementById("range-select");
        this.smaToggle = document.getElementById("sma-toggle");
        this.volumeToggle = document.getElementById("volume-toggle");
        this.volatilityToggle = document.getElementById("volatility-toggle");
        this.compareSelect = document.getElementById("compare-select");

        this.symbols = ["AAPL", "MSFT", "TSLA", "GOOGL", "AMZN", "META", "NVDA", "IBM", "ORCL", "JPM", "SPY"];

        // Main symbol dropdown
        this.symbols.forEach(s => this.symbolSelect.add(new Option(s, s)));
        this.symbolSelect.value = "AAPL";

        // Compare-with multi-select
        this.symbols.forEach(s => {
            if (s !== this.symbolSelect.value)
                this.compareSelect.add(new Option(s, s));
        });
    }

    async redraw() {
        const symbol = this.symbolSelect.value;
        const days = +this.rangeSelect.value;

        // Main chart data
        const data = (await this.api.getDaily(symbol)).slice(-days);
        DataProcessor.addSMA(data, 7, "sma7");
        DataProcessor.addSMA(data, 30, "sma30");
        DataProcessor.addVolatility(data, 14);

        // RSI calculated before calling this.chart.render()

        DataProcessor.addRSI(data, 14, "rsi");

        // Overlay comparison symbols (multi-select)
        const compareSymbols = Array.from(this.compareSelect.selectedOptions).map(o => o.value);

        // Load overlay data arrays
        const benchmarkDataList = await Promise.all(
            compareSymbols.map(async sym => {
                const d = (await this.api.getDaily(sym)).slice(-days);
                return d.map(e => ({
                    date: e.date,
                    close: e.close
                }));
            })
        );

        this.chart.render(data, {
            showSMA: this.smaToggle.checked,
            showVolume: this.volumeToggle.checked,
            showVolatility: this.volatilityToggle.checked,
            compareSymbols,
            benchmarkDataList
        });

        this.chart.resetZoomAndBrush();
    }

    attachEvents() {
        this.symbolSelect.onchange = () => this.updateCompareList();
        this.rangeSelect.onchange = () => this.redraw();
        this.smaToggle.onchange = () => this.redraw();
        this.volumeToggle.onchange = () => this.redraw();
        this.volatilityToggle.onchange = () => this.redraw();
        this.compareSelect.onchange = () => this.redraw();
    }

    updateCompareList() {
        const mainSymbol = this.symbolSelect.value;
        this.compareSelect.innerHTML = "";

        this.symbols.forEach(s => {
            if (s !== mainSymbol)
                this.compareSelect.add(new Option(s, s));
        });
        this.chart.resetZoomAndBrush();

        this.redraw();
    }
}