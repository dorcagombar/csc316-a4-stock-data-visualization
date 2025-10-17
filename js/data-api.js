// Alpha Vantage loader

const API_KEY = "GJY5RL03ED48CM7D";
const symbols = ["AAPL","MSFT","TSLA","GOOGL"];
const apiFunction = "TIME_SERIES_DAILY";

async function fetchSymbol(sym){
  const url = `https://www.alphavantage.co/query?function=${apiFunction}&symbol=${sym}&outputsize=compact&apikey=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

async function loadAPI(){
  window.stockData = window.stockData || {};
  let anyLoaded = false;
  for(const sym of symbols){
    try{
      const json = await fetchSymbol(sym);
      document.querySelector('footer').textContent = json.Information;
      const series = json["Time Series (Daily)"];
      if(!series){ console.warn('No series for', sym); continue; }
      const parsed = Object.entries(series).map(([date,vals])=>({date, close: +vals["4. close"]})).sort((a,b)=>new Date(a.date)-new Date(b.date));
      window.stockData[sym] = parsed;
      anyLoaded = true;
      // polite delay to avoid hitting rate limit quickly
      await new Promise(r=>setTimeout(r,600));
    }catch(e){
      console.error('Error fetching', sym, e);
    }
  }
  if(anyLoaded){
    window.dispatchEvent(new Event('stockdata:loaded'));
  } else {
    console.warn('API did not return data; sample fallback remains.');
  }
}

loadAPI();
