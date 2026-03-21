import requests
from langchain_ollama import OllamaLLM
from datetime import datetime, timedelta

llm = OllamaLLM(model="qwen2.5:7b")

def run_insider(ticker: str) -> dict:
    # SEC EDGAR - Form 4 insider transactions
    clean_ticker = ticker.replace(".IS", "").replace(".L", "").replace(".DE", "")

    try:
        # Şirketi bul
        search_url = f"https://efts.sec.gov/LATEST/search-index?q=%22{clean_ticker}%22&dateRange=custom&startdt={(datetime.now()-timedelta(days=90)).strftime('%Y-%m-%d')}&enddt={datetime.now().strftime('%Y-%m-%d')}&forms=4"
        headers = {"User-Agent": "BenderEdge research@benderedge.com"}
        res = requests.get(search_url, headers=headers, timeout=10)
        data = res.json()

        hits = data.get("hits", {}).get("hits", [])
        transactions = []

        for hit in hits[:10]:
            source = hit.get("_source", {})
            transactions.append({
                "date": source.get("file_date", ""),
                "name": source.get("display_names", ["Unknown"])[0] if source.get("display_names") else "Unknown",
                "form": source.get("form_type", "4"),
            })

        has_data = len(transactions) > 0

        if has_data:
            tx_text = "\n".join([f"- {t['date']}: {t['name']} filed Form 4" for t in transactions[:5]])
        else:
            tx_text = f"No recent Form 4 filings found for {clean_ticker} in last 90 days."

        prompt = f"""You are an insider trading analyst. Analyze SEC Form 4 filings for {ticker}.

Recent filings:
{tx_text}

Respond in EXACTLY this format:
VOTE: <BUY or SELL or HOLD>
CONFIDENCE: <number between 0.0 and 1.0>
SIGNAL: <Bullish or Bearish or Neutral>
REASONING: <1 sentence explaining insider activity significance>"""

        response = llm.invoke(prompt)

        vote = "HOLD"
        confidence = 0.4
        signal = "Neutral"
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
                    confidence = 0.4
            elif line.startswith("SIGNAL:"):
                signal = line.replace("SIGNAL:", "").strip()
            elif line.startswith("REASONING:"):
                reasoning = line.replace("REASONING:", "").strip()

        return {
            "agent": "insider",
            "ticker": ticker,
            "transactions": transactions[:5],
            "transaction_count": len(transactions),
            "has_data": has_data,
            "signal": signal,
            "vote": vote,
            "confidence": confidence,
            "reasoning": reasoning,
        }

    except Exception as e:
        return {
            "agent": "insider",
            "ticker": ticker,
            "error": str(e),
            "vote": "HOLD",
            "confidence": 0.3,
            "signal": "Neutral",
            "reasoning": "Could not fetch insider data.",
            "transactions": [],
            "has_data": False,
        }