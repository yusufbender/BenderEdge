from fastapi import APIRouter
from database import save_scanner_result, get_latest_scanner_results, save_analysis, get_analyses, get_accuracy_stats, get_pending_validations, save_validation
from agents.researcher import run_researcher
from agents.quant import run_quant
from agents.sentiment import run_sentiment
from agents.ml_agent import run_ml_agent
from agents.portfolio import run_portfolio
import yfinance as yf

router = APIRouter()

# Endeks ticker listeleri
INDICES = {
    "SP500": [
        "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "BRK-B",
        "JPM", "V", "XOM", "UNH", "JNJ", "PG", "MA", "HD", "CVX", "MRK",
        "ABBV", "PEP"
    ],
    "NASDAQ100": [
        "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO",
        "COST", "NFLX", "AMD", "ADBE", "QCOM", "INTC", "INTU", "AMAT",
        "MU", "PANW", "LRCX", "KLAC"
    ],
    "BIST50": [
        "THYAO.IS", "GARAN.IS", "AKBNK.IS", "ISCTR.IS", "EREGL.IS",
        "BIMAS.IS", "KCHOL.IS", "SAHOL.IS", "SISE.IS", "TCELL.IS",
        "TUPRS.IS", "ASELS.IS", "FROTO.IS", "TOASO.IS", "KOZAL.IS",
        "EKGYO.IS", "HALKB.IS", "VAKBN.IS", "YKBNK.IS", "PETKM.IS"
    ],
    "BIST100": [
        "THYAO.IS", "GARAN.IS", "AKBNK.IS", "ISCTR.IS", "EREGL.IS",
        "BIMAS.IS", "KCHOL.IS", "SAHOL.IS", "SISE.IS", "TCELL.IS",
        "TUPRS.IS", "ASELS.IS", "FROTO.IS", "TOASO.IS", "KOZAL.IS",
        "EKGYO.IS", "HALKB.IS", "VAKBN.IS", "YKBNK.IS", "PETKM.IS",
        "SASA.IS", "PGSUS.IS", "TAVHL.IS", "MGROS.IS", "ARCLK.IS"
    ]
}

def analyze_ticker(ticker: str, index_name: str) -> dict:
    try:
        researcher = run_researcher(ticker)
        quant = run_quant(ticker)
        sentiment = run_sentiment(ticker, researcher.get("headlines", []))
        ml = run_ml_agent(ticker)
        portfolio = run_portfolio(ticker, researcher, quant, sentiment, ml)

        result = {
            "ticker": ticker,
            "researcher": researcher,
            "quant": quant,
            "sentiment": sentiment,
            "ml": ml,
            "portfolio": portfolio,
        }

        save_scanner_result(ticker, index_name, result)
        save_analysis(ticker, result)
        return result
    except Exception as e:
        return {"ticker": ticker, "error": str(e)}

@router.get("/scanner/results")
async def get_scanner_results(index: str = None):
    results = get_latest_scanner_results(index)
    return {"results": results, "count": len(results)}

@router.post("/scanner/scan/{index_name}")
async def scan_index(index_name: str, limit: int = 5):
    if index_name not in INDICES:
        return {"error": f"Unknown index: {index_name}. Use: {list(INDICES.keys())}"}

    tickers = INDICES[index_name][:limit]
    results = []

    for ticker in tickers:
        result = analyze_ticker(ticker, index_name)
        results.append({
            "ticker": ticker,
            "verdict": result.get("portfolio", {}).get("verdict", "ERROR"),
            "confidence": result.get("portfolio", {}).get("confidence_score", 0),
            "weighted_score": result.get("portfolio", {}).get("weighted_score", 0),
            "price": result.get("quant", {}).get("current_price", 0),
            "sector": result.get("ml", {}).get("fundamentals", {}).get("sector", "N/A"),
            "error": result.get("error"),
        })

    return {"index": index_name, "scanned": len(results), "results": results}

@router.get("/scanner/history")
async def get_history(limit: int = 50):
    analyses = get_analyses(limit)
    return {"analyses": analyses, "count": len(analyses)}

@router.get("/scanner/accuracy")
async def get_accuracy():
    stats = get_accuracy_stats()
    return stats

@router.post("/scanner/validate")
async def run_validation():
    pending = get_pending_validations()
    validated = 0

    for analysis in pending:
        try:
            ticker = analysis["ticker"]
            stock = yf.Ticker(ticker)
            hist = stock.history(period="10d")

            if hist.empty:
                continue

            price_now = float(hist["Close"].iloc[-1])
            price_at = analysis["price_at_analysis"]

            save_validation(
                analysis_id=analysis["id"],
                ticker=ticker,
                verdict=analysis["verdict"],
                price_at=price_at,
                price_7d=price_now,
            )
            validated += 1
        except:
            continue

    return {"validated": validated, "pending": len(pending)}