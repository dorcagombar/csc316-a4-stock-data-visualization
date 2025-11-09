class DataProcessor {
    static addSMA(data, n, fieldName) {
        for (let i = 0; i < data.length; i++) {
            if (i < n) { data[i][fieldName] = null; continue; }
            const slice = data.slice(i - n, i);
            const avg = d3.mean(slice, d => d.close);
            data[i][fieldName] = avg;
        }
    }

    static addVolatility(data, window = 14) {
        for (let i = 1; i < data.length; i++) {
            data[i].return = (data[i].close - data[i - 1].close) / data[i - 1].close;
        }

        for (let i = 0; i < data.length; i++) {
            if (i < window) { data[i].volatility = null; continue; }
            const slice = data.slice(i - window, i);
            const std = d3.deviation(slice, d => d.return);
            data[i].volatility = std;
        }
    }

    static normalizeForComparison(baseData, compareData) {
        const base0 = baseData[0]?.close;
        const comp0 = compareData[0]?.close;
        if (!base0 || !comp0) return { baseData, compareData };

        baseData.forEach(d => d.norm = d.close / base0);
        compareData.forEach(d => d.norm = d.close / comp0);
    }

    static addRSI(data, period, fieldName) {
        let gains = 0, losses = 0;

        for (let i = 1; i < period + 1; i++) {
            const diff = data[i].close - data[i - 1].close;
            if (diff > 0) gains += diff;
            else losses -= diff;
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        for (let i = period + 1; i < data.length; i++) {
            const diff = data[i].close - data[i - 1].close;
            if (diff > 0) {
                avgGain = (avgGain * (period - 1) + diff) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1) + 0) / period;
                avgLoss = (avgLoss * (period - 1) - diff) / period;
            }

            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            data[i][fieldName] = 100 - (100 / (1 + rs));
        }
    }

}
