# BenderEdge 🧠

> Multi-agent AI stock research platform powered by XGBoost, LLM agents, and real-time streaming.

## What is BenderEdge?

BenderEdge is a multi-agent AI system that analyzes stocks using 5 specialized agents working in parallel. Each agent votes on a BUY/SELL/HOLD decision with a confidence score. A weighted voting system combines all signals into a final verdict.

Built as a portfolio project to demonstrate multi-agent orchestration, ML model integration, and real-time streaming architecture.

---

## Architecture
```
User Input (ticker)
        ↓
FastAPI Orchestrator (LangChain)
        ↓
┌─────────────────────────────────────┐
│  Researcher   │ Web + NewsAPI       │
│  Quant        │ RSI, MACD, BB, SMA  │
│  Sentiment    │ News tone analysis  │
│  BenderQuant  │ XGBoost ML signal   │
│  Portfolio    │ Weighted verdict    │
└─────────────────────────────────────┘
        ↓
SSE Streaming → Next.js UI
```

---

## Agents

**Researcher Agent**
Fetches live news via NewsAPI, identifies spotlight headlines, extracts risk and catalyst signals, votes BUY/SELL/HOLD with confidence score.

**Quant Agent**
Computes RSI, MACD, Bollinger Bands, SMA20/50, support/resistance, volume spike. Generates technical vote.

**Sentiment Agent**
Analyzes news headline tone, produces sentiment score (-10 to +10), labels Bullish/Neutral/Bearish.

**BenderQuant ML Agent**
Trains an XGBoost model on-the-fly using 2 years of price data. Produces:
- 5-day short-term signal
- 30-day long-term signal
- CV score (5-fold cross-validation)
- Backtest results (Return, Sharpe, Max Drawdown)
- Equity curve
- Fundamental data (P/E, EPS, Market Cap, Beta)

**Portfolio Agent**
Combines all agent votes using a weighted voting system:
- Quant: 35%
- BenderQuant ML: 30%
- Sentiment: 20%
- Researcher: 15%

Confidence score = agent agreement × signal strength.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, Tailwind CSS, Recharts |
| Backend | FastAPI, Python 3.13 |
| ML | XGBoost, scikit-learn, pandas |
| LLM | Ollama (Qwen2.5:7b) + LangChain |
| Data | yfinance, NewsAPI |
| Streaming | Server-Sent Events (SSE) |

---

## Features

- ✅ Real-time agent streaming — each agent result appears as it completes
- ✅ Weighted multi-agent voting with confidence scoring
- ✅ On-the-fly XGBoost training per ticker (no pre-trained model required)
- ✅ Backtest with Sharpe ratio, Max Drawdown, CAGR
- ✅ Equity curve visualization
- ✅ Fundamental data (P/E, EPS, Market Cap, Beta, 52-week range)
- ✅ Global market support (NYSE, NASDAQ, BIST, LSE, etc.)
- ✅ Spotlight headline analysis with Risk/Catalyst extraction
- ✅ Fully local LLM — no API costs

---

## Local Setup

**Prerequisites**
- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com) with `qwen2.5:7b`
```bash
# 1. Clone
git clone https://github.com/yusufbender/BenderEdge.git
cd BenderEdge

# 2. Backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt

# 3. Environment
cp backend/.env.example backend/.env
# Add your NewsAPI key to .env

# 4. Pull LLM
ollama pull qwen2.5:7b

# 5. Run backend
cd backend
uvicorn main:app --reload

# 6. Run frontend
cd ../frontend
npm install
npm run dev
```

Open http://localhost:3000

---

## Usage

Enter any ticker symbol:
- US stocks: `AAPL`, `TSLA`, `NVDA`
- Borsa Istanbul: `THYAO.IS`, `GARAN.IS`
- London: `HSBA.L`
- Frankfurt: `SAP.DE`

---

## Related Projects

**[BenderQuant](https://github.com/yusufbender/benderquant)** — The XGBoost financial classification model powering the ML agent in this project. Trained on multi-ticker datasets with feature engineering, SMOTE oversampling, and hyperparameter tuning.

---

## Author

**Yusuf** — AI/ML Engineer
Building toward production-grade LLM and ML systems.