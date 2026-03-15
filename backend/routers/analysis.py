from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agents.researcher import run_researcher
from agents.quant import run_quant
from agents.sentiment import run_sentiment
from agents.portfolio import run_portfolio
from agents.ml_agent import run_ml_agent
import json
import yfinance as yf

router = APIRouter()

class AnalysisRequest(BaseModel):
    ticker: str

async def stream_analysis(ticker: str):
    def event(agent: str, data: dict):
        return f"data: {json.dumps({'agent': agent, 'data': data})}\n\n"

    researcher = run_researcher(ticker)
    yield event("researcher", researcher)

    quant = run_quant(ticker)
    yield event("quant", quant)

    sentiment = run_sentiment(ticker, researcher.get("headlines", []))
    yield event("sentiment", sentiment)

    ml = run_ml_agent(ticker)
    yield event("ml", ml)

    portfolio = run_portfolio(ticker, researcher, quant, sentiment, ml)
    yield event("portfolio", portfolio)

    yield event("done", {"ticker": ticker})

@router.get("/analyze/stream")
async def analyze_stream(ticker: str):
    return StreamingResponse(
        stream_analysis(ticker.upper()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )

@router.post("/analyze")
async def analyze(req: AnalysisRequest):
    ticker = req.ticker.upper()
    researcher = run_researcher(ticker)
    quant = run_quant(ticker)
    sentiment = run_sentiment(ticker, researcher.get("headlines", []))
    ml = run_ml_agent(ticker)
    portfolio = run_portfolio(ticker, researcher, quant, sentiment, ml)
    return {
        "ticker": ticker,
        "researcher": researcher,
        "quant": quant,
        "sentiment": sentiment,
        "ml": ml,
        "portfolio": portfolio,
    }

@router.get("/chart/{ticker}")
async def get_chart_data(ticker: str):
    stock = yf.Ticker(ticker.upper())
    hist = stock.history(period="1mo")
    if hist.empty:
        return {"ticker": ticker, "data": []}
    data = [
        {
            "date": str(idx.date()),
            "close": round(float(row["Close"]), 2),
            "volume": int(row["Volume"]),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
        }
        for idx, row in hist.iterrows()
    ]
    return {"ticker": ticker.upper(), "data": data}