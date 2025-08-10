import React, { useEffect, useMemo, useRef, useState } from "react";

// Reversi / Othello — beautiful single-file React app
// Styling: TailwindCSS classes
// Features: legal-move highlights, score, undo, restart, hint, simple AI, end-game modal, responsive layout

const N = 8;
const EMPTY = 0;
const BLACK = 1; // ●
const WHITE = 2; // ○
const DIRS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

// Positional weights for AI (classic heuristic)
const WEIGHTS = [
  [120, -20, 20, 5, 5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20, 5, 5, 20, -20, 120],
];

function cloneBoard(b) {
  return b.map((row) => row.slice());
}

function inBounds(r, c) {
  return r >= 0 && r < N && c >= 0 && c < N;
}

function opponent(p) {
  return p === BLACK ? WHITE : BLACK;
}

function initBoard() {
  const b = Array.from({ length: N }, () => Array(N).fill(EMPTY));
  b[3][3] = WHITE;
  b[3][4] = BLACK;
  b[4][3] = BLACK;
  b[4][4] = WHITE;
  return b;
}

function countScore(board) {
  let black = 0,
    white = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (board[r][c] === BLACK) black++;
      else if (board[r][c] === WHITE) white++;
    }
  }
  return { black, white };
}

// Returns a Map("r,c" => list of [r,c] to flip)
function getValidMoves(board, player) {
  const opp = opponent(player);
  const moves = new Map();
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (board[r][c] !== EMPTY) continue;
      const flips = [];
      for (const [dr, dc] of DIRS) {
        let rr = r + dr,
          cc = c + dc;
        const line = [];
        while (inBounds(rr, cc) && board[rr][cc] === opp) {
          line.push([rr, cc]);
          rr += dr;
          cc += dc;
        }
        if (line.length && inBounds(rr, cc) && board[rr][cc] === player) {
          flips.push(...line);
        }
      }
      if (flips.length) moves.set(`${r},${c}`, flips);
    }
  }
  return moves;
}

function applyMove(board, r, c, player, flips) {
  const nb = cloneBoard(board);
  nb[r][c] = player;
  for (const [fr, fc] of flips) nb[fr][fc] = player;
  return nb;
}

function aiPick(validMoves, board, aiSide) {
  // Simple heuristic: positional weight + discs flipped + mobility after move (prefer limiting opponent)
  let bestKey = null;
  let bestScore = -Infinity;
  for (const [key, flips] of validMoves.entries()) {
    const [r, c] = key.split(",").map(Number);
    const weight = WEIGHTS[r][c];
    const nb = applyMove(board, r, c, aiSide, flips);
    const oppMoves = getValidMoves(nb, opponent(aiSide));
    const mobility = -oppMoves.size; // fewer options for opponent is better
    const score = weight + flips.length * 3 + mobility * 2;
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  return bestKey; // may be null
}

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

export default function ReversiApp() {
  const [board, setBoard] = useState(initBoard);
  const [turn, setTurn] = useState(BLACK); // Black moves first
  const [history, setHistory] = useState([]); // stack of {board, turn}
  const [vsAI, setVsAI] = useState(true);
  const [aiSide, setAiSide] = useState(WHITE); // default: you play Black
  const [message, setMessage] = useState("");
  const [lastMove, setLastMove] = useState(null); // [r,c]
  const [showHint, setShowHint] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const validMoves = useMemo(() => getValidMoves(board, turn), [board, turn]);
  const prevTurn = usePrevious(turn);

  // Reset message after a while
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 1800);
    return () => clearTimeout(t);
  }, [message]);

  // AI move
  useEffect(() => {
    if (!vsAI) return;
    if (turn !== aiSide) return;
    const moves = getValidMoves(board, turn);
    let cancelled = false;
    const doAI = async () => {
      if (moves.size === 0) {
        // pass
        const next = opponent(turn);
        const yourMoves = getValidMoves(board, next);
        if (yourMoves.size === 0) {
          setGameOver(true);
          return;
        } else {
          setMessage("對手無合法步，換你繼續。");
          setTurn(next);
          return;
        }
      }
      // small delay to feel natural
      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;
      const key = aiPick(moves, board, turn) || [...moves.keys()][0];
      const [r, c] = key.split(",").map(Number);
      const flips = moves.get(key);
      pushMove(r, c, flips);
    };
    doAI();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vsAI, aiSide, turn, board]);

  function pushMove(r, c, flips) {
    setHistory((h) => [...h, { board: cloneBoard(board), turn }]);
    const nb = applyMove(board, r, c, turn, flips);
    setBoard(nb);
    setLastMove([r, c]);
    const next = opponent(turn);
    const nextMoves = getValidMoves(nb, next);
    if (nextMoves.size === 0) {
      const backToYou = getValidMoves(nb, turn);
      if (backToYou.size === 0) {
        setGameOver(true);
      } else {
        setMessage("對手無合法步，換你繼續。");
        setTurn(turn); // same player again
      }
    } else {
      setTurn(next);
    }
  }

  function handleClickCell(r, c) {
    if (gameOver) return;
    if (vsAI && turn === aiSide) return; // wait AI
    const key = `${r},${c}`;
    if (!validMoves.has(key)) return;
    const flips = validMoves.get(key);
    pushMove(r, c, flips);
  }

  function handleUndo() {
    if (!history.length || (vsAI && turn === aiSide)) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setBoard(prev.board);
    setTurn(prev.turn);
    setLastMove(null);
    setGameOver(false);
  }

  function handleRestart() {
    setBoard(initBoard());
    setTurn(BLACK);
    setHistory([]);
    setMessage("");
    setLastMove(null);
    setShowHint(false);
    setGameOver(false);
  }

  const scores = useMemo(() => countScore(board), [board]);
  const hintKey = useMemo(() => {
    if (!showHint) return null;
    const moves = getValidMoves(board, turn);
    if (moves.size === 0) return null;
    return aiPick(moves, board, turn);
  }, [board, turn, showHint]);

  const winner = useMemo(() => {
    if (!gameOver) return null;
    const { black, white } = scores;
    if (black > white) return BLACK;
    if (white > black) return WHITE;
    return 3; // draw
  }, [gameOver, scores]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Reversi <span className="opacity-80">/</span> 黑白棋
            </h1>
            <p className="text-slate-400 mt-1">精緻介面、流暢操作、支援電腦對戰與提示。</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={BLACK} value={scores.black} label="Black" active={turn === BLACK} />
            <Badge color={WHITE} value={scores.white} label="White" active={turn === WHITE} />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left sidebar: Controls */}
          <aside className="order-2 lg:order-1 lg:col-span-2">
            <Panel>
              <h2 className="text-lg font-semibold mb-3">對戰設定</h2>
              <div className="space-y-3">
                <Toggle
                  labelLeft="玩家 vs 玩家"
                  labelRight="玩家 vs 電腦"
                  enabled={vsAI}
                  onChange={setVsAI}
                />
                <div className={`transition-opacity ${vsAI ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                  <Label>電腦方</Label>
                  <div className="flex gap-2">
                    <Segmented
                      options={[
                        { key: WHITE, label: "White" },
                        { key: BLACK, label: "Black" },
                      ]}
                      value={aiSide}
                      onChange={(v) => setAiSide(v)}
                      disabled={!vsAI || (vsAI && turn === aiSide)}
                    />
                  </div>
                </div>
              </div>
            </Panel>

            <Panel className="mt-6">
              <h2 className="text-lg font-semibold mb-3">操作</h2>
              <div className="flex flex-wrap gap-3">
                <Btn onClick={handleRestart} title="重新開始" icon={IconRefresh} />
                <Btn onClick={handleUndo} title="悔棋" icon={IconUndo} disabled={!history.length || (vsAI && turn === aiSide)} />
                <Btn
                  onClick={() => setShowHint((v) => !v)}
                  title={showHint ? "隱藏提示" : "提示"}
                  icon={IconSparkles}
                />
              </div>
              <p className="text-sm text-slate-400 mt-3">
                當前回合：<span className="font-semibold">{turn === BLACK ? "Black (●)" : "White (○)"}</span>
              </p>
              {message && (
                <div className="mt-3 text-emerald-300 text-sm">{message}</div>
              )}
            </Panel>

            <Panel className="mt-6">
              <h2 className="text-lg font-semibold mb-2">規則小提醒</h2>
              <ul className="list-disc pl-5 text-sm text-slate-300 space-y-1">
                <li>玩家輪流下子，必須夾住對方棋子才能落子。</li>
                <li>若無合法步則<span className="font-semibold">跳過回合</span>；雙方都無步時比數高者獲勝。</li>
                <li>角落價值極高；善用提示功能找策略。</li>
              </ul>
            </Panel>
          </aside>

          {/* Board */}
          <main className="order-1 lg:order-2 lg:col-span-3">
            <div className="relative">
              <Board
                board={board}
                validMoves={validMoves}
                hintKey={hintKey}
                lastMove={lastMove}
                onClickCell={handleClickCell}
                disabled={gameOver || (vsAI && turn === aiSide)}
              />
              {/* End game overlay */}
              {gameOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl">
                  <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-6 text-center shadow-xl">
                    <h3 className="text-xl font-semibold mb-2">對局結束</h3>
                    <p className="text-slate-300 mb-4">
                      {winner === 3 ? (
                        <span>平手！</span>
                      ) : winner === BLACK ? (
                        <span>Black（●）獲勝！</span>
                      ) : (
                        <span>White（○）獲勝！</span>
                      )}
                      <br />
                      最終比分：<span className="font-semibold">{scores.black}</span> - <span className="font-semibold">{scores.white}</span>
                    </p>
                    <div className="flex justify-center gap-3">
                      <Btn onClick={handleRestart} title="再來一局" icon={IconPlay} />
                      <Btn
                        onClick={() => {
                          setGameOver(false);
                          setShowHint(true);
                        }}
                        title="檢視棋盤"
                        icon={IconEye}
                        variant="ghost"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="mt-10 text-center text-xs text-slate-500">
          <p>Made with ❤️ — Reversi / Othello</p>
        </footer>
      </div>
    </div>
  );
}

function Board({ board, validMoves, hintKey, lastMove, onClickCell, disabled }) {
  const sizeClamp = "max-w-[min(92vw,640px)]";
  return (
    <div className={`mx-auto ${sizeClamp}`}>
      <div className="aspect-square w-full bg-emerald-900/40 rounded-2xl p-2 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.35)]">
        <div className="grid grid-cols-8 grid-rows-8 gap-1 w-full h-full">
          {Array.from({ length: N }).map((_, r) =>
            Array.from({ length: N }).map((_, c) => {
              const key = `${r},${c}`;
              const legal = validMoves.has(key);
              const isHint = hintKey === key;
              const lm = lastMove && lastMove[0] === r && lastMove[1] === c;
              return (
                <Cell
                  key={key}
                  r={r}
                  c={c}
                  value={board[r][c]}
                  legal={legal}
                  isHint={isHint}
                  lastMove={lm}
                  onClick={() => !disabled && onClickCell(r, c)}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Cell({ r, c, value, legal, isHint, lastMove, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "relative select-none rounded-lg flex items-center justify-center",
        "bg-emerald-700/60 hover:bg-emerald-700/80 transition-colors",
        legal ? "ring-2 ring-emerald-300/60" : "ring-1 ring-emerald-800/60",
      ].join(" ")}
      aria-label={`row ${r + 1} column ${c + 1}`}
    >
      {/* legal dot */}
      {legal && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-emerald-300/80 animate-pulse" />
        </div>
      )}
      {/* hint ring */}
      {isHint && (
        <div className="absolute inset-0 rounded-lg ring-2 ring-amber-300 animate-pulse" />
      )}
      {value !== EMPTY && (
        <Disc color={value} lastMove={lastMove} />
      )}
    </button>
  );
}

function Disc({ color, lastMove }) {
  const isBlack = color === BLACK;
  return (
    <div
      className={[
        "h-8 w-8 sm:h-10 sm:w-10 rounded-full shadow-lg transition-transform duration-200",
        lastMove ? "scale-110" : "scale-100",
        isBlack
          ? "bg-gradient-to-br from-slate-800 via-black to-slate-900 border border-slate-700"
          : "bg-gradient-to-br from-white via-slate-100 to-slate-200 border border-slate-300",
      ].join(" ")}
    />
  );
}

function Badge({ color, value, label, active }) {
  const isBlack = color === BLACK;
  return (
    <div
      className={[
        "flex items-center gap-2 rounded-full px-3 py-1.5 border",
        active ? "border-emerald-400 bg-emerald-400/10" : "border-slate-700/60 bg-slate-800/40",
      ].join(" ")}
    >
      <div
        className={[
          "h-3.5 w-3.5 rounded-full",
          isBlack
            ? "bg-gradient-to-br from-slate-800 via-black to-slate-900 border border-slate-700"
            : "bg-gradient-to-br from-white via-slate-100 to-slate-200 border border-slate-300",
        ].join(" ")}
      />
      <span className="text-sm tabular-nums">{label}: {value}</span>
    </div>
  );
}

function Panel({ children, className = "" }) {
  return (
    <div className={["rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 shadow-xl", className].join(" ")}>{children}</div>
  );
}

function Label({ children }) {
  return <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">{children}</div>;
}

function Segmented({ options, value, onChange, disabled }) {
  return (
    <div className={["inline-flex rounded-xl overflow-hidden border", disabled ? "opacity-60" : "", "border-slate-700"].join(" ")}
    >
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => !disabled && onChange(o.key)}
          className={[
            "px-3 py-1.5 text-sm",
            value === o.key ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700/70",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ labelLeft, labelRight, enabled, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-sm ${!enabled ? "text-white" : "text-slate-400"}`}>{labelLeft}</span>
      <button
        onClick={() => onChange(!enabled)}
        className={[
          "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
          enabled ? "bg-emerald-500/90" : "bg-slate-700",
        ].join(" ")}
        aria-label="toggle vs ai"
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
            enabled ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
      <span className={`text-sm ${enabled ? "text-white" : "text-slate-400"}`}>{labelRight}</span>
    </div>
  );
}

function Btn({ title, onClick, icon: Icon, variant = "solid", disabled }) {
  const base = "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
  const style =
    variant === "ghost"
      ? "bg-transparent hover:bg-white/5 border border-slate-700"
      : "bg-emerald-600 hover:bg-emerald-500 text-white";
  return (
    <button className={[base, style].join(" ")} onClick={onClick} disabled={disabled}>
      {Icon && <Icon className="h-4 w-4" />}
      <span>{title}</span>
    </button>
  );
}

// --- Minimal inline icons ---
function IconUndo({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M9 14l-5-5 5-5" />
      <path d="M4 9h9a7 7 0 110 14h-3" />
    </svg>
  );
}
function IconRefresh({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M21 12a9 9 0 10-3.5 7.1" />
      <path d="M21 3v7h-7" />
    </svg>
  );
}
function IconSparkles({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 3l1.7 3.5L17 8l-3.3 1.5L12 13l-1.7-3.5L7 8l3.3-1.5L12 3z" />
      <path d="M5 19l.9 1.9L8 22l-2.1 1L5 25l-.9-2.1L2 22l2.1-.9L5 19z" />
      <path d="M19 15l1.1 2.3L23 18l-2.9 1 .9 2.2L19 20l-2.1 1 1-2.2L15 18l2.9-.7L19 15z" />
    </svg>
  );
}
function IconPlay({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function IconEye({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
