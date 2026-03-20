"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useState } from "react";

interface AgentVote { vote: string; confidence: number; }
interface QuantData {
  current_price: number; change_1w: number; change_1m: number;
  sma_20: number; sma_50: number; above_sma: boolean;
  rsi: number; rsi_signal: string; macd: number; macd_signal: string;
  bb_upper: number; bb_lower: number; bb_position: string;
  volume_spike: boolean; support: number; resistance: number;
  trend: string; assessment: string; vote: string; confidence: number; reasoning: string;
}
interface SentimentData { score: number; label: string; reasoning: string; vote: string; confidence: number; }
interface PortfolioData {
  verdict: string; confidence_score: number; confidence_label: string;
  weighted_score: number; vote_counts: Record<string, number>;
  agent_agreement: number; agent_votes: Record<string, AgentVote>; rationale: string;
}
interface ResearcherData {
  headlines: string[]; summary: string; spotlight: string;
  risk: string; catalyst: string; has_live_news: boolean;
  vote: string; confidence: number; reasoning: string;
}
interface MLData {
  signal: string; vote: string; confidence: number;
  test_accuracy: number; cv_score: number; cv_std: number;
  trend_note: string; rsi: number; macd: number;
  macd_signal: number; trend_crossover: boolean;
  macd_buy_signal: boolean; reasoning: string; error?: string;
  long_signal: string; long_confidence: number;
  backtest?: {
    initial_cash: number; final_value: number; total_return: number;
    trade_count: number; trades: {action: string; date: string; price: number; return_pct?: number}[];
    equity_chart: {date: string; equity: number}[];
  };
  metrics?: { sharpe: number; max_drawdown: number; cagr: number; };
  fundamentals?: {
    name: string; sector: string; market_cap: number; pe_ratio: number;
    eps: number; week_52_high: number; week_52_low: number;
    dividend_yield: number; beta: number; ai_mention: string;
  };
}

const verdictStyle: Record<string, { border: string; text: string; bg: string }> = {
  BUY:  { border: "border-green-500",  text: "text-green-400",  bg: "bg-green-500/10" },
  SELL: { border: "border-red-500",    text: "text-red-400",    bg: "bg-red-500/10" },
  HOLD: { border: "border-yellow-500", text: "text-yellow-400", bg: "bg-yellow-500/10" },
};
const voteColor: Record<string, string> = { BUY: "text-green-400", SELL: "text-red-400", HOLD: "text-yellow-400" };
const sentimentColor: Record<string, string> = { Bullish: "text-green-400", Bearish: "text-red-400", Neutral: "text-yellow-400" };
const agentList = ["researcher", "quant", "sentiment", "ml", "portfolio"];
const TABS = ["Overview", "Quant", "ML Model", "Research"];

export default function Home() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState("");
  const [doneAgents, setDoneAgents] = useState<string[]>([]);
  const [researcher, setResearcher] = useState<ResearcherData | null>(null);
  const [quant, setQuant] = useState<QuantData | null>(null);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [ml, setMl] = useState<MLData | null>(null);
  const [chartData, setChartData] = useState<{ date: string; close: number }[]>([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Overview");

  const analyze = async () => {
    if (!ticker) return;
    setLoading(true); setError("");
    setResearcher(null); setQuant(null); setSentiment(null);
    setPortfolio(null); setMl(null); setChartData([]); setDoneAgents([]);
    setActiveTab("Overview");

    fetch(`http://127.0.0.1:8000/api/chart/${ticker}`)
      .then(r => r.json())
      .then(d => setChartData(d.data || []));

    const response = await fetch(`http://127.0.0.1:8000/api/analyze/stream?ticker=${ticker}`);
    if (!response.body) { setError("Stream failed."); setLoading(false); return; }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const { agent, data } = JSON.parse(line.slice(5).trim());
          if (agent === "researcher") { setResearcher(data); setActiveAgent("quant"); setDoneAgents(p => [...p, "researcher"]); }
          else if (agent === "quant") { setQuant(data); setActiveAgent("sentiment"); setDoneAgents(p => [...p, "quant"]); }
          else if (agent === "sentiment") { setSentiment(data); setActiveAgent("ml"); setDoneAgents(p => [...p, "sentiment"]); }
          else if (agent === "ml") { setMl(data); setActiveAgent("portfolio"); setDoneAgents(p => [...p, "ml"]); }
          else if (agent === "portfolio") { setPortfolio(data); setActiveAgent(""); setDoneAgents(p => [...p, "portfolio"]); }
          else if (agent === "done") { setLoading(false); }
        } catch { }
      }
    }
    setLoading(false);
  };

  const vs = portfolio ? (verdictStyle[portfolio.verdict] || verdictStyle.HOLD) : null;
  const hasResult = portfolio !== null;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Bender<span className="text-purple-400">Edge</span></h1>
          <p className="text-gray-500 mt-1 text-sm">Multi-agent AI stock research platform</p>
        </div>

        {/* Search */}
        <div className="flex gap-3 mb-6">
          <input
            type="text" value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            placeholder="Enter ticker — AAPL, TSLA, NVDA, THYAO.IS..."
            className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition"
          />
          <button onClick={analyze} disabled={loading}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-8 py-3 rounded-xl font-semibold transition">
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>

        {/* Agent feed */}
        {(loading || doneAgents.length > 0) && !hasResult && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Agent feed</p>
            <div className="space-y-3">
              {agentList.map((agent) => {
                const done = doneAgents.includes(agent);
                const active = activeAgent === agent;
                return (
                  <div key={agent} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full transition-all ${active ? "bg-purple-400 animate-pulse" : done ? "bg-green-400" : "bg-gray-700"}`} />
                    <span className={`text-sm capitalize ${active ? "text-white" : done ? "text-green-400" : "text-gray-600"}`}>
                      {agent} agent {active ? "running..." : done ? "✓ done" : "waiting"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && <div className="bg-red-950 border border-red-800 rounded-xl p-4 mb-6 text-red-300">{error}</div>}

        {/* Results */}
        {hasResult && vs && (
          <div className="space-y-4">

            {/* Verdict — always visible */}
            <div className={`border-2 ${vs.border} ${vs.bg} rounded-2xl p-6`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Portfolio verdict</p>
                  <p className={`text-5xl font-bold ${vs.text}`}>{portfolio.verdict}</p>
                </div>
                <div className="text-right">
                  <div className="flex gap-4 text-sm text-gray-400 mb-2">
                    <span>Confidence: <span className="text-white font-medium">{portfolio.confidence_label}</span></span>
                    <span>Score: <span className="text-white font-medium">{portfolio.confidence_score}</span></span>
                    <span>Weighted: <span className="text-white font-medium">{portfolio.weighted_score}</span></span>
                  </div>
                  {/* Mini vote bars */}
                  <div className="flex gap-3 justify-end">
                    {Object.entries(portfolio.agent_votes).map(([agent, data]) => (
                      <div key={agent} className="text-center">
                        <p className={`text-xs font-bold ${voteColor[data.vote]}`}>{data.vote}</p>
                        <p className="text-xs text-gray-500 capitalize">{agent}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">{portfolio.rationale}</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
              {TABS.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                    activeTab === tab
                      ? "bg-purple-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab: Overview */}
            {activeTab === "Overview" && (
              <div className="space-y-4">

                {/* Price chart */}
                {chartData.length > 0 && quant && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Price chart — 1 month</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chartData}>
                        <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
                        <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} domain={["auto", "auto"]} width={55} tickFormatter={(v) => `$${v}`} />
                        <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }} labelStyle={{ color: "#9ca3af", fontSize: 12 }} formatter={(v: number) => [`$${v}`, "Close"]} />
                        <ReferenceLine y={quant.sma_20} stroke="#a855f7" strokeDasharray="4 4" label={{ value: "SMA20", fill: "#a855f7", fontSize: 10 }} />
                        <Line type="monotone" dataKey="close" stroke="#818cf8" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#818cf8" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Agent votes */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Agent votes</p>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {Object.entries(portfolio.agent_votes).map(([agent, data]) => (
                      <div key={agent} className="bg-gray-800 rounded-xl p-4">
                        <p className="text-xs text-gray-500 uppercase mb-2 capitalize">{agent}</p>
                        <p className={`text-2xl font-bold mb-1 ${voteColor[data.vote]}`}>{data.vote}</p>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mb-2">
                          <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${data.confidence * 100}%` }} />
                        </div>
                        <p className="text-xs text-gray-400">{(data.confidence * 100).toFixed(0)}%</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 pt-4 border-t border-gray-800">
                    {Object.entries(portfolio.vote_counts).map(([v, count]) => (
                      <div key={v} className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${voteColor[v]}`}>{v}</span>
                        <span className="text-gray-400 text-sm">{count}</span>
                      </div>
                    ))}
                    <span className="ml-auto text-xs text-gray-500">Agreement: {(portfolio.agent_agreement * 100).toFixed(0)}%</span>
                  </div>
                </div>

                {/* Sentiment */}
                {sentiment && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs text-gray-500 uppercase tracking-widest">Sentiment</p>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${voteColor[sentiment.vote]} bg-gray-800`}>
                        {sentiment.vote} {(sentiment.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-6">
                      <p className={`text-3xl font-bold ${sentimentColor[sentiment.label] || "text-yellow-400"}`}>{sentiment.label}</p>
                      <div className="flex-1">
                        <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                          <div className="h-2 rounded-full bg-purple-500 transition-all" style={{ width: `${((sentiment.score + 10) / 20) * 100}%` }} />
                        </div>
                        <p className="text-xs text-gray-400">Score: {sentiment.score}/10</p>
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm mt-3">{sentiment.reasoning}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Quant */}
            {activeTab === "Quant" && quant && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-gray-500 uppercase tracking-widest">Quant indicators</p>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${voteColor[quant.vote]} bg-gray-800`}>
                    {quant.vote} {(quant.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-4xl font-bold mb-6">${quant.current_price}</p>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {([
                    ["1 week", `${quant.change_1w > 0 ? "+" : ""}${quant.change_1w}%`, quant.change_1w >= 0],
                    ["1 month", `${quant.change_1m > 0 ? "+" : ""}${quant.change_1m}%`, quant.change_1m >= 0],
                    ["RSI (14)", `${quant.rsi} — ${quant.rsi_signal}`, quant.rsi_signal === "oversold" ? true : quant.rsi_signal === "overbought" ? false : null],
                    ["MACD", `${quant.macd} — ${quant.macd_signal}`, quant.macd_signal === "bullish"],
                    ["SMA 20", `$${quant.sma_20}`, quant.above_sma],
                    ["SMA 50", `$${quant.sma_50}`, quant.current_price > quant.sma_50],
                    ["Bollinger", quant.bb_position, null],
                    ["Trend", quant.trend, quant.trend === "bullish"],
                    ["Support", `$${quant.support}`, null],
                    ["Resistance", `$${quant.resistance}`, null],
                    ["Volume spike", quant.volume_spike ? "Yes" : "No", quant.volume_spike ? true : null],
                  ] as [string, string, boolean | null][]).map(([label, value, positive]) => (
                    <div key={label} className="flex justify-between bg-gray-800 rounded-lg px-3 py-2">
                      <span className="text-gray-400 text-sm">{label}</span>
                      <span className={`text-sm font-medium ${positive === true ? "text-green-400" : positive === false ? "text-red-400" : "text-gray-300"}`}>{value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-gray-400 text-sm mb-2">{quant.assessment}</p>
                <p className="text-gray-500 text-xs italic">{quant.reasoning}</p>
              </div>
            )}

            {/* Tab: ML Model */}
            {activeTab === "ML Model" && ml && (
              <div className="space-y-4">
                {ml.error ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <p className="text-red-400 text-sm">{ml.error}</p>
                  </div>
                ) : (
                  <>
                    {/* Signals */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">BenderQuant XGBoost</p>
                      <div className="grid grid-cols-2 gap-4 mb-5">
                        <div className="bg-gray-800 rounded-xl p-4 text-center">
                          <p className="text-xs text-gray-500 uppercase mb-1">5-day signal</p>
                          <p className={`text-3xl font-bold ${voteColor[ml.signal]}`}>{ml.signal}</p>
                          <p className="text-xs text-gray-400 mt-1">{(ml.confidence * 100).toFixed(0)}% confidence</p>
                        </div>
                        <div className="bg-gray-800 rounded-xl p-4 text-center">
                          <p className="text-xs text-gray-500 uppercase mb-1">30-day signal</p>
                          <p className={`text-3xl font-bold ${voteColor[ml.long_signal] || "text-gray-300"}`}>{ml.long_signal}</p>
                          <p className="text-xs text-gray-400 mt-1">{(ml.long_confidence * 100).toFixed(0)}% confidence</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-gray-800 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500 mb-1">CV score</p>
                          <p className="text-lg font-bold text-purple-400">{ml.cv_score}</p>
                          <p className="text-xs text-gray-500">±{ml.cv_std}</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500 mb-1">Test accuracy</p>
                          <p className={`text-lg font-bold ${ml.test_accuracy >= 60 ? "text-green-400" : "text-yellow-400"}`}>{ml.test_accuracy}%</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500 mb-1">5-day trend</p>
                          <p className="text-lg font-bold text-gray-300">{ml.trend_note.split(" ")[0]}</p>
                          <p className="text-xs text-gray-500">buy signals</p>
                        </div>
                      </div>
                      <p className="text-gray-400 text-sm">{ml.reasoning}</p>
                    </div>

                    {/* Backtest */}
                    {ml.backtest && ml.metrics && (
                      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Backtest — 2 year</p>
                        <div className="grid grid-cols-4 gap-3 mb-5">
                          {([
                            ["Return", `${ml.backtest.total_return > 0 ? "+" : ""}${ml.backtest.total_return}%`, ml.backtest.total_return >= 0],
                            ["Sharpe", ml.metrics.sharpe.toString(), ml.metrics.sharpe >= 1],
                            ["Max DD", `${ml.metrics.max_drawdown}%`, ml.metrics.max_drawdown > -10],
                            ["Trades", ml.backtest.trade_count.toString(), null],
                          ] as [string, string, boolean | null][]).map(([label, value, positive]) => (
                            <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
                              <p className="text-xs text-gray-500 mb-1">{label}</p>
                              <p className={`text-lg font-bold ${positive === true ? "text-green-400" : positive === false ? "text-red-400" : "text-gray-300"}`}>{value}</p>
                            </div>
                          ))}
                        </div>
                        {ml.backtest.equity_chart.length > 0 && (
                          <div className="mb-5">
                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Equity curve</p>
                            <ResponsiveContainer width="100%" height={150}>
                              <LineChart data={ml.backtest.equity_chart}>
                                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
                                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} domain={["auto", "auto"]} width={65} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }} labelStyle={{ color: "#9ca3af", fontSize: 11 }} formatter={(v: number) => [`$${v.toFixed(2)}`, "Portfolio"]} />
                                <Line type="monotone" dataKey="equity" stroke="#a855f7" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                        {ml.backtest.trades.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Recent trades</p>
                            <div className="space-y-1">
                              {ml.backtest.trades.slice(-6).map((t, i) => (
                                <div key={i} className="flex justify-between items-center bg-gray-800 rounded-lg px-3 py-2">
                                  <span className={`text-xs font-bold ${t.action === "BUY" ? "text-green-400" : "text-red-400"}`}>{t.action}</span>
                                  <span className="text-gray-400 text-xs">{t.date}</span>
                                  <span className="text-gray-300 text-xs">${t.price}</span>
                                  {t.return_pct !== undefined && (
                                    <span className={`text-xs font-medium ${t.return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                                      {t.return_pct > 0 ? "+" : ""}{t.return_pct}%
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fundamentals */}
                    {ml.fundamentals && Object.keys(ml.fundamentals).length > 0 && (
                      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Fundamentals — {ml.fundamentals.name}</p>
                        <div className="grid grid-cols-2 gap-3">
                          {([
                            ["Sector", ml.fundamentals.sector, null],
                            ["Market cap", ml.fundamentals.market_cap ? `$${(ml.fundamentals.market_cap / 1e9).toFixed(1)}B` : "N/A", null],
                            ["P/E ratio", ml.fundamentals.pe_ratio?.toFixed(1) ?? "N/A", null],
                            ["EPS", ml.fundamentals.eps ? `$${ml.fundamentals.eps.toFixed(2)}` : "N/A", ml.fundamentals.eps > 0],
                            ["52w high", ml.fundamentals.week_52_high ? `$${ml.fundamentals.week_52_high}` : "N/A", null],
                            ["52w low", ml.fundamentals.week_52_low ? `$${ml.fundamentals.week_52_low}` : "N/A", null],
                            ["Beta", ml.fundamentals.beta?.toFixed(2) ?? "N/A", null],
                            ["AI company", ml.fundamentals.ai_mention, ml.fundamentals.ai_mention === "Yes"],
                          ] as [string, string, boolean | null][]).map(([label, value, positive]) => (
                            <div key={label} className="flex justify-between bg-gray-800 rounded-lg px-3 py-2">
                              <span className="text-gray-400 text-sm">{label}</span>
                              <span className={`text-sm font-medium ${positive === true ? "text-green-400" : positive === false ? "text-red-400" : "text-gray-300"}`}>{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Tab: Research */}
            {activeTab === "Research" && researcher && (
              <div className="space-y-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Research</p>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${voteColor[researcher.vote]} bg-gray-800`}>
                      {researcher.vote} {(researcher.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm mb-5 leading-relaxed">{researcher.summary}</p>
                  {researcher.spotlight && (
                    <div className="bg-purple-950/40 border border-purple-800/40 rounded-lg p-4 mb-4">
                      <p className="text-xs text-purple-400 uppercase tracking-widest mb-2">Spotlight</p>
                      <p className="text-gray-300 text-sm leading-relaxed">{researcher.spotlight}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {researcher.risk && (
                      <div className="bg-red-950/30 border border-red-800/30 rounded-lg p-3">
                        <p className="text-xs text-red-400 uppercase tracking-widest mb-2">Risk</p>
                        <p className="text-gray-400 text-sm">{researcher.risk}</p>
                      </div>
                    )}
                    {researcher.catalyst && researcher.catalyst !== "NONE" && (
                      <div className="bg-green-950/30 border border-green-800/30 rounded-lg p-3">
                        <p className="text-xs text-green-400 uppercase tracking-widest mb-2">Catalyst</p>
                        <p className="text-gray-400 text-sm">{researcher.catalyst}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Headlines</p>
                  <div className="space-y-2">
                    {researcher.headlines.map((h, i) => (
                      <p key={i} className="text-gray-500 text-xs border-l-2 border-gray-700 pl-3">{h}</p>
                    ))}
                  </div>
                  <p className="text-gray-500 text-xs mt-4 italic">{researcher.reasoning}</p>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </main>
  );
}