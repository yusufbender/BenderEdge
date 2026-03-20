import pandas as pd
import numpy as np
import yfinance as yf
from xgboost import XGBClassifier
from sklearn.model_selection import cross_val_score, StratifiedKFold
from langchain_ollama import OllamaLLM

llm = OllamaLLM(model="qwen2.5:7b")

FEATURES = [
    "RSI", "EMA20", "SMA50", "MACD", "MACD_Signal", "BB_Middle",
    "BB_Upper", "BB_Lower", "Volume_Norm", "Price_Change_Pct",
    "RSI_Overbought", "RSI_Oversold", "Trend_Crossover",
    "Volatility", "MACD_Buy_Signal"
]

SECTOR_PARAMS = {
    "Technology":         {"n_estimators": 300, "max_depth": 5, "learning_rate": 0.03, "subsample": 0.8},
    "Financial Services": {"n_estimators": 200, "max_depth": 3, "learning_rate": 0.05, "subsample": 0.9},
    "Energy":             {"n_estimators": 150, "max_depth": 4, "learning_rate": 0.08, "subsample": 0.85},
    "Healthcare":         {"n_estimators": 200, "max_depth": 4, "learning_rate": 0.05, "subsample": 0.8},
    "Consumer Cyclical":  {"n_estimators": 250, "max_depth": 4, "learning_rate": 0.04, "subsample": 0.85},
    "Consumer Defensive": {"n_estimators": 180, "max_depth": 3, "learning_rate": 0.06, "subsample": 0.9},
    "Industrials":        {"n_estimators": 200, "max_depth": 4, "learning_rate": 0.05, "subsample": 0.85},
    "Basic Materials":    {"n_estimators": 170, "max_depth": 4, "learning_rate": 0.07, "subsample": 0.8},
    "Real Estate":        {"n_estimators": 160, "max_depth": 3, "learning_rate": 0.06, "subsample": 0.9},
    "Utilities":          {"n_estimators": 150, "max_depth": 3, "learning_rate": 0.05, "subsample": 0.9},
    "Communication":      {"n_estimators": 220, "max_depth": 4, "learning_rate": 0.04, "subsample": 0.8},
    "default":            {"n_estimators": 200, "max_depth": 4, "learning_rate": 0.05, "subsample": 0.85},
}

def get_sector_params(sector: str) -> dict:
    for key in SECTOR_PARAMS:
        if key.lower() in sector.lower():
            return SECTOR_PARAMS[key]
    return SECTOR_PARAMS["default"]

def add_indicators(df):
    delta = df["Close"].diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = -delta.where(delta < 0, 0).rolling(14).mean()
    rs = gain / loss
    df["RSI"] = 100 - (100 / (1 + rs))
    df["EMA20"] = df["Close"].ewm(span=20, adjust=False).mean()
    df["SMA50"] = df["Close"].rolling(window=50).mean()
    ema12 = df["Close"].ewm(span=12, adjust=False).mean()
    ema26 = df["Close"].ewm(span=26, adjust=False).mean()
    df["MACD"] = ema12 - ema26
    df["MACD_Signal"] = df["MACD"].ewm(span=9, adjust=False).mean()
    df["BB_Middle"] = df["Close"].rolling(window=20).mean()
    std_series = df["Close"].rolling(window=20).std()
    df["BB_Upper"] = df["BB_Middle"] + 2 * std_series
    df["BB_Lower"] = df["BB_Middle"] - 2 * std_series
    volume_std = df["Volume"].std()
    df["Volume_Norm"] = (df["Volume"] - df["Volume"].mean()) / volume_std if volume_std != 0 else 0
    return df


def add_advanced_features(df):
    df["Price_Change_Pct"] = df["Close"].pct_change()
    df["RSI_Overbought"] = (df["RSI"] > 70).astype(int)
    df["RSI_Oversold"] = (df["RSI"] < 30).astype(int)
    df["Trend_Crossover"] = (df["EMA20"] > df["SMA50"]).astype(int)
    volatility_div = df["BB_Middle"].replace(0, np.nan)
    df["Volatility"] = (df["BB_Upper"] - df["BB_Lower"]) / volatility_div
    df["MACD_Buy_Signal"] = (
        (df["MACD"] > df["MACD_Signal"]) &
        (df["MACD"].shift(1) <= df["MACD_Signal"].shift(1))
    ).astype(int)
    return df


def create_labels(df, forward_days=5, threshold=0.02):
    future_return = df["Close"].shift(-forward_days) / df["Close"] - 1
    df["Target"] = (future_return > threshold).astype(int)
    return df


def run_backtest(df, initial_cash=10000, stop_loss=0.05, take_profit=0.1):
    cash = initial_cash
    position = 0
    entry_price = 0
    portfolio_log = []
    equity_curve = []

    for i in range(len(df)):
        date = df.index[i]
        price = float(df.iloc[i]["Close"])
        signal = int(df.iloc[i]["Prediction"])
        current_value = cash + position * price
        equity_curve.append({"date": str(date.date()), "equity": round(current_value, 2)})

        if signal == 1 and cash > 0:
            position = cash / price
            entry_price = price
            cash = 0
            portfolio_log.append({"action": "BUY", "date": str(date.date()), "price": round(price, 2)})
        elif position > 0:
            change = (price - entry_price) / entry_price
            if signal == 0 or change <= -stop_loss or change >= take_profit:
                cash = position * price
                portfolio_log.append({
                    "action": "SELL",
                    "date": str(date.date()),
                    "price": round(price, 2),
                    "return_pct": round(change * 100, 2)
                })
                position = 0

    if position > 0:
        cash = position * float(df.iloc[-1]["Close"])
        portfolio_log.append({
            "action": "FINAL SELL",
            "date": str(df.index[-1].date()),
            "price": round(float(df.iloc[-1]["Close"]), 2)
        })

    final_value = round(cash, 2)
    total_return = round((final_value - initial_cash) / initial_cash * 100, 2)
    return portfolio_log, equity_curve, initial_cash, final_value, total_return


def calculate_metrics(equity_curve):
    if len(equity_curve) < 2:
        return {"sharpe": 0, "max_drawdown": 0, "cagr": 0}
    equities = [e["equity"] for e in equity_curve]
    eq = pd.Series(equities)
    returns = eq.pct_change().dropna()
    excess = returns - (0.01 / 252)
    sharpe = round(float(np.sqrt(252) * excess.mean() / excess.std()), 3) if excess.std() != 0 else 0
    roll_max = eq.cummax()
    drawdown = (eq - roll_max) / roll_max
    max_dd = round(float(drawdown.min() * 100), 2)
    days = len(equity_curve)
    start_val = equities[0]
    end_val = equities[-1]
    cagr = round(((end_val / start_val) ** (365 / days) - 1) * 100, 2) if days > 0 and start_val > 0 else 0
    return {"sharpe": sharpe, "max_drawdown": max_dd, "cagr": cagr}


def run_ml_agent(ticker: str) -> dict:
    try:
        df = yf.download(ticker, period="2y", progress=False)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        if df.empty or len(df) < 100:
            raise ValueError("Insufficient data")

        df = add_indicators(df)
        df = add_advanced_features(df)
        df = create_labels(df, forward_days=5, threshold=0.02)
        df = df.dropna()

        if len(df) < 60:
            raise ValueError("Not enough rows after dropna")

        for col in FEATURES:
            if col not in df.columns:
                df[col] = 0

        X = df[FEATURES]
        y = df["Target"]

        split = len(df) - 20
        X_train, X_test = X.iloc[:split], X.iloc[split:]
        y_train = y.iloc[:split]

        # 0. Sektör parametrelerini önceden çek
        sector = "default"
        try:
            info_pre = yf.Ticker(ticker).info
            sector = info_pre.get("sector", "default") or "default"
        except:
            sector = "default"
        sector_params = get_sector_params(sector)

        # 1. Model eğitimi — sektör bazlı parametreler
        model = XGBClassifier(
            n_estimators=sector_params["n_estimators"],
            max_depth=sector_params["max_depth"],
            learning_rate=sector_params["learning_rate"],
            subsample=sector_params["subsample"],
            eval_metric="logloss",
            verbosity=0,
        )
        model.fit(X_train, y_train)

        # 2. Test accuracy
        test_preds = model.predict(X_test)
        test_accuracy = round(float((test_preds == y.iloc[split:].values).mean()) * 100, 1)

        # 3. CV skoru
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_scores = cross_val_score(model, X_train, y_train, cv=skf, scoring="f1_weighted")
        cv_score = round(float(cv_scores.mean()), 3)
        cv_std = round(float(cv_scores.std()), 3)

        # 4. Son gün tahmini
        last_pred = int(model.predict(X.iloc[[-1]])[0])
        proba = model.predict_proba(X.iloc[[-1]])[0]
        confidence = round(float(max(proba)), 2)
        signal = "BUY" if last_pred == 1 else "SELL"

        # 5. 5 günlük trend
        last_5_preds = model.predict(X.iloc[-5:])
        buy_count = int(sum(last_5_preds))
        trend_note = f"{buy_count}/5 BUY signal in last 5 days"

        # 6. Multi-horizon modeller
        horizons = {
            "short": {"days": 5,   "threshold": 0.02, "label": "1-7 day"},
            "mid":   {"days": 21,  "threshold": 0.04, "label": "1-3 month"},
            "long":  {"days": 63,  "threshold": 0.08, "label": "3+ month"},
        }

        horizon_signals = {}

        for key, config in horizons.items():
            try:
                df_h = df.copy()
                future_return_h = df_h["Close"].shift(-config["days"]) / df_h["Close"] - 1
                df_h["Target_H"] = (future_return_h > config["threshold"]).astype(int)
                df_h = df_h.dropna(subset=["Target_H"])
                X_h = df_h[FEATURES]
                y_h = df_h["Target_H"]

                if len(X_h) > 60 and y_h.nunique() > 1:
                    model_h = XGBClassifier(
                        n_estimators=200, max_depth=4,
                        learning_rate=0.05, eval_metric="logloss", verbosity=0
                    )
                    model_h.fit(X_h.iloc[:-20], y_h.iloc[:-20])
                    pred_h = int(model_h.predict(X_h.iloc[[-1]])[0])
                    proba_h = model_h.predict_proba(X_h.iloc[[-1]])[0]
                    signal_h = "BUY" if pred_h == 1 else "SELL"
                    confidence_h = round(float(max(proba_h)), 2)
                else:
                    signal_h = "N/A"
                    confidence_h = 0.0

                horizon_signals[key] = {
                    "label": config["label"],
                    "signal": signal_h,
                    "confidence": confidence_h,
                    "days": config["days"],
                    "threshold": config["threshold"],
                }
            except:
                horizon_signals[key] = {
                    "label": config["label"],
                    "signal": "N/A",
                    "confidence": 0.0,
                    "days": config["days"],
                    "threshold": config["threshold"],
                }

        # Geriye dönük uyumluluk için long_signal
        long_signal = horizon_signals["long"]["signal"]
        long_confidence = horizon_signals["long"]["confidence"]

        # 7. Backtest
        all_preds = model.predict(X)
        df_bt = df.copy()
        df_bt["Prediction"] = all_preds
        trades, equity_curve, initial_cash, final_value, total_return = run_backtest(df_bt)
        metrics = calculate_metrics(equity_curve)
        trade_count = len([t for t in trades if t["action"] == "BUY"])
        equity_chart = equity_curve[-60:]

        # 8. Fundamentals
        try:
            info = yf.Ticker(ticker).info
            fundamentals = {
                "name": info.get("shortName", ticker),
                "sector": sector,
                "market_cap": info.get("marketCap"),
                "pe_ratio": info.get("trailingPE"),
                "eps": info.get("trailingEps"),
                "week_52_high": info.get("fiftyTwoWeekHigh"),
                "week_52_low": info.get("fiftyTwoWeekLow"),
                "dividend_yield": info.get("dividendYield"),
                "beta": info.get("beta"),
                "ai_mention": "Yes" if "AI" in info.get("longBusinessSummary", "") else "No",
            }
        except:
            fundamentals = {}

        sector_params = get_sector_params(sector)

        rsi_val = round(float(df["RSI"].iloc[-1]), 2)
        macd_val = round(float(df["MACD"].iloc[-1]), 2)
        macd_sig_val = round(float(df["MACD_Signal"].iloc[-1]), 2)
        trend_cross = int(df["Trend_Crossover"].iloc[-1])
        macd_buy = int(df["MACD_Buy_Signal"].iloc[-1])

        # 9. SHAP feature importance
        try:
            import shap
            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(X.iloc[[-1]])
            
            # Her feature'ın katkısı
            shap_dict = {}
            for i, feature in enumerate(FEATURES):
                shap_dict[feature] = round(float(shap_values[0][i]), 4)
            
            # En etkili 5 feature (absolute değere göre sırala)
            top_features = sorted(shap_dict.items(), key=lambda x: abs(x[1]), reverse=True)[:5]
            
            shap_summary = {
                "values": shap_dict,
                "top_features": [
                    {
                        "feature": f,
                        "value": round(v, 4),
                        "impact": "positive" if v > 0 else "negative",
                        "strength": round(abs(v), 4)
                    }
                    for f, v in top_features
                ],
                "base_value": round(float(explainer.expected_value), 4),
            }
        except Exception as e:
            shap_summary = {"error": str(e), "top_features": [], "values": {}}

        # 10. LLM reasoning
        prompt = f"""You are a quantitative ML analyst. XGBoost model trained on {ticker} data.

Model signal (5-day): {signal} (confidence: {confidence})
Model signal (30-day): {long_signal} (confidence: {long_confidence})
CV Score: {cv_score} (+/- {cv_std})
Test accuracy: {test_accuracy}%
Recent trend: {trend_note}
RSI: {rsi_val} | MACD: {macd_val} vs {macd_sig_val}
EMA20 > SMA50: {bool(trend_cross)} | MACD Buy crossover: {bool(macd_buy)}
Backtest return: {total_return}% | Sharpe: {metrics['sharpe']} | Max DD: {metrics['max_drawdown']}%

In 1-2 sentences, explain what the ML model is detecting and why it signals {signal}."""

        reasoning = llm.invoke(prompt)

        return {
            "agent": "ml",
            "ticker": ticker,
            "signal": signal,
            "vote": signal,
            "confidence": confidence,
            "test_accuracy": test_accuracy,
            "cv_score": cv_score,
            "cv_std": cv_std,
            "trend_note": trend_note,
            "rsi": rsi_val,
            "macd": macd_val,
            "macd_signal": macd_sig_val,
            "trend_crossover": bool(trend_cross),
            "macd_buy_signal": bool(macd_buy),
            "reasoning": reasoning,
            "long_signal": long_signal,
            "long_confidence": long_confidence,
            "horizon_signals": horizon_signals,
            "backtest": {
                "initial_cash": initial_cash,
                "final_value": final_value,
                "total_return": total_return,
                "trade_count": trade_count,
                "trades": trades[-10:],
                "equity_chart": equity_chart,
            },
            "metrics": metrics,
            "fundamentals": fundamentals,
            "sector_params": {
                "sector": sector,
                "params": sector_params,
            },
            "shap": shap_summary,
        }

    except Exception as e:
        return {
            "agent": "ml", "ticker": ticker, "error": str(e),
            "vote": "HOLD", "confidence": 0.0,
            "signal": "HOLD", "reasoning": "ML analysis failed."
        }