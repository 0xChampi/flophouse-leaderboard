"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Copy, Crown, ExternalLink, Flame, House, LayoutDashboard, RefreshCw, Search, ShieldCheck, Sparkles, Trophy, Users, X } from "lucide-react";
import { amount, calendarDate, prizeFor, standingsCsv, type Leaderboard, type LeaderboardResponse, type Player } from "@/lib/leaderboard";

function HouseMark({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M13 28 32 12l19 16v24H13V28Z" stroke="currentColor" strokeWidth="5" strokeLinejoin="round"/><path d="M25 51V33h14v18M21 27h22" stroke="currentColor" strokeWidth="5" strokeLinejoin="round"/></svg>;
}

function Avatar({ player, large = false }: { player: Player; large?: boolean }) {
  const [broken, setBroken] = useState(false);
  return <span className={`avatar ${large ? "avatar-large" : ""}`}>
    {player.avatar && !broken ? <img src={player.avatar} alt="" loading="lazy" onError={() => setBroken(true)} /> : <span>{player.name.slice(0, 2).toUpperCase()}</span>}
  </span>;
}

const capturedLabel = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(value)) + " UTC";

export default function Dashboard({ initialBoard }: { initialBoard: Leaderboard }) {
  const [board, setBoard] = useState(initialBoard);
  const [mode, setMode] = useState<"source" | "snapshot">("snapshot");
  const [activeNav, setActiveNav] = useState("overview");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "paid">("all");
  const [sort, setSort] = useState("rank");
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<Player | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const topThree = board.players.filter(p => p.rank <= 3);
  const totalWager = board.players.reduce((total, p) => total + p.wagered, 0);
  const first = board.players.find(p => p.rank === 1);
  const seasonRange = `${calendarDate(board.startsAtSource)} — ${calendarDate(board.endsAtSource)} ${board.endsAtSource.slice(0, 4)}`;
  const seasonProgress = Math.max(0, Math.min(100, (Date.parse(board.capturedAt) - Date.parse(board.startsAtSource.replace(" ", "T") + "Z")) / (Date.parse(board.endsAtSource.replace(" ", "T") + "Z") - Date.parse(board.startsAtSource.replace(" ", "T") + "Z")) * 100));

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!board.endsAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [board.endsAt]);

  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    if (!selected && dialog.current?.open) {
      dialog.current.close();
      opener.current?.focus();
    }
  }, [selected]);

  const filtered = useMemo(() => {
    const rows = board.players.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()) && (filter === "all" || prizeFor(board, p.rank) > 0));
    return rows.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "wager" ? b.wagered - a.wagered : a.rank - b.rank);
  }, [board, search, filter, sort]);
  const pageSize = showAll ? Math.max(filtered.length, 1) : 10;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const endTime = board.endsAt && now ? Math.max(0, new Date(board.endsAt).getTime() - now) : null;
  const days = endTime === null ? null : Math.floor(endTime / 86400000);
  const hours = endTime === null ? null : Math.floor(endTime / 3600000) % 24;
  const minutes = endTime === null ? null : Math.floor(endTime / 60000) % 60;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(board.eligibility);
      setCopied(true);
      setNotice("Code flop copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch { setNotice(`Your browser could not copy the code. Use ${board.eligibility}.`); }
  }

  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); setNotice("Dashboard link copied. Share it with the house."); }
    catch { setNotice("Copy the address from your browser to share this board."); }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Refresh unavailable");
      const result = await response.json() as LeaderboardResponse;
      if (result.board.id !== board.id || !Array.isArray(result.board.players)) throw new Error("Unexpected standings");
      setBoard(result.board); setMode(result.mode); setNotice(result.message);
    } catch { setNotice("Refresh is unavailable. Your saved standings are still here; check Gamba for the latest."); }
    finally { setRefreshing(false); }
  }

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([standingsCsv(board, filtered)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `flophouse-${board.id}-standings.csv`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`${filtered.length} player${filtered.length === 1 ? "" : "s"} exported.`);
  }

  function openPlayer(player: Player, button: HTMLButtonElement) { opener.current = button; setSelected(player); }
  const navItems = [{ id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "leaderboard", label: "Leaderboard", icon: Trophy }, { id: "rules", label: "House rules", icon: CircleHelp }, { id: "community", label: "The community", icon: Users }];

  return <>
    <a href="#main" className="skip-link">Skip to dashboard</a>
    <aside className="sidebar">
      <a href="#overview" className="brand" aria-label="Flophouse home"><span className="brand-icon"><HouseMark /></span><span>FLOPHOUSE<span className="brand-subtitle">THE HOUSE LEADERBOARD</span></span></a>
      <div className="sidebar-label">THE HOUSE</div>
      <nav aria-label="Main navigation">{navItems.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} className={`nav-link ${activeNav === id ? "nav-active" : ""}`} onClick={() => setActiveNav(id)}><Icon size={18} /><span>{label}</span>{id === "leaderboard" && <span className="nav-count">{board.players.length}</span>}</a>)}</nav>
      <div className="sidebar-season"><span className="eyebrow"><span className="small-dot" /> THE CURRENT SEASON</span><strong>September → October</strong><p>{seasonRange}</p><div className="season-line" title="Season progress at the capture time"><span style={{ width: `${seasonProgress}%` }} /></div><span className="sidebar-season-note">Exclusive leaderboard #{board.id}</span></div>
      <div className="sidebar-bottom"><div className="host-avatar">T</div><div><strong>{board.host}</strong><span>YOUR HOUSE HOST</span></div><a href={board.sourceUrl} target="_blank" rel="noreferrer" aria-label="View Travszzz's Gamba leaderboard"><ArrowUpRight size={18} /></a></div>
    </aside>

    <div className="app-shell">
      <header className="topbar"><div className="breadcrumb"><span className="mobile-brand"><HouseMark /> FLOPHOUSE</span><span className="desktop-breadcrumb">The house <ChevronRight size={13} /> <strong>Overview</strong></span></div><div className="topbar-actions"><a href={board.sourceUrl} target="_blank" rel="noreferrer" className="source-link"><span className="gamba-letter">G</span> Gamba leaderboard <ArrowUpRight size={14} /></a><span className="topbar-divider" /><button className="share-button" onClick={share}>Share board <ExternalLink size={14} /></button></div></header>
      <nav className="mobile-navigation" aria-label="Mobile navigation">{navItems.slice(0, 3).map(item => <a href={`#${item.id}`} key={item.id}>{item.label}</a>)}</nav>

      <main id="main">
        <section className="hero" id="overview">
          <div className="hero-content"><span className="eyebrow hero-eyebrow"><span className="small-dot" /> FLOPHOUSE × GAMBA <span className="eyebrow-line" /></span><h1>Your house.<br /><span>Your leaderboard.</span></h1><p>The Flophouse standings, all in one place.<br className="desktop-break" /> A community race hosted by <strong>{board.host}</strong>.</p><div className="hero-actions"><a className="primary-button" href="#leaderboard" onClick={() => setActiveNav("leaderboard")}>Explore the standings <ArrowRight size={16} /></a><a className="quiet-link" href="#rules" onClick={() => setActiveNav("rules")}>How it works <ArrowUpRight size={15} /></a></div><div className="hero-season"><CalendarDays size={14} /><span>{seasonRange}</span><span className="hero-season-dot">·</span><span>Race #{board.id}</span></div></div>
          <div className="hero-art" aria-hidden="true"><div className="art-grid" /><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-glow"/><div className="house-tile"><HouseMark /><span>THE HOUSE ALWAYS<br />HAS ROOM.</span></div><div className="floating-chip chip-players"><Users size={15} /><span><b>{board.players.length}</b> contenders</span></div><div className="floating-chip chip-prizes"><Trophy size={15} /><span><b>{board.prizes.length}</b> prize places</span></div><span className="art-star star-one">✳</span><span className="art-star star-two">+</span><span className="art-code">FH / 20764</span></div>
        </section>

        <section className="stats-grid" aria-label="Season statistics"><article className="stat-card prize-stat"><div className="stat-top"><span>Total prize pool</span><Trophy size={17} /></div><div className="stat-value">{amount(board.prizePool)}<span>{board.currency}</span></div><p><span className="small-dot" /> Across {board.prizes.length} prize positions</p></article><article className="stat-card"><div className="stat-top"><span>Ranked players</span><Users size={17} /></div><div className="stat-value">{board.players.length}<span>PLAYERS</span></div><p>The whole house, on one board</p></article><article className="stat-card"><div className="stat-top"><span>Tracked qualifying wager</span><Flame size={17} /></div><div className="stat-value">{amount(totalWager)}<span>{board.currency}</span></div><p>Across the captured standings</p></article><article className="stat-card"><div className="stat-top"><span>{endTime === null ? "Season closes" : endTime === 0 ? "Season ended" : "Time remaining"}</span><CalendarDays size={17} /></div><div className={`stat-value ${endTime !== null ? "countdown-value" : ""}`}>{endTime === null ? calendarDate(board.endsAtSource).toUpperCase() : <>{days}<small>d</small> {String(hours).padStart(2, "0")}<small>h</small> {String(minutes).padStart(2, "0")}<small>m</small></>}</div><p>{board.endsAt ? "October 14 · 23:59 UTC" : "Source deadline · timezone unlisted"}</p></article></section>

        <div className="content-grid">
          <div className="primary-column">
            <section className="podium-section" aria-labelledby="podium-heading"><div className="section-heading"><div><span className="eyebrow">THE FRONT OF THE HOUSE</span><h2 id="podium-heading">The current podium<span className="title-dot">.</span></h2></div><span className="soft-pill"><Crown size={13} /> TOP 3</span></div><div className="podium">{[2, 1, 3].map(position => { const player = topThree.find(p => p.rank === position); if (!player) return null; return <button onClick={e => openPlayer(player, e.currentTarget)} className={`podium-card podium-${position}`} key={player.id} aria-label={`View ${player.name}, rank ${position}`}><div className="podium-rank">{position === 1 ? <><Crown size={14} /> THE HOUSE LEADER</> : <><span>#{position}</span> {position === 2 ? "RUNNER-UP" : "THIRD PLACE"}</>}</div><div className="podium-avatar"><Avatar player={player} large /><span className="rank-token">{position === 1 ? <Crown size={12} /> : position}</span></div><strong className="podium-name">{player.name}</strong><span className="vip-label">{player.vip}</span><div className="podium-prize">{amount(prizeFor(board, position))}<span>{board.currency}</span></div><span className="podium-prize-label">PROJECTED PRIZE</span><div className="podium-wager"><span>Qualifying wager</span><strong>{amount(player.wagered)}</strong></div></button>; })}</div></section>

            <section className="leaderboard-panel" id="leaderboard" aria-labelledby="rankings-heading"><div className="table-heading"><div><span className="eyebrow">EVERY CONTENDER COUNTS</span><h2 id="rankings-heading">The house rankings<span className="title-dot">.</span> <span className="count-badge">{board.players.length}</span></h2></div><div className="table-actions"><button className="icon-button" onClick={exportCsv} aria-label="Export displayed standings as CSV" title="Export standings"><ArrowDownToLine size={17} /></button><button className="icon-button" disabled={refreshing} onClick={refresh} aria-label="Refresh standings" title="Refresh standings"><RefreshCw size={17} className={refreshing ? "spin" : ""} /></button></div></div><div className="table-controls"><div className="filter-tabs" role="group" aria-label="Player filter"><button aria-pressed={filter === "all"} className={filter === "all" ? "filter-active" : ""} onClick={() => { setFilter("all"); setPage(1); }}>All players</button><button aria-pressed={filter === "paid"} className={filter === "paid" ? "filter-active" : ""} onClick={() => { setFilter("paid"); setPage(1); }}>Prize positions <span>{board.prizes.length}</span></button></div><div className="search-field"><Search size={15} /><label className="sr-only" htmlFor="player-search">Search players</label><input id="player-search" type="search" placeholder="Find a player…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div></div><div className="table-meta"><span><span className={`capture-dot ${mode === "source" ? "source-current" : ""}`} /> {mode === "source" ? "Source refreshed" : "Verified source capture"} <span className="capture-date">· {capturedLabel(board.capturedAt)}</span></span><label className="sort-label">Sort <select aria-label="Sort standings" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="rank">By rank</option><option value="wager">Wager, highest</option><option value="name">Player A–Z</option></select><ChevronDown size={12}/></label></div><div className="table-scroll"><table><thead><tr><th scope="col">RANK</th><th scope="col">PLAYER</th><th scope="col" className="number-cell">QUALIFYING WAGER</th><th scope="col" className="number-cell">PROJECTED PRIZE</th><th scope="col" className="row-arrow"><span className="sr-only">Details</span></th></tr></thead><tbody>{rows.map(player => <tr key={player.id} className={player.rank <= 3 ? `table-rank-${player.rank}` : ""}><td><span className={`table-rank ${player.rank <= 3 ? "medal-rank" : ""}`}>{player.rank === 1 ? <Crown size={13}/> : String(player.rank).padStart(2, "0")}</span></td><td><button className="player-button" onClick={e => openPlayer(player, e.currentTarget)} aria-label={`View ${player.name}, rank ${player.rank}`}><Avatar player={player}/><span><strong>{player.name}</strong><small>{player.vip}</small></span></button></td><td className="number-cell"><strong>{amount(player.wagered)}</strong><span className="wager-line"><span style={{ width: `${first ? player.wagered / first.wagered * 100 : 0}%` }}/></span></td><td className={`number-cell table-prize ${prizeFor(board, player.rank) > 0 ? "has-prize" : ""}`}>{prizeFor(board, player.rank) > 0 ? amount(prizeFor(board, player.rank)) : <span className="no-prize">—</span>}</td><td className="row-arrow"><button className="row-details" onClick={e => openPlayer(player, e.currentTarget)} aria-label={`Details for ${player.name}`}><ArrowUpRight size={15}/></button></td></tr>)}</tbody></table>{!rows.length && <div className="empty-state"><Search size={26}/><strong>No players found</strong><p>Try a different name or switch to all players.</p><button className="quiet-link" onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters <ArrowRight size={14}/></button></div>}</div><div className="table-footer"><span>{filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} players <span className="currency-note">· Values in {board.currency}</span></span><div className="pagination"><button className="show-all" onClick={() => { setShowAll(!showAll); setPage(1); }}>{showAll ? "Show 10" : "Show all"}</button><button disabled={currentPage <= 1} aria-label="Previous page" onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15}/></button><span>{currentPage} / {pages}</span><button disabled={currentPage >= pages} aria-label="Next page" onClick={() => setPage(currentPage + 1)}><ChevronRight size={15}/></button></div></div></section>
          </div>

          <aside className="secondary-column"><section className="house-card" id="community"><div className="house-card-icon"><HouseMark /></div><span className="eyebrow">WELCOME TO FLOPHOUSE</span><h2>Good company.<br />One shared board.</h2><p>The Flophouse community race,<br />hosted by <strong>{board.host}</strong>.</p><div className="code-box"><span>ELIGIBILITY CODE</span><button aria-label="Copy eligibility code flop" onClick={copyCode}><strong>{board.eligibility.toUpperCase()}</strong>{copied ? <Check size={16}/> : <Copy size={16}/>}</button></div><a href={board.sourceUrl} target="_blank" rel="noreferrer" className="house-source">View the race on Gamba <ArrowUpRight size={16}/></a><div className="community-credit"><span className="small-dot"/> TRAV / HYPERTHREAT TV</div></section>

            <section className="rules-card" id="rules"><div className="side-heading"><span className="side-icon"><ShieldCheck size={17}/></span><h2>The house rules</h2></div><p>Your leaderboard wager is weighted by each game’s house edge.</p><div className="contribution-heading"><span>HOUSE EDGE</span><span>COUNTS</span></div>{board.contributions.map(rule => <div className="contribution-row" key={rule.min}><div><strong>{rule.min}%–{rule.max}%</strong><b>{rule.percentage}%</b></div><span className="contribution-track"><span style={{ width: `${rule.percentage}%` }}/></span></div>)}<div className="rules-note"><CircleHelp size={15}/><span>House edge = 100% − RTP.<br />Check each game’s published RTP.</span></div><a href={board.sourceUrl} target="_blank" rel="noreferrer" className="quiet-link">Official rules & eligibility <ArrowUpRight size={14}/></a></section>

            <section className="prize-card"><div className="side-heading"><span className="side-icon gold"><Trophy size={17}/></span><h2>A place in the prizes</h2></div><p>The top {board.prizes.length} positions share the pool.</p><div className="prize-distribution" aria-label="Prize pool distribution">{board.prizes.slice(0, 3).map((prize, i) => <span key={prize.rank} className={`distribution-segment segment-${i + 1}`} style={{ width: `${prize.percentage}%` }}/>) }<span className="distribution-segment segment-rest" style={{ width: `${100 - board.prizes.slice(0, 3).reduce((n, p) => n + p.percentage, 0)}%` }}/></div><div className="prize-legend">{board.prizes.slice(0, 3).map(prize => <div key={prize.rank}><span><i className={`legend-dot legend-${prize.rank}`}/> {prize.rank === 1 ? "1st" : prize.rank === 2 ? "2nd" : "3rd"} place</span><strong>{prize.percentage}%</strong></div>)}<div><span><i className="legend-dot legend-rest"/> 4th–10th place</span><strong>15%</strong></div></div><span className="prize-footnote">Projected amounts. Final standings and payouts are determined by Gamba.</span></section>

            <div className="source-note"><Sparkles size={16}/><p>Built for the house.<br /><span>Standings mapped from Gamba #{board.id}.</span></p></div>
          </aside>
        </div>
        <footer className="page-footer"><span><House size={13}/> FLOPHOUSE <i>/</i> THE HOUSE LEADERBOARD</span><a href={board.sourceUrl} target="_blank" rel="noreferrer">Independent community view · Source: Gamba <ArrowUpRight size={12}/></a></footer>
      </main>
    </div>

    {notice && <div className="toast" role="status"><Check size={17}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={16}/></button></div>}
    <dialog ref={dialog} className="player-dialog" aria-labelledby="player-dialog-title" onCancel={() => setSelected(null)} onClose={() => setSelected(null)} onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>{selected && <div className="dialog-content"><button className="dialog-close icon-button" aria-label="Close player details" onClick={() => setSelected(null)}><X size={18}/></button><span className="eyebrow">FLOPHOUSE CONTENDER</span><Avatar player={selected} large/><h2 id="player-dialog-title">{selected.name}</h2><span className="soft-pill">{selected.vip}</span><div className="player-detail-grid"><div><span>Current rank</span><strong>#{selected.rank}</strong></div><div><span>Projected prize · {board.currency}</span><strong className="green-text">{amount(prizeFor(board, selected.rank))}</strong></div><div className="detail-wide"><span>Qualifying wager · {board.currency}</span><strong>{amount(selected.wagered)}</strong></div></div>{selected.rank > 1 && board.players.find(p => p.rank === selected.rank - 1) && <p className="gap-note">{amount(Math.max(0, board.players.find(p => p.rank === selected.rank - 1)!.wagered - selected.wagered))} {board.currency} separates this player from the next position in the captured standings.</p>}<p className="dialog-captured">Captured {capturedLabel(board.capturedAt)}</p><a className="primary-button" href={board.sourceUrl} target="_blank" rel="noreferrer">Verify on Gamba <ArrowUpRight size={15}/></a></div>}</dialog>
  </>;
}
