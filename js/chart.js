class Chart {
    constructor(selector, boxSize) {
        this.margin = { top: 30, right: 70, bottom: 180, left: 60 };
        this.width = boxSize.width - this.margin.right - this.margin.left;
        this.height = boxSize.height - this.margin.top - this.margin.bottom;

        this.svg = d3.select(selector).append("svg")
            .attr("width", this.width + this.margin.right + this.margin.left)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        this.g = this.svg.append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        // DEFINE CLIP PATHS
        this.svg.append("defs").append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("width", this.width)
            .attr("height", this.height);

        this.x = d3.scaleTime().range([0, this.width]);
        this.y = d3.scaleLinear().range([this.height, 0]);
        this.yVol = d3.scaleLinear().range([this.height, this.height * 0.6]);
        this.yVolat = d3.scaleLinear().range([this.height, 0]);

        this.line = d3.line().x(d => this.x(d.dateObj)).y(d => this.y(d.close));
        this.lineNorm = d3.line().x(d => d.dateObj).y(d => d.norm);

        // MAIN X-AXIS (Bottom of the Price/Value area)
        this.xAxisG = this.g.append("g").attr("transform", `translate(0,${this.height})`);
        this.yAxisG = this.g.append("g");

        // Add Main Y-Axis Label
        this.yAxisLabel = this.yAxisG.append("text")
            .attr("fill", "#e8e8e8")
            .attr("transform", "rotate(-90)")
            .attr("y", -this.margin.left + 15)
            .attr("x", -this.height / 2)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .text("Price / Value in USD")
            .on("click", () => this.toggleSMAsAndVolume())
            .style("cursor", "pointer");


        // Volatility Y-Axis Group on the right
        this.yVolatAxisG = this.g.append("g")
            .attr("transform", `translate(${this.width}, 0)`)
            .style("fill", "purple")
            .style("opacity", 0)
            .style("display", "none");

        // Add Volatility Y-Axis Label
        this.yVolatAxisLabel = this.yVolatAxisG.append("text")
            .attr("fill", "purple")
            .attr("transform", "rotate(-90)")
            .attr("y", this.margin.right - 15)
            .attr("x", -this.height / 2)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .text("Volatility")
            .on("click", () => this.toggleVolatility())
            .style("cursor", "pointer");

        // APPLY CLIP PATH
        this.volumeGroup = this.g.append("g").attr("clip-path", "url(#clip)");
        this.smaGroup = this.g.append("g").attr("clip-path", "url(#clip)");
        this.volatilityGroup = this.g.append("g").attr("clip-path", "url(#clip)");
        this.priceGroup = this.g.append("path").attr("clip-path", "url(#clip)").attr("stroke-width", 2).attr("fill", "none");
        this.benchmarkGroup = this.g.append("g").attr("clip-path", "url(#clip)");

        // Custom benchmark colors
        this.benchmarkColors = [
            "#c3e0a1", "#4f8c4d", "#f3b7ba", "#d6302c", "#fec087",
            "#f9802c", "#c7b6d9", "#6a4095", "#ffffc9", "#945731"
        ];
        this.compareSymbols = [];

        // Visibility state for toggled elements
        this.showVolume = false;
        this.showVolatility = false;
        this.showSMA = false;
        this.transitionDuration = 300;


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

        // Minimap X-Axis Group
        this.minimapAxisG = this.minimap.append("g")
            .attr("transform", `translate(0, ${this.minimapHeight})`);

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
        this.rsiGap = 40;

        // Define clip path for RSI panel
        this.svg.append("defs").append("clipPath")
            .attr("id", "rsi-clip")
            .append("rect")
            .attr("width", this.width)
            .attr("height", this.rsiHeight);

        this.rsiY = d3.scaleLinear().range([this.rsiHeight, 0]);

        this.rsiGroup = this.g.append("g")
            .attr("transform", `translate(0, ${this.height + this.rsiGap})`)
            .attr("clip-path", "url(#rsi-clip)")
            .style("opacity", 0)
            .style("display", "none");

        // RSI X-AXIS (Ultimate bottom axis)
        this.rsiAxisG = this.rsiGroup.append("g")
            .attr("transform", `translate(0, ${this.rsiHeight})`);

        // Add RSI Panel Y-Axis Label, with 'RSI' in red
        this.rsiLabel = this.rsiGroup.append("text")
            .attr("fill", "#e8e8e8")
            .attr("transform", "rotate(-90)")
            .attr("y", -this.margin.left + 15)
            .attr("x", -this.rsiHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .on("click", () => this.toggleRSI())
            .style("cursor", "pointer")
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

        // Price line & Benchmark updates (No transition needed here)
        const priceGen = d3.line()
            .defined(d => d && d.dateObj && d.close != null)
            .x(d => this.x(d.dateObj))
            .y(d => this.y(d.close));
        this.priceGroup.attr("d", priceGen(this.priceGroup.datum() || []));

        const benchGen = d3.line()
            .defined(e => e && e.dateObj && e.norm != null)
            .x(e => this.x(e.dateObj))
            .y(e => this.y(e.norm));
        this.benchmarkGroup.selectAll("path")
            .attr("d", d => benchGen(d));

        this.xAxisG.call(d3.axisBottom(this.x).ticks(5));

        this.updateIndicators(true); // true means update without full redraw/toggle logic
    }

    onBrush(event) {
        if (!event.selection) return;

        const [px0, px1] = event.selection;
        const x0 = this.minimapX.invert(px0);
        const x1 = this.minimapX.invert(px1);

        this.x.domain([x0, x1]);

        // Price line & Benchmark updates (No transition needed here)
        const priceGen = d3.line()
            .defined(d => d && d.dateObj && d.close != null)
            .x(d => this.x(d.dateObj))
            .y(d => this.y(d.close));
        this.priceGroup.datum(this.priceGroup.datum() || []).attr("d", priceGen);

        const benchGen = d3.line()
            .defined(e => e && e.dateObj && e.norm != null)
            .x(e => this.x(e.dateObj))
            .y(e => this.y(e.norm));
        this.benchmarkGroup.selectAll("path").attr("d", d => benchGen(d));

        const xAxis = d3.axisBottom(this.x).ticks(5);
        this.xAxisG.call(xAxis);

        this.updateIndicators(true); // true means update without full redraw/toggle logic
    }

    /**
     * Updates the visibility and rendering of all indicators.
     * @param {boolean} isZoomOrBrush If true, performs a movement update instead of a full toggle/transition.
     */
    updateIndicators(isZoomOrBrush = false) {
        const data = this.priceGroup.datum() || [];
        const duration = isZoomOrBrush ? 0 : this.transitionDuration;
        const volGen = d3.line()
            .defined(e => e.volatility != null)
            .x(e => this.x(e.dateObj))
            .y(e => this.yVolat(e.volatility));
        const smaGenFactory = (field) => d3.line()
            .defined(d => d && d.dateObj && d[field] != null)
            .x(d => this.x(d.dateObj))
            .y(d => this.y(d[field]));

        // --- VOLUME OVERLAY (Vertical Wipe Transition) ---
        this.volumeGroup
            .selectAll("rect")
            .data(this.showVolume ? data : [], d => d.date) // key by date for stability
            .join(
                // ENTER
                enter => enter.append("rect")
                    .attr("x", d => this.x(d.dateObj))
                    .attr("y", this.height)
                    .attr("width", 2)
                    .attr("height", 0)
                    .attr("fill", "rgba(180,180,255,0.4)")
                    .style("opacity", 0)
                    .call(enter =>
                        enter.transition()
                            .duration(duration)
                            .attr("y", d => (d.volume != null) ? this.yVol(d.volume) : this.height)
                            .attr("height", d => (d.volume != null) ? (this.height - this.yVol(d.volume)) : 0)
                            .style("opacity", 1)
                    ),

                // UPDATE
                update => update
                    .transition()
                    .duration(duration)
                    .attr("x", d => this.x(d.dateObj))
                    .attr("y", d => (d.volume != null) ? this.yVol(d.volume) : this.height)
                    .attr("height", d => (d.volume != null) ? (this.height - this.yVol(d.volume)) : 0)
                    .style("opacity", 1),

                // EXIT (fade & shrink downward before removal)
                exit => exit
                    .each(function () { d3.select(this).interrupt(); }) // stop other transitions
                    .transition()
                    .duration(duration)
                    .attr("y", this.height)
                    .attr("height", 0)
                    .style("opacity", 0)
                    .on("end", function () {
                        d3.select(this).remove();
                    })
            );


        // --- SMA LINES (Fade In/Out) ---
        const smaLines = [
            { data, field: "sma7", color: "#87CEFA", style: "5,5" },
            { data, field: "sma30", color: "#AFEEEE", style: "1,3" }
        ];

        this.smaGroup
            .selectAll("path")
            .data(this.showSMA ? smaLines : [], d => d.field) // <-- key function!
            .join(
                enter => enter.append("path")
                    .attr("stroke", d => d.color)
                    .attr("stroke-dasharray", d => d.style)
                    .attr("fill", "none")
                    .attr("stroke-width", 1.5)
                    .attr("d", d => smaGenFactory(d.field)(d.data))
                    .style("opacity", 0)
                    .call(enter => enter.transition()
                        .duration(duration)
                        .style("opacity", 1)
                    ), // Fade in

                update => update.transition()
                    .duration(duration)
                    .attr("d", d => smaGenFactory(d.field)(d.data))
                    .attr("stroke-dasharray", d => d.style)
                    .style("opacity", 1),

                exit => exit.transition()
                    .duration(duration)
                    .style("opacity", 0)
                    .on("end", function () { d3.select(this).remove(); })
            );

        // --- VOLATILITY LINE (Left-to-Right Wipe Transition) ---
        this.volatilityGroup
            .selectAll("path")
            .data(this.showVolatility ? [data] : [], () => "volatility-line") // key function
            .join(
                // ENTER
                enter => enter.append("path")
                    .attr("stroke", "purple")
                    .attr("fill", "none")
                    .attr("d", volGen(data))
                    .each(function () {
                        const length = this.getTotalLength();
                        d3.select(this)
                            .attr("stroke-dasharray", length)
                            .attr("stroke-dashoffset", length);
                    })
                    .call(enter => enter.transition()
                        .duration(duration)
                        .attr("stroke-dashoffset", 0)), // Wipe in left → right

                // UPDATE
                update => update
                    .attr("d", volGen) // update path first
                    .each(function () {
                        const length = this.getTotalLength();
                        d3.select(this)
                            .attr("stroke-dasharray", length)
                            .attr("stroke-dashoffset", length);
                    })
                    .call(update => update.transition()
                        .duration(duration)
                        .attr("stroke-dashoffset", 0)), // wipe again (left→right)

                // EXIT
                exit => exit
                    .each(function () {
                        // Ensure previous transition stops cleanly
                        d3.select(this).interrupt();
                    })
                    .transition()
                    .duration(duration)
                    .attr("stroke-dashoffset", function () {
                        return this.getTotalLength(); // Move back off-screen (right→left)
                    })
                    .on("end", function () {
                        d3.select(this).remove();
                    })
            );


        // --- VOLATILITY AXIS (Fades with line) ---
        if (this.showVolatility) {
            this.yVolatAxisG.call(d3.axisRight(this.yVolat).ticks(6).tickFormat(d3.format(".1%")));
            this.yVolatAxisG.style("display", null).transition().duration(duration).style("opacity", 1);
        } else {
            this.yVolatAxisG.transition().duration(duration)
                .style("opacity", 0)
                .on("end", function () {
                    d3.select(this).style("display", "none");
                });
        }

        // --- RSI PANEL/LINE (Left-to-Right Wipe Transition) ---
        const isRsiVisible = this.rsiGroup.style("display") !== "none";

        if (isRsiVisible) {
            this.rsiGroup
                .style("display", null)
                .transition()
                .duration(duration)
                .style("opacity", 1);

            this.rsiGroup
                .selectAll("path.rsi-line")
                .data([data])
                .join(
                    // ENTER
                    enter => enter.append("path")
                        .attr("class", "rsi-line")
                        .attr("stroke", "#d62728")
                        .attr("fill", "none")
                        .attr("stroke-width", 1.5)
                        .attr("d", this.rsiLine)
                        .each(function () {
                            const length = this.getTotalLength();
                            d3.select(this)
                                .attr("stroke-dasharray", length)
                                .attr("stroke-dashoffset", length);
                        })
                        .call(enter =>
                            enter.transition()
                                .duration(duration)
                                .attr("stroke-dashoffset", 0)
                        ),

                    // UPDATE
                    update => update
                        .attr("d", this.rsiLine)
                        .call(update => {
                            if (duration === 0) {
                                // Zoom/pan → no animation
                                update.attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
                            } else {
                                // Normal redraw → wipe in again
                                update.each(function () {
                                    const length = this.getTotalLength();
                                    d3.select(this)
                                        .attr("stroke-dasharray", length)
                                        .attr("stroke-dashoffset", length);
                                })
                                    .transition()
                                    .duration(duration)
                                    .attr("stroke-dashoffset", 0);
                            }
                            return update;
                        }),

                    // EXIT
                    exit => exit
                        .each(function () {
                            // stop previous transitions to avoid conflicts
                            d3.select(this).interrupt();
                        })
                        .transition()
                        .duration(duration)
                        .attr("stroke-dashoffset", function () {
                            return this.getTotalLength(); // wipe out right→left
                        })
                        .on("end", function () {
                            d3.select(this).remove();
                        })
                );
        } else {
            // if RSI is hidden, fade out the whole group
            this.rsiGroup.transition().duration(duration).style("opacity", 0).on("end", () => {
                this.rsiGroup.style("display", "none");
            });
        }


        // --- X-AXES ---
        this.xAxisG.call(d3.axisBottom(this.x).ticks(5));
        if (isRsiVisible) {
            this.rsiAxisG.call(d3.axisBottom(this.x).ticks(5));
        }
    }

    toggleSMAsAndVolume() {
        this.showSMA = !this.showSMA;
        this.showVolume = !this.showVolume;
        this.updateIndicators();
    }

    toggleVolatility() {
        this.showVolatility = !this.showVolatility;
        this.updateIndicators();
    }

    toggleRSI() {
        const isVisible = this.rsiGroup.style("display") === "none";

        // Instantaneously adjust SVG height and RSI group position
        this.totalHeight = isVisible ? (this.height + this.rsiHeight + this.rsiGap) : this.height;
        this.svg.attr("height", this.totalHeight + this.margin.top + this.margin.bottom);
        this.rsiGroup.attr("transform", `translate(0, ${this.height + this.rsiGap})`);

        if (isVisible) this.rsiGroup.style("display", null);

        this.updateIndicators();
    }

    render(data, opts = {}) {

        this.compareSymbols = opts.compareSymbols || [];
        this.rsiY.domain([0, 100]);

        this.showVolatility = opts.showVolatility || false;
        this.showVolume = opts.showVolume || false;
        this.showSMA = opts.showSMA || false;

        // Initialize display properties instantly for first render
        const isRSIInitialVisible = true;
        this.rsiGroup.style("display", isRSIInitialVisible ? null : "none");
        this.rsiGroup.style("opacity", isRSIInitialVisible ? 1 : 0);
        this.yVolatAxisG.style("opacity", this.showVolatility ? 1 : 0);
        this.yVolatAxisG.style("display", this.showVolatility ? null : "none");


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

        const isRsiVisible = this.rsiGroup.style("display") !== "none";
        this.totalHeight = isRsiVisible ? (this.height + this.rsiHeight + this.rsiGap) : this.height;

        this.svg.attr("height", this.totalHeight + this.margin.top + this.margin.bottom);
        this.rsiGroup.attr("transform", `translate(0, ${this.height + this.rsiGap})`);
        this.rsiAxisG.attr("transform", `translate(0, ${this.rsiHeight})`);

        // --- Domain Setup ---
        let allYValues = data.map(d => d.close);
        this.currentBenchmarks.forEach(series => {
            const norms = series.map(d => d.norm).filter(n => n != null);
            allYValues = allYValues.concat(norms);
        });
        const minY = d3.min(allYValues) * 0.98;
        const maxY = d3.max(allYValues) * 1.02;

        this.x.domain(d3.extent(data, d => d.dateObj));
        this.y.domain([minY, maxY]);
        this.yVol.domain([0, d3.max(data, d => d.volume || 0)]);
        this.yVolat.domain([0, d3.max(data, d => d.volatility || 0) * 1.05]);

        this.xOriginal = this.x.copy();
        this.yOriginal = this.y.copy();

        // --- Base Drawing (Instantaneous) ---
        const priceLineGen = d3.line()
            .defined(d => d.close != null)
            .x(d => this.x(d.dateObj))
            .y(d => this.y(d.close));

        this.priceGroup
            .attr("stroke", "#1f77b4")
            .datum(data); // Bind new data immediately

        this.priceGroup
            .attr("stroke", "#1f77b4")
            .datum(data)
            .attr("d", priceLineGen)
            .attr("opacity", 1);

        const benchGen = d3.line()
            .defined(e => e && e.dateObj && e.norm != null)
            .x(e => this.x(e.dateObj))
            .y(e => this.y(e.norm));

        // **BENCHMARK DRAWING WITH SAFE FADE-IN / FADE-OUT**
        this.benchmarkGroup
            .selectAll("path")
            .data(this.currentBenchmarks, (d, i) => d.symbol || i) // optional key for stable join
            .join(
                // ENTER (fade in)
                enter => enter.append("path")
                    .attr("stroke", (d, i) => this.benchmarkColors[i % this.benchmarkColors.length])
                    .attr("fill", "none")
                    .attr("stroke-width", 1.5)
                    .attr("opacity", 0)
                    .attr("d", benchGen)
                    .call(enter =>
                        enter.transition()
                            .duration(this.transitionDuration)
                            .attr("opacity", 0.9)
                    ),

                // UPDATE (re-draw with gentle opacity restore)
                update => update
                    .attr("d", benchGen)
                    .transition()
                    .duration(this.transitionDuration)
                    .attr("opacity", 0.9),

                // EXIT (fade-out before remove)
                exit => exit
                    .each(function () { d3.select(this).interrupt(); }) // stop ongoing transitions
                    .transition()
                    .duration(this.transitionDuration)
                    .attr("opacity", 0)
                    .on("end", function () { d3.select(this).remove(); })
            );


        // --- Axes (Instantaneous) ---
        this.xAxisG.call(d3.axisBottom(this.x).ticks(5));
        this.yAxisG.call(d3.axisLeft(this.y).ticks(6));

        // --- Minimap (Instantaneous) ---
        this.minimapX.domain(d3.extent(data, d => d.dateObj));
        this.minimapY.domain(this.yOriginal.domain());

        const minimapLineGen = d3.line()
            .x(d => this.minimapX(d.dateObj))
            .y(d => this.minimapY(d.close));

        this.minimapPath.datum(data) // Bind new data immediately
            .attr("d", minimapLineGen)
            .attr("opacity", 1);

        this.minimapAxisG.call(d3.axisBottom(this.minimapX).ticks(4));
        this.brushArea.call(this.brush)
            .call(this.brush.move, [this.width * 0.4, this.width]);

        // --- Indicators (Initial Draw) ---
        this.updateIndicators();
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

        this.crosshair.select(".crosshair-x")
            .attr("x1", mx).attr("x2", mx);
        this.crosshair.select(".crosshair-y")
            .attr("y1", this.y(d.close)).attr("y2", this.y(d.close));

        let html = `<strong>${d3.timeFormat("%Y-%m-%d")(d.dateObj)}</strong><br>
                <span style="color:#1f77b4">Close</span>: <b>$${d.close.toFixed(2)}</b>`;

        if (this.showVolume && d.volume != null) html += `<br>Volume: ${d.volume.toLocaleString()}`;
        if (this.showVolatility && d.volatility != null) html += `<br><span style="color:purple">Volatility(14)</span>: ${d.volatility.toFixed(3)}`;

        const isRsiVisible = this.rsiGroup.style("display") !== "none";
        if (isRsiVisible && d.rsi != null) html += `<br><span style="color:#d62728">RSI(14)</span>: ${d.rsi.toFixed(2)}`;

        if (this.showSMA && d.sma7 != null) html += `<br><span style="color:#87CEFA"><span style="display:inline-block; width:15px; height:1px; border-bottom: 2px dashed #87CEFA; margin-right:5px; vertical-align:middle;"></span>SMA7</span>: ${d.sma7.toFixed(2)}`;

        if (this.showSMA && d.sma30 != null) html += `<br><span style="color:#AFEEEE"><span style="display:inline-block; width:15px; height:1px; border-bottom: 2px dotted #AFEEEE; margin-right:5px; vertical-align:middle;"></span>SMA30</span>: ${d.sma30.toFixed(2)}`;

        if (this.currentBenchmarks && this.currentBenchmarks.length > 0) {
            this.currentBenchmarks.forEach((series, idx) => {
                const point = series[i];
                const symbol = this.compareSymbols[idx];
                if (point && point.norm != null) {
                    const benchColor = this.benchmarkColors[idx % this.benchmarkColors.length];
                    html += `<br><span style="color:${benchColor}"><span style="display:inline-block; width:15px; height:1px; border-bottom: 2px solid ${benchColor}; margin-right:5px; vertical-align:middle;"></span>${symbol}</span>: $${point.norm.toFixed(2)}`;
                }
            });
        }

        this.tooltip
            .html(html)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY + 15) + "px");
    }

    resetZoomAndBrush() {
        // Reset the main chart's zoom to the identity transform (no zoom/pan)
        this.svg.transition().duration(this.transitionDuration).call(this.zoom.transform, d3.zoomIdentity);

        // Reset the brush to the default extent (last 60% of the data)
        this.brushArea.call(this.brush.move, [this.width * 0.4, this.width]);
    }
}