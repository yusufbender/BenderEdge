import sqlite3
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "benderedge.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Analiz sonuçları tablosu
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            analyzed_at TEXT NOT NULL,
            verdict TEXT NOT NULL,
            confidence_score REAL,
            weighted_score REAL,
            researcher_vote TEXT,
            quant_vote TEXT,
            sentiment_vote TEXT,
            ml_vote TEXT,
            price_at_analysis REAL,
            short_signal TEXT,
            mid_signal TEXT,
            long_signal TEXT,
            sector TEXT,
            agent_agreement REAL
        )
    """)

    # Doğrulama tablosu
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS validations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_id INTEGER NOT NULL,
            ticker TEXT NOT NULL,
            verdict TEXT NOT NULL,
            price_at_analysis REAL,
            price_after_7d REAL,
            price_after_30d REAL,
            return_7d REAL,
            return_30d REAL,
            correct_7d INTEGER,
            correct_30d INTEGER,
            validated_at TEXT,
            FOREIGN KEY (analysis_id) REFERENCES analyses(id)
        )
    """)

    # Scanner sonuçları tablosu
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scanner_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scanned_at TEXT NOT NULL,
            ticker TEXT NOT NULL,
            index_name TEXT NOT NULL,
            verdict TEXT NOT NULL,
            confidence_score REAL,
            weighted_score REAL,
            price REAL,
            short_signal TEXT,
            mid_signal TEXT,
            long_signal TEXT,
            sector TEXT,
            agent_agreement REAL
        )
    """)

    conn.commit()
    conn.close()

def save_analysis(ticker: str, result: dict) -> int:
    conn = get_db()
    cursor = conn.cursor()

    portfolio = result.get("portfolio", {})
    quant = result.get("quant", {})
    ml = result.get("ml", {})

    horizon = ml.get("horizon_signals", {})
    short = horizon.get("short", {}).get("signal", "N/A")
    mid = horizon.get("mid", {}).get("signal", "N/A")
    long = horizon.get("long", {}).get("signal", "N/A")

    cursor.execute("""
        INSERT INTO analyses (
            ticker, analyzed_at, verdict, confidence_score, weighted_score,
            researcher_vote, quant_vote, sentiment_vote, ml_vote,
            price_at_analysis, short_signal, mid_signal, long_signal,
            sector, agent_agreement
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        ticker,
        datetime.now().isoformat(),
        portfolio.get("verdict", "HOLD"),
        portfolio.get("confidence_score", 0),
        portfolio.get("weighted_score", 0),
        result.get("researcher", {}).get("vote", "HOLD"),
        result.get("quant", {}).get("vote", "HOLD"),
        result.get("sentiment", {}).get("vote", "HOLD"),
        ml.get("vote", "HOLD"),
        quant.get("current_price", 0),
        short, mid, long,
        ml.get("fundamentals", {}).get("sector", "N/A"),
        portfolio.get("agent_agreement", 0),
    ))

    analysis_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return analysis_id

def get_analyses(limit: int = 50) -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM analyses
        ORDER BY analyzed_at DESC
        LIMIT ?
    """, (limit,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def get_pending_validations() -> list:
    conn = get_db()
    cursor = conn.cursor()
    seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
    cursor.execute("""
        SELECT a.* FROM analyses a
        LEFT JOIN validations v ON a.id = v.analysis_id
        WHERE v.id IS NULL
        AND a.analyzed_at <= ?
        AND a.price_at_analysis > 0
    """, (seven_days_ago,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def save_validation(analysis_id: int, ticker: str, verdict: str,
                    price_at: float, price_7d: float, price_30d: float = None):
    conn = get_db()
    cursor = conn.cursor()

    return_7d = round((price_7d - price_at) / price_at * 100, 2) if price_at > 0 else 0
    return_30d = round((price_30d - price_at) / price_at * 100, 2) if price_30d and price_at > 0 else None

    correct_7d = None
    if verdict == "BUY":
        correct_7d = 1 if return_7d > 0 else 0
    elif verdict == "SELL":
        correct_7d = 1 if return_7d < 0 else 0
    elif verdict == "HOLD":
        correct_7d = 1 if abs(return_7d) < 3 else 0

    cursor.execute("""
        INSERT INTO validations (
            analysis_id, ticker, verdict,
            price_at_analysis, price_after_7d, price_after_30d,
            return_7d, return_30d, correct_7d, validated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        analysis_id, ticker, verdict,
        price_at, price_7d, price_30d,
        return_7d, return_30d, correct_7d,
        datetime.now().isoformat()
    ))

    conn.commit()
    conn.close()

def get_accuracy_stats() -> dict:
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COUNT(*) as total,
            SUM(correct_7d) as correct,
            AVG(return_7d) as avg_return,
            verdict
        FROM validations
        WHERE correct_7d IS NOT NULL
        GROUP BY verdict
    """)
    rows = [dict(row) for row in cursor.fetchall()]

    cursor.execute("""
        SELECT COUNT(*) as total, SUM(correct_7d) as correct
        FROM validations WHERE correct_7d IS NOT NULL
    """)
    overall = dict(cursor.fetchone())
    conn.close()

    total = overall["total"] or 0
    correct = overall["correct"] or 0
    accuracy = round(correct / total * 100, 1) if total > 0 else 0

    return {
        "total_validations": total,
        "correct": correct,
        "accuracy_pct": accuracy,
        "by_verdict": rows
    }

def save_scanner_result(ticker: str, index_name: str, result: dict):
    conn = get_db()
    cursor = conn.cursor()

    portfolio = result.get("portfolio", {})
    quant = result.get("quant", {})
    ml = result.get("ml", {})
    horizon = ml.get("horizon_signals", {})

    cursor.execute("""
        INSERT INTO scanner_results (
            scanned_at, ticker, index_name, verdict,
            confidence_score, weighted_score, price,
            short_signal, mid_signal, long_signal,
            sector, agent_agreement
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.now().isoformat(),
        ticker, index_name,
        portfolio.get("verdict", "HOLD"),
        portfolio.get("confidence_score", 0),
        portfolio.get("weighted_score", 0),
        quant.get("current_price", 0),
        horizon.get("short", {}).get("signal", "N/A"),
        horizon.get("mid", {}).get("signal", "N/A"),
        horizon.get("long", {}).get("signal", "N/A"),
        ml.get("fundamentals", {}).get("sector", "N/A"),
        portfolio.get("agent_agreement", 0),
    ))

    conn.commit()
    conn.close()

def get_latest_scanner_results(index_name: str = None) -> list:
    conn = get_db()
    cursor = conn.cursor()

    if index_name:
        cursor.execute("""
            SELECT * FROM scanner_results
            WHERE index_name = ?
            AND date(scanned_at) = date('now')
            ORDER BY confidence_score DESC
        """, (index_name,))
    else:
        cursor.execute("""
            SELECT * FROM scanner_results
            WHERE date(scanned_at) = date('now')
            ORDER BY confidence_score DESC
        """)

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows