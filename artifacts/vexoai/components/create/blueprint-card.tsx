// @ts-nocheck
"use client"

import React, { useState, useEffect, useRef } from "react";

// VexoAI — multi-scene Blueprint editor.
// Each scene is its own full block (Script, Style, Avatar, Voice, duration, ratio).
// "+ Scene нэмэх" appends another; scenes collapse/expand; Generate renders the
// whole project → done with Play. Self-contained, no props.

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

.vx-wrap{
  --ink:#08090C;--surface:#0F1116;--surface-2:#14171E;--inset:#0C0E13;
  --line:rgba(255,255,255,0.08);--line-strong:rgba(255,255,255,0.16);
  --tungsten:#F3B279;--teal:#2DD4BF;--teal-deep:#0d9488;
  --text:#ECEEF1;--muted:#8B919C;--faint:#565C66;--vg:#55AA5B;--vr:#B80D0D;
  display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;box-sizing:border-box;
  font-family:'Manrope',system-ui,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;
  background:radial-gradient(1200px 600px at 80% -10%,rgba(45,212,191,0.06),transparent 60%),
    radial-gradient(900px 500px at 10% 110%,rgba(184,13,13,0.045),transparent 55%),var(--ink);
}
.vx-wrap *{box-sizing:border-box}
.vx-card{position:relative;width:100%;max-width:660px;background:linear-gradient(180deg,var(--surface) 0%,#0D0F14 100%);
  border:1px solid var(--line);border-radius:22px;box-shadow:0 40px 80px -20px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.02) inset}
.vx-clip{border-radius:22px;overflow:hidden}

/* HUD */
.vx-hud{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;font-family:'JetBrains Mono',monospace;
  font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--faint);border-bottom:1px solid var(--line)}
.vx-hg{display:flex;align-items:center;gap:10px}
.vx-rec{display:inline-flex;align-items:center;gap:7px;color:#ff5a52}.vx-rec.live{color:var(--teal)}
.vx-rec .vx-dot{width:8px;height:8px;border-radius:50%;background:currentColor;box-shadow:0 0 10px currentColor;animation:vxblink 1.2s steps(1) infinite}
@keyframes vxblink{50%{opacity:0.18}}
.vx-sep{color:var(--line-strong)}.vx-tag{color:var(--muted)}

/* Viewfinder */
.vx-vf{position:relative;margin:16px;height:248px;border-radius:14px;overflow:hidden}
.vx-stage{position:absolute;inset:0;background:radial-gradient(140% 120% at 78% 18%,rgba(243,178,121,0.55),transparent 42%),
  radial-gradient(120% 100% at 20% 90%,rgba(94,79,63,0.6),transparent 50%),linear-gradient(135deg,#2a2620 0%,#17161b 55%,#0c0c10 100%)}
.vx-bokeh{position:absolute;border-radius:50%;opacity:0.5}
.vx-b1{width:90px;height:90px;top:24px;right:60px;background:rgba(255,214,170,0.55);filter:blur(14px)}
.vx-b2{width:46px;height:46px;top:90px;right:30px;background:rgba(255,224,190,0.45);filter:blur(8px)}
.vx-b3{width:30px;height:30px;top:60px;right:140px;background:rgba(255,205,160,0.4);filter:blur(8px)}
.vx-b4{width:120px;height:120px;bottom:-30px;left:-20px;background:rgba(120,95,70,0.4);filter:blur(22px)}
.vx-vig{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.1) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,0.55) 78%,rgba(0,0,0,0.82) 100%)}
.vx-br{position:absolute;width:26px;height:26px;border:2px solid rgba(255,255,255,0.85);transition:all .35s ease}
.vx-tl{border-right:none;border-bottom:none;border-top-left-radius:3px}
.vx-tr{border-left:none;border-bottom:none;border-top-right-radius:3px}
.vx-bl{border-right:none;border-top:none;border-bottom-left-radius:3px}
.vx-brr{border-left:none;border-top:none;border-bottom-right-radius:3px}
.vx-slate{position:absolute;top:18px;left:50%;transform:translateX(-50%);font-family:'JetBrains Mono',monospace;
  font-size:10.5px;letter-spacing:0.14em;color:rgba(255,255,255,0.78);text-transform:uppercase;white-space:nowrap}
.vx-title{position:absolute;left:0;right:0;bottom:42px;text-align:center;font-family:'Oswald',sans-serif;font-weight:600;
  line-height:0.94;letter-spacing:-0.01em;text-transform:uppercase;color:#fff;text-shadow:0 2px 24px rgba(0,0,0,0.7);margin:0;padding:0 28px}
.vx-tc{position:absolute;bottom:20px;right:46px;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:0.08em;color:var(--teal)}
.vx-ratio{position:absolute;bottom:20px;left:50px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.12em;color:rgba(255,255,255,0.6)}

/* Render / Done */
.vx-render{position:relative;margin:16px;height:300px;border-radius:14px;overflow:hidden;background:radial-gradient(120% 120% at 50% 32%,#16181f,#0a0b0e 70%)}
.vx-grid{position:absolute;inset:0;opacity:0.22;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
  background-size:34px 34px;-webkit-mask-image:radial-gradient(circle at 50% 42%,#000 28%,transparent 74%);mask-image:radial-gradient(circle at 50% 42%,#000 28%,transparent 74%)}
.vx-rbr{position:absolute;width:24px;height:24px;border:2px solid rgba(255,255,255,0.3)}
.vx-rbr.vx-tl{top:14px;left:14px}.vx-rbr.vx-tr{top:14px;right:14px}.vx-rbr.vx-bl{bottom:14px;left:14px}.vx-rbr.vx-brr{bottom:14px;right:14px}
.vx-logo{position:absolute;top:48px;left:50%;transform:translateX(-50%);width:122px;height:118px}
.vx-logo svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.vx-ghost polygon{opacity:0.15}
.vx-fillwrap{position:absolute;inset:0;animation:vxrender 2.1s ease-in-out infinite}
@keyframes vxrender{0%{clip-path:inset(100% 0 0 0)}55%{clip-path:inset(0 0 0 0)}100%{clip-path:inset(0 0 0 0)}}
.vx-glow{filter:drop-shadow(0 0 13px rgba(85,170,91,0.5)) drop-shadow(0 0 13px rgba(184,13,13,0.4))}
.vx-scan{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--teal),transparent);box-shadow:0 0 14px var(--teal);animation:vxscan 2.1s ease-in-out infinite}
@keyframes vxscan{0%{top:168px;opacity:0}10%{opacity:1}55%{top:48px;opacity:1}65%{opacity:0}100%{opacity:0}}
.vx-rtc{position:absolute;bottom:64px;left:0;right:0;text-align:center;font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:0.1em;color:var(--teal)}
.vx-rstage{position:absolute;bottom:30px;left:0;right:0;text-align:center;font-family:'JetBrains Mono',monospace;font-size:11.5px;letter-spacing:0.13em;text-transform:uppercase;color:var(--muted)}
.vx-rstage b{color:var(--text);font-weight:600}
.vx-logo.done .vx-fillwrap{animation:none;clip-path:none}
.vx-logo.done{animation:vxfloat 3.4s ease-in-out infinite}
@keyframes vxfloat{50%{transform:translateX(-50%) translateY(-6px)}}
.vx-done-lbl{position:absolute;bottom:54px;left:0;right:0;text-align:center;font-family:'Oswald',sans-serif;font-weight:600;font-size:22px;letter-spacing:0.02em;text-transform:uppercase;color:#fff}
.vx-done-sub{position:absolute;bottom:30px;left:0;right:0;text-align:center;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--teal)}

/* progress */
.vx-prog{padding:8px 24px 20px}
.vx-bar{height:8px;border-radius:99px;background:var(--inset);border:1px solid var(--line);overflow:hidden}
.vx-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--vg),#9aa84a,var(--vr));box-shadow:0 0 16px rgba(184,13,13,0.35);transition:width .25s ease}
.vx-pmeta{display:flex;justify-content:space-between;margin-top:11px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.05em;color:var(--faint)}
.vx-pct{color:var(--teal)}

/* Body / scenes */
.vx-body{padding:18px 24px 24px}
.vx-eye{font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:0.16em;text-transform:uppercase;color:var(--teal-deep);margin-bottom:9px;display:flex;align-items:center;gap:8px}
.vx-eye::before{content:'';width:5px;height:5px;background:var(--teal);border-radius:1px;box-shadow:0 0 8px var(--teal)}
.vx-scene{border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,0.012);margin-bottom:14px}
.vx-shd{display:flex;align-items:center;gap:10px;padding:13px 16px;cursor:pointer}
.vx-shd.open{border-bottom:1px solid var(--line)}
.vx-snum{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:var(--teal);display:flex;align-items:center;gap:8px}
.vx-snum::before{content:'';width:6px;height:6px;background:var(--teal);border-radius:1px;box-shadow:0 0 8px var(--teal)}
.vx-ssum{color:var(--faint);font-size:12px;margin-left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.vx-shp{margin-left:auto;display:flex;gap:4px}
.vx-ib{width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
.vx-ib:hover{color:var(--text);border-color:var(--line-strong)}
.vx-ib.del:hover{color:#ff5a52;border-color:rgba(255,90,82,0.4)}
.vx-ib svg{width:15px;height:15px}
.vx-sbd{padding:2px 16px 16px}
.vx-prow{display:grid;grid-template-columns:1fr 1fr;gap:22px;padding:16px 0 4px}
.vx-ta{width:100%;min-height:92px;resize:vertical;background:var(--inset);border:1px solid var(--line);border-radius:11px;
  padding:11px 13px;color:#D6DAE0;font-family:'Manrope',sans-serif;font-size:13px;line-height:1.55;outline:none;transition:border-color .15s}
.vx-ta:focus{border-color:rgba(45,212,191,0.5)}.vx-ta::placeholder{color:var(--faint)}
.vx-cast{padding:14px 0 4px}
.vx-castgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}
.vx-slot{position:relative;display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:12px;background:var(--inset);
  border:1px solid var(--line);cursor:pointer;text-align:left;width:100%;color:inherit;transition:border-color .15s}
.vx-slot:hover{border-color:var(--line-strong)}.vx-slot.sel{border-color:rgba(45,212,191,0.4)}
.vx-av{width:38px;height:38px;border-radius:9px;flex:none;display:flex;align-items:center;justify-content:center;color:var(--faint);
  background:linear-gradient(135deg,rgba(45,212,191,0.12),rgba(255,255,255,0.03));border:1px solid var(--line)}
.vx-av.on{color:var(--teal);border-color:rgba(45,212,191,0.4)}
.vx-meta{display:flex;flex-direction:column;gap:3px;min-width:0}
.vx-k{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:var(--faint)}
.vx-v{font-size:12.5px;color:var(--muted);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vx-v.on{color:var(--text)}
.vx-chev{margin-left:auto;color:var(--faint);display:flex}
.vx-pop{position:absolute;top:calc(100% + 8px);left:0;right:0;z-index:60;background:#171a22;border:1px solid var(--line-strong);
  border-radius:13px;padding:6px;box-shadow:0 22px 44px -12px rgba(0,0,0,0.75);max-height:220px;overflow:auto}
.vx-pi{display:flex;align-items:center;gap:10px;padding:10px 11px;border-radius:9px;cursor:pointer;font-size:13px;color:var(--text)}
.vx-pi:hover{background:rgba(255,255,255,0.05)}
.vx-pi.on{background:rgba(45,212,191,0.1)}.vx-pi.on .vx-nm{color:var(--teal)}
.vx-pi .vx-ptag{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--faint)}
.vx-pi svg{width:16px;height:16px;color:var(--teal)}
.vx-backdrop{position:fixed;inset:0;z-index:55}
.vx-spec{display:flex;flex-wrap:wrap;gap:7px;align-items:center;padding:14px 0 2px}
.vx-chip{display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:0.04em;
  color:var(--muted);padding:6px 11px;border-radius:8px;background:var(--surface-2);border:1px solid var(--line)}
.vx-chip svg{width:12px;height:12px;opacity:0.7}
.vx-chip.click{cursor:pointer}.vx-chip.click:hover{border-color:var(--line-strong);color:var(--text)}.vx-chip.click:hover svg{opacity:1}
.vx-step{display:inline-flex;align-items:center;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--text);background:var(--surface-2);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.vx-step b{padding:0 7px;min-width:32px;text-align:center}
.vx-step button{width:26px;height:28px;background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .15s}
.vx-step button:hover{background:rgba(255,255,255,0.06);color:var(--teal)}.vx-step button:disabled{opacity:0.3;cursor:default}
.vx-credit{color:var(--teal);background:rgba(45,212,191,0.07);border-color:rgba(45,212,191,0.22)}.vx-credit svg{opacity:1}
.vx-addscene{width:100%;height:48px;border:1.5px dashed var(--line-strong);border-radius:14px;background:transparent;color:var(--muted);
  font-family:'JetBrains Mono',monospace;font-size:11.5px;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:9px;transition:all .15s}
.vx-addscene:hover{color:var(--teal);border-color:rgba(45,212,191,0.5)}
.vx-addscene svg{width:16px;height:16px}

/* Actions */
.vx-actions{display:flex;gap:12px;padding:22px 24px 24px;border-top:1px solid var(--line)}
.vx-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;height:50px;border-radius:13px;cursor:pointer;border:1px solid transparent;
  font-family:'Manrope',sans-serif;font-weight:700;font-size:14px;letter-spacing:0.01em;transition:all .18s ease}
.vx-ghost{flex:0 0 132px;background:transparent;border-color:var(--line-strong);color:var(--muted)}
.vx-ghost:hover{color:var(--text);border-color:rgba(255,255,255,0.3)}
.vx-gen{flex:1;background:linear-gradient(135deg,var(--teal) 0%,var(--teal-deep) 100%);color:#04201c;box-shadow:0 8px 24px -10px rgba(45,212,191,0.45);text-transform:uppercase;letter-spacing:0.06em;font-weight:800}
.vx-gen:hover{filter:brightness(1.08)}.vx-gen:disabled{opacity:0.55;cursor:default;filter:none}
.vx-play{flex:0 0 132px;background:rgba(45,212,191,0.12);border-color:rgba(45,212,191,0.4);color:var(--teal);font-weight:800}
.vx-play:hover{background:rgba(45,212,191,0.2)}
.vx-dl{flex:1;background:linear-gradient(135deg,var(--vg),var(--vr));color:#fff;box-shadow:0 8px 24px -10px rgba(184,13,13,0.5);text-transform:uppercase;letter-spacing:0.06em;font-weight:800}
.vx-btn svg{width:17px;height:17px}.vx-btn:focus-visible{outline:2px solid var(--teal);outline-offset:2px}
.vx-spin{width:16px;height:16px;border:2px solid rgba(4,32,28,0.35);border-top-color:#04201c;border-radius:50%;animation:vxsp .7s linear infinite}
@keyframes vxsp{to{transform:rotate(360deg)}}
@media (max-width:560px){.vx-prow,.vx-castgrid{grid-template-columns:1fr;gap:16px}}
@media (prefers-reduced-motion:reduce){*{animation-duration:.001ms!important}}
`;

const Svg = ({ d, w = 2, s, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={s} {...p}>{d}</svg>
);
const I = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />, chev: <path d="M6 9l6 6 6-6" />, chevUp: <path d="M18 15l-6-6-6 6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />, plus: <path d="M12 5v14M5 12h14" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>, wave: <path d="M3 12h2l2-6 3 14 3-18 3 12 2-4h3" />,
  upload: <><path d="M12 16V4m0 0l-4 4m4-4l4 4" /><path d="M4 18v2h16v-2" /></>, sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  check: <path d="M5 13l4 4L19 7" />, globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" /></>,
  cc: <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M8 11h2M14 11h2M7 14h4M13 14h4" /></>,
  coin: <><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9 10h4.5a1.5 1.5 0 0 1 0 3H9h5" /></>,
  play: <path d="M8 5v14l11-7z" />, pause: <><rect x="7" y="5" width="3.5" height="14" rx="1" /><rect x="14" y="5" width="3.5" height="14" rx="1" /></>,
  dl: <path d="M12 3v12m0 0l-5-5m5 5l5-5M4 21h16" />,
};

const VOICES = [
  { name: "Сараа", tag: "эмэгтэй · дулаан" }, { name: "Энхээ", tag: "эмэгтэй · залуу" }, { name: "Номин", tag: "эмэгтэй · тод" },
  { name: "Болд", tag: "эрэгтэй · ноён" }, { name: "Тэмүүлэн", tag: "эрэгтэй · гүн" }, { name: "Ганаа", tag: "эрэгтэй · дотно" },
];
const RATIOS = ["16:9", "9:16", "1:1"];
const RATIO_LBL = { "16:9": "LANDSCAPE", "9:16": "PORTRAIT", "1:1": "SQUARE" };
const RB = { "16:9": { x: "7%", y: "16%" }, "9:16": { x: "33%", y: "6%" }, "1:1": { x: "25%", y: "8%" } };
const STAGES = ["Скрипт боловсруулж байна", "Дуу хоолой үүсгэж байна", "Аватар дүрсжүүлж байна", "Видео render хийж байна"];
const DEFAULT_SCRIPT = "Мэргэжлийн залуу эмэгтэй гэрэлт студид шинэ бүтээгдэхүүн танилцуулж буй бичлэг. Зөөлөн гэрэлтүүлэгтэй, бүдэг арын дэвсгэртэй, мэргэжлийн өнгө аястай.";
const DEFAULT_STYLE = "Мэргэжлийн студийн орчин, зөөлөн гэрэлтүүлэг, бүдэг арын дэвсгэр (bokeh effect), тод дулаан өнгөний зохицол.";
const newScene = (withDefault) => ({ script: withDefault ? DEFAULT_SCRIPT : "", style: DEFAULT_STYLE, avatar: null, voice: 0, duration: 6, ratio: "16:9", collapsed: false });

const fmt = (pct, dur) => {
  const s = (pct / 100) * dur, mm = Math.floor(s / 60), ss = Math.floor(s % 60), ff = Math.floor((s - Math.floor(s)) * 24);
  const p = (n) => String(n).padStart(2, "0");
  return `00:${p(mm)}:${p(ss)}:${p(ff)}`;
};

const VLogo = ({ done }) => (
  <div className={`vx-logo${done ? " done" : ""}`}>
    <svg className="vx-ghost" viewBox="0 0 100 100"><polygon points="14,16 30,16 50,86 38,86" fill="#fff" /><polygon points="70,16 86,16 62,86 50,86" fill="#fff" /></svg>
    <div className="vx-fillwrap"><svg className="vx-glow" viewBox="0 0 100 100"><polygon points="14,16 30,16 50,86 38,86" fill="var(--vg)" /><polygon points="70,16 86,16 62,86 50,86" fill="var(--vr)" /></svg></div>
  </div>
);
const RatioGlyph = ({ ratio }) => {
  const m = { "16:9": [20, 11], "9:16": [11, 20], "1:1": [15, 15] }[ratio];
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}><rect x={(24 - m[0]) / 2} y={(24 - m[1]) / 2} width={m[0]} height={m[1]} rx="1.5" /></svg>;
};

export default function BlueprintCard() {
  const [scenes, setScenes] = useState([newScene(true)]);
  const [menu, setMenu] = useState(null);        // null | {i, field}
  const [mode, setMode] = useState("idle");
  const [pct, setPct] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playPct, setPlayPct] = useState(0);
  const fileRef = useRef(null), uploadIdx = useRef(0), t1 = useRef(null), t2 = useRef(null);

  const N = scenes.length;
  const totalDur = scenes.reduce((a, s) => a + s.duration, 0);
  const rScene = Math.min(N, Math.floor((pct / 100) * N) + 1);
  const stageLabel = STAGES[Math.min(STAGES.length - 1, Math.floor((pct / 100) * STAGES.length))];

  useEffect(() => {
    if (mode !== "rendering") return;
    t1.current = setInterval(() => setPct((p) => {
      if (p >= 100) { clearInterval(t1.current); setTimeout(() => setMode("done"), 450); return 100; }
      return Math.min(100, p + (p < 70 ? 1.5 : 0.8));
    }), 55);
    return () => clearInterval(t1.current);
  }, [mode]);

  useEffect(() => {
    if (!playing) return;
    t2.current = setInterval(() => setPlayPct((p) => {
      if (p >= 100) { clearInterval(t2.current); setPlaying(false); return 0; }
      return Math.min(100, p + 5 / totalDur);
    }), 50);
    return () => clearInterval(t2.current);
  }, [playing, totalDur]);

  const start = () => { setPct(0); setMode("rendering"); };
  const reset = () => { setPct(0); setPlayPct(0); setPlaying(false); setMode("idle"); };
  const setField = (i, k, v) => setScenes((s) => s.map((sc, idx) => idx === i ? { ...sc, [k]: v } : sc));
  const addScene = () => setScenes((s) => [...s.map((sc) => ({ ...sc, collapsed: true })), newScene(false)]);
  const delScene = (i, e) => { e.stopPropagation(); setScenes((s) => s.length > 1 ? s.filter((_, idx) => idx !== i) : s); };
  const openUpload = (i) => { uploadIdx.current = i; fileRef.current && fileRef.current.click(); };
  const onFile = () => { setField(uploadIdx.current, "avatar", { type: "upload", label: "Оруулсан зураг" }); setMenu(null); };

  const ins = RB[scenes[0].ratio];
  const brk = { tl: { top: ins.y, left: ins.x }, tr: { top: ins.y, right: ins.x }, bl: { bottom: ins.y, left: ins.x }, brr: { bottom: ins.y, right: ins.x } };

  return (
    <div className="vx-wrap">
      <style>{CSS}</style>
      <div className="vx-card">
        {menu && <div className="vx-backdrop" onClick={() => setMenu(null)} />}
        <div className="vx-clip">
          <div className="vx-hud">
            <div className="vx-hg">
              <span className={`vx-rec${mode !== "idle" ? " live" : ""}`}><span className="vx-dot" />{mode === "rendering" ? "Rendering" : mode === "done" ? "Done" : "REC"}</span>
              <span className="vx-sep">/</span><span>Blueprint</span>
            </div>
            <div className="vx-hg"><span className="vx-tag">id: bapjys</span><span className="vx-sep">·</span><span>{mode === "rendering" ? "working" : mode === "done" ? "ready ✓" : `${N} scene`}</span></div>
          </div>

          {/* IDLE */}
          {mode === "idle" && (
            <>
              <div className="vx-vf">
                <div className="vx-stage" />
                <div className="vx-bokeh vx-b1" /><div className="vx-bokeh vx-b2" /><div className="vx-bokeh vx-b3" /><div className="vx-bokeh vx-b4" />
                <div className="vx-vig" />
                <div className="vx-br vx-tl" style={brk.tl} /><div className="vx-br vx-tr" style={brk.tr} /><div className="vx-br vx-bl" style={brk.bl} /><div className="vx-br vx-brr" style={brk.brr} />
                <div className="vx-slate">PROJECT · {String(N).padStart(2, "0")} SCENE{N > 1 ? "S" : ""}</div>
                <h3 className="vx-title" style={{ fontSize: scenes[0].ratio === "16:9" ? 46 : 36 }}>Бүтээгдэхүүн<br />танилцуулга</h3>
                <div className="vx-ratio">{scenes[0].ratio} — {RATIO_LBL[scenes[0].ratio]}</div>
                <div className="vx-tc">{fmt(100, totalDur)}</div>
              </div>

              <div className="vx-body">
                {scenes.map((sc, i) => {
                  const open = !sc.collapsed;
                  return (
                    <div className="vx-scene" key={i}>
                      <div className={`vx-shd${open ? " open" : ""}`} onClick={() => setField(i, "collapsed", !sc.collapsed)}>
                        <span className="vx-snum">Scene {String(i + 1).padStart(2, "0")}</span>
                        {!open && <span className="vx-ssum">{sc.script ? sc.script.slice(0, 44) + (sc.script.length > 44 ? "…" : "") : "Хоосон scene"}</span>}
                        <span className="vx-shp">
                          <button className="vx-ib" onClick={(e) => { e.stopPropagation(); setField(i, "collapsed", !sc.collapsed); }}><Svg d={open ? I.chevUp : I.chev} /></button>
                          {N > 1 && <button className="vx-ib del" onClick={(e) => delScene(i, e)}><Svg d={I.x} /></button>}
                        </span>
                      </div>

                      {open && (
                        <div className="vx-sbd">
                          <div className="vx-prow">
                            <div>
                              <div className="vx-eye">Script</div>
                              <textarea className="vx-ta" value={sc.script} placeholder="Бичлэгийн зохиолоо энд бичнэ үү…" onChange={(e) => setField(i, "script", e.target.value)} />
                            </div>
                            <div>
                              <div className="vx-eye">Style</div>
                              <textarea className="vx-ta" value={sc.style} placeholder="Дүрслэл, өнгө аяс…" onChange={(e) => setField(i, "style", e.target.value)} />
                            </div>
                          </div>

                          <div className="vx-cast">
                            <div className="vx-eye">Cast</div>
                            <div className="vx-castgrid">
                              <button className={`vx-slot${sc.avatar ? " sel" : ""}`} onClick={() => setMenu(menu && menu.i === i && menu.field === "avatar" ? null : { i, field: "avatar" })}>
                                <div className={`vx-av${sc.avatar ? " on" : ""}`}><Svg d={sc.avatar ? I.check : I.user} s={{ width: 18, height: 18 }} /></div>
                                <div className="vx-meta"><span className="vx-k">Avatar</span><span className={`vx-v${sc.avatar ? " on" : ""}`}>{sc.avatar ? sc.avatar.label : "Сонгох…"}</span></div>
                                <span className="vx-chev"><Svg d={I.chev} s={{ width: 15, height: 15 }} /></span>
                                {menu && menu.i === i && menu.field === "avatar" && (
                                  <div className="vx-pop" onClick={(e) => e.stopPropagation()}>
                                    <div className="vx-pi" onClick={() => openUpload(i)}><Svg d={I.upload} /><span className="vx-nm">Зураг оруулах</span><span className="vx-ptag">upload</span></div>
                                    <div className="vx-pi" onClick={() => { setField(i, "avatar", { type: "ai", label: "AI аватар" }); setMenu(null); }}><Svg d={I.sparkle} /><span className="vx-nm">AI-аар үүсгэх</span><span className="vx-ptag">AI</span></div>
                                  </div>
                                )}
                              </button>

                              <button className="vx-slot sel" onClick={() => setMenu(menu && menu.i === i && menu.field === "voice" ? null : { i, field: "voice" })}>
                                <div className="vx-av on"><Svg d={I.wave} s={{ width: 18, height: 18 }} /></div>
                                <div className="vx-meta"><span className="vx-k">Voice — CAMB.AI</span><span className="vx-v on">{VOICES[sc.voice].name} · {VOICES[sc.voice].tag.split(" · ")[0]}</span></div>
                                <span className="vx-chev"><Svg d={I.chev} s={{ width: 15, height: 15 }} /></span>
                                {menu && menu.i === i && menu.field === "voice" && (
                                  <div className="vx-pop" onClick={(e) => e.stopPropagation()}>
                                    {VOICES.map((v, vi) => (
                                      <div key={vi} className={`vx-pi${vi === sc.voice ? " on" : ""}`} onClick={() => { setField(i, "voice", vi); setMenu(null); }}>
                                        <span className="vx-nm">{v.name}</span><span className="vx-ptag">{v.tag}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="vx-spec">
                            <span className="vx-step">
                              <button onClick={() => setField(i, "duration", Math.max(2, sc.duration - 1))} disabled={sc.duration <= 2}>−</button>
                              <b>{sc.duration}s</b>
                              <button onClick={() => setField(i, "duration", Math.min(60, sc.duration + 1))} disabled={sc.duration >= 60}>+</button>
                            </span>
                            <span className="vx-chip click" onClick={() => setField(i, "ratio", RATIOS[(RATIOS.indexOf(sc.ratio) + 1) % RATIOS.length])}>
                              <RatioGlyph ratio={sc.ratio} />{sc.ratio}
                            </span>
                            <span className="vx-chip"><Svg d={I.globe} s={{ width: 12, height: 12 }} />mn-MN</span>
                            <span className="vx-chip"><Svg d={I.cc} s={{ width: 12, height: 12 }} />Subtitles</span>
                            <span className="vx-chip vx-credit"><Svg d={I.coin} s={{ width: 12, height: 12 }} />15–30 cr</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button className="vx-addscene" onClick={addScene}><Svg d={I.plus} />Scene нэмэх</button>
              </div>

              <div className="vx-actions">
                <button className="vx-btn vx-gen" onClick={start}>Generate · {N} scene<Svg d={I.arrow} w={2.4} /></button>
              </div>
            </>
          )}

          {/* RENDERING */}
          {mode === "rendering" && (
            <>
              <div className="vx-render">
                <div className="vx-grid" /><div className="vx-rbr vx-tl" /><div className="vx-rbr vx-tr" /><div className="vx-rbr vx-bl" /><div className="vx-rbr vx-brr" />
                <VLogo /><div className="vx-scan" />
                <div className="vx-rtc">{fmt(pct, totalDur)}</div>
                <div className="vx-rstage">Scene {String(rScene).padStart(2, "0")}/{String(N).padStart(2, "0")} · <b>{stageLabel}</b></div>
              </div>
              <div className="vx-prog">
                <div className="vx-bar"><div className="vx-fill" style={{ width: `${pct}%` }} /></div>
                <div className="vx-pmeta"><span>VexoAI Studio · CAMB.AI</span><span className="vx-pct">{Math.round(pct)}%</span></div>
              </div>
              <div className="vx-actions">
                <button className="vx-btn vx-ghost" onClick={reset}>Цуцлах</button>
                <button className="vx-btn vx-gen" disabled><span className="vx-spin" />Үүсгэж байна…</button>
              </div>
            </>
          )}

          {/* DONE */}
          {mode === "done" && (
            <>
              <div className="vx-render">
                <div className="vx-grid" /><div className="vx-rbr vx-tl" /><div className="vx-rbr vx-tr" /><div className="vx-rbr vx-bl" /><div className="vx-rbr vx-brr" />
                <VLogo done />
                <div className="vx-done-lbl">{playing ? "Тоглуулж байна" : "Бэлэн боллоо"}</div>
                <div className="vx-done-sub">{playing ? fmt(playPct, totalDur) : `${totalDur}s · ${N} scene · ${scenes[0].ratio}`}</div>
              </div>
              <div className="vx-prog">
                <div className="vx-bar"><div className="vx-fill" style={{ width: `${playing ? playPct : 100}%` }} /></div>
                <div className="vx-pmeta"><span>VexoAI Studio</span><span className="vx-pct">{playing ? Math.round(playPct) : 100}%</span></div>
              </div>
              <div className="vx-actions">
                <button className="vx-btn vx-play" onClick={() => { if (playing) { setPlaying(false); setPlayPct(0); } else { setPlayPct(0); setPlaying(true); } }}>
                  <Svg d={playing ? I.pause : I.play} />{playing ? "Зогсоох" : "Play"}
                </button>
                <button className="vx-btn vx-dl"><Svg d={I.dl} />Татах</button>
              </div>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />
      </div>
    </div>
  );
}