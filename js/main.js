const chartBox = document.querySelector('#chart-area');
const api = new StockAPI("GJY5RL03ED48CM7D");
const chart = new Chart("#chart-area", { width: chartBox.offsetWidth, height: chartBox.offsetHeight});
const ui = new UI(api, chart);
ui.attachEvents();
ui.redraw();