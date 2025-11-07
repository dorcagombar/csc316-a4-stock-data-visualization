class Chart {
    constructor(selector, boxSize) {
        this.margin = { top: 30, right: 70, bottom: 180, left: 60 }; // Increased right margin from 30 to 70
        this.width = boxSize.width - this.margin.right - this.margin.left;
        this.height = boxSize.height - this.margin.top - this.margin.bottom;

        this.svg = d3.select(selector).append("svg")
            .attr("width", this.width + this.margin.right + this.margin.left)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        this.g = this.svg.append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.x = d3.scaleTime().range([0, this.width]);
        this.y = d3.scaleLinear().range([this.height, 0]);
        this.yVol = d3.scaleLinear().range([this.height, this.height * 0.6]);
        this.yVolat = d3.scaleLinear().range([this.height, 0]); // NEW: Dedicated Y-scale for Volatility

        this.line = d3.line().x(d => this.x(d.dateObj)).y(d => this.y(d.close));
        this.lineNorm = d3.line().x(d => this.x(d.dateObj)).y(d => this.y(d.norm));

        this.xAxisG = this.g.append("g").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.g.append("g");

        // Add Main Y-Axis Label
        this.yAxisLabel = this.yAxisG.append("text")
            .attr("fill", "#e8e8e8")
            .attr("transform", "rotate(-90)")
            .attr("y", -this.margin.left + 15) // Position left of the axis
            .attr("x", -this.height / 2) // Center along the axis
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .text("Price / Value");

        // NEW: Volatility Y-Axis Group on the right
        this.yVolatAxisG = this.g.append("g")
            .attr("transform", `translate(${this.width}, 0)`) // Move to the right edge
            .style("fill", "purple");

        // NEW: Add Volatility Y-Axis Label
        this.yVolatAxisLabel = this.yVolatAxisG.append("text")
            .attr("fill", "purple")
            .attr("transform", "rotate(-90)")
            .attr("y", this.margin.right - 15) // Position right of the axis
            .attr("x", -this.height / 2) // Center along the axis
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .text("Volatility");

        this.volumeGroup = this.g.append("g");
        this.smaGroup = this.g.append("g");
        this.volatilityGroup = this.g.append("g");
        this.priceGroup = this.g.append("path").attr("stroke-width", 2).attr("fill", "none");
        this.benchmarkGroup = this.g.append("g");

        // Custom benchmark colors: Orange for the first, then the rest of d3.schemeSet1
        const d3SchemeSet1 = d3.schemeSet1;
        this.benchmarkColors = ["#ff7f00", ...d3SchemeSet1.slice(1)];
        this.compareSymbols = []; // Initialize symbol storage

        // === ZOOM + PAN ===
        this.zoom = d3.zoom()
            .scaleExtent([1, 20])
            .translateExtent([[0, 0], [this.width, this.height]])
            .extent([[0, 0], [this.width, this.height]])
            .on("zoom", (event) => this.onZoom(event));

        this.svg.call(this.zoom);

        // === MINIMAP SETUP ===
        this.minimapHeight = 100;
        this.minimapY = d3.scaleLinear().range([this.minimapHeight, 0]);
        this.minimapX = d3.scaleTime().range([0, this.width]);

        this.minimap = this.svg.append("g")
            .attr("transform", `translate(${this.margin.left},${this.height + this.margin.top + 50})`);

        this.minimapPath = this.minimap.append("path")
            .attr("stroke", "#999")
            .attr("fill", "none")
            .attr("stroke-width", 1.2);

        this.brush = d3.brushX()
            .extent([[0, 0], [this.width, this.minimapHeight]])
            .on("brush end", (event) => this.onBrush(event));

        this.brushArea = this.minimap.append("g").attr("class", "brush");

        // === CROSSHAIR ===
        this.crosshair = this.g.append("g").style("display", "none");

        this.crosshair.append("line")
            .attr("class", "crosshair-x")
            .attr("stroke", "#aaa")
            .attr("stroke-width", 1)
            .attr("y1", 0)
            .attr("y2", this.height);

        this.crosshair.append("line")
            .attr("class", "crosshair-y")
            .attr("stroke", "#aaa")
            .attr("stroke-width", 1)
            .attr("x1", 0)
            .attr("x2", this.width);

        this.tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("pointer-events", "none")
            .style("display", "none");

        this.svg.on("mousemove", (event) => this.onMouseMove(event))
            .on("mouseenter", () => this.onMouseEnter())
            .on("mouseleave", () => this.onMouseLeave());

        // ==== RSI panel ====
        this.rsiHeight = 80;

        this.rsiY = d3.scaleLinear().range([this.rsiHeight, 0]);

        this.rsiGroup = this.g.append("g")
            .attr("transform", `translate(0, ${this.height + 40})`);

        this.rsiAxisG = this.rsiGroup.append("g")
            .attr("transform", `translate(0, ${this.rsiHeight})`);

        // Add RSI Panel Y-Axis Label, with 'RSI' in red
        this.rsiGroup.append("text")
            .attr("fill", "#e8e8e8")
            .attr("transform", "rotate(-90)")
            .attr("y", -this.margin.left + 15)
            .attr("x", -this.rsiHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .append("tspan")
            .style("fill", "#d62728")
            .text("RSI");

        this.rsiLine = d3.line()
            .defined(d => d.rsi != null)
            .x(d => this.x(d.dateObj))
            .y(d => this.rsiY(d.rsi));
    }

    onZoom(event) {
        if (!this.xOriginal) return;

        const transform = event.transform;
        this.x.domain(transform.rescaleX(this.xOriginal).domain());

        // ---------- GENERATORS (defensive) ----------
        const priceGen = d3.line()
            .defined(d => d && d.dateObj && d.close != null)
            .x(d => this.x(d.dateObj))
            .y(d => this.y(d.close));

        const smaGenFactory = (field) => d3.line()
            .defined(d => d && d.dateObj && d[field] != null)
            .x(d => this.x(d.dateObj))
            .y(d => this.y(d[field]));

        // Volatility generator uses the new scale
        const volGen = d3.line()
            .defined(d => d && d.dateObj && d.volatility != null)
            .x(d => this.x(d.dateObj))
            .y(d => this.yVolat(d.volatility)); // UPDATED: Use yVolat

        this.priceGroup.attr("d", priceGen(this.priceGroup.datum() || []));

        this.volumeGroup.selectAll("rect")
            .attr("x", d => d.dateObj ? this.x(d.dateObj) : -10)
            .attr("y", d => (d.volume != null) ? this.yVol(d.volume) : this.height)
            .attr("height", d => (d.volume != null) ? (this.height - this.yVol(d.volume)) : 0);

        this.smaGroup.selectAll("path").each((d, i, nodes) => {
            const gen = smaGenFactory(d.field);
            d3.select(nodes[i]).attr("d", gen(d.data));
        });

        this.volatilityGroup.selectAll("path")
            .attr("d", d => volGen(d));

        const benchGen = d3.line()
            .defined(e => e && e.dateObj && e.norm != null)
            .x(e => this.x(e.dateObj))
            .y(e => this.y(e.norm));

        this.benchmarkGroup.selectAll("path")
            .attr("d", d => benchGen(d));

        // Axis redraw (Only X-axis changes domain on zoom)
        this.xAxisG.call(d3.axisBottom(this.x).ticks(8));

        // RSI update
        this.rsiGroup.selectAll("path")
            .each((d, i, nodes) => {
                const sel = d3.select(nodes[i]);
                const bound = sel.datum();
                if (bound) sel.attr("d", this.rsiLine(bound));
            });

        this.rsiAxisG.call(d3.axisBottom(this.x).ticks(8));
    }

    onBrush(event) {
        if (!event.selection) return;

        // selection pixel coordinates
        const [px0, px1] = event.selection;
        const x0 = this.minimapX.invert(px0);
        const x1 = this.minimapX.invert(px1);

        // new x domain
        this.x.domain([x0, x1]);

        // ---------- GENERATORS (defensive) ----------
        const priceGen = d3.line()
            .defined(d => d && d.dateObj && d.close != null)
            .x(d => this.x(d.dateObj))
            .y(d => this.y(d.close));

        const smaGenFactory = (field) => d3.line()
            .defined(d => d && d.dateObj && d[field] != null)
            .x(d => this.x(d.dateObj))
            .y(d => this.y(d[field]));

        // Volatility generator uses the new scale
        const volGen = d3.line()
            .defined(d => d && d.dateObj && d.volatility != null)
            .x(d => this.x(d.dateObj))
            .y(d => this.yVolat(d.volatility)); // UPDATED: Use yVolat

        // price line
        this.priceGroup.datum(this.priceGroup.datum() || [])
            .attr("d", priceGen);

        // volume columns
        this.volumeGroup.selectAll("rect")
            .attr("x", d => d.dateObj ? this.x(d.dateObj) : -10)
            .attr("y", d => (d.volume != null) ? this.yVol(d.volume) : this.height)
            .attr("height", d => (d.volume != null) ? (this.height - this.yVol(d.volume)) : 0);

        // SMA lines
        this.smaGroup.selectAll("path").each((d, i, nodes) => {
            const datum = d;
            const field = datum.field;
            const gen = smaGenFactory(field);
            d3.select(nodes[i]).attr("d", gen(datum.data));
        });

        // volatility
        this.volatilityGroup.selectAll("path")
            .each((d, i, nodes) => {
                if (d) d3.select(nodes[i]).attr("d", volGen(d));
            });

        // benchmark
        const benchGen = d3.line()
            .defined(e => e && e.dateObj && e.norm != null)
            .x(e => this.x(e.dateObj))
            .y(e => this.y(e.norm));

        this.benchmarkGroup.selectAll("path")
            .attr("d", d => benchGen(d));

        // X Axis
        const xAxis = d3.axisBottom(this.x).ticks(8);
        this.xAxisG.call(xAxis);

        // RSI update
        this.rsiGroup.selectAll("path")
            .each((d, i, nodes) => {
                const sel = d3.select(nodes[i]);
                const bound = sel.datum();
                if (bound) sel.attr("d", this.rsiLine(bound));
            });

        this.rsiAxisG.call(d3.axisBottom(this.x).ticks(8));

    }

    render(data, opts = {}) {

        // STORE SYMBOL NAMES for Tooltip
        this.compareSymbols = opts.compareSymbols || [];

        this.rsiY.domain([0, 100]);

        // ==== MULTI-BENCHMARK NORMALIZATION ====
        this.currentBenchmarks = [];

        if (opts.benchmarkDataList && opts.benchmarkDataList.length > 0) {
            const mainStart = data[0].close;

            this.currentBenchmarks = opts.benchmarkDataList.map(raw => {
                const base = raw[0].close;
                return raw.map(d => ({
                    dateObj: new Date(d.date),
                    norm: (d.close / base) * mainStart
                }));
            });
        }

        data.forEach(d => d.dateObj = new Date(d.date));

        // total height with RSI
        this.totalHeight = this.height + this.rsiHeight + 50;

        this.svg.attr("height", this.totalHeight + this.margin.top + this.margin.bottom);

        this.rsiGroup.attr("transform", `translate(0, ${this.height + 40})`);
        this.rsiAxisG.attr("transform", `translate(0, ${this.rsiHeight})`);

        // --- FIX: Calculate Y domain to include all normalized benchmark data ---
        let allYValues = data.map(d => d.close);
        this.currentBenchmarks.forEach(series => {
            // Only use normalized values that are not null
            const norms = series.map(d => d.norm).filter(n => n != null);
            allYValues = allYValues.concat(norms);
        });

        const minY = d3.min(allYValues) * 0.98;
        const maxY = d3.max(allYValues) * 1.02;

        this.x.domain(d3.extent(data, d => d.dateObj));
        this.y.domain([minY, maxY]); // Set domain using min/max of main and benchmark data
        // --- END FIX ---

        this.yVol.domain([0, d3.max(data, d => d.volume || 0)]);

        // NEW: Volatility Scale Domain
        if (opts.showVolatility) {
            this.yVolat.domain([0, d3.max(data, d => d.volatility || 0) * 1.05]);
            this.yVolatAxisG.style("display", null);
        } else {
            this.yVolatAxisG.style("display", "none");
        }

        this.xOriginal = this.x.copy(); // needed for zoom
        this.yOriginal = this.y.copy();

        const xAxis = d3.axisBottom(this.x).ticks(8);
        const yAxis = d3.axisLeft(this.y).ticks(6);
        const yVolatAxis = d3.axisRight(this.yVolat).ticks(6).tickFormat(d3.format(".1%")); // NEW: Volatility axis format

        this.xAxisG.call(xAxis);
        this.yAxisG.call(yAxis);
        this.yVolatAxisG.call(yVolatAxis); // NEW: Volatility Axis draw

        const priceLineGen = d3.line()
            .defined(d => d.close != null) // skip null closes
            .x(d => this.x(d.dateObj))
            .y(d => this.y(d.close));

        this.priceGroup.attr("stroke", "#1f77b4")
            .datum(data)
            .attr("d", priceLineGen);

        // volume overlay
        this.volumeGroup.selectAll("rect").data(opts.showVolume ? data : [])
            .join("rect")
            .attr("x", d => this.x(d.dateObj))
            .attr("y", d => this.yVol(d.volume))
            .attr("width", 2)
            .attr("height", d => this.height - this.yVol(d.volume))
            .attr("fill", "rgba(180,180,255,0.4)");

        // SMA
        if (opts.showSMA) {
            const smaLines = [
                { data, field: "sma7", color: "yellow" },
                { data, field: "sma30", color: "green" }
            ];
            this.smaGroup.selectAll("path").data(smaLines)
                .join("path")
                .attr("stroke", d => d.color)
                .attr("fill", "none")
                .attr("d", d => {
                    const gen = d3.line()
                        .defined(e => e[d.field] != null)
                        .x(e => this.x(e.dateObj))
                        .y(e => this.y(e[d.field]));
                    return gen(d.data);
                });
        } else {
            this.smaGroup.selectAll("path").remove();
        }

        // volatility
        if (opts.showVolatility) {
            this.volatilityGroup.selectAll("path").data([data])
                .join("path")
                .attr("stroke", "purple")
                .attr("fill", "none")
                .attr("d", d => {
                    const gen = d3.line()
                        .defined(e => e.volatility != null)
                        .x(e => this.x(e.dateObj))
                        .y(e => this.yVolat(e.volatility)); // UPDATED: Use yVolat
                    return gen(d);
                });
        } else {
            this.volatilityGroup.selectAll("path").remove();
        }

        // === MULTI-BENCHMARK DRAW ===
        const benchGen = d3.line()
            .defined(e => e && e.dateObj && e.norm != null)
            .x(e => this.x(e.dateObj))
            .y(e => this.y(e.norm));

        // Use custom color list for benchmarks
        this.benchmarkGroup.selectAll("path")
            .data(this.currentBenchmarks)
            .join("path")
            .attr("stroke", (d, i) => this.benchmarkColors[i % this.benchmarkColors.length])
            .attr("fill", "none")
            .attr("stroke-width", 1.5)
            .attr("opacity", 0.9)
            .attr("d", benchGen);

        // === MINIMAP RENDER ===
        this.minimapX.domain(d3.extent(data, d => d.dateObj));
        this.minimapY.domain(this.yOriginal.domain()); // Minimap uses original Y scale

        this.minimapPath.datum(data)
            .attr("d", d3.line()
                .x(d => this.minimapX(d.dateObj))
                .y(d => this.minimapY(d.close))
            );

        // Default brush selection → last 60% of timeline
        const defaultStart = this.width * 0.4;
        const defaultEnd = this.width;

        this.brushArea.call(this.brush)
            .call(this.brush.move, [defaultStart, defaultEnd]);

        // ==== RSI DRAW ====
        this.rsiGroup.selectAll("path").remove();

        this.rsiGroup.append("path")
            .datum(data)
            .attr("stroke", "#d62728")
            .attr("fill", "none")
            .attr("stroke-width", 1.5)
            .attr("d", this.rsiLine);

        // RSI axis
        this.rsiAxisG.call(d3.axisBottom(this.x).ticks(8));

        // RSI guide lines
        this.rsiGroup.selectAll(".rsi-guide").remove();
        this.rsiGroup.append("line").attr("class", "rsi-guide")
            .attr("x1", 0).attr("x2", this.width)
            .attr("y1", this.rsiY(70)).attr("y2", this.rsiY(70))
            .attr("stroke", "#999").attr("stroke-dasharray", "4,4");

        this.rsiGroup.append("line").attr("class", "rsi-guide")
            .attr("x1", 0).attr("x2", this.width)
            .attr("y1", this.rsiY(30)).attr("y2", this.rsiY(30))
            .attr("stroke", "#999").attr("stroke-dasharray", "4,4");

    }

    onMouseEnter() {
        this.crosshair.style("display", null);
        this.tooltip.style("display", "block");
    }

    onMouseLeave() {
        this.crosshair.style("display", "none");
        this.tooltip.style("display", "none");
    }

    onMouseMove(event) {
        const [mx, my] = d3.pointer(event, this.g.node());
        const date = this.x.invert(mx);

        const data = this.priceGroup.datum();
        const i = d3.bisector(d => d.dateObj).left(data, date);
        const d = data[i];
        if (!d) return;

        // crosshair position
        this.crosshair.select(".crosshair-x")
            .attr("x1", mx)
            .attr("x2", mx);
        this.crosshair.select(".crosshair-y")
            .attr("y1", my)
            .attr("y2", my);

        // tooltip values
        let html = `<strong>${d3.timeFormat("%Y-%m-%d")(d.dateObj)}</strong><br>
                <span style="color:#1f77b4">Close</span>: <b>${d.close.toFixed(2)}</b>`; // Main Price: #1f77b4

        if (d.volume != null) html += `<br>Volume: ${d.volume.toLocaleString()}`;
        if (d.sma7 != null) html += `<br><span style="color:yellow">SMA7</span>: ${d.sma7.toFixed(2)}`;
        if (d.sma30 != null) html += `<br><span style="color:green">SMA30</span>: ${d.sma30.toFixed(2)}`;
        if (d.volatility != null) html += `<br><span style="color:purple">Volatility(14)</span>: ${d.volatility.toFixed(3)}`;
        if (d.rsi != null) html += `<br><span style="color:#d62728">RSI(14)</span>: ${d.rsi.toFixed(2)}`;


        // benchmark
        // multi-benchmark tooltip
        if (this.currentBenchmarks && this.currentBenchmarks.length > 0) {
            this.currentBenchmarks.forEach((series, idx) => {
                const point = series[i];
                const symbol = this.compareSymbols[idx]; // Use stored symbol name
                if (point && point.norm != null) {
                    html += `<br><span style="color:${this.benchmarkColors[idx % this.benchmarkColors.length]}">${symbol}</span>: ${point.norm.toFixed(2)}`;
                }
            });
        }

        // tooltip position
        this.tooltip
            .html(html)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY + 15) + "px");
    }

}