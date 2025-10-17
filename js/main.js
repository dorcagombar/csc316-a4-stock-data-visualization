// main.js - Stock Insight Prototype (Milestone 1)
// D3.js v7 visualization for daily closing prices.
// Loads data from window.stockData (provided by data-sample.js or data-api.js)
// Provides symbol selection, range selection, and tooltips.
//
// Usage: open index.html or serve via a local server. The page listens for 'stockdata:loaded'.

const margin = { top: 20, right: 20, bottom: 40, left: 60 };
const width = 860 - margin.left - margin.right;
const height = 420 - margin.top - margin.bottom;

const svg = d3.select('#chart-area').append('svg')
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

// Scales
const x = d3.scaleTime().range([0, width]);
const y = d3.scaleLinear().range([height, 0]);

// Axis groups
const xAxisG = svg.append('g').attr('class', 'x axis').attr('transform', `translate(0, ${height})`);
const yAxisG = svg.append('g').attr('class', 'y axis');

// Line generator
const line = d3.line().x(d => x(new Date(d.date))).y(d => y(d.close)).curve(d3.curveMonotoneX);

// Tooltip element
const tooltip = d3.select('body').append('div').attr('class', 'tooltip').style('display', 'none');

// UI elements
const select = d3.select('#symbol-select');
const rangeSelect = d3.select('#range-select');

// Initialize when data is available
window.addEventListener('stockdata:loaded', init);

function init() {
  const symbols = Object.keys(window.stockData || {}).sort();
  if (symbols.length === 0) {
    console.error('No stock data available.');
    return;
  }
  // Populate symbol dropdown
  symbols.forEach(s => select.append('option').attr('value', s).text(s));
  select.on('change', updateChart);
  rangeSelect.on('change', updateChart);
  select.property('value', symbols[0]);
  updateChart();
}

// updateChart: read current symbol and range, then redraw chart accordingly
function updateChart() {
  const symbol = select.property('value');
  const range = +rangeSelect.property('value');
  if (!window.stockData || !window.stockData[symbol]) return;

  let data = window.stockData[symbol].slice();
  if (range && data.length > range) data = data.slice(data.length - range);

  // parse date and close
  data.forEach(d => { d.dateObj = new Date(d.date); d.close = +d.close; });

  x.domain(d3.extent(data, d => d.dateObj));
  y.domain([d3.min(data, d => d.close) * 0.98, d3.max(data, d => d.close) * 1.02]);

  const xAxis = d3.axisBottom(x).ticks(Math.min(10, data.length)).tickFormat(d3.timeFormat('%b %d'));
  const yAxis = d3.axisLeft(y).ticks(6);

  xAxisG.transition().duration(600).call(xAxis).selectAll('text').attr('transform', 'rotate(-35)').style('text-anchor', 'end');
  yAxisG.transition().duration(600).call(yAxis);

  // DATA JOIN for single path (line)
  const path = svg.selectAll('path.line').data([data]);
  path.enter().append('path').attr('class', 'line').merge(path)
    .transition().duration(600)
    .attr('d', line)
    .attr('fill', 'none').attr('stroke', '#1f77b4').attr('stroke-width', 2);
  path.exit().remove();

  // DATA JOIN for points (circles)
  const circles = svg.selectAll('circle.point').data(data);
  circles.enter().append('circle').attr('class', 'point').attr('r', 3)
    .on('mouseenter', (event, d) => {
      tooltip.style('display', 'block').html(`<strong>${select.property('value')}</strong><br>${d.date}<br>Close: $${d.close}`);
    })
    .on('mousemove', (event) => {
      tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY + 12) + 'px');
    })
    .on('mouseleave', () => tooltip.style('display', 'none'))
    .merge(circles)
    .transition().duration(600)
    .attr('cx', d => x(d.dateObj))
    .attr('cy', d => y(d.close));

  circles.exit().remove();
}
