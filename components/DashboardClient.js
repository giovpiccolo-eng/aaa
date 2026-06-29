"use client";
import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import { CURRICULUM, MONTHS, periodIncludes } from "@/lib/curriculum";

const NAVY = "#1e2d5a";
const GOLD = "#c9a84c";
const STATUS_CYCLE = ["not-started", "planning", "ready", "teaching", "complete"];
const STATUS_LABELS = { "not-started": "Not Started", planning: "Planning", ready: "Ready", teaching: "Teaching", complete: "Complete" };
const STATUS_COLORS = {
  "not-started": "bg-gray-100 text-gray-500",
  planning: "bg-amber-50 text-amber-700 border border-amber-200",
  ready: "bg-blue-50 text-blue-700 border border-blue-200",
  teaching: "bg-green-50 text-green-700 border border-green-200",
  complete: "bg-purple-50 text-purple-600 border border-purple-200",
};
const PACING_COLORS = {
  "on-track": "text-green-600",
  behind: "text-red-500",
  ahead: "text-blue-500",
};

function nextStatus(s) {
  return STATUS_CYCLE[(STATUS_CYCLE.indexOf(s) + 1) % STATUS_CYCLE.length];
}

export function DashboardClient({ user }) {
  const isCoordinator = user.role === "COORDINATOR";

  const [view, setView] = useState("dashboard");
  const [month, setMonth] = useState("November");
  const [yFilter, setYFilter] = useState("all");
  const [mapYear, setMapYear] = useState(7);
  const [syncYear, setSyncYear] = useState(7);
  const [syncKey, setSyncKey] = useState(null);
  const [detailTheme, setDetail] = useState(null);

  // Server state
  const [themeStatus, setThemeStatus] = useState({});
  const [syncStates, setSyncStates] = useState({});
  const [notes, setNotes] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [noteInput, setNoteInput] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [tsRes, syncRes, asgRes] = await Promise.all([
      fetch("/api/theme-status"),
      fetch("/api/sync"),
      fetch("/api/assignments"),
    ]);
    const [ts, sync, asg] = await Promise.all([tsRes.json(), syncRes.json(), asgRes.json()]);
    setThemeStatus(ts);
    setSyncStates(sync);
    setAssignments(Array.isArray(asg) ? asg : []);
    if (isCoordinator) {
      const uRes = await fetch("/api/users");
      const u = await uRes.json();
      setUsers(Array.isArray(u) ? u : []);
    }
    setLoading(false);
  }, [isCoordinator]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchNotes = useCallback(async (key) => {
    const res = await fetch(`/api/notes?syncKey=${key}`);
    const data = await res.json();
    setNotes((prev) => ({ ...prev, [key]: Array.isArray(data) ? data : [] }));
  }, []);

  useEffect(() => {
    if (syncKey) fetchNotes(syncKey);
  }, [syncKey, fetchNotes]);

  async function updateThemeStatus(themeKey, field, value) {
    const current = themeStatus[themeKey] ?? { status: "not-started", pacing: "on-track" };
    const updated = { ...current, [field]: value };
    setThemeStatus((prev) => ({ ...prev, [themeKey]: updated }));
    await fetch("/api/theme-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themeKey, ...updated }),
    });
  }

  async function updateSync(key, field, value) {
    const current = syncStates[key] ?? { aligned: false, reason: null };
    const updated = { ...current, [field]: value };
    setSyncStates((prev) => ({ ...prev, [key]: updated }));
    await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncKey: key, ...updated }),
    });
  }

  async function addNote(key, content) {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncKey: key, content }),
    });
    const note = await res.json();
    setNotes((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), note] }));
  }

  async function updateAssignment(yearGroup, stream, userId) {
    setAssignments((prev) =>
      prev.map((a) =>
        a.yearGroup === yearGroup && a.stream === stream ? { ...a, userId } : a
      )
    );
    await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  // ─── VIEWS ────────────────────────────────────────────────────────────────

  const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard" },
    { id: "yearmap", label: "Year Map" },
    { id: "sync", label: "Sync Board" },
    ...(isCoordinator ? [{ id: "staff", label: "Staff & Assignments" }] : []),
    { id: "assessments", label: "Assessments" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header style={{ backgroundColor: NAVY }} className="text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <span className="font-bold text-lg tracking-wide">Concordance</span>
          <span className="text-xs text-blue-200 hidden sm:block">Acorn International School</span>
        </div>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                view === n.id ? "bg-white/20 text-white" : "text-blue-100 hover:bg-white/10"
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {isCoordinator && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: GOLD, color: NAVY }}>
              Coordinator
            </span>
          )}
          <div className="flex items-center gap-2">
            {user.image ? (
              <img src={user.image} className="w-7 h-7 rounded-full" alt="" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-400 flex items-center justify-center text-xs font-bold">
                {(user.name ?? user.email ?? "?")[0].toUpperCase()}
              </div>
            )}
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-xs text-blue-200 hover:text-white">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
        ) : (
          <>
            {view === "dashboard" && (
              <DashboardView
                month={month} setMonth={setMonth}
                yFilter={yFilter} setYFilter={setYFilter}
                getTs={getTs} getAssignment={getAssignment}
                syncStates={syncStates}
                onSelectSync={(key) => { setSyncKey(key); setView("sync"); }}
                onSelectTheme={(theme, yearId) => setDetail({ theme, yearId })}
              />
            )}
            {view === "yearmap" && (
              <YearMapView
                mapYear={mapYear} setMapYear={setMapYear}
                getTs={getTs} canEdit={canEdit}
                updateThemeStatus={updateThemeStatus}
                onSelectTheme={(theme) => setDetail({ theme, yearId: mapYear })}
                getAssignment={getAssignment}
              />
            )}
            {view === "sync" && (
              <SyncBoardView
                syncYear={syncYear} setSyncYear={setSyncYear}
                syncKey={syncKey} setSyncKey={setSyncKey}
                syncStates={syncStates} getTs={getTs}
                notes={notes} noteInput={noteInput} setNoteInput={setNoteInput}
                addNote={addNote} updateSync={updateSync}
                isCoordinator={isCoordinator}
                getAssignment={getAssignment}
                month={month}
              />
            )}
            {view === "staff" && isCoordinator && (
              <StaffView
                assignments={assignments} users={users}
                updateAssignment={updateAssignment}
              />
            )}
            {view === "assessments" && (
              <AssessmentsView
                month={month} setMonth={setMonth}
                getTs={getTs} getAssignment={getAssignment}
              />
            )}
          </>
        )}
      </main>

      {/* Theme detail panel */}
      {detailTheme && (
        <ThemeDetail
          theme={detailTheme.theme}
          yearId={detailTheme.yearId}
          getTs={getTs}
          canEdit={canEdit}
          updateThemeStatus={updateThemeStatus}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

// ─── DASHBOARD VIEW ──────────────────────────────────────────────────────────

function DashboardView({ month, setMonth, yFilter, setYFilter, getTs, getAssignment, syncStates, onSelectSync, onSelectTheme }) {
  const years = [7, 8, 9].filter((y) => yFilter === "all" || parseInt(yFilter) === y);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Coordination overview — {month}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            {MONTHS.map((m) => <option key={m}>{m}</option>)}
          </select>
          <select
            value={yFilter}
            onChange={(e) => setYFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="all">All years</option>
            <option value="7">Year 7</option>
            <option value="8">Year 8</option>
            <option value="9">Year 9</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {years.map((yearId) => {
          const year = CURRICULUM[yearId];
          const themes = year.themes.filter((t) => periodIncludes(t.period, month));
          if (!themes.length) return (
            <div key={yearId} className="bg-white rounded-xl border border-gray-100 p-4 text-sm text-gray-400">
              Year {yearId} — no themes in {month}
            </div>
          );
          return themes.map((theme) => {
            const syncK = `y${yearId}-${theme.id.split("-").slice(1).join("-")}`;
            const sync = syncStates[syncK] ?? { aligned: null };
            const britTs = getTs(`${theme.id}-british`);
            const itTs = getTs(`${theme.id}-italian`);
            const needsAttention = !sync.aligned && sync.aligned !== null && (
              britTs.pacing === "behind" || itTs.pacing === "behind" ||
              britTs.status !== itTs.status
            );

            const britAsg = getAssignment(yearId, "british");
            const itAsg = getAssignment(yearId, "italian");

            return (
              <div key={theme.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-400">Year {yearId}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{theme.period}</span>
                      {needsAttention && (
                        <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full font-medium">
                          ⚠ Needs Attention
                        </span>
                      )}
                      {sync.aligned && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#fef3cd", color: "#92660a" }}>
                          ✓ Aligned
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 mt-1">{theme.british.enquiry}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 italic">{theme.bridgeEnquiry}</p>
                  </div>
                  <button
                    onClick={() => onSelectSync(syncK)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
                  >
                    Sync Board →
                  </button>
                </div>

                <div className="border-t border-gray-50 grid grid-cols-2 divide-x divide-gray-50">
                  {[
                    { stream: "british", ts: britTs, asg: britAsg, streamData: theme.british, label: "British" },
                    { stream: "italian", ts: itTs, asg: itAsg, streamData: theme.italian, label: "Italian" },
                  ].map(({ stream, ts, asg, streamData, label }) => (
                    <div key={stream} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium" style={{ color: stream === "british" ? NAVY : GOLD }}>
                          {label}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[ts.status]}`}>
                            {STATUS_LABELS[ts.status]}
                          </span>
                          <span className={`text-xs font-medium ${PACING_COLORS[ts.pacing]}`}>
                            {ts.pacing === "on-track" ? "On Track" : ts.pacing === "behind" ? "Behind" : "Ahead"}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 leading-snug">{streamData.title}</p>
                      {asg?.user && (
                        <p className="text-xs text-gray-400 mt-1">{asg.user.name ?? asg.user.email}</p>
                      )}
                    </div>
                  ))}
                </div>

                {sync.reason && (
                  <div className="px-5 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-700">
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Year Map</h1>
        <div className="flex gap-2">
          {[7, 8, 9].map((y) => (
            <button
              key={y}
              onClick={() => setMapYear(y)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                mapYear === y ? "text-white border-transparent" : "text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
              style={mapYear === y ? { backgroundColor: NAVY } : {}}
            >
              Year {y}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 font-medium text-gray-500 w-28">Period</th>
              <th className="text-left py-2 px-3 font-medium w-1/2" style={{ color: NAVY }}>British Stream</th>
              <th className="text-left py-2 px-3 font-medium w-1/2" style={{ color: GOLD }}>Italian Stream</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {year.themes.map((theme) => {
              const britTs = getTs(`${theme.id}-british`);
              const itTs = getTs(`${theme.id}-italian`);
              const britCanEdit = canEdit(mapYear, "british");
              const itCanEdit = canEdit(mapYear, "italian");

              return (
                <tr key={theme.id} className="hover:bg-gray-50/50">
                  <td className="py-3 px-3 align-top">
                    <span className="text-xs text-gray-400 font-medium">{theme.period}</span>
                  </td>
                  {["british", "italian"].map((stream) => {
                    const data = theme[stream];
                    const ts = stream === "british" ? britTs : itTs;
                    const editable = stream === "british" ? britCanEdit : itCanEdit;
                    const themeKey = `${theme.id}-${stream}`;

                    return (
                      <td key={stream} className="py-3 px-3 align-top">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => onSelectTheme(theme)}
                              className="text-left font-medium text-gray-800 hover:underline text-sm leading-snug"
                            >
                              {data.title}
                            </button>
                            <p className="text-xs text-gray-500 mt-0.5 italic line-clamp-1">{data.enquiry}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <button
                              disabled={!editable}
                              onClick={() => editable && updateThemeStatus(themeKey, "status", nextStatus(ts.status))}
                              className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[ts.status]} ${editable ? "cursor-pointer hover:opacity-80" : "opacity-60 cursor-default"}`}
                            >
                              {STATUS_LABELS[ts.status]}
                            </button>
                            {editable && (
                              <select
                                value={ts.pacing}
                                onChange={(e) => updateThemeStatus(themeKey, "pacing", e.target.value)}
                                className={`text-xs border-0 bg-transparent font-medium ${PACING_COLORS[ts.pacing]} cursor-pointer`}
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
  const year = CURRICULUM[syncYear];
  const themes = year.themes;

  const activeTheme = syncKey
    ? themes.find((t) => `y${syncYear}-${t.id.split("-").slice(1).join("-")}` === syncKey)
    : themes.find((t) => periodIncludes(t.period, month)) ?? themes[0];
  const activeKey = activeTheme ? `y${syncYear}-${activeTheme.id.split("-").slice(1).join("-")}` : null;
  const displayKey = syncKey ?? activeKey;
  const displayTheme = syncKey ? activeTheme : (themes.find((t) => periodIncludes(t.period, month)) ?? themes[0]);

  const sync = syncStates[displayKey] ?? { aligned: false, reason: null };
  const britTs = displayTheme ? getTs(`${displayTheme.id}-british`) : null;
  const itTs = displayTheme ? getTs(`${displayTheme.id}-italian`) : null;
  const noteList = notes[displayKey] ?? [];

  const REASONS = ["Italian stream behind", "British stream behind", "Assessment mismatch", "Pacing divergence", "Resource gap", "Planning not complete"];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sync Board</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[7, 8, 9].map((y) => (
              <button
                key={y}
                onClick={() => { setSyncYear(y); setSyncKey(null); }}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium border ${syncYear === y ? "text-white border-transparent" : "text-gray-600 border-gray-200"}`}
                style={syncYear === y ? { backgroundColor: NAVY } : {}}
              >
                Y{y}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Theme picker */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {themes.map((t) => {
          const k = `y${syncYear}-${t.id.split("-").slice(1).join("-")}`;
          const active = displayKey === k;
          return (
            <button
              key={k}
              onClick={() => setSyncKey(k)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? "text-white border-transparent" : "text-gray-600 border-gray-200 hover:bg-gray-50"}`}
              style={active ? { backgroundColor: NAVY } : {}}
            >
              {t.period}
            </button>
          );
        })}
      </div>

      {displayTheme && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: stream panels */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm" style={{ backgroundColor: NAVY }}>
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-blue-300 mb-1">{displayTheme.period} · Year {syncYear}</p>
                <h2 className="text-white font-bold text-lg leading-snug">{displayTheme.british.enquiry}</h2>
                <p className="text-blue-200 text-sm mt-1 italic">{displayTheme.bridgeEnquiry}</p>
              </div>
              <div className="px-5 py-2 bg-white/10 flex items-center gap-2">
                <span className="text-xs text-blue-100">Bridge concept:</span>
                <span className="text-xs font-semibold text-white">{displayTheme.bridgeConcept}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { stream: "british", data: displayTheme.british, ts: britTs, label: "British Stream", color: NAVY },
                { stream: "italian", data: displayTheme.italian, ts: itTs, label: "Italian Stream", color: GOLD },
              ].map(({ stream, data, ts, label, color }) => {
                const asg = getAssignment(syncYear, stream);
                return (
                  <div key={stream} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold" style={{ color }}>{label}</span>
                      {asg?.user && (
                        <span className="text-xs text-gray-400">{asg.user.name ?? asg.user.email}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-800 mb-2">{data.title}</p>
                    <p className="text-xs text-gray-500 italic mb-3">{data.enquiry}</p>
                    {ts && (
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[ts.status]}`}>{STATUS_LABELS[ts.status]}</span>
                        <span className={`text-xs font-medium ${PACING_COLORS[ts.pacing]}`}>
                          {ts.pacing === "on-track" ? "On Track" : ts.pacing === "behind" ? "Behind" : "Ahead"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
              <span className="font-medium">Cross-stream connection: </span>
              {displayTheme.crossStream}
            </div>
          </div>

          {/* Right: sync controls + notes */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Alignment</h3>
              {isCoordinator ? (
                <>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => updateSync(displayKey, "aligned", true)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${sync.aligned ? "text-white border-transparent" : "text-gray-600 border-gray-200"}`}
                      style={sync.aligned ? { backgroundColor: "#16a34a" } : {}}
                    >
                      ✓ Aligned
                    </button>
                    <button
                      onClick={() => updateSync(displayKey, "aligned", false)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${!sync.aligned ? "text-white border-transparent bg-amber-500" : "text-gray-600 border-gray-200"}`}
                    >
                      ⚠ Not aligned
                    </button>
                  </div>
                  {!sync.aligned && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {REASONS.map((r) => (
                        <button
                          key={r}
                          onClick={() => updateSync(displayKey, "reason", r)}
                          className={`text-xs px-2 py-1 rounded-full border transition-colors ${sync.reason === r ? "text-white border-transparent bg-amber-500" : "text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className={`text-sm font-medium ${sync.aligned ? "text-green-600" : "text-amber-600"}`}>
                  {sync.aligned ? "✓ Streams are aligned" : "⚠ Streams need attention"}
                  {sync.reason && <p className="text-xs text-gray-500 mt-1 font-normal">{sync.reason}</p>}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Coordination Notes</h3>
              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                {noteList.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No notes yet.</p>
                )}
                {noteList.map((n) => (
                  <div key={n.id} className="text-xs bg-gray-50 rounded-lg p-2.5">
                    <p className="font-medium text-gray-700">{n.author?.name ?? n.author?.email}</p>
                    <p className="text-gray-600 mt-0.5">{n.content}</p>
                    <p className="text-gray-400 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && noteInput.trim()) {
                      addNote(displayKey, noteInput.trim());
                      setNoteInput("");
                    }
                  }}
                  placeholder="Add a note…"
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
                <button
                  onClick={() => { if (noteInput.trim()) { addNote(displayKey, noteInput.trim()); setNoteInput(""); } }}
                  disabled={!noteInput.trim()}
                  className="text-xs px-3 py-2 rounded-lg text-white disabled:opacity-40"
                  style={{ backgroundColor: NAVY }}
                >
                  Add
                </button>
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Staff & Assignments</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: NAVY }}>
            <tr>
              <th className="text-left py-3 px-4 text-white font-medium text-xs">Year</th>
              <th className="text-left py-3 px-4 text-white font-medium text-xs">British Stream</th>
              <th className="text-left py-3 px-4 text-white font-medium text-xs">Italian Stream</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {[7, 8, 9].map((y) => {
              const britAsg = assignments.find((a) => a.yearGroup === y && a.stream === "british");
              const itAsg = assignments.find((a) => a.yearGroup === y && a.stream === "italian");
              return (
                <tr key={y}>
                  <td className="py-3 px-4 font-medium text-gray-700">Year {y}</td>
                  {[
                    { asg: britAsg, stream: "british" },
                    { asg: itAsg, stream: "italian" },
                  ].map(({ asg, stream }) => (
                    <td key={stream} className="py-3 px-4">
                      <select
                        value={asg?.userId ?? asg?.user?.id ?? ""}
                        onChange={(e) => updateAssignment(y, stream, e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white w-full max-w-xs"
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

      <div className="mt-6">
        <h2 className="font-semibold text-gray-700 mb-3 text-sm">All Staff</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {users.map((u) => (
            <div key={u.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
              {u.image ? (
                <img src={u.image} className="w-9 h-9 rounded-full" alt="" />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: u.role === "COORDINATOR" ? GOLD : NAVY }}>
                  {(u.name ?? u.email ?? "?")[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{u.name ?? u.email}</p>
                <p className="text-xs text-gray-400 capitalize">{u.role.toLowerCase()}</p>
              </div>
            </div>
          ))}
        </div>
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
        const ts = getTs(`${theme.id}-${stream}`);
        const asg = getAssignment(parseInt(yearId), stream);
        items.push({ yearId: parseInt(yearId), theme, stream, data, ts, asg, period: theme.period });
      }
    }
  }

  const monthItems = items.filter((i) => periodIncludes(i.period, month));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          {MONTHS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>

      {monthItems.length === 0 ? (
        <p className="text-gray-400 text-sm">No assessments in {month}.</p>
      ) : (
        <div className="space-y-3">
          {monthItems.map((item) => (
            <div key={`${item.theme.id}-${item.stream}`} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium" style={{ color: item.stream === "british" ? NAVY : GOLD }}>
                      Year {item.yearId} · {item.stream === "british" ? "British" : "Italian"}
                    </span>
                    <span className="text-xs text-gray-400">· {item.period}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800">{item.data.assessment}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.data.title}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[item.ts.status]}`}>
                    {STATUS_LABELS[item.ts.status]}
                  </span>
                  {item.asg?.user && (
                    <span className="text-xs text-gray-400">{item.asg.user.name ?? item.asg.user.email}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── THEME DETAIL PANEL ───────────────────────────────────────────────────────

function ThemeDetail({ theme, yearId, getTs, canEdit, updateThemeStatus, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-2xl bg-white shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 text-white" style={{ backgroundColor: NAVY }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-blue-300">Year {yearId} · {theme.period}</span>
            <button onClick={onClose} className="text-blue-200 hover:text-white text-lg leading-none">×</button>
          </div>
          <h2 className="text-xl font-bold">{theme.british.enquiry}</h2>
          <p className="text-sm text-blue-200 mt-1 italic">{theme.bridgeEnquiry}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-blue-300">Bridge:</span>
            <span className="text-xs font-semibold text-white">{theme.bridgeConcept}</span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {["british", "italian"].map((stream) => {
              const data = theme[stream];
              const ts = getTs(`${theme.id}-${stream}`);
              const editable = canEdit(yearId, stream);
              const themeKey = `${theme.id}-${stream}`;
              return (
                <div key={stream}>
                  <h3 className="font-bold text-sm mb-3" style={{ color: stream === "british" ? NAVY : GOLD }}>
                    {stream === "british" ? "British" : "Italian"} Stream
                  </h3>
                  <p className="font-medium text-gray-800 text-sm mb-1">{data.title}</p>
                  <p className="text-xs text-gray-500 italic mb-3">{data.enquiry}</p>

                  {editable && (
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => updateThemeStatus(themeKey, "status", nextStatus(ts.status))}
                        className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[ts.status]}`}
                      >
                        {STATUS_LABELS[ts.status]}
                      </button>
                      <select
                        value={ts.pacing}
                        onChange={(e) => updateThemeStatus(themeKey, "pacing", e.target.value)}
                        className={`text-xs border-0 bg-transparent font-medium ${PACING_COLORS[ts.pacing]}`}
                      >
                        <option value="on-track">On Track</option>
                        <option value="behind">Behind</option>
                        <option value="ahead">Ahead</option>
                      </select>
                    </div>
                  )}

                  {[
                    ["Topics", data.topics],
                    ["Knowledge", data.knowledge],
                    ["Skills", data.skills],
                  ].map(([label, items]) => (
                    <div key={label} className="mb-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                      <ul className="text-xs text-gray-600 space-y-0.5">
                        {items.map((item) => <li key={item} className="leading-snug">· {item}</li>)}
                      </ul>
                    </div>
                  ))}

                  <div className="mt-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Assessment</p>
                    <p className="text-xs text-gray-600">{data.assessment}</p>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {data.vocab?.en?.map((w, i) => (
                      <span key={w} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {w}{data.vocab.it?.[i] ? ` / ${data.vocab.it[i]}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Cross-stream connection</p>
            <p className="text-sm text-amber-800">{theme.crossStream}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
