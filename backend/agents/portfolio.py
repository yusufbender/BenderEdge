from langchain_ollama import OllamaLLM

llm = OllamaLLM(model="qwen2.5:7b")

AGENT_WEIGHTS = {
    "quant":    0.30,
    "ml":       0.25,
    "sentiment":0.15,
    "researcher":0.10,
    "earnings": 0.10,
    "macro":    0.05,
    "insider":  0.05,
}

VOTE_SCORES = {
    "BUY":  1.0,
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
    agreement_ratio = max_votes / len(AGENT_WEIGHTS)
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


def run_portfolio(ticker: str, researcher: dict, quant: dict, sentiment: dict,
                  ml: dict, insider: dict = None, macro: dict = None, earnings: dict = None) -> dict:

    insider = insider or {}
    macro = macro or {}
    earnings = earnings or {}

    votes = {
        "researcher": {"vote": researcher.get("vote", "HOLD"), "confidence": researcher.get("confidence", 0.5)},
        "quant":      {"vote": quant.get("vote", "HOLD"),       "confidence": quant.get("confidence", 0.5)},
        "sentiment":  {"vote": sentiment.get("vote", "HOLD"),   "confidence": sentiment.get("confidence", 0.5)},
        "ml":         {"vote": ml.get("vote", "HOLD"),          "confidence": ml.get("confidence", 0.5)},
        "insider":    {"vote": insider.get("vote", "HOLD"),     "confidence": insider.get("confidence", 0.3)},
        "macro":      {"vote": macro.get("vote", "HOLD"),       "confidence": macro.get("confidence", 0.3)},
        "earnings":   {"vote": earnings.get("vote", "HOLD"),    "confidence": earnings.get("confidence", 0.3)},
    }

    weighted = calculate_weighted_verdict(votes)

    prompt = f"""You are a senior portfolio manager. Seven agents have voted on {ticker}:

Quant:      {votes['quant']['vote']} ({votes['quant']['confidence']}) — {quant.get('reasoning', 'N/A')}
ML Model:   {votes['ml']['vote']} ({votes['ml']['confidence']}) — {ml.get('reasoning', 'N/A')}
Sentiment:  {votes['sentiment']['vote']} ({votes['sentiment']['confidence']}) — {sentiment.get('reasoning', 'N/A')}
Researcher: {votes['researcher']['vote']} ({votes['researcher']['confidence']}) — {researcher.get('reasoning', 'N/A')}
Earnings:   {votes['earnings']['vote']} ({votes['earnings']['confidence']}) — {earnings.get('reasoning', 'N/A')}
Macro:      {votes['macro']['vote']} ({votes['macro']['confidence']}) — {macro.get('reasoning', 'N/A')}
Insider:    {votes['insider']['vote']} ({votes['insider']['confidence']}) — {insider.get('reasoning', 'N/A')}

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
            "quant":      votes["quant"],
            "sentiment":  votes["sentiment"],
            "ml":         votes["ml"],
            "insider":    votes["insider"],
            "macro":      votes["macro"],
            "earnings":   votes["earnings"],
        },
        "rationale": rationale
    }