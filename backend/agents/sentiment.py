from langchain_ollama import OllamaLLM

llm = OllamaLLM(model="qwen2.5:7b")

def run_sentiment(ticker: str, headlines: list[str]) -> dict:
    if not headlines:
        headlines = [f"No headlines available for {ticker}"]

    news_text = "\n".join(headlines)

    prompt = f"""You are a financial sentiment analyst. Analyze these headlines for {ticker}:
{news_text}

Respond in EXACTLY this format:
VOTE: <BUY or SELL or HOLD>
CONFIDENCE: <number between 0.0 and 1.0>
SCORE: <number from -10 to 10>
LABEL: <Bearish or Neutral or Bullish>
REASONING: <1 sentence explaining your vote>"""

    response = llm.invoke(prompt)

    vote = "HOLD"
    confidence = 0.5
    score = 0.0
    label = "Neutral"
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
        elif line.startswith("SCORE:"):
            try:
                score = float(line.replace("SCORE:", "").strip())
            except:
                score = 0.0
        elif line.startswith("LABEL:"):
            label = line.replace("LABEL:", "").strip()
        elif line.startswith("REASONING:"):
            reasoning = line.replace("REASONING:", "").strip()

    return {
        "agent": "sentiment",
        "ticker": ticker,
        "vote": vote,
        "confidence": confidence,
        "score": score,
        "label": label,
        "reasoning": reasoning
    }