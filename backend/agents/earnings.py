import yfinance as yf
from langchain_ollama import OllamaLLM
from datetime import datetime

llm = OllamaLLM(model="qwen2.5:7b")

def run_earnings(ticker: str) -> dict:
    try:
        stock = yf.Ticker(ticker)

        # Earnings geçmişi
        earnings_hist = stock.earnings_history
        quarterly = []

        if earnings_hist is not None and not earnings_hist.empty:
            for idx, row in earnings_hist.head(8).iterrows():
                try:
                    eps_est = float(row.get("epsEstimate", 0) or 0)
                    eps_act = float(row.get("epsActual", 0) or 0)
                    surprise = float(row.get("epsSurprise", 0) or 0)
                    surprise_pct = float(row.get("surprisePercent", 0) or 0)

                    quarterly.append({
                        "date": str(idx.date()) if hasattr(idx, 'date') else str(idx),
                        "eps_estimate": round(eps_est, 3),
                        "eps_actual": round(eps_act, 3),
                        "surprise": round(surprise, 3),
                        "surprise_pct": round(surprise_pct, 2),
                        "beat": eps_act > eps_est,
                    })
                except:
                    continue

        # Gelecek earnings tarihi
        next_earnings = None
        try:
            cal = stock.calendar
            if cal is not None and "Earnings Date" in cal:
                next_earnings = str(cal["Earnings Date"][0])
        except:
            pass

        # İstatistikler
        beats = sum(1 for q in quarterly if q.get("beat"))
        total = len(quarterly)
        beat_rate = round(beats / total * 100, 1) if total > 0 else 0
        avg_surprise = round(sum(q["surprise_pct"] for q in quarterly) / total, 2) if total > 0 else 0

        hist_text = "\n".join([
            f"- {q['date']}: EPS {q['eps_actual']} vs est {q['eps_estimate']} ({'BEAT' if q['beat'] else 'MISS'} {q['surprise_pct']}%)"
            for q in quarterly[:4]
        ]) if quarterly else "No earnings history available."

        prompt = f"""You are an earnings analyst for {ticker}.

Earnings history (last 4 quarters):
{hist_text}

Beat rate: {beat_rate}% ({beats}/{total} quarters)
Average surprise: {avg_surprise}%
Next earnings: {next_earnings or "Unknown"}

Respond in EXACTLY this format:
VOTE: <BUY or SELL or HOLD>
CONFIDENCE: <number between 0.0 and 1.0>
TREND: <Improving or Declining or Stable>
REASONING: <1 sentence earnings assessment>"""

        response = llm.invoke(prompt)

        vote = "HOLD"
        confidence = 0.5
        trend = "Stable"
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
            elif line.startswith("TREND:"):
                trend = line.replace("TREND:", "").strip()
            elif line.startswith("REASONING:"):
                reasoning = line.replace("REASONING:", "").strip()

        return {
            "agent": "earnings",
            "ticker": ticker,
            "quarterly": quarterly[:4],
            "beat_rate": beat_rate,
            "avg_surprise": avg_surprise,
            "next_earnings": next_earnings,
            "trend": trend,
            "vote": vote,
            "confidence": confidence,
            "reasoning": reasoning,
        }

    except Exception as e:
        return {
            "agent": "earnings",
            "ticker": ticker,
            "error": str(e),
            "vote": "HOLD",
            "confidence": 0.3,
            "trend": "Stable",
            "reasoning": "Could not fetch earnings data.",
            "quarterly": [],
            "beat_rate": 0,
        }