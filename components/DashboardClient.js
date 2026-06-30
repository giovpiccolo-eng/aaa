"use client";
import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import { CURRICULUM, MONTHS, periodIncludes } from "@/lib/curriculum";

const TEAL  = "#16494A";
const LIME  = "#CAF104";
const GREEN = "#17C430";

const STATUS_CYCLE = ["not-started", "planning", "ready", "teaching", "complete"];
const STATUS_LABELS = {
  "not-started": "Not Started",
  planning:  "Planning",
  ready:     "Ready",
  teaching:  "Teaching",
  complete:  "Complete",
};

function statusPill(status) {
  const base = "text-xs font-semibold px-2.5 py-0.5 rounded-full border";
  switch (status) {
    case "not-started": return `${base} bg-gray-100 text-gray-500 border-gray-200`;
    case "planning":    return `${base} border text-teal-800` + ` bg-[#f2ffd0]`;
    case "ready":       return `${base} bg-teal-50 text-teal-700 border-teal-200`;
    case "teaching":    return `${base} text-white border-transparent` + ` bg-[#17C430]`;
    case "complete":    return `${base} text-white border-transparent` + ` bg-[#16494A]`;
    default:            return `${base} bg-gray-100 text-gray-500`;
  }
}

function statusStyle(status) {
  switch (status) {
    case "not-started": return { background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" };
    case "planning":    return { background: "#f2ffd0", color: "#16494A", border: `1px solid ${LIME}` };
    case "ready":       return { background: "#e6f7f7", color: TEAL, border: `1px solid #9dd9da` };
    case "teaching":    return { background: GREEN, color: "#fff", border: "none" };
    case "complete":    return { background: TEAL, color: "#fff", border: "none" };
    default:            return { background: "#f3f4f6", color: "#6b7280" };
  }
}

const PACING_COLORS = {
  "on-track": { color: GREEN },
  behind:     { color: "#ef4444" },
  ahead:      { color: TEAL },
};

function nextStatus(s) {
  return STATUS_CYCLE[(STATUS_CYCLE.indexOf(s) + 1) % STATUS_CYCLE.length];
}

// Acorn SVG mark
function AcornMark({ size = 24, color = LIME }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 60 72" fill="none">
      <ellipse cx="30" cy="52" rx="18" ry="20" fill={color}/>
      <rect x="27" y="30" width="6" height="14" rx="3" fill={color} opacity=".75"/>
      <ellipse cx="30" cy="32" rx="16" ry="7" fill={color} opacity=".9"/>
    </svg>
  );
}

export function DashboardClient({ user }) {
  const isCoordinator = user.role === "COORDINATOR";

  const [view, setView]         = useState("dashboard");
  const [month, setMonth]       = useState("November");
  const [yFilter, setYFilter]   = useState("all");
  const [mapYear, setMapYear]   = useState(7);
  const [syncYear, setSyncYear] = useState(7);
  const [syncKey, setSyncKey]   = useState(null);
  const [detailTheme, setDetail]= useState(null);

  const [themeStatus, setThemeStatus] = useState({});
  const [syncStates, setSyncStates]   = useState({});
  const [notes, setNotes]             = useState({});
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers]             = useState([]);
  const [noteInput, setNoteInput]     = useState("");
  const [loading, setLoading]         = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const safeJson = async (res) => { try { return await res.json(); } catch { return {}; } };
      const [tsRes, syncRes, asgRes] = await Promise.all([
        fetch("/api/theme-status"),
        fetch("/api/sync"),
        fetch("/api/assignments"),
      ]);
      const [ts, sync, asg] = await Promise.all([safeJson(tsRes), safeJson(syncRes), safeJson(asgRes)]);
      if (ts && !ts.error) setThemeStatus(ts);
      if (sync && !sync.error) setSyncStates(sync);
      setAssignments(Array.isArray(asg) ? asg : []);
      if (isCoordinator) {
        const uRes = await fetch("/api/users");
        const u = await safeJson(uRes);
        setUsers(Array.isArray(u) ? u : []);
      }
    } catch (e) {
      console.error("fetchAll:", e);
    } finally {
      setLoading(false);
    }
  }, [isCoordinator]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchNotes = useCallback(async (key) => {
    const res  = await fetch(`/api/notes?syncKey=${key}`);
    const data = await res.json().catch(() => []);
    setNotes((prev) => ({ ...prev, [key]: Array.isArray(data) ? data : [] }));
  }, []);

  useEffect(() => { if (syncKey) fetchNotes(syncKey); }, [syncKey, fetchNotes]);

  async function updateThemeStatus(themeKey, field, value) {
    const current = themeStatus[themeKey] ?? { status: "not-started", pacing: "on-track" };
    const updated = { ...current, [field]: value };
    setThemeStatus((prev) => ({ ...prev, [themeKey]: updated }));
    await fetch("/api/theme-status", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themeKey, ...updated }),
    });
  }

  async function updateSync(key, field, value) {
    const current = syncStates[key] ?? { aligned: false, reason: null };
    const updated = { ...current, [field]: value };
    setSyncStates((prev) => ({ ...prev, [key]: updated }));
    await fetch("/api/sync", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncKey: key, ...updated }),
    });
  }

  async function addNote(key, content) {
    const res  = await fetch("/api/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncKey: key, content }),
    });
    const note = await res.json().catch(() => null);
    if (note && !note.error) setNotes((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), note] }));
  }

  async function updateAssignment(yearGroup, stream, userId) {
    await fetch("/api/assignments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yearGroup, stream, userId }),
    });
    await fetchAll();
  }

  function getAssignment(yearGroup, stream) {
    return assignments.find((a) => a.yearGroup === yearGroup && a.stream === stream);
  }
  function getTs(themeKey) {
    return themeStatus[themeKey] ?? { status: "not-started", pacing: "on-track" };
  }
  function canEdit(yearGroup, stream) {
    if (isCoordinator) return true;
    const asg = getAssignment(yearGroup, stream);
    return asg?.user?.id === user.id || asg?.userId === user.id;
  }

  const NAV_ITEMS = [
    { id: "dashboard",   label: "Dashboard" },
    { id: "yearmap",     label: "Year Map" },
    { id: "sync",        label: "Sync Board" },
    ...(isCoordinator ? [{ id: "staff", label: "Staff" }] : []),
    { id: "assessments", label: "Assessments" },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8faf8" }}>
      {/* Header */}
      <header className="relative overflow-hidden" style={{ backgroundColor: TEAL }}>
        {/* Swoosh corner */}
        <div className="absolute top-0 right-0 w-32 h-16 pointer-events-none overflow-hidden">
          <svg viewBox="0 0 128 56" className="w-full h-full">
            <path d="M128 0 Q80 0 40 30 Q10 48 0 56 L128 56 Z" fill={LIME} opacity="0.15"/>
            <path d="M128 0 Q90 8 60 30 Q30 48 0 56" stroke={LIME} strokeWidth="1.5" fill="none" opacity="0.35"/>
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          {/* Logo + wordmark */}
          <div className="flex items-center gap-3">
            <img src="/logo-mark.svg" alt="Acorn International School" className="h-9 w-auto" />
            <div>
              <span className="font-bold text-white text-lg leading-none" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                Concordance
              </span>
              <div className="h-px w-full mt-0.5" style={{ backgroundColor: LIME, opacity: 0.5 }} />
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-0.5">
            {NAV_ITEMS.map((n) => (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className="px-3 py-1.5 rounded-xl text-sm font-semibold transition-all"
                style={view === n.id
                  ? { backgroundColor: LIME, color: TEAL }
                  : { color: "rgba(255,255,255,0.75)" }
                }
              >
                {n.label}
              </button>
            ))}
          </nav>

          {/* User */}
          <div className="flex items-center gap-2">
            {isCoordinator && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: LIME, color: TEAL }}>
                Coordinator
              </span>
            )}
            {user.image
              ? <img src={user.image} className="w-7 h-7 rounded-full border-2" style={{ borderColor: LIME }} alt="" />
              : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: LIME, color: TEAL }}>
                  {(user.name ?? user.email ?? "?")[0].toUpperCase()}
                </div>
            }
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-xs" style={{ color: "rgba(202,241,4,0.75)" }}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Lime rule under header */}
      <div className="h-0.5 w-full" style={{ backgroundColor: LIME }} />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3" style={{ color: TEAL }}>
              <AcornMark size={28} color={TEAL} />
              <span className="text-sm font-semibold" style={{ fontFamily: "'Fredoka', sans-serif" }}>Loading…</span>
            </div>
          </div>
        ) : (
          <>
            {view === "dashboard"   && <DashboardView month={month} setMonth={setMonth} yFilter={yFilter} setYFilter={setYFilter} getTs={getTs} getAssignment={getAssignment} syncStates={syncStates} onSelectSync={(key) => { setSyncKey(key); setView("sync"); }} onSelectTheme={(theme, yearId) => setDetail({ theme, yearId })} />}
            {view === "yearmap"     && <YearMapView mapYear={mapYear} setMapYear={setMapYear} getTs={getTs} canEdit={canEdit} updateThemeStatus={updateThemeStatus} onSelectTheme={(theme) => setDetail({ theme, yearId: mapYear })} getAssignment={getAssignment} />}
            {view === "sync"        && <SyncBoardView syncYear={syncYear} setSyncYear={setSyncYear} syncKey={syncKey} setSyncKey={setSyncKey} syncStates={syncStates} getTs={getTs} notes={notes} noteInput={noteInput} setNoteInput={setNoteInput} addNote={addNote} updateSync={updateSync} isCoordinator={isCoordinator} getAssignment={getAssignment} month={month} />}
            {view === "staff" && isCoordinator && <StaffView assignments={assignments} users={users} updateAssignment={updateAssignment} />}
            {view === "assessments" && <AssessmentsView month={month} setMonth={setMonth} getTs={getTs} getAssignment={getAssignment} />}
          </>
        )}
      </main>

      {detailTheme && (
        <ThemeDetail theme={detailTheme.theme} yearId={detailTheme.yearId} getTs={getTs} canEdit={canEdit} updateThemeStatus={updateThemeStatus} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'Fredoka', sans-serif", color: TEAL }}>{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function LimePill({ children }) {
  return (
    <span className="inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: LIME, color: TEAL }}>
      {children}
    </span>
  );
}

function YearTab({ year, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 rounded-xl text-sm font-bold transition-all border"
      style={active
        ? { backgroundColor: TEAL, color: "#fff", borderColor: TEAL }
        : { backgroundColor: "#fff", color: TEAL, borderColor: "#d1d5db" }
      }
    >
      Year {year}
    </button>
  );
}

function StatusBadge({ status, onClick, disabled }) {
  const style = statusStyle(status);
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="text-xs font-semibold px-2.5 py-0.5 rounded-full transition-opacity"
      style={{ ...style, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1 }}
    >
      {STATUS_LABELS[status]}
    </button>
  );
}

// ─── DASHBOARD VIEW ───────────────────────────────────────────────────────────

function DashboardView({ month, setMonth, yFilter, setYFilter, getTs, getAssignment, syncStates, onSelectSync, onSelectTheme }) {
  const years = [7, 8, 9].filter((y) => yFilter === "all" || parseInt(yFilter) === y);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Coordination overview — ${month}`}>
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white" style={{ color: TEAL }}>
            {MONTHS.map((m) => <option key={m}>{m}</option>)}
          </select>
          <select value={yFilter} onChange={(e) => setYFilter(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white" style={{ color: TEAL }}>
            <option value="all">All years</option>
            <option value="7">Year 7</option>
            <option value="8">Year 8</option>
            <option value="9">Year 9</option>
          </select>
        </div>
      </PageHeader>

      <div className="space-y-4">
        {years.map((yearId) => {
          const year   = CURRICULUM[yearId];
          const themes = year.themes.filter((t) => periodIncludes(t.period, month));
          if (!themes.length) return (
            <div key={yearId} className="bg-white rounded-2xl border border-gray-100 p-4 text-sm text-gray-400">
              Year {yearId} — no themes in {month}
            </div>
          );
          return themes.map((theme) => {
            const syncK   = `y${yearId}-${theme.id.split("-").slice(1).join("-")}`;
            const sync    = syncStates[syncK] ?? {};
            const britTs  = getTs(`${theme.id}-british`);
            const itTs    = getTs(`${theme.id}-italian`);
            const unaligned = sync.aligned === false && (britTs.pacing === "behind" || itTs.pacing === "behind" || britTs.status !== itTs.status);
            const britAsg = getAssignment(yearId, "british");
            const itAsg   = getAssignment(yearId, "italian");

            return (
              <div key={theme.id} className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1.5px solid ${unaligned ? "#fcd34d" : "#e5e7eb"}` }}>
                {/* Card header */}
                <div className="px-5 py-4 relative overflow-hidden">
                  {/* Tiny swoosh watermark */}
                  <div className="absolute right-2 top-2 opacity-5 pointer-events-none">
                    <AcornMark size={40} color={TEAL} />
                  </div>
                  <div className="flex items-start justify-between gap-4 relative">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <LimePill>Year {yearId}</LimePill>
                        <span className="text-xs text-gray-400">{theme.period}</span>
                        {unaligned && <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full font-semibold">⚠ Needs Attention</span>}
                        {sync.aligned && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "#f2ffd0", color: TEAL, border: `1px solid ${LIME}` }}>✓ Aligned</span>}
                      </div>
                      <h3 className="font-bold text-gray-900 text-base" style={{ fontFamily: "'Fredoka', sans-serif" }}>{theme.british.enquiry}</h3>
                      <p className="text-xs text-gray-400 mt-0.5 italic">{theme.bridgeEnquiry}</p>
                    </div>
                    <button onClick={() => onSelectSync(syncK)} className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors hover:bg-gray-50" style={{ color: TEAL, borderColor: "#d1d5db" }}>
                      Sync →
                    </button>
                  </div>
                </div>

                {/* Lime divider */}
                <div className="h-px mx-5" style={{ backgroundColor: LIME }} />

                {/* Streams */}
                <div className="grid grid-cols-2 divide-x divide-gray-50">
                  {[
                    { stream: "british", ts: britTs, asg: britAsg, data: theme.british, label: "British" },
                    { stream: "italian", ts: itTs,   asg: itAsg,   data: theme.italian, label: "Italian" },
                  ].map(({ stream, ts, asg, data, label }) => (
                    <div key={stream} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold" style={{ color: TEAL }}>{label}</span>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={ts.status} disabled />
                          <span className="text-xs font-semibold" style={PACING_COLORS[ts.pacing] ?? {}}>
                            {ts.pacing === "on-track" ? "On Track" : ts.pacing === "behind" ? "Behind" : "Ahead"}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 leading-snug">{data.title}</p>
                      {asg?.user && <p className="text-xs text-gray-400 mt-1">{asg.user.name ?? asg.user.email}</p>}
                    </div>
                  ))}
                </div>

                {sync.reason && (
                  <div className="px-5 py-2 text-xs font-medium" style={{ backgroundColor: "#fffbeb", color: "#92400e", borderTop: "1px solid #fde68a" }}>
                    {sync.reason}
                  </div>
                )}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}

// ─── YEAR MAP VIEW ────────────────────────────────────────────────────────────

function YearMapView({ mapYear, setMapYear, getTs, canEdit, updateThemeStatus, onSelectTheme, getAssignment }) {
  const year = CURRICULUM[mapYear];
  return (
    <div>
      <PageHeader title="Year Map">
        <div className="flex gap-2">
          {[7, 8, 9].map((y) => <YearTab key={y} year={y} active={mapYear === y} onClick={() => setMapYear(y)} />)}
        </div>
      </PageHeader>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1.5px solid #e5e7eb" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: TEAL }}>
              <th className="text-left py-3 px-4 font-semibold text-xs w-28" style={{ color: LIME }}>Period</th>
              <th className="text-left py-3 px-4 font-semibold text-xs w-1/2" style={{ color: LIME }}>British Stream</th>
              <th className="text-left py-3 px-4 font-semibold text-xs w-1/2" style={{ color: LIME }}>Italian Stream</th>
            </tr>
          </thead>
          <tbody>
            {year.themes.map((theme, i) => {
              const britTs = getTs(`${theme.id}-british`);
              const itTs   = getTs(`${theme.id}-italian`);
              return (
                <tr key={theme.id} style={{ borderTop: i > 0 ? `1px solid #f3f4f6` : "none" }} className="hover:bg-[#f8fffe]">
                  <td className="py-3 px-4 align-top">
                    <span className="text-xs font-semibold" style={{ color: TEAL }}>{theme.period}</span>
                  </td>
                  {["british", "italian"].map((stream) => {
                    const data   = theme[stream];
                    const ts     = stream === "british" ? britTs : itTs;
                    const editable = canEdit(mapYear, stream);
                    const themeKey = `${theme.id}-${stream}`;
                    return (
                      <td key={stream} className="py-3 px-4 align-top">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <button onClick={() => onSelectTheme(theme)} className="text-left font-semibold text-gray-800 hover:underline text-sm leading-snug" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                              {data.title}
                            </button>
                            <p className="text-xs text-gray-400 mt-0.5 italic line-clamp-1">{data.enquiry}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <StatusBadge
                              status={ts.status}
                              disabled={!editable}
                              onClick={() => editable && updateThemeStatus(themeKey, "status", nextStatus(ts.status))}
                            />
                            {editable && (
                              <select
                                value={ts.pacing}
                                onChange={(e) => updateThemeStatus(themeKey, "pacing", e.target.value)}
                                className="text-xs border-0 bg-transparent font-semibold cursor-pointer"
                                style={PACING_COLORS[ts.pacing] ?? {}}
                              >
                                <option value="on-track">On Track</option>
                                <option value="behind">Behind</option>
                                <option value="ahead">Ahead</option>
                              </select>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SYNC BOARD VIEW ─────────────────────────────────────────────────────────

function SyncBoardView({ syncYear, setSyncYear, syncKey, setSyncKey, syncStates, getTs, notes, noteInput, setNoteInput, addNote, updateSync, isCoordinator, getAssignment, month }) {
  const year   = CURRICULUM[syncYear];
  const themes = year.themes;
  const displayTheme = syncKey
    ? themes.find((t) => `y${syncYear}-${t.id.split("-").slice(1).join("-")}` === syncKey)
    : (themes.find((t) => periodIncludes(t.period, month)) ?? themes[0]);
  const displayKey = displayTheme ? `y${syncYear}-${displayTheme.id.split("-").slice(1).join("-")}` : null;
  const sync    = syncStates[displayKey] ?? { aligned: false, reason: null };
  const britTs  = displayTheme ? getTs(`${displayTheme.id}-british`) : null;
  const itTs    = displayTheme ? getTs(`${displayTheme.id}-italian`) : null;
  const noteList = notes[displayKey] ?? [];
  const REASONS = ["Italian stream behind", "British stream behind", "Assessment mismatch", "Pacing divergence", "Resource gap", "Planning not complete"];

  return (
    <div>
      <PageHeader title="Sync Board">
        <div className="flex items-center gap-2">
          {[7, 8, 9].map((y) => <YearTab key={y} year={y} active={syncYear === y} onClick={() => { setSyncYear(y); setSyncKey(null); }} />)}
        </div>
      </PageHeader>

      {/* Theme strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
        {themes.map((t) => {
          const k = `y${syncYear}-${t.id.split("-").slice(1).join("-")}`;
          const active = displayKey === k;
          return (
            <button key={k} onClick={() => setSyncKey(k)}
              className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
              style={active ? { backgroundColor: TEAL, color: "#fff", borderColor: TEAL } : { color: TEAL, borderColor: "#d1d5db", background: "#fff" }}
            >
              {t.period}
            </button>
          );
        })}
      </div>

      {displayTheme && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            {/* Hero banner */}
            <div className="relative rounded-2xl overflow-hidden" style={{ backgroundColor: TEAL }}>
              <div className="absolute top-0 right-0 w-40 h-full pointer-events-none overflow-hidden">
                <svg viewBox="0 0 160 100" className="w-full h-full">
                  <path d="M160 0 Q100 0 60 50 Q30 80 0 100 L160 100 Z" fill={LIME} opacity="0.12"/>
                  <path d="M160 0 Q110 15 75 55 Q40 80 0 100" stroke={LIME} strokeWidth="1.5" fill="none" opacity="0.3"/>
                </svg>
              </div>
              <div className="relative px-5 py-5">
                <div className="flex items-center gap-2 mb-2">
                  <LimePill>Year {syncYear}</LimePill>
                  <span className="text-xs text-green-200">{displayTheme.period}</span>
                </div>
                <h2 className="text-white font-bold text-lg leading-snug" style={{ fontFamily: "'Fredoka', sans-serif" }}>{displayTheme.british.enquiry}</h2>
                <p className="text-sm mt-1 italic" style={{ color: "rgba(202,241,4,0.75)" }}>{displayTheme.bridgeEnquiry}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: LIME, color: TEAL }}>{displayTheme.bridgeConcept}</span>
                </div>
              </div>
            </div>

            {/* Stream panels */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { stream: "british", data: displayTheme.british, ts: britTs, label: "British" },
                { stream: "italian", data: displayTheme.italian, ts: itTs,   label: "Italian" },
              ].map(({ stream, data, ts, label }) => {
                const asg = getAssignment(syncYear, stream);
                return (
                  <div key={stream} className="bg-white rounded-2xl shadow-sm p-4" style={{ border: `1.5px solid #e5e7eb` }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold" style={{ color: TEAL }}>{label}</span>
                      {asg?.user && <span className="text-xs text-gray-400">{asg.user.name ?? asg.user.email}</span>}
                    </div>
                    <div className="h-px mb-3" style={{ backgroundColor: LIME }} />
                    <p className="text-sm font-semibold text-gray-800 mb-1" style={{ fontFamily: "'Fredoka', sans-serif" }}>{data.title}</p>
                    <p className="text-xs text-gray-500 italic mb-3">{data.enquiry}</p>
                    {ts && (
                      <div className="flex items-center gap-2">
                        <StatusBadge status={ts.status} disabled />
                        <span className="text-xs font-semibold" style={PACING_COLORS[ts.pacing] ?? {}}>
                          {ts.pacing === "on-track" ? "On Track" : ts.pacing === "behind" ? "Behind" : "Ahead"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cross-stream connection */}
            <div className="rounded-2xl p-4 text-sm" style={{ backgroundColor: "#f2ffd0", border: `1px solid ${LIME}`, color: TEAL }}>
              <span className="font-bold">Cross-stream: </span>{displayTheme.crossStream}
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Alignment */}
            <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1.5px solid #e5e7eb" }}>
              <h3 className="font-bold text-sm mb-3" style={{ fontFamily: "'Fredoka', sans-serif", color: TEAL }}>Alignment</h3>
              {isCoordinator ? (
                <>
                  <div className="flex gap-2 mb-3">
                    <button onClick={() => updateSync(displayKey, "aligned", true)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold border transition-all"
                      style={sync.aligned ? { backgroundColor: GREEN, color: "#fff", borderColor: GREEN } : { color: TEAL, borderColor: "#d1d5db" }}
                    >✓ Aligned</button>
                    <button onClick={() => updateSync(displayKey, "aligned", false)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold border transition-all"
                      style={!sync.aligned ? { backgroundColor: "#fbbf24", color: "#fff", borderColor: "#fbbf24" } : { color: TEAL, borderColor: "#d1d5db" }}
                    >⚠ Not aligned</button>
                  </div>
                  {!sync.aligned && (
                    <div className="flex flex-wrap gap-1.5">
                      {REASONS.map((r) => (
                        <button key={r} onClick={() => updateSync(displayKey, "reason", r)}
                          className="text-xs px-2.5 py-1 rounded-full font-semibold border transition-all"
                          style={sync.reason === r
                            ? { backgroundColor: LIME, color: TEAL, borderColor: LIME }
                            : { color: TEAL, borderColor: "#d1d5db", background: "#fff" }
                          }
                        >{r}</button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm font-semibold" style={{ color: sync.aligned ? GREEN : "#f59e0b" }}>
                  {sync.aligned ? "✓ Streams are aligned" : "⚠ Needs attention"}
                  {sync.reason && <p className="text-xs text-gray-500 mt-1 font-normal">{sync.reason}</p>}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1.5px solid #e5e7eb" }}>
              <h3 className="font-bold text-sm mb-1" style={{ fontFamily: "'Fredoka', sans-serif", color: TEAL }}>Notes</h3>
              <div className="h-px mb-3" style={{ backgroundColor: LIME }} />
              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                {noteList.length === 0 && <p className="text-xs text-gray-400 italic">No notes yet.</p>}
                {noteList.map((n) => (
                  <div key={n.id} className="text-xs rounded-xl p-2.5" style={{ backgroundColor: "#f8faf8" }}>
                    <p className="font-semibold" style={{ color: TEAL }}>{n.author?.name ?? n.author?.email}</p>
                    <p className="text-gray-600 mt-0.5">{n.content}</p>
                    <p className="text-gray-400 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={noteInput} onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && noteInput.trim()) { addNote(displayKey, noteInput.trim()); setNoteInput(""); } }}
                  placeholder="Add a note…"
                  className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1"
                  style={{ "--tw-ring-color": LIME }}
                />
                <button onClick={() => { if (noteInput.trim()) { addNote(displayKey, noteInput.trim()); setNoteInput(""); } }}
                  disabled={!noteInput.trim()}
                  className="text-xs px-3 py-2 rounded-xl font-bold text-white disabled:opacity-40"
                  style={{ backgroundColor: TEAL }}
                >Add</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STAFF VIEW ───────────────────────────────────────────────────────────────

function StaffView({ assignments, users, updateAssignment }) {
  return (
    <div>
      <PageHeader title="Staff & Assignments" />
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6" style={{ border: "1.5px solid #e5e7eb" }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: TEAL }}>
            <tr>
              {["Year", "British Stream", "Italian Stream"].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold" style={{ color: LIME }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {[7, 8, 9].map((y) => {
              const britAsg = assignments.find((a) => a.yearGroup === y && a.stream === "british");
              const itAsg   = assignments.find((a) => a.yearGroup === y && a.stream === "italian");
              return (
                <tr key={y}>
                  <td className="py-3 px-4"><LimePill>Year {y}</LimePill></td>
                  {[{ asg: britAsg, stream: "british" }, { asg: itAsg, stream: "italian" }].map(({ asg, stream }) => (
                    <td key={stream} className="py-3 px-4">
                      <select
                        value={asg?.userId ?? asg?.user?.id ?? ""}
                        onChange={(e) => updateAssignment(y, stream, e.target.value)}
                        className="text-sm border border-gray-200 rounded-xl px-2 py-1.5 bg-white w-full max-w-xs"
                        style={{ color: TEAL }}
                      >
                        <option value="">Unassigned</option>
                        {users.filter((u) => u.role === "TEACHER").map((u) => (
                          <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="font-bold text-sm mb-3" style={{ fontFamily: "'Fredoka', sans-serif", color: TEAL }}>All Staff</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {users.map((u) => (
          <div key={u.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm" style={{ border: "1.5px solid #e5e7eb" }}>
            {u.image
              ? <img src={u.image} className="w-9 h-9 rounded-full" alt="" />
              : <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: u.role === "COORDINATOR" ? LIME : TEAL, color: u.role === "COORDINATOR" ? TEAL : "#fff" }}>
                  {(u.name ?? u.email ?? "?")[0].toUpperCase()}
                </div>
            }
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate" style={{ fontFamily: "'Fredoka', sans-serif" }}>{u.name ?? u.email}</p>
              <p className="text-xs text-gray-400 capitalize">{u.role.toLowerCase()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ASSESSMENTS VIEW ─────────────────────────────────────────────────────────

function AssessmentsView({ month, setMonth, getTs, getAssignment }) {
  const items = [];
  for (const [yearId, year] of Object.entries(CURRICULUM)) {
    for (const theme of year.themes) {
      for (const stream of ["british", "italian"]) {
        const data = theme[stream];
        const ts   = getTs(`${theme.id}-${stream}`);
        const asg  = getAssignment(parseInt(yearId), stream);
        if (periodIncludes(theme.period, month)) {
          items.push({ yearId: parseInt(yearId), theme, stream, data, ts, asg });
        }
      }
    }
  }

  return (
    <div>
      <PageHeader title="Assessments" subtitle={month}>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white" style={{ color: TEAL }}>
          {MONTHS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </PageHeader>

      {items.length === 0
        ? <p className="text-sm text-gray-400">No assessments in {month}.</p>
        : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={`${item.theme.id}-${item.stream}`} className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1.5px solid #e5e7eb" }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <LimePill>Year {item.yearId}</LimePill>
                      <span className="text-xs font-semibold" style={{ color: TEAL }}>{item.stream === "british" ? "British" : "Italian"}</span>
                      <span className="text-xs text-gray-400">· {item.theme.period}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800" style={{ fontFamily: "'Fredoka', sans-serif" }}>{item.data.assessment}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.data.title}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={item.ts.status} disabled />
                    {item.asg?.user && <span className="text-xs text-gray-400">{item.asg.user.name ?? item.asg.user.email}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

// ─── THEME DETAIL PANEL ───────────────────────────────────────────────────────

function ThemeDetail({ theme, yearId, getTs, canEdit, updateThemeStatus, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-2xl bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="relative overflow-hidden px-6 py-5" style={{ backgroundColor: TEAL }}>
          <div className="absolute top-0 right-0 w-32 h-full pointer-events-none overflow-hidden">
            <svg viewBox="0 0 128 100" className="w-full h-full">
              <path d="M128 0 Q80 0 40 50 Q10 75 0 100 L128 100 Z" fill={LIME} opacity="0.12"/>
            </svg>
          </div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <LimePill>Year {yearId}</LimePill>
                <span className="text-xs text-green-200">{theme.period}</span>
              </div>
              <button onClick={onClose} className="text-green-200 hover:text-white text-2xl leading-none font-light">×</button>
            </div>
            <h2 className="text-white font-bold text-xl leading-snug" style={{ fontFamily: "'Fredoka', sans-serif" }}>{theme.british.enquiry}</h2>
            <p className="text-sm italic mt-1" style={{ color: "rgba(202,241,4,0.8)" }}>{theme.bridgeEnquiry}</p>
            <div className="mt-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: LIME, color: TEAL }}>{theme.bridgeConcept}</span>
            </div>
          </div>
        </div>
        <div className="h-0.5" style={{ backgroundColor: LIME }} />

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-5">
            {["british", "italian"].map((stream) => {
              const data     = theme[stream];
              const ts       = getTs(`${theme.id}-${stream}`);
              const editable = canEdit(yearId, stream);
              const themeKey = `${theme.id}-${stream}`;
              return (
                <div key={stream}>
                  <h3 className="font-bold text-sm mb-1" style={{ fontFamily: "'Fredoka', sans-serif", color: TEAL }}>
                    {stream === "british" ? "British" : "Italian"} Stream
                  </h3>
                  <div className="h-0.5 mb-3" style={{ backgroundColor: LIME }} />
                  <p className="font-semibold text-gray-800 text-sm mb-1" style={{ fontFamily: "'Fredoka', sans-serif" }}>{data.title}</p>
                  <p className="text-xs text-gray-500 italic mb-3">{data.enquiry}</p>

                  {editable && (
                    <div className="flex items-center gap-2 mb-3">
                      <StatusBadge status={ts.status} onClick={() => updateThemeStatus(themeKey, "status", nextStatus(ts.status))} />
                      <select value={ts.pacing} onChange={(e) => updateThemeStatus(themeKey, "pacing", e.target.value)}
                        className="text-xs border-0 bg-transparent font-semibold cursor-pointer"
                        style={PACING_COLORS[ts.pacing] ?? {}}
                      >
                        <option value="on-track">On Track</option>
                        <option value="behind">Behind</option>
                        <option value="ahead">Ahead</option>
                      </select>
                    </div>
                  )}

                  {[["Topics", data.topics], ["Knowledge", data.knowledge], ["Skills", data.skills]].map(([label, items]) => (
                    <div key={label} className="mb-2">
                      <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: TEAL }}>{label}</p>
                      <ul className="text-xs text-gray-600 space-y-0.5">
                        {items.map((item) => <li key={item} className="leading-snug">· {item}</li>)}
                      </ul>
                    </div>
                  ))}

                  <div className="mt-2">
                    <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: TEAL }}>Assessment</p>
                    <p className="text-xs text-gray-600">{data.assessment}</p>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {data.vocab?.en?.map((w, i) => (
                      <span key={w} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#f2ffd0", color: TEAL, border: `1px solid ${LIME}` }}>
                        {w}{data.vocab.it?.[i] ? ` / ${data.vocab.it[i]}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl p-4 text-sm" style={{ backgroundColor: "#f2ffd0", border: `1px solid ${LIME}`, color: TEAL }}>
            <p className="font-bold text-xs uppercase tracking-wide mb-1">Cross-stream connection</p>
            <p>{theme.crossStream}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
