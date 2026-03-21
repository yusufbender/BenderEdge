"use client";
import { useState } from "react";
import Link from "next/link";

interface ScanResult {
  ticker: string;
  verdict: string;
  confidence: number;
  weighted_score: number;
  price: number;
  sector: string;
  error?: string;
}

interface HistoryItem {
  id: number;
  ticker: string;
  analyzed_at: string;
  verdict: string;
  confidence_score: number;
  weighted_score: number;
  price_at_analysis: number;
  short_signal: string;
  mid_signal: string;
  long_signal: string;
  sector: string;
  agent_agreement: number;
}

interface AccuracyStats {
  total_validations: number;
  correct: number;
  accuracy_pct: number;
  by_verdict: { verdict: string; total: number; correct: number; avg_return: number }[];
}

const verdictColor: Record<string, string> = {
  BUY: "text-green-400",
  SELL: "text-red-400",
  HOLD: "text-yellow-400",
};

const verdictBg: Record<string, string> = {
  BUY: "bg-green-500/10 border-green-500/30",
  SELL: "bg-red-500/10 border-red-500/30",
  HOLD: "bg-yellow-500/10 border-yellow-500/30",
};

const INDICES = ["SP500", "NASDAQ100", "BIST50", "BIST100"];

export default function Scanner() {
  const [selectedIndex, setSelectedIndex] = useState("NASDAQ100");
  const [limit, setLimit] = useState(5);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [accuracy, setAccuracy] = useState<AccuracyStats | null>(null);
  const [activeTab, setActiveTab] = useState<"scan" | "history" | "accuracy">("scan");
  const [validating, setValidating] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const runScan = async () => {
    setScanning(true);
    setResults([]);
    setScanProgress(0);

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/scanner/scan/${selectedIndex}?limit=${limit}`,
        { method: "POST" }
      );
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      console.error("Scan failed");
    } finally {
      setScanning(false);
      setScanProgress(100);
    }
  };

  const loadHistory = async () => {
    const res = await fetch("http://127.0.0.1:8000/api/scanner/history?limit=50");
    const data = await res.json();
    setHistory(data.analyses || []);
    setActiveTab("history");
  };

  const loadAccuracy = async () => {
    const res = await fetch("http://127.0.0.1:8000/api/scanner/accuracy");
    const data = await res.json();
    setAccuracy(data);
    setActiveTab("accuracy");
  };

  const runValidation = async () => {
    setValidating(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/scanner/validate", { method: "POST" });
      const data = await res.json();
      alert(`✅ ${data.validated} analiz doğrulandı!`);
      await loadAccuracy();
    } catch {
      alert("Validation failed");
    } finally {
      setValidating(false);
    }
  };

  const buyResults = results.filter(r => r.verdict === "BUY");
  const sellResults = results.filter(r => r.verdict === "SELL");
  const holdResults = results.filter(r => r.verdict === "HOLD");

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/" className="text-gray-500 hover:text-white text-sm transition">
                ← BenderEdge
              </Link>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              Bender<span className="text-purple-400">Scanner</span>
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Multi-agent market scanner — find opportunities across indices
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6">
          {[
            { id: "scan", label: "Scanner" },
            { id: "history", label: "Analysis History" },
            { id: "accuracy", label: "Accuracy Tracker" },
          ].map((tab) => (
            <button key={tab.id}
              onClick={() => {
                if (tab.id === "history") loadHistory();
                else if (tab.id === "accuracy") loadAccuracy();
                else setActiveTab("scan");
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scanner Tab */}
        {activeTab === "scan" && (
          <div className="space-y-6">

            {/* Controls */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Scanner settings</p>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-2">Index</p>
                  <div className="flex gap-2">
                    {INDICES.map((idx) => (
                      <button key={idx}
                        onClick={() => setSelectedIndex(idx)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                          selectedIndex === idx
                            ? "bg-purple-600 text-white"
                            : "bg-gray-800 text-gray-400 hover:text-white"
                        }`}>
                        {idx}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-2">Hisse sayısı</p>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                    <option value={3}>3 hisse</option>
                    <option value={5}>5 hisse</option>
                    <option value={10}>10 hisse</option>
                    <option value={20}>20 hisse</option>
                  </select>
                </div>
                <button
                  onClick={runScan}
                  disabled={scanning}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-8 py-2 rounded-xl font-semibold transition">
                  {scanning ? "Scanning..." : "Start Scan"}
                </button>
              </div>

              {scanning && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <p className="text-sm text-gray-400">
                      Analyzing {selectedIndex} — {limit} hisse için 5 ajan çalışıyor...
                    </p>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1">
                    <div className="h-1 rounded-full bg-purple-500 animate-pulse" style={{ width: "60%" }} />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Her hisse ~60-90 sn sürebilir (ML eğitimi dahil)
                  </p>
                </div>
              )}
            </div>

            {/* Özet */}
            {results.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase mb-1">BUY</p>
                  <p className="text-3xl font-bold text-green-400">{buyResults.length}</p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase mb-1">HOLD</p>
                  <p className="text-3xl font-bold text-yellow-400">{holdResults.length}</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase mb-1">SELL</p>
                  <p className="text-3xl font-bold text-red-400">{sellResults.length}</p>
                </div>
              </div>
            )}

            {/* Sonuçlar */}
            {results.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">
                  {selectedIndex} — {results.length} hisse tarandı
                </p>
                <div className="space-y-3">
                  {results
                    .filter(r => !r.error)
                    .sort((a, b) => Math.abs(b.weighted_score) - Math.abs(a.weighted_score))
                    .map((r) => (
                      <div key={r.ticker}
                        className={`flex items-center justify-between border rounded-xl px-4 py-3 ${verdictBg[r.verdict] || "bg-gray-800 border-gray-700"}`}>
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-white">{r.ticker}</p>
                              <Link
                                href={`/?ticker=${r.ticker}`}
                                className="text-xs text-purple-400 hover:text-purple-300">
                                Detaylı analiz →
                              </Link>
                            </div>
                            <p className="text-xs text-gray-400">{r.sector}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Price</p>
                            <p className="text-sm font-medium text-white">
                            {r.ticker.endsWith(".IS") ? "₺" : r.ticker.endsWith(".L") ? "£" : "$"}{r.price}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Confidence</p>
                            <p className="text-sm font-medium text-white">{(r.confidence * 100).toFixed(0)}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Score</p>
                            <p className={`text-sm font-medium ${r.weighted_score > 0 ? "text-green-400" : "text-red-400"}`}>
                              {r.weighted_score > 0 ? "+" : ""}{r.weighted_score}
                            </p>
                          </div>
                          <div className={`text-xl font-bold w-16 text-right ${verdictColor[r.verdict]}`}>
                            {r.verdict}
                          </div>
                        </div>
                      </div>
                    ))}
                  {results.filter(r => r.error).map((r) => (
                    <div key={r.ticker} className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
                      <p className="text-gray-400 text-sm">{r.ticker}</p>
                      <p className="text-red-400 text-xs">{r.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest">Analysis history</p>
              <button
                onClick={runValidation}
                disabled={validating}
                className="text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-4 py-2 rounded-lg transition">
                {validating ? "Validating..." : "Run Validation"}
              </button>
            </div>
            {history.length === 0 ? (
              <p className="text-gray-500 text-sm">Henüz analiz yok. Scanner'ı çalıştır!</p>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-white">{item.ticker}</p>
                        <span className={`text-xs font-bold ${verdictColor[item.verdict]}`}>{item.verdict}</span>
                        <span className="text-xs text-gray-500">{item.sector}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(item.analyzed_at).toLocaleString("tr-TR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs text-gray-500">Price</p>
                        <p className="text-sm text-white">${item.price_at_analysis}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Short</p>
                        <p className={`text-xs font-bold ${verdictColor[item.short_signal]}`}>{item.short_signal}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Mid</p>
                        <p className={`text-xs font-bold ${verdictColor[item.mid_signal]}`}>{item.mid_signal}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Long</p>
                        <p className={`text-xs font-bold ${verdictColor[item.long_signal]}`}>{item.long_signal}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Confidence</p>
                        <p className="text-sm text-white">{(item.confidence_score * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Accuracy Tab */}
        {activeTab === "accuracy" && (
          <div className="space-y-4">
            {!accuracy ? (
              <p className="text-gray-500 text-sm">Yükleniyor...</p>
            ) : accuracy.total_validations === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <p className="text-gray-400 mb-2">Henüz doğrulanmış analiz yok.</p>
                <p className="text-gray-500 text-sm">
                  Analizler 7 gün sonra otomatik doğrulanır.
                  History sekmesinden "Run Validation" ile manuel çalıştırabilirsin.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
                    <p className="text-xs text-gray-500 uppercase mb-2">Overall accuracy</p>
                    <p className={`text-4xl font-bold ${accuracy.accuracy_pct >= 60 ? "text-green-400" : accuracy.accuracy_pct >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                      {accuracy.accuracy_pct}%
                    </p>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
                    <p className="text-xs text-gray-500 uppercase mb-2">Total validated</p>
                    <p className="text-4xl font-bold text-white">{accuracy.total_validations}</p>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
                    <p className="text-xs text-gray-500 uppercase mb-2">Correct</p>
                    <p className="text-4xl font-bold text-purple-400">{accuracy.correct}</p>
                  </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">By verdict</p>
                  <div className="space-y-3">
                    {accuracy.by_verdict.map((v) => (
                      <div key={v.verdict} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                        <span className={`font-bold ${verdictColor[v.verdict]}`}>{v.verdict}</span>
                        <div className="flex gap-6 text-sm">
                          <span className="text-gray-400">Total: <span className="text-white">{v.total}</span></span>
                          <span className="text-gray-400">Correct: <span className="text-green-400">{v.correct}</span></span>
                          <span className="text-gray-400">Avg return: <span className={v.avg_return > 0 ? "text-green-400" : "text-red-400"}>
                            {v.avg_return > 0 ? "+" : ""}{v.avg_return?.toFixed(2)}%
                          </span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </main>
  );
}