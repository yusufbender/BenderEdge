"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useState } from "react";
import Link from "next/link";

interface AgentVote { vote: string; confidence: number; }
interface QuantData {
  currency: string; current_price: number; change_1w: number; change_1m: number;
  sma_20: number; sma_50: number; above_sma: boolean; rsi: number; rsi_signal: string;
  macd: number; macd_signal: string; bb_upper: number; bb_lower: number; bb_position: string;
  volume_spike: boolean; support: number; resistance: number; trend: string;
  assessment: string; vote: string; confidence: number; reasoning: string;
}
interface SentimentData { score: number; label: string; reasoning: string; vote: string; confidence: number; }
interface PortfolioData {
  verdict: string; confidence_score: number; confidence_label: string;
  weighted_score: number; vote_counts: Record<string, number>;
  agent_agreement: number; agent_votes: Record<string, AgentVote>; rationale: string;
}
interface ResearcherData {
  headlines: string[]; summary: string; spotlight: string; risk: string;
  catalyst: string; has_live_news: boolean; vote: string; confidence: number; reasoning: string;
}
interface MLData {
  signal: string; vote: string; confidence: number; test_accuracy: number;
  cv_score: number; cv_std: number; trend_note: string; rsi: number; macd: number;
  macd_signal: number; trend_crossover: boolean; macd_buy_signal: boolean;
  reasoning: string; error?: string; long_signal: string; long_confidence: number;
  horizon_signals?: { short: { label: string; signal: string; confidence: number; }; mid: { label: string; signal: string; confidence: number; }; long: { label: string; signal: string; confidence: number; }; };
  shap?: { top_features: { feature: string; value: number; impact: string; strength: number; }[]; base_value: number; error?: string; };
  backtest?: { initial_cash: number; final_value: number; total_return: number; trade_count: number; trades: { action: string; date: string; price: number; return_pct?: number }[]; equity_chart: { date: string; equity: number }[]; };
  metrics?: { sharpe: number; max_drawdown: number; cagr: number; };
  fundamentals?: { name: string; sector: string; market_cap: number; pe_ratio: number; eps: number; week_52_high: number; week_52_low: number; dividend_yield: number; beta: number; ai_mention: string; };
}
interface InsiderData {
  signal: string; vote: string; confidence: number;
  transactions: { date: string; name: string; form: string; }[];
  transaction_count: number; has_data: boolean; reasoning: string; error?: string;
}
interface MacroData {
  macro_data: Record<string, { value: number; change: number; date: string; }>;
  yield_spread: number | null; environment: string;
  vote: string; confidence: number; reasoning: string; error?: string;
}
interface EarningsData {
  quarterly: { date: string; eps_estimate: number; eps_actual: number; surprise_pct: number; beat: boolean; }[];
  beat_rate: number; avg_surprise: number; next_earnings: string | null;
  trend: string; vote: string; confidence: number; reasoning: string; error?: string;
}

const voteColor: Record<string, string> = { BUY: "text-green-400", SELL: "text-red-400", HOLD: "text-yellow-400" };
const voteBg: Record<string, string> = { BUY: "bg-green-500/10 border-green-500/20", SELL: "bg-red-500/10 border-red-500/20", HOLD: "bg-yellow-500/10 border-yellow-500/20" };
const sentimentColor: Record<string, string> = { Bullish: "text-green-400", Bearish: "text-red-400", Neutral: "text-yellow-400" };
const agentList = ["researcher", "quant", "sentiment", "ml", "insider", "macro", "earnings", "portfolio"];
const SIDEBAR_ITEMS = [
  { id: "overview", label: "Overview", icon: "◎" },
  { id: "quant", label: "Quant", icon: "📊" },
  { id: "ml", label: "ML Model", icon: "🤖" },
  { id: "intelligence", label: "Intelligence", icon: "🔍" },
  { id: "research", label: "Research", icon: "📰" },
];

const RECENT_TICKERS = ["NVDA", "AAPL", "TSLA", "THYAO.IS", "GARAN.IS"];

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
  const [insider, setInsider] = useState<InsiderData | null>(null);
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [chartData, setChartData] = useState<{ date: string; close: number }[]>([]);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [analyzedTicker, setAnalyzedTicker] = useState("");

  const analyze = async (t?: string) => {
    const target = (t || ticker).trim().toUpperCase();
    if (!target) return;
    setTicker(target);
    setLoading(true); setError("");
    setResearcher(null); setQuant(null); setSentiment(null);
    setPortfolio(null); setMl(null); setInsider(null);
    setMacro(null); setEarnings(null);
    setChartData([]); setDoneAgents([]);
    setActiveSection("overview"); setAnalyzedTicker(target);

    fetch(`http://127.0.0.1:8000/api/chart/${target}`)
      .then(r => r.json()).then(d => setChartData(d.data || []));

    const response = await fetch(`http://127.0.0.1:8000/api/analyze/stream?ticker=${target}`);
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
          else if (agent === "ml") { setMl(data); setActiveAgent("insider"); setDoneAgents(p => [...p, "ml"]); }
          else if (agent === "insider") { setInsider(data); setActiveAgent("macro"); setDoneAgents(p => [...p, "insider"]); }
          else if (agent === "macro") { setMacro(data); setActiveAgent("earnings"); setDoneAgents(p => [...p, "macro"]); }
          else if (agent === "earnings") { setEarnings(data); setActiveAgent("portfolio"); setDoneAgents(p => [...p, "earnings"]); }
          else if (agent === "portfolio") { setPortfolio(data); setActiveAgent(""); setDoneAgents(p => [...p, "portfolio"]); }
          else if (agent === "done") { setLoading(false); }
        } catch { }
      }
    }
    setLoading(false);
  };

  const hasResult = portfolio !== null;
  const verdict = portfolio?.verdict || "HOLD";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">

      {/* Top navbar */}
      <nav className="border-b border-white/5 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold tracking-tight">
            Bender<span className="text-purple-400">Edge</span>
          </h1>
          <div className="flex items-center gap-1">
            <Link href="/" className="text-xs text-white/60 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/5 transition">
              Analysis
            </Link>
            <Link href="/scanner" className="text-xs text-white/60 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/5 transition">
              Scanner
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {analyzedTicker && (
            <>
              <span className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full">
                {analyzedTicker}
              </span>
              <button
                onClick={() => { setPortfolio(null); setAnalyzedTicker(""); }}
                className="text-xs text-white/30 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1 rounded-full transition">
                ← New analysis
              </button>
            </>
          )}
        </div>
      </nav>

      {!hasResult && !loading ? (
        /* ── Landing ── */
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-20">
          <div className="w-full max-w-2xl">

            {/* Hero */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 text-xs text-purple-400 bg-purple-400/10 border border-purple-400/20 px-3 py-1 rounded-full mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                7 AI agents · Real-time streaming · Local LLM
              </div>
              <h2 className="text-5xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
                AI-powered stock research
              </h2>
              <p className="text-white/40 text-lg">
                7 specialized agents analyze any stock and vote on a weighted BUY / SELL / HOLD verdict.
              </p>
            </div>

            {/* Search */}
            <div className="flex gap-2 mb-6">
              <input
                type="text" value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && analyze()}
                placeholder="Enter ticker — AAPL, TSLA, NVDA, THYAO.IS..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50 focus:bg-white/8 transition text-sm"
              />
              <button onClick={() => analyze()}
                className="bg-purple-600 hover:bg-purple-500 px-8 py-3.5 rounded-xl font-semibold transition text-sm">
                Analyze
              </button>
            </div>

            {/* Recent */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/20">Try:</span>
              {RECENT_TICKERS.map(t => (
                <button key={t} onClick={() => analyze(t)}
                  className="text-xs text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 px-3 py-1.5 rounded-lg transition">
                  {t}
                </button>
              ))}
            </div>

            {/* How it works */}
            <div className="mt-16 grid grid-cols-3 gap-4">
              {[
                { icon: "🔍", title: "7 specialized agents", desc: "Quant, ML, Sentiment, Insider, Macro, Earnings, Research" },
                { icon: "⚡", title: "Real-time streaming", desc: "Watch each agent work as results stream in live" },
                { icon: "🧠", title: "Explainable decisions", desc: "SHAP feature importance shows what drove each verdict" },
              ].map((item) => (
                <div key={item.title} className="bg-white/3 border border-white/5 rounded-xl p-4">
                  <p className="text-xl mb-2">{item.icon}</p>
                  <p className="text-sm font-medium text-white/80 mb-1">{item.title}</p>
                  <p className="text-xs text-white/30">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      ) : loading && !hasResult ? (
        /* ── Loading state ── */
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <p className="text-white/40 text-sm mb-1">Analyzing</p>
              <p className="text-2xl font-bold">{analyzedTicker}</p>
            </div>
            <div className="bg-white/3 border border-white/5 rounded-2xl p-6 space-y-4">
              {agentList.map((agent) => {
                const done = doneAgents.includes(agent);
                const active = activeAgent === agent;
                return (
                  <div key={agent} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all ${
                      done ? "bg-green-500/20 text-green-400" :
                      active ? "bg-purple-500/20 text-purple-400" :
                      "bg-white/5 text-white/20"
                    }`}>
                      {done ? "✓" : active ? "●" : "○"}
                    </div>
                    <span className={`text-sm capitalize flex-1 ${active ? "text-white" : done ? "text-white/60" : "text-white/20"}`}>
                      {agent} agent
                    </span>
                    {active && <span className="text-xs text-purple-400 animate-pulse">running...</span>}
                    {done && <span className="text-xs text-white/20">done</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      ) : hasResult && (
        /* ── Results ── */
        <div className="flex-1 flex overflow-hidden">

          {/* Sidebar */}
          <div className="w-52 border-r border-white/5 p-4 flex flex-col gap-1 shrink-0">
            <p className="text-xs text-white/20 uppercase tracking-widest px-3 mb-2">Analysis</p>
            {SIDEBAR_ITEMS.map((item) => (
              <button key={item.id} onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition text-left ${
                  activeSection === item.id
                    ? "bg-purple-600/20 text-purple-400 border border-purple-500/20"
                    : "text-white/40 hover:text-white hover:bg-white/5"
                }`}>
                <span className="text-base">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto space-y-4">

              {/* Verdict — always on top */}
              <div className={`border rounded-2xl p-6 ${voteBg[verdict]}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Portfolio verdict</p>
                    <p className={`text-6xl font-black tracking-tight ${voteColor[verdict]}`}>{verdict}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex flex-col gap-1 text-xs text-white/30 mb-3">
                      <span>Confidence <span className="text-white/60">{portfolio?.confidence_label}</span></span>
                      <span>Score <span className="text-white/60">{portfolio?.confidence_score}</span></span>
                      <span>Weighted <span className="text-white/60">{portfolio?.weighted_score}</span></span>
                    </div>
                    <div className="flex gap-2 justify-end">
                      {portfolio && Object.entries(portfolio.agent_votes).map(([agent, data]) => (
                        <div key={agent} className="text-center">
                          <p className={`text-xs font-bold ${voteColor[data.vote]}`}>{data.vote[0]}</p>
                          <p className="text-xs text-white/20 capitalize">{agent.slice(0, 3)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Confidence bar */}
                <div className="w-full bg-white/5 rounded-full h-1 mb-3">
                  <div className={`h-1 rounded-full transition-all ${verdict === "BUY" ? "bg-green-500" : verdict === "SELL" ? "bg-red-500" : "bg-yellow-500"}`}
                    style={{ width: `${(portfolio?.confidence_score || 0) * 100}%` }} />
                </div>

                <p className="text-white/50 text-sm leading-relaxed">{portfolio?.rationale}</p>
              </div>

              {/* Overview section */}
              {activeSection === "overview" && (
                <div className="space-y-4">

                  {/* Price chart */}
                  {chartData.length > 0 && quant && (
                    <div className="bg-white/3 border border-white/5 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs text-white/30 uppercase tracking-widest">Price — 1 month</p>
                        <p className="text-xl font-bold">{quant.currency}{quant.current_price}</p>
                      </div>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={chartData}>
                          <XAxis dataKey="date" tick={{ fill: "#ffffff20", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#ffffff20", fontSize: 10 }} domain={["auto", "auto"]} width={50} tickFormatter={(v) => `${quant.currency}${v}`} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: "#111", border: "1px solid #ffffff10", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#ffffff40" }} formatter={(v: number) => [`${quant.currency}${v}`, "Close"]} />
                          <ReferenceLine y={quant.sma_20} stroke="#a855f7" strokeDasharray="3 3" strokeOpacity={0.5} />
                          <Line type="monotone" dataKey="close" stroke="#818cf8" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: "#818cf8" }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Agent votes grid */}
                  {portfolio && (
                    <div className="bg-white/3 border border-white/5 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs text-white/30 uppercase tracking-widest">Agent votes</p>
                        <p className="text-xs text-white/30">Agreement: {(portfolio.agent_agreement * 100).toFixed(0)}%</p>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {Object.entries(portfolio.agent_votes).map(([agent, data]) => (
                          <div key={agent} className="bg-white/3 rounded-xl p-3 text-center">
                            <p className="text-xs text-white/30 capitalize mb-1">{agent}</p>
                            <p className={`text-lg font-bold ${voteColor[data.vote]}`}>{data.vote}</p>
                            <div className="w-full bg-white/5 rounded-full h-0.5 mt-2">
                              <div className="h-0.5 rounded-full bg-purple-500" style={{ width: `${data.confidence * 100}%` }} />
                            </div>
                            <p className="text-xs text-white/20 mt-1">{(data.confidence * 100).toFixed(0)}%</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-4 pt-3 border-t border-white/5">
                        {Object.entries(portfolio.vote_counts).map(([v, count]) => (
                          <div key={v} className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold ${voteColor[v]}`}>{v}</span>
                            <span className="text-white/30 text-xs">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sentiment */}
                  {sentiment && (
                    <div className="bg-white/3 border border-white/5 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-white/30 uppercase tracking-widest">Sentiment</p>
                        <span className={`text-xs font-bold ${voteColor[sentiment.vote]}`}>
                          {sentiment.vote} {(sentiment.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mb-3">
                        <p className={`text-2xl font-bold ${sentimentColor[sentiment.label] || "text-yellow-400"}`}>{sentiment.label}</p>
                        <div className="flex-1">
                          <div className="w-full bg-white/5 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${((sentiment.score + 10) / 20) * 100}%` }} />
                          </div>
                          <p className="text-xs text-white/20 mt-1">Score: {sentiment.score}/10</p>
                        </div>
                      </div>
                      <p className="text-white/40 text-sm">{sentiment.reasoning}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Quant section */}
              {activeSection === "quant" && quant && (
                <div className="bg-white/3 border border-white/5 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-xs text-white/30 uppercase tracking-widest">Quant indicators</p>
                    <span className={`text-xs font-bold ${voteColor[quant.vote]}`}>{quant.vote} {(quant.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-4xl font-black mb-6">{quant.currency}{quant.current_price}</p>
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {([
                      ["1 week", `${quant.change_1w > 0 ? "+" : ""}${quant.change_1w}%`, quant.change_1w >= 0],
                      ["1 month", `${quant.change_1m > 0 ? "+" : ""}${quant.change_1m}%`, quant.change_1m >= 0],
                      ["RSI (14)", `${quant.rsi} — ${quant.rsi_signal}`, quant.rsi_signal === "oversold" ? true : quant.rsi_signal === "overbought" ? false : null],
                      ["MACD", `${quant.macd} — ${quant.macd_signal}`, quant.macd_signal === "bullish"],
                      ["SMA 20", `${quant.currency}${quant.sma_20}`, quant.above_sma],
                      ["SMA 50", `${quant.currency}${quant.sma_50}`, quant.current_price > quant.sma_50],
                      ["Bollinger", quant.bb_position, null],
                      ["Trend", quant.trend, quant.trend === "bullish"],
                      ["Support", `${quant.currency}${quant.support}`, null],
                      ["Resistance", `${quant.currency}${quant.resistance}`, null],
                      ["Volume spike", quant.volume_spike ? "Yes" : "No", quant.volume_spike ? true : null],
                    ] as [string, string, boolean | null][]).map(([label, value, positive]) => (
                      <div key={label} className="flex justify-between bg-white/3 rounded-lg px-3 py-2">
                        <span className="text-white/30 text-sm">{label}</span>
                        <span className={`text-sm font-medium ${positive === true ? "text-green-400" : positive === false ? "text-red-400" : "text-white/60"}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-white/40 text-sm mb-1">{quant.assessment}</p>
                  <p className="text-white/20 text-xs italic">{quant.reasoning}</p>
                </div>
              )}

              {/* ML section */}
              {activeSection === "ml" && ml && (
                <div className="space-y-4">
                  {ml.error ? (
                    <div className="bg-white/3 border border-white/5 rounded-xl p-5">
                      <p className="text-red-400 text-sm">{ml.error}</p>
                    </div>
                  ) : (
                    <>
                      {/* Horizons */}
                      {ml.horizon_signals && (
                        <div className="bg-white/3 border border-white/5 rounded-xl p-5">
                          <p className="text-xs text-white/30 uppercase tracking-widest mb-4">Signal horizons</p>
                          <div className="grid grid-cols-3 gap-3">
                            {Object.values(ml.horizon_signals).map((h) => (
                              <div key={h.label} className="bg-white/3 rounded-xl p-4 text-center">
                                <p className="text-xs text-white/30 uppercase mb-2">{h.label}</p>
                                <p className={`text-2xl font-bold mb-2 ${voteColor[h.signal] || "text-white/40"}`}>{h.signal}</p>
                                <div className="w-full bg-white/5 rounded-full h-1">
                                  <div className="h-1 rounded-full bg-purple-500" style={{ width: `${h.confidence * 100}%` }} />
                                </div>
                                <p className="text-xs text-white/20 mt-1">{(h.confidence * 100).toFixed(0)}%</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Model quality */}
                      <div className="bg-white/3 border border-white/5 rounded-xl p-5">
                        <p className="text-xs text-white/30 uppercase tracking-widest mb-4">Model quality</p>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="bg-white/3 rounded-lg p-3 text-center">
                            <p className="text-xs text-white/30 mb-1">CV score</p>
                            <p className="text-xl font-bold text-purple-400">{ml.cv_score}</p>
                            <p className="text-xs text-white/20">±{ml.cv_std}</p>
                          </div>
                          <div className="bg-white/3 rounded-lg p-3 text-center">
                            <p className="text-xs text-white/30 mb-1">Test accuracy</p>
                            <p className={`text-xl font-bold ${ml.test_accuracy >= 60 ? "text-green-400" : "text-yellow-400"}`}>{ml.test_accuracy}%</p>
                          </div>
                          <div className="bg-white/3 rounded-lg p-3 text-center">
                            <p className="text-xs text-white/30 mb-1">5-day trend</p>
                            <p className="text-xl font-bold text-white/60">{ml.trend_note?.split(" ")[0]}</p>
                            <p className="text-xs text-white/20">buy signals</p>
                          </div>
                        </div>
                        <p className="text-white/40 text-sm">{ml.reasoning}</p>
                      </div>

                      {/* SHAP */}
                      {ml.shap && ml.shap.top_features.length > 0 && (
                        <div className="bg-white/3 border border-white/5 rounded-xl p-5">
                          <p className="text-xs text-white/30 uppercase tracking-widest mb-4">Feature importance (SHAP)</p>
                          <div className="space-y-3">
                            {ml.shap.top_features.map((f, i) => {
                              const maxStrength = ml.shap!.top_features[0].strength;
                              const barWidth = (f.strength / maxStrength) * 100;
                              return (
                                <div key={i} className="flex items-center gap-3">
                                  <span className="text-xs text-white/30 w-36 shrink-0">{f.feature}</span>
                                  <div className="flex-1 bg-white/5 rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full ${f.impact === "positive" ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${barWidth}%` }} />
                                  </div>
                                  <span className={`text-xs font-medium w-14 text-right ${f.impact === "positive" ? "text-green-400" : "text-red-400"}`}>
                                    {f.impact === "positive" ? "+" : ""}{f.value}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-white/15 mt-3">Green = BUY pressure · Red = SELL pressure</p>
                        </div>
                      )}

                      {/* Backtest */}
                      {ml.backtest && ml.metrics && (
                        <div className="bg-white/3 border border-white/5 rounded-xl p-5">
                          <p className="text-xs text-white/30 uppercase tracking-widest mb-4">Backtest — 2 year</p>
                          <div className="grid grid-cols-4 gap-3 mb-4">
                            {([
                              ["Return", `${ml.backtest.total_return > 0 ? "+" : ""}${ml.backtest.total_return}%`, ml.backtest.total_return >= 0],
                              ["Sharpe", ml.metrics.sharpe.toString(), ml.metrics.sharpe >= 1],
                              ["Max DD", `${ml.metrics.max_drawdown}%`, ml.metrics.max_drawdown > -10],
                              ["Trades", ml.backtest.trade_count.toString(), null],
                            ] as [string, string, boolean | null][]).map(([label, value, positive]) => (
                              <div key={label} className="bg-white/3 rounded-lg p-3 text-center">
                                <p className="text-xs text-white/30 mb-1">{label}</p>
                                <p className={`text-lg font-bold ${positive === true ? "text-green-400" : positive === false ? "text-red-400" : "text-white/60"}`}>{value}</p>
                              </div>
                            ))}
                          </div>
                          {ml.backtest.equity_chart.length > 0 && (
                            <ResponsiveContainer width="100%" height={120}>
                              <LineChart data={ml.backtest.equity_chart}>
                                <XAxis dataKey="date" tick={{ fill: "#ffffff15", fontSize: 9 }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: "#ffffff15", fontSize: 9 }} domain={["auto", "auto"]} width={55} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ background: "#111", border: "1px solid #ffffff10", borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`$${v.toFixed(0)}`, "Portfolio"]} />
                                <Line type="monotone" dataKey="equity" stroke="#a855f7" strokeWidth={1.5} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      )}

                      {/* Fundamentals */}
                      {ml.fundamentals && (
                        <div className="bg-white/3 border border-white/5 rounded-xl p-5">
                          <p className="text-xs text-white/30 uppercase tracking-widest mb-4">Fundamentals — {ml.fundamentals.name}</p>
                          <div className="grid grid-cols-2 gap-2">
                            {([
                              ["Sector", ml.fundamentals.sector, null],
                              ["Market cap", ml.fundamentals.market_cap ? `$${(ml.fundamentals.market_cap / 1e9).toFixed(1)}B` : "N/A", null],
                              ["P/E ratio", ml.fundamentals.pe_ratio?.toFixed(1) ?? "N/A", null],
                              ["EPS", ml.fundamentals.eps ? `$${ml.fundamentals.eps.toFixed(2)}` : "N/A", ml.fundamentals.eps > 0],
                              ["52w high", `$${ml.fundamentals.week_52_high}`, null],
                              ["52w low", `$${ml.fundamentals.week_52_low}`, null],
                              ["Beta", ml.fundamentals.beta?.toFixed(2) ?? "N/A", null],
                              ["AI company", ml.fundamentals.ai_mention, ml.fundamentals.ai_mention === "Yes"],
                            ] as [string, string, boolean | null][]).map(([label, value, positive]) => (
                              <div key={label} className="flex justify-between bg-white/3 rounded-lg px-3 py-2">
                                <span className="text-white/30 text-sm">{label}</span>
                                <span className={`text-sm font-medium ${positive === true ? "text-green-400" : positive === false ? "text-red-400" : "text-white/60"}`}>{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Intelligence section */}
              {activeSection === "intelligence" && (
                <div className="space-y-4">

                  {insider && (
                    <div className="bg-white/3 border border-white/5 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-widest">Insider trading</p>
                          <p className="text-xs text-white/15 mt-0.5">SEC EDGAR Form 4</p>
                        </div>
                        <span className={`text-xs font-bold ${voteColor[insider.vote]}`}>{insider.vote} {(insider.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center gap-3 mb-4">
                        <p className={`text-xl font-bold ${insider.signal === "Bullish" ? "text-green-400" : insider.signal === "Bearish" ? "text-red-400" : "text-yellow-400"}`}>{insider.signal}</p>
                        <p className="text-white/30 text-sm">{insider.transaction_count} filings (90 days)</p>
                      </div>
                      {insider.transactions.length > 0 ? (
                        <div className="space-y-1.5 mb-3">
                          {insider.transactions.map((t, i) => (
                            <div key={i} className="flex justify-between bg-white/3 rounded-lg px-3 py-2">
                              <span className="text-white/40 text-xs">{t.name}</span>
                              <span className="text-white/20 text-xs">{t.date}</span>
                              <span className="text-purple-400 text-xs">Form {t.form}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-white/20 text-sm mb-3">No recent filings.</p>
                      )}
                      <p className="text-white/40 text-sm italic">{insider.reasoning}</p>
                    </div>
                  )}

                  {macro && (
                    <div className="bg-white/3 border border-white/5 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-widest">Macro environment</p>
                          <p className="text-xs text-white/15 mt-0.5">FRED API</p>
                        </div>
                        <span className={`text-xs font-bold ${voteColor[macro.vote]}`}>{macro.vote} {(macro.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center gap-3 mb-4">
                        <p className={`text-xl font-bold ${macro.environment === "Risk-On" ? "text-green-400" : macro.environment === "Risk-Off" ? "text-red-400" : "text-yellow-400"}`}>{macro.environment}</p>
                        {macro.yield_spread !== null && (
                          <p className={`text-sm ${macro.yield_spread > 0 ? "text-green-400" : "text-red-400"}`}>
                            Yield spread: {macro.yield_spread > 0 ? "+" : ""}{macro.yield_spread}%
                            {macro.yield_spread < 0 && " ⚠️"}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {Object.entries(macro.macro_data).filter(([k]) => k !== "yield_spread").map(([key, d]) => (
                          <div key={key} className="flex justify-between bg-white/3 rounded-lg px-3 py-2">
                            <span className="text-white/30 text-xs capitalize">{key.replace("_", " ")}</span>
                            <span className={`text-xs font-medium ${d.change > 0 ? "text-red-400" : d.change < 0 ? "text-green-400" : "text-white/40"}`}>
                              {d.value}%
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-white/40 text-sm italic">{macro.reasoning}</p>
                    </div>
                  )}

                  {earnings && (
                    <div className="bg-white/3 border border-white/5 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs text-white/30 uppercase tracking-widest">Earnings</p>
                        <span className={`text-xs font-bold ${voteColor[earnings.vote]}`}>{earnings.vote} {(earnings.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-white/3 rounded-lg p-3 text-center">
                          <p className="text-xs text-white/30 mb-1">Beat rate</p>
                          <p className={`text-xl font-bold ${earnings.beat_rate >= 75 ? "text-green-400" : earnings.beat_rate >= 50 ? "text-yellow-400" : "text-red-400"}`}>{earnings.beat_rate}%</p>
                        </div>
                        <div className="bg-white/3 rounded-lg p-3 text-center">
                          <p className="text-xs text-white/30 mb-1">Avg surprise</p>
                          <p className={`text-xl font-bold ${earnings.avg_surprise > 0 ? "text-green-400" : "text-red-400"}`}>{earnings.avg_surprise > 0 ? "+" : ""}{earnings.avg_surprise}%</p>
                        </div>
                        <div className="bg-white/3 rounded-lg p-3 text-center">
                          <p className="text-xs text-white/30 mb-1">Trend</p>
                          <p className={`text-xl font-bold ${earnings.trend === "Improving" ? "text-green-400" : earnings.trend === "Declining" ? "text-red-400" : "text-yellow-400"}`}>{earnings.trend}</p>
                        </div>
                      </div>
                      {earnings.next_earnings && (
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 mb-3">
                          <p className="text-xs text-purple-400">Next earnings: {earnings.next_earnings}</p>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {earnings.quarterly.map((q, i) => (
                          <div key={i} className="flex justify-between items-center bg-white/3 rounded-lg px-3 py-2">
                            <span className="text-white/30 text-xs">{q.date}</span>
                            <span className="text-white/40 text-xs">Est: {q.eps_estimate}</span>
                            <span className="text-white/40 text-xs">Act: {q.eps_actual}</span>
                            <span className={`text-xs font-bold ${q.beat ? "text-green-400" : "text-red-400"}`}>
                              {q.beat ? "BEAT" : "MISS"} {q.surprise_pct > 0 ? "+" : ""}{q.surprise_pct}%
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-white/40 text-sm mt-3 italic">{earnings.reasoning}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Research section */}
              {activeSection === "research" && researcher && (
                <div className="bg-white/3 border border-white/5 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-white/30 uppercase tracking-widest">Research</p>
                    <span className={`text-xs font-bold ${voteColor[researcher.vote]}`}>{researcher.vote} {(researcher.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-white/60 text-sm mb-5 leading-relaxed">{researcher.summary}</p>
                  {researcher.spotlight && (
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-4">
                      <p className="text-xs text-purple-400 uppercase tracking-widest mb-2">Spotlight</p>
                      <p className="text-white/60 text-sm leading-relaxed">{researcher.spotlight}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {researcher.risk && (
                      <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                        <p className="text-xs text-red-400 uppercase tracking-widest mb-2">Risk</p>
                        <p className="text-white/40 text-sm">{researcher.risk}</p>
                      </div>
                    )}
                    {researcher.catalyst && researcher.catalyst !== "NONE" && (
                      <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-3">
                        <p className="text-xs text-green-400 uppercase tracking-widest mb-2">Catalyst</p>
                        <p className="text-white/40 text-sm">{researcher.catalyst}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-white/20 uppercase tracking-widest mb-3">Headlines</p>
                  <div className="space-y-2">
                    {researcher.headlines.map((h, i) => (
                      <p key={i} className="text-white/30 text-xs border-l border-white/10 pl-3">{h}</p>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}