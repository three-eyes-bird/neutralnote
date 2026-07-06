import { useState, useEffect, useMemo } from "react";

/* ニュートラル・ノート — Claudeアーティファクト専用の旧版（凍結）
   ※ 2026-07-02以降の正本は index.html（PWA版）。
      「窓」（リフレーミング）・⚙APIキー設定・不安度before/after などの
      新機能は index.html のみに実装されており、このファイルには移植しない。
   思想: AIは助言しない。鏡として「事実/解釈/べき」を映し、問いを一つ返すだけ。
   保存: window.storage（キー 'nn-entries' に一括保存） */

const C = {
  bg: "#14181F",
  surface: "#1C222B",
  surface2: "#232B36",
  line: "#2E3845",
  ink: "#E9E5DB",
  sub: "#8C95A3",
  ai: "#7FA0BD",      // 藍 — 落ち着き・水
  ember: "#C98A63",   // 感情の温度
  fact: "#8FB8A0",    // 事実
  warn: "#D4B36A",    // 解釈・べき
};

const serif = '"Noto Serif JP","Hiragino Mincho ProN","Yu Mincho",serif';
const sans = '"Noto Sans JP","Hiragino Sans",sans-serif';

const EMOTIONS = ["不安", "怒り", "悲しみ", "焦り", "孤独", "罪悪感", "むなしさ", "恐れ", "悔しさ", "安堵", "喜び", "静けさ"];

const STORAGE_KEY = "nn-entries";

async function loadEntries() {
  try {
    const r = await window.storage.get(STORAGE_KEY);
    return r ? JSON.parse(r.value) : [];
  } catch { return []; }
}
async function saveEntries(entries) {
  try { await window.storage.set(STORAGE_KEY, JSON.stringify(entries)); } catch (e) { console.error(e); }
}

/* ---- ローカルの「べき」検出（AIなしでも動く） ---- */
function detectShoulds(text) {
  const patterns = [/[^。\n]*(?:すべき|べきだ|べきで|べきな)[^。\n]*/g, /[^。\n]*(?:しなければ|せねば|しないと(?:いけ|だめ)|ねばならな)[^。\n]*/g, /[^。\n]*(?:はずだ|はずなのに)[^。\n]*/g];
  const found = new Set();
  for (const p of patterns) {
    const m = text.match(p);
    if (m) m.forEach(s => found.add(s.trim()));
  }
  return [...found];
}

/* ---- AIの鏡（助言禁止のプロンプト） ---- */
async function callMirror(text, emotions, intensity) {
  const prompt = `あなたは「鏡」です。助言・励まし・解決策・評価を一切しません。
以下の文章を読み、次のJSONだけを返してください。前置き・コードフェンス禁止。

{"facts": ["客観的に起きた事実（短文、最大4つ）"],
 "interpretations": ["書き手の頭の中の解釈・推測・物語（短文、最大4つ）"],
 "shoulds": ["文中の『〜すべき』『〜しなければ』等の思い込み表現（原文のまま、最大3つ）"],
 "question": "書き手が自分の本音に気づくための、開かれた問いをひとつ。問いのみ。"}

文章:
${text}

選んだ感情: ${emotions.join("、") || "未選択"}（強さ ${intensity}/100）`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  const raw = (data.content || []).map(b => b.text || "").join("").replace(/```json|```/g, "").trim();
  return JSON.parse(raw);
}

/* ---- 心の水位（SVG折れ線） ---- */
function WaterLine({ entries }) {
  const pts = entries.slice(-30);
  if (pts.length < 2) return (
    <p style={{ color: C.sub, fontSize: 13, lineHeight: 1.8 }}>記録が2件たまると、不安度の水位線がここに現れます。</p>
  );
  const W = 320, H = 120, pad = 8;
  const xs = pts.map((_, i) => pad + (i * (W - pad * 2)) / (pts.length - 1));
  const ys = pts.map(p => H - pad - ((p.intensity ?? 50) / 100) * (H - pad * 2));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${path} L${xs[xs.length - 1]},${H - pad} L${xs[0]},${H - pad} Z`;
  const last = pts[pts.length - 1].intensity ?? 50;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }} aria-label="不安度の推移">
        <defs>
          <linearGradient id="w" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.ai} stopOpacity="0.35" />
            <stop offset="100%" stopColor={C.ai} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#w)" />
        <path d={path} fill="none" stroke={C.ai} strokeWidth="1.5" />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill={C.ai} />
      </svg>
      <p style={{ color: C.sub, fontSize: 12, margin: "4px 0 0" }}>直近の不安度 <span style={{ color: C.ink, fontFamily: serif, fontSize: 16 }}>{last}</span> / 100（最新{pts.length}件）</p>
    </div>
  );
}

/* ---- 小物 ---- */
const Label = ({ children }) => (
  <div style={{ fontFamily: sans, fontSize: 11, letterSpacing: "0.18em", color: C.sub, marginBottom: 8 }}>{children}</div>
);
const Card = ({ children, style }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, ...style }}>{children}</div>
);
const Btn = ({ children, onClick, primary, disabled, small }) => (
  <button onClick={onClick} disabled={disabled} style={{
    fontFamily: sans, cursor: disabled ? "default" : "pointer",
    background: primary ? C.ai : "transparent",
    color: primary ? "#10141A" : C.ink,
    border: primary ? "none" : `1px solid ${C.line}`,
    borderRadius: 8, padding: small ? "6px 12px" : "11px 18px",
    fontSize: small ? 13 : 14, fontWeight: primary ? 700 : 400,
    opacity: disabled ? 0.4 : 1, transition: "opacity .15s",
  }}>{children}</button>
);

export default function App() {
  const [tab, setTab] = useState("write");
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // 書くフロー
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [emotions, setEmotions] = useState([]);
  const [intensity, setIntensity] = useState(50);
  const [mirror, setMirror] = useState(null);
  const [mirrorState, setMirrorState] = useState("idle"); // idle|loading|done|error
  const [answer, setAnswer] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => { loadEntries().then(e => { setEntries(e); setLoaded(true); }); }, []);

  const localShoulds = useMemo(() => detectShoulds(text), [text]);

  const toggleEmotion = (e) =>
    setEmotions(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);

  const runMirror = async () => {
    setMirrorState("loading");
    try {
      const m = await callMirror(text, emotions, intensity);
      setMirror(m); setMirrorState("done");
    } catch (e) { console.error(e); setMirrorState("error"); }
  };

  const save = async () => {
    const entry = {
      id: Date.now(), date: new Date().toISOString(),
      text, emotions, intensity,
      mirror: mirror || null, answer,
    };
    const next = [...entries, entry];
    setEntries(next);
    await saveEntries(next);
    setText(""); setEmotions([]); setIntensity(50); setMirror(null); setMirrorState("idle"); setAnswer(""); setStep(0);
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2200);
    setTab("log");
  };

  const removeEntry = async (id) => {
    const next = entries.filter(e => e.id !== id);
    setEntries(next);
    await saveEntries(next);
  };

  const steps = ["書く", "感じる", "鏡", "問い"];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: sans, fontSize: 15, lineHeight: 1.75 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "28px 18px 80px" }}>

        {/* 題字 */}
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: 24, letterSpacing: "0.3em", margin: 0 }}>ニュートラル・ノート</h1>
          <p style={{ color: C.sub, fontSize: 12, margin: "6px 0 0", letterSpacing: "0.06em" }}>変えない。還る。— 助言をしない記録帳</p>
        </header>

        {/* タブ */}
        <nav style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[["write", "書く"], ["log", "水位と記録"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              fontFamily: sans, cursor: "pointer", fontSize: 13, padding: "7px 14px",
              background: tab === k ? C.surface2 : "transparent",
              color: tab === k ? C.ink : C.sub,
              border: `1px solid ${tab === k ? C.line : "transparent"}`, borderRadius: 8,
            }}>{label}</button>
          ))}
          {savedFlash && <span style={{ alignSelf: "center", color: C.fact, fontSize: 12 }}>保存しました</span>}
        </nav>

        {tab === "write" && (
          <div style={{ display: "grid", gap: 16 }}>
            {/* 段階表示 */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {steps.map((s, i) => (
                <span key={s} style={{
                  fontSize: 11, letterSpacing: "0.12em",
                  color: i === step ? C.ink : C.sub,
                  borderBottom: i === step ? `1px solid ${C.ai}` : "1px solid transparent",
                  paddingBottom: 2,
                }}>{s}{i < steps.length - 1 ? "　" : ""}</span>
              ))}
            </div>

            {step === 0 && (
              <Card>
                <Label>いま、頭の中にあるもの</Label>
                <textarea value={text} onChange={e => setText(e.target.value)}
                  placeholder="整えなくていい。出てくる順に、そのまま。"
                  rows={8}
                  style={{ width: "100%", boxSizing: "border-box", background: C.bg, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 8, padding: 12, fontFamily: serif, fontSize: 15, lineHeight: 1.9, resize: "vertical" }} />
                {localShoulds.length > 0 && (
                  <p style={{ fontSize: 12, color: C.warn, margin: "10px 0 0" }}>
                    「べき・ねば」が {localShoulds.length} か所。あとで鏡が映します。
                  </p>
                )}
                <div style={{ marginTop: 14, textAlign: "right" }}>
                  <Btn primary disabled={text.trim().length < 5} onClick={() => setStep(1)}>つぎへ</Btn>
                </div>
              </Card>
            )}

            {step === 1 && (
              <Card>
                <Label>解決しない。ただ、名前をつけて測る</Label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                  {EMOTIONS.map(e => (
                    <button key={e} onClick={() => toggleEmotion(e)} style={{
                      fontFamily: serif, fontSize: 14, cursor: "pointer", padding: "6px 14px", borderRadius: 999,
                      background: emotions.includes(e) ? C.ember : "transparent",
                      color: emotions.includes(e) ? "#10141A" : C.ink,
                      border: `1px solid ${emotions.includes(e) ? C.ember : C.line}`,
                    }}>{e}</button>
                  ))}
                </div>
                <Label>不安度（いまの体感）</Label>
                <input type="range" min="0" max="100" value={intensity}
                  onChange={e => setIntensity(Number(e.target.value))}
                  style={{ width: "100%", accentColor: C.ember }} aria-label="不安度" />
                <div style={{ fontFamily: serif, fontSize: 28, color: C.ember, textAlign: "center", margin: "4px 0 12px" }}>{intensity}</div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Btn onClick={() => setStep(0)}>もどる</Btn>
                  <Btn primary onClick={() => setStep(2)}>つぎへ</Btn>
                </div>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <Label>鏡 — 助言はしない。映すだけ</Label>
                {mirrorState === "idle" && (
                  <div>
                    <p style={{ fontSize: 14, color: C.sub, margin: "0 0 14px" }}>書いた文章を「起きた事実」と「頭の中の解釈」に分けて映します。判断や励ましは返ってきません。</p>
                    <Btn primary onClick={runMirror}>鏡に映す</Btn>
                    <span style={{ marginLeft: 12 }}><Btn small onClick={() => setStep(3)}>鏡を使わず進む</Btn></span>
                  </div>
                )}
                {mirrorState === "loading" && <p style={{ color: C.sub }}>静かに読んでいます…</p>}
                {mirrorState === "error" && (
                  <div>
                    <p style={{ color: C.warn, fontSize: 14 }}>うまく映せませんでした。通信を確認して、もう一度どうぞ。</p>
                    <Btn small onClick={runMirror}>もう一度</Btn>
                  </div>
                )}
                {mirrorState === "done" && mirror && (
                  <div style={{ display: "grid", gap: 14 }}>
                    <div>
                      <div style={{ color: C.fact, fontSize: 12, letterSpacing: "0.15em", marginBottom: 4 }}>起きた事実</div>
                      {(mirror.facts || []).map((f, i) => <p key={i} style={{ margin: "2px 0", fontFamily: serif }}>・{f}</p>)}
                    </div>
                    <div>
                      <div style={{ color: C.warn, fontSize: 12, letterSpacing: "0.15em", marginBottom: 4 }}>頭の中の解釈</div>
                      {(mirror.interpretations || []).map((f, i) => <p key={i} style={{ margin: "2px 0", fontFamily: serif, color: C.sub }}>・{f}</p>)}
                    </div>
                    {(mirror.shoulds || []).length > 0 && (
                      <div>
                        <div style={{ color: C.warn, fontSize: 12, letterSpacing: "0.15em", marginBottom: 4 }}>「べき・ねば」</div>
                        {mirror.shoulds.map((f, i) => <p key={i} style={{ margin: "2px 0", fontFamily: serif, color: C.warn }}>・{f}</p>)}
                      </div>
                    )}
                    <div style={{ textAlign: "right" }}><Btn primary onClick={() => setStep(3)}>つぎへ</Btn></div>
                  </div>
                )}
                {(mirrorState === "idle" || mirrorState === "error") && (
                  <div style={{ marginTop: 12 }}>
                    <Btn small onClick={() => setStep(1)}>もどる</Btn>
                  </div>
                )}
              </Card>
            )}

            {step === 3 && (
              <Card>
                <Label>問い</Label>
                <p style={{ fontFamily: serif, fontSize: 17, lineHeight: 2, margin: "0 0 14px" }}>
                  {mirror?.question || "この出来事が、何かのメッセージだとしたら——本当はどうしたい？"}
                </p>
                <textarea value={answer} onChange={e => setAnswer(e.target.value)}
                  placeholder="答えは自分の中から。書けなければ空欄のままでいい。"
                  rows={4}
                  style={{ width: "100%", boxSizing: "border-box", background: C.bg, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 8, padding: 12, fontFamily: serif, fontSize: 15, lineHeight: 1.9, resize: "vertical" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
                  <Btn onClick={() => setStep(2)}>もどる</Btn>
                  <Btn primary onClick={save}>記録して閉じる</Btn>
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === "log" && (
          <div style={{ display: "grid", gap: 16 }}>
            <Card>
              <Label>心の水位 — 不安度の推移</Label>
              {loaded ? <WaterLine entries={entries} /> : <p style={{ color: C.sub }}>読み込み中…</p>}
            </Card>
            {[...entries].reverse().map(e => (
              <Card key={e.id} style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 12, color: C.sub }}>
                    {new Date(e.date).toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" })}
                    　{(e.emotions || []).join("・")}　
                    <span style={{ color: C.ember }}>不安 {e.intensity}</span>
                  </span>
                  <button onClick={() => removeEntry(e.id)} aria-label="この記録を消す"
                    style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: 12 }}>消す</button>
                </div>
                <p style={{ fontFamily: serif, fontSize: 14, lineHeight: 1.9, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>
                  {e.text.length > 120 ? e.text.slice(0, 120) + "…" : e.text}
                </p>
                {e.answer && (
                  <p style={{ fontFamily: serif, fontSize: 14, color: C.ai, margin: "8px 0 0", borderLeft: `2px solid ${C.ai}`, paddingLeft: 10 }}>{e.answer}</p>
                )}
              </Card>
            ))}
            {loaded && entries.length === 0 && (
              <p style={{ color: C.sub, fontSize: 14 }}>まだ記録がありません。「書く」から始められます。</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
