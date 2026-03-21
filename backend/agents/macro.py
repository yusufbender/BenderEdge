import requests
import os
from langchain_ollama import OllamaLLM
from dotenv import load_dotenv

load_dotenv()
llm = OllamaLLM(model="qwen2.5:7b")

FRED_API_KEY = os.getenv("FRED_API_KEY", "")

FRED_SERIES = {
    "fed_rate":   "FEDFUNDS",
    "inflation":  "CPIAUCSL",
    "gdp_growth": "A191RL1Q225SBEA",
    "unemployment": "UNRATE",
    "yield_10y":  "GS10",
    "yield_2y":   "GS2",
}

def fetch_fred(series_id: str, limit: int = 2) -> list:
    if not FRED_API_KEY:
        return []
    url = f"https://api.stlouisfed.org/fred/series/observations?series_id={series_id}&api_key={FRED_API_KEY}&file_type=json&sort_order=desc&limit={limit}"
    try:
        res = requests.get(url, timeout=8)
        data = res.json()
        return data.get("observations", [])
    except:
        return []

def run_macro(ticker: str) -> dict:
    macro_data = {}

    for key, series_id in FRED_SERIES.items():
        obs = fetch_fred(series_id, limit=2)
        if obs:
            latest = obs[0]
            prev = obs[1] if len(obs) > 1 else obs[0]
            try:
                val = float(latest["value"])
                prev_val = float(prev["value"])
                change = round(val - prev_val, 3)
                macro_data[key] = {
                    "value": round(val, 3),
                    "prev": round(prev_val, 3),
                    "change": change,
                    "date": latest["date"],
                }
            except:
                pass

    if not macro_data:
        return {
            "agent": "macro",
            "ticker": ticker,
            "error": "FRED API key missing or unavailable",
            "vote": "HOLD",
            "confidence": 0.3,
            "reasoning": "No macro data available.",
            "macro_data": {},
        }

    # Yield curve (10y - 2y)
    yield_spread = None
    if "yield_10y" in macro_data and "yield_2y" in macro_data:
        yield_spread = round(
            macro_data["yield_10y"]["value"] - macro_data["yield_2y"]["value"], 3
        )
        macro_data["yield_spread"] = {
            "value": yield_spread,
            "signal": "normal" if yield_spread > 0 else "inverted"
        }

    summary_lines = []
    for key, d in macro_data.items():
        if isinstance(d, dict) and "value" in d:
            summary_lines.append(f"- {key}: {d['value']} (change: {d.get('change', 'N/A')})")

    summary_text = "\n".join(summary_lines)

    prompt = f"""You are a macro economist analyzing market conditions for {ticker}.

Current macroeconomic indicators:
{summary_text}

Yield curve: {"INVERTED (recession signal)" if yield_spread and yield_spread < 0 else "Normal"}

Based on these macro conditions, assess the investment environment.
Respond in EXACTLY this format:
VOTE: <BUY or SELL or HOLD>
CONFIDENCE: <number between 0.0 and 1.0>
ENVIRONMENT: <Risk-On or Risk-Off or Neutral>
REASONING: <1-2 sentence macro assessment>"""

    response = llm.invoke(prompt)

    vote = "HOLD"
    confidence = 0.5
    environment = "Neutral"
    reasoning = ""

    for line in response.split("\n"):
        line = line.strip()
        if line.startswith("VOTE:"):
            v = line.replace("VOTE:", "").strip().upper()
            if v in ["BUY", "SELL", "HOLD"]:
                vote = v
        elif line.startswith("CONFIDENCE:"):
            try:
                confidence = float(line.replace("CONFIDENCE:", "").strip())
                confidence = max(0.0, min(1.0, confidence))
            except:
                confidence = 0.5
        elif line.startswith("ENVIRONMENT:"):
            environment = line.replace("ENVIRONMENT:", "").strip()
        elif line.startswith("REASONING:"):
            reasoning = line.replace("REASONING:", "").strip()

    return {
        "agent": "macro",
        "ticker": ticker,
        "macro_data": macro_data,
        "yield_spread": yield_spread,
        "environment": environment,
        "vote": vote,
        "confidence": confidence,
        "reasoning": reasoning,
    }