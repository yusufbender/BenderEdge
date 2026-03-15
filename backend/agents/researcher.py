from langchain_ollama import OllamaLLM
import requests
import os
from dotenv import load_dotenv

load_dotenv()

llm = OllamaLLM(model="qwen2.5:7b")

def run_researcher(ticker: str) -> dict:
    news_api_key = os.getenv("NEWS_API_KEY", "")

    articles = []
    raw_articles = []

    if news_api_key:
        url = f"https://newsapi.org/v2/everything?q={ticker}&sortBy=publishedAt&pageSize=8&apiKey={news_api_key}"
        try:
            res = requests.get(url, timeout=5)
            data = res.json()
            for a in data.get("articles", [])[:8]:
                title = a.get("title", "")
                source = a.get("source", {}).get("name", "")
                description = a.get("description", "") or ""
                published = a.get("publishedAt", "")[:10]
                articles.append(f"- [{published}] {title} ({source})")
                raw_articles.append({
                    "title": title,
                    "source": source,
                    "description": description,
                    "published": published,
                })
        except:
            articles = []

    has_live_news = len(articles) > 0

    if not articles:
        articles = [f"No live news found for {ticker}. Using model knowledge."]

    news_text = "\n".join(articles)

    prompt = f"""You are a sharp financial research analyst covering {ticker}.

Recent news headlines:
{news_text}

Your job:
1. Identify the 1-2 most market-moving headlines and explain WHY they matter
2. Spot any risks or catalysts hidden in the headlines
3. Give an overall research verdict

Respond in EXACTLY this format:
VOTE: <BUY or SELL or HOLD>
CONFIDENCE: <number between 0.0 and 1.0>
SUMMARY: <2-3 sentence overview of what's happening with this stock>
SPOTLIGHT: <The most important headline and why it matters for the stock price — be specific>
RISK: <1 key risk or concern from the news>
CATALYST: <1 potential upside catalyst from the news, or NONE if not present>
REASONING: <1 sentence explaining your vote>"""

    response = llm.invoke(prompt)

    vote = "HOLD"
    confidence = 0.5
    summary = ""
    spotlight = ""
    risk = ""
    catalyst = ""
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
        elif line.startswith("SUMMARY:"):
            summary = line.replace("SUMMARY:", "").strip()
        elif line.startswith("SPOTLIGHT:"):
            spotlight = line.replace("SPOTLIGHT:", "").strip()
        elif line.startswith("RISK:"):
            risk = line.replace("RISK:", "").strip()
        elif line.startswith("CATALYST:"):
            catalyst = line.replace("CATALYST:", "").strip()
        elif line.startswith("REASONING:"):
            reasoning = line.replace("REASONING:", "").strip()

    return {
        "agent": "researcher",
        "ticker": ticker,
        "headlines": articles,
        "has_live_news": has_live_news,
        "summary": summary,
        "spotlight": spotlight,
        "risk": risk,
        "catalyst": catalyst,
        "vote": vote,
        "confidence": confidence,
        "reasoning": reasoning,
    }