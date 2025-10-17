// Loads sample data into window.stockData and fires 'stockdata:loaded'
fetch('data/stocks-sample.json')
  .then(res => res.json())
  .then(data => {
    window.stockData = data;
    window.dispatchEvent(new Event('stockdata:loaded'));
    document.querySelector('footer').textContent = "Data loaded successfully";
  })
  .catch(err => console.error('Error loading sample data:', err));
