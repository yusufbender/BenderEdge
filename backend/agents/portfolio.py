from langchain_ollama import OllamaLLM

llm = OllamaLLM(model="qwen2.5:7b")

AGENT_WEIGHTS = {
    "quant": 0.35,
    "ml": 0.30,
    "sentiment": 0.20,
    "researcher": 0.15,
}

VOTE_SCORES = {
    "BUY": 1.0,
    "HOLD": 0.0,
    "SELL": -1.0,
}

def calculate_weighted_verdict(votes: dict) -> dict:
    weighted_score = 0.0
    total_confidence = 0.0
    vote_counts = {"BUY": 0, "SELL": 0, "HOLD": 0}

    for agent, weight in AGENT_WEIGHTS.items():
        if agent not in votes:
            continue
        vote = votes[agent]["vote"]
        confidence = votes[agent]["confidence"]
        vote_counts[vote] += 1
        weighted_score += VOTE_SCORES.get(vote, 0.0) * weight * confidence
        total_confidence += weight * confidence

    normalized_score = weighted_score / total_confidence if total_confidence > 0 else 0.0

    if normalized_score > 0.2:
        verdict = "BUY"
    elif normalized_score < -0.2:
        verdict = "SELL"
    else:
        verdict = "HOLD"

    max_votes = max(vote_counts.values())
    agreement_ratio = max_votes / 4
    signal_strength = abs(normalized_score)
    confidence_score = round((agreement_ratio * 0.6 + signal_strength * 0.4), 2)

    if confidence_score > 0.7:
        confidence_label = "High"
    elif confidence_score > 0.4:
        confidence_label = "Medium"
    else:
        confidence_label = "Low"

    return {
        "verdict": verdict,
        "confidence_score": confidence_score,
        "confidence_label": confidence_label,
        "weighted_score": round(normalized_score, 3),
        "vote_counts": vote_counts,
        "agent_agreement": round(agreement_ratio, 2),
    }

def run_portfolio(ticker: str, researcher: dict, quant: dict, sentiment: dict, ml: dict) -> dict:
    votes = {
        "researcher": {"vote": researcher.get("vote", "HOLD"), "confidence": researcher.get("confidence", 0.5)},
        "quant":      {"vote": quant.get("vote", "HOLD"),       "confidence": quant.get("confidence", 0.5)},
        "sentiment":  {"vote": sentiment.get("vote", "HOLD"),   "confidence": sentiment.get("confidence", 0.5)},
        "ml":         {"vote": ml.get("vote", "HOLD"),          "confidence": ml.get("confidence", 0.5)},
    }

    weighted = calculate_weighted_verdict(votes)

    prompt = f"""You are a senior portfolio manager. Four agents have voted on {ticker}:

Researcher: {votes['researcher']['vote']} (confidence: {votes['researcher']['confidence']})
  Reasoning: {researcher.get('reasoning', 'N/A')}

Quant: {votes['quant']['vote']} (confidence: {votes['quant']['confidence']})
  Reasoning: {quant.get('reasoning', 'N/A')}

Sentiment: {votes['sentiment']['vote']} (confidence: {votes['sentiment']['confidence']})
  Reasoning: {sentiment.get('reasoning', 'N/A')}

ML Model (BenderQuant): {votes['ml']['vote']} (confidence: {votes['ml']['confidence']})
  Reasoning: {ml.get('reasoning', 'N/A')}

Weighted verdict: {weighted['verdict']} (score: {weighted['weighted_score']})
Agent agreement: {weighted['agent_agreement']}

Write a 2-3 sentence final rationale for the {weighted['verdict']} verdict."""

    rationale = llm.invoke(prompt)

    return {
        "agent": "portfolio",
        "ticker": ticker,
        "verdict": weighted["verdict"],
        "confidence_score": weighted["confidence_score"],
        "confidence_label": weighted["confidence_label"],
        "weighted_score": weighted["weighted_score"],
        "vote_counts": weighted["vote_counts"],
        "agent_agreement": weighted["agent_agreement"],
        "agent_votes": {
            "researcher": votes["researcher"],
            "quant": votes["quant"],
            "sentiment": votes["sentiment"],
            "ml": votes["ml"],
        },
        "rationale": rationale
    }