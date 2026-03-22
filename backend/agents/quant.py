import yfinance as yf
from langchain_ollama import OllamaLLM
import pandas as pd
llm = OllamaLLM(model="qwen2.5:7b")

def run_quant(ticker: str) -> dict:

    # Para birimi tespiti
    def get_currency(ticker: str) -> str:
        if ticker.endswith(".IS"):
            return "₺"
        elif ticker.endswith(".L"):
            return "£"
        elif ticker.endswith(".DE") or ticker.endswith(".PA") or ticker.endswith(".MI"):
            return "€"
        elif ticker.endswith(".T"):
            return "¥"
        elif ticker.endswith(".HK"):
            return "HK$"
        else:
            return "$"
        
    stock = yf.Ticker(ticker)
    hist = stock.history(period="3mo")

    if hist.empty:
        return {"agent": "quant", "ticker": ticker, "error": "No data found", "vote": "HOLD", "confidence": 0.0}

    close = hist["Close"]
    volume = hist["Volume"]

    current_price = round(float(close.iloc[-1]), 2)
    price_1w = round(float(close.iloc[-5]), 2) if len(close) >= 5 else current_price
    price_1m = round(float(close.iloc[-21]), 2) if len(close) >= 21 else current_price

    change_1w = round(((current_price - price_1w) / price_1w) * 100, 2)
    change_1m = round(((current_price - price_1m) / price_1m) * 100, 2)

    # SMA
    sma_20 = round(float(close.tail(20).mean()), 2)
    sma_50 = round(float(close.tail(50).mean()), 2)

    # RSI
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = -delta.clip(upper=0).rolling(14).mean()
    rs = gain / loss
    rsi = round(float(100 - (100 / (1 + rs.iloc[-1]))), 2)

    # MACD
    ema12 = close.ewm(span=12).mean()
    ema26 = close.ewm(span=26).mean()
    macd = round(float((ema12 - ema26).iloc[-1]), 2)
    signal_line = round(float((ema12 - ema26).ewm(span=9).mean().iloc[-1]), 2)
    macd_signal = "bullish" if macd > signal_line else "bearish"

    # Bollinger Bands
    bb_mid = close.rolling(20).mean()
    bb_std = close.rolling(20).std()
    bb_upper = round(float((bb_mid + 2 * bb_std).iloc[-1]), 2)
    bb_lower = round(float((bb_mid - 2 * bb_std).iloc[-1]), 2)
    bb_position = "above upper" if current_price > bb_upper else "below lower" if current_price < bb_lower else "within bands"

    # Volume spike
    avg_volume = int(volume.rolling(20).mean().iloc[-1])
    last_volume = int(volume.iloc[-1])
    volume_spike = bool(last_volume > avg_volume * 1.5)

    # Support / Resistance
    support = round(float(close.tail(20).min()), 2)
    resistance = round(float(close.tail(20).max()), 2)

    # RSI signal
    rsi_signal = "oversold" if rsi < 30 else "overbought" if rsi > 70 else "neutral"

    # Trend
    if current_price < sma_50 and sma_20 < sma_50:
        trend = "bearish"
    elif current_price > sma_50 and sma_20 > sma_50:
        trend = "bullish"
    else:
        trend = "neutral"

    prompt = f"""You are a quantitative analyst. Analyze {ticker} based on these indicators:

Price: ${current_price} | 1W: {change_1w}% | 1M: {change_1m}%
RSI(14): {rsi} → {rsi_signal}
MACD: {macd} vs Signal: {signal_line} → {macd_signal}
Bollinger Bands: [{bb_lower} - {bb_upper}] → price is {bb_position}
SMA20: ${sma_20} | SMA50: ${sma_50} → trend: {trend}
Volume spike: {volume_spike}
Support: ${support} | Resistance: ${resistance}

Respond in EXACTLY this format:
VOTE: <BUY or SELL or HOLD>
CONFIDENCE: <number between 0.0 and 1.0>
ASSESSMENT: <2 sentence technical assessment>
REASONING: <1 sentence explaining your vote>"""

    response = llm.invoke(prompt)

    vote = "HOLD"
    confidence = 0.5
    assessment = ""
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
        elif line.startswith("ASSESSMENT:"):
            assessment = line.replace("ASSESSMENT:", "").strip()
        elif line.startswith("REASONING:"):
            reasoning = line.replace("REASONING:", "").strip()

        # Risk yönetimi — ATR bazlı
    atr_period = 14
    high_low = hist["High"] - hist["Low"]
    high_close = abs(hist["High"] - hist["Close"].shift(1))
    low_close = abs(hist["Low"] - hist["Close"].shift(1))
    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    atr = round(float(true_range.rolling(atr_period).mean().iloc[-1]), 2)

    # Stop loss ve take profit
    stop_loss_pct = round((atr / current_price) * 100 * 1.5, 2)
    take_profit_pct = round(stop_loss_pct * 2, 2)

    stop_loss_price = round(current_price * (1 - stop_loss_pct / 100), 2)
    take_profit_price = round(current_price * (1 + take_profit_pct / 100), 2)

    risk_reward = round(take_profit_pct / stop_loss_pct, 2) if stop_loss_pct > 0 else 2.0

    # Kelly criterion ile pozisyon büyüklüğü
    win_rate = 0.55
    kelly_pct = round((win_rate - (1 - win_rate) / risk_reward) * 100, 1)
    kelly_pct = max(1.0, min(kelly_pct, 25.0))  # 1-25% arası sınırla

    risk_management = {
        "atr": atr,
        "stop_loss_price": stop_loss_price,
        "stop_loss_pct": stop_loss_pct,
        "take_profit_price": take_profit_price,
        "take_profit_pct": take_profit_pct,
        "risk_reward": risk_reward,
        "position_size_pct": kelly_pct,
    }

    return {
        "agent": "quant",
        "ticker": ticker,
        "current_price": current_price,
        "change_1w": change_1w,
        "change_1m": change_1m,
        "sma_20": sma_20,
        "sma_50": sma_50,
        "above_sma": bool(current_price > sma_20),
        "rsi": rsi,
        "rsi_signal": rsi_signal,
        "macd": macd,
        "macd_signal": macd_signal,
        "bb_upper": bb_upper,
        "bb_lower": bb_lower,
        "bb_position": bb_position,
        "volume_spike": volume_spike,
        "support": support,
        "resistance": resistance,
        "trend": trend,
        "assessment": assessment,
        "vote": vote,
        "confidence": confidence,
        "reasoning": reasoning,
        "currency": get_currency(ticker),
        "risk_management": risk_management,
        "atr": atr,
    }