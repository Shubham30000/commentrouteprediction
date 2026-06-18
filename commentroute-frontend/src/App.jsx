import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const TEAMS = [
  "Customer Success",
  "Engineering & Platform",
  "Product Team",
  "Compliance & HR Escalation",
];

const TEAM_COLOR = {
  "Customer Success":          "#0ea5e9",
  "Engineering & Platform":    "#8b5cf6",
  "Product Team":              "#10b981",
  "Compliance & HR Escalation":"#ef4444",
  "Customer Success / HR General": "#0ea5e9",
};

const PRIORITY_STYLE = {
  Normal:   { bg:"#f0fdf4", text:"#15803d", border:"#86efac" },
  High:     { bg:"#fffbeb", text:"#b45309", border:"#fcd34d" },
  Critical: { bg:"#fef2f2", text:"#b91c1c", border:"#fca5a5" },
};

const STATUS_STYLE = {
  "Open":        { bg:"#eff6ff", text:"#1d4ed8", border:"#bfdbfe" },
  "In Progress": { bg:"#faf5ff", text:"#7c3aed", border:"#ddd6fe" },
  "Resolved":    { bg:"#f0fdf4", text:"#15803d", border:"#86efac" },
};

const ADMIN_CREDS = { email:"admin@commentroute.com", password:"admin123" };

/* ─── tiny shared components ─────────────────────────────────────────── */

function Badge({ label, type="status" }) {
  const map = type==="priority" ? PRIORITY_STYLE : STATUS_STYLE;
  const c   = map[label] || { bg:"#f3f4f6", text:"#374151", border:"#d1d5db" };
  return (
    <span style={{ background:c.bg, color:c.text, border:`1px solid ${c.border}`,
      borderRadius:6, padding:"2px 9px", fontSize:12, fontWeight:500, whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

function TeamDot({ team }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:13, color:"#374151" }}>
      <span style={{ width:8, height:8, borderRadius:"50%",
        background: TEAM_COLOR[team]||"#9ca3af", flexShrink:0 }} />
      {team}
    </span>
  );
}

function Spinner() {
  return (
    <span style={{ display:"inline-block", width:15, height:15,
      border:"2px solid #e5e7eb", borderTopColor:"#6366f1",
      borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #f3f4f6", borderRadius:12,
      padding:"1rem 1.25rem", borderLeft:`3px solid ${accent||"#e5e7eb"}` }}>
      <p style={{ fontSize:11, color:"#9ca3af", margin:"0 0 6px", fontWeight:600,
        letterSpacing:"0.06em", textTransform:"uppercase" }}>{label}</p>
      <p style={{ fontSize:26, fontWeight:700, margin:"0 0 2px", color:"#111827", lineHeight:1 }}>
        {value ?? "—"}
      </p>
      {sub && <p style={{ fontSize:11, color:"#9ca3af", margin:0 }}>{sub}</p>}
    </div>
  );
}

function BarChart({ data, colorMap }) {
  if (!data?.length) return <p style={{ fontSize:13, color:"#9ca3af" }}>No data yet</p>;
  const max = Math.max(...data.map(d=>d.count), 1);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {data.map(d => (
        <div key={d.team||d.label_name} style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:12, color:"#6b7280", width:170, flexShrink:0,
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
            {d.team||d.label_name}
          </span>
          <div style={{ flex:1, background:"#f3f4f6", borderRadius:4, height:10, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${(d.count/max)*100}%`,
              background: colorMap?.[d.team]||"#6366f1", borderRadius:4,
              transition:"width 0.5s ease" }} />
          </div>
          <span style={{ fontSize:12, fontWeight:600, color:"#111827", width:24, textAlign:"right" }}>
            {d.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data }) {
  if (!data?.length) return <p style={{ fontSize:13, color:"#9ca3af" }}>No data yet</p>;
  const total  = data.reduce((s,d)=>s+d.count,0);
  const colors = ["#6366f1","#10b981"];
  const r=42, cx=56, cy=56, circ=2*Math.PI*r;
  let offset=0;
  const slices = data.map((d,i)=>{
    const dash = (d.count/total)*circ;
    const s = { ...d, dash, offset, color:colors[i%colors.length] };
    offset += dash;
    return s;
  });
  return (
    <div style={{ display:"flex", alignItems:"center", gap:24 }}>
      <svg width={112} height={112} viewBox="0 0 112 112">
        {slices.map((s,i)=>(
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={14}
            strokeDasharray={`${s.dash} ${circ-s.dash}`}
            strokeDashoffset={-s.offset+circ/4}
            style={{ transition:"stroke-dasharray 0.5s" }} />
        ))}
        <text x={cx} y={cy+5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#111827">
          {total}
        </text>
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {slices.map((s,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
            <span style={{ width:10, height:10, borderRadius:"50%", background:s.color, flexShrink:0 }} />
            <span style={{ color:"#374151" }}>{s.source_type?.replace("_"," ")||s.team}</span>
            <span style={{ color:"#9ca3af", marginLeft:"auto" }}>
              {Math.round((s.count/total)*100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── sidebar layout ─────────────────────────────────────────────────── */

function Sidebar({ role, activePage, onNav, name, onLogout }) {
  const roleColor = role==="admin" ? "#8b5cf6" : role==="employee" ? "#0ea5e9" : "#10b981";
  const roleLabel = role==="admin" ? "Admin" : role==="employee" ? "Employee" : "Customer";

  const navSections = role==="admin" ? [
    { heading:"Monitor", items:[
      { id:"overview",   label:"Overview",         icon:"📊" },
      { id:"tickets",    label:"All tickets",       icon:"🎫" },
      { id:"analytics",  label:"Model analytics",   icon:"🔬" },
    ]},
  ] : role==="employee" ? [
    { heading:"Reports", items:[
      { id:"submit",     label:"Submit report",     icon:"📝" },
      { id:"history",    label:"My reports",        icon:"📋" },
    ]},
  ] : [
    { heading:"Feedback", items:[
      { id:"submit",     label:"Submit feedback",   icon:"💬" },
      { id:"history",    label:"My tickets",        icon:"📋" },
    ]},
  ];

  return (
    <div style={{ width:220, minHeight:"100vh", background:"#fff",
      borderRight:"1px solid #f3f4f6", display:"flex", flexDirection:"column",
      padding:"0", flexShrink:0, position:"sticky", top:0 }}>

      <div style={{ padding:"1.25rem 1.25rem 1rem", borderBottom:"1px solid #f3f4f6" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:30, height:30, borderRadius:9,
            background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ color:"#fff", fontSize:13, fontWeight:700 }}>CR</span>
          </div>
          <div>
            <p style={{ fontWeight:700, fontSize:14, color:"#111827", margin:0, letterSpacing:"-0.02em" }}>
              CommentRoute
            </p>
            <p style={{ fontSize:10, color:"#9ca3af", margin:0 }}>Feedback triage</p>
          </div>
        </div>
      </div>

      <div style={{ padding:"1rem 1rem 0.5rem" }}>
        <div style={{ background: roleColor+"12", borderRadius:8, padding:"8px 12px",
          display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:"50%", background: roleColor+"25",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:12, fontWeight:600, color:roleColor }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow:"hidden" }}>
            <p style={{ fontSize:13, fontWeight:500, color:"#111827", margin:0,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</p>
            <p style={{ fontSize:11, color:roleColor, margin:0, fontWeight:500 }}>{roleLabel}</p>
          </div>
        </div>
      </div>

      <nav style={{ flex:1, padding:"0.5rem 0.75rem" }}>
        {navSections.map(section=>(
          <div key={section.heading} style={{ marginBottom:"1rem" }}>
            <p style={{ fontSize:10, fontWeight:600, color:"#d1d5db", letterSpacing:"0.08em",
              textTransform:"uppercase", padding:"0 8px", margin:"0 0 4px" }}>
              {section.heading}
            </p>
            {section.items.map(item=>(
              <button key={item.id} onClick={()=>onNav(item.id)}
                style={{ display:"flex", alignItems:"center", gap:8, width:"100%",
                  padding:"8px 10px", borderRadius:8, border:"none",
                  background: activePage===item.id ? "#f5f3ff" : "transparent",
                  color: activePage===item.id ? "#7c3aed" : "#6b7280",
                  fontSize:13, fontWeight: activePage===item.id ? 600 : 400,
                  cursor:"pointer", textAlign:"left", transition:"all 0.1s" }}>
                <span style={{ fontSize:15 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div style={{ padding:"1rem", borderTop:"1px solid #f3f4f6" }}>
        <button onClick={onLogout}
          style={{ display:"flex", alignItems:"center", gap:8, width:"100%",
            padding:"8px 10px", borderRadius:8, border:"none", background:"transparent",
            color:"#9ca3af", fontSize:13, cursor:"pointer" }}>
          <span>↩</span> Sign out
        </button>
      </div>
    </div>
  );
}

function AppShell({ role, name, onLogout, children, activePage, onNav }) {
  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#fafafa",
      fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        input,textarea,select,button{font-family:inherit;}
        .tr-hover:hover{background:#f9fafb!important;}
        .nav-btn:hover{background:#f3f4f6!important;}
      `}</style>
      <Sidebar role={role} activePage={activePage} onNav={onNav} name={name} onLogout={onLogout} />
      <main style={{ flex:1, padding:"2rem", overflowX:"hidden" }}>
        {children}
      </main>
    </div>
  );
}

/* ─── login ──────────────────────────────────────────────────────────── */

function LoginPage({ onLogin }) {
  const [mode,    setMode]    = useState("select"); // select | customer | employee | admin
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [err,     setErr]     = useState("");

  const handleAdminLogin = () => {
    if (email===ADMIN_CREDS.email && pass===ADMIN_CREDS.password) {
      onLogin("admin","Admin");
    } else {
      setErr("Invalid credentials.");
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#fafafa", fontFamily:"'Inter',system-ui,sans-serif",
      display:"flex", alignItems:"center", justifyContent:"center", padding:"2rem" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        input,button{font-family:inherit;}
        .portal-card{transition:border-color 0.15s,background 0.15s;cursor:pointer;}
        .portal-card:hover{border-color:#a5b4fc!important;background:#fafbff!important;}
      `}</style>

      <div style={{ animation:"fadeIn 0.4s ease", width:"100%", maxWidth:480 }}>
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ width:52, height:52, borderRadius:15,
            background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            display:"flex", alignItems:"center", justifyContent:"center",
            margin:"0 auto 1rem" }}>
            <span style={{ color:"#fff", fontSize:22, fontWeight:700 }}>CR</span>
          </div>
          <h1 style={{ fontSize:24, fontWeight:700, color:"#111827", margin:"0 0 4px", letterSpacing:"-0.03em" }}>
            CommentRoute
          </h1>
          <p style={{ fontSize:14, color:"#9ca3af", margin:0 }}>
            Intelligent feedback triage & incident escalation
          </p>
        </div>

        {mode==="select" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[
              { id:"customer", icon:"🛍️", title:"Customer", desc:"Submit product reviews, bug reports, or complaints", color:"#10b981" },
              { id:"employee", icon:"🏢", title:"Employee",  desc:"Submit internal reports — HR concerns or workplace issues", color:"#0ea5e9" },
              { id:"admin",    icon:"🔐", title:"Admin / Data Science", desc:"Monitor all tickets and view model analytics", color:"#8b5cf6" },
            ].map(r=>(
              <div key={r.id} className="portal-card" onClick={()=>setMode(r.id)}
                style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12,
                  padding:"1rem 1.25rem", display:"flex", alignItems:"center", gap:14 }}>
                <span style={{ fontSize:26 }}>{r.icon}</span>
                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:600, fontSize:14, color:"#111827", margin:"0 0 2px" }}>{r.title}</p>
                  <p style={{ fontSize:12, color:"#9ca3af", margin:0 }}>{r.desc}</p>
                </div>
                <span style={{ color:"#d1d5db", fontSize:16 }}>›</span>
              </div>
            ))}
          </div>
        )}

        {(mode==="customer"||mode==="employee") && (
          <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, padding:"1.5rem" }}>
            <button onClick={()=>setMode("select")}
              style={{ background:"none", border:"none", color:"#9ca3af", fontSize:13,
                cursor:"pointer", padding:0, marginBottom:"1.25rem", display:"flex", alignItems:"center", gap:4 }}>
              ← Back
            </button>
            <h2 style={{ fontSize:17, fontWeight:600, color:"#111827", margin:"0 0 1.25rem" }}>
              {mode==="customer" ? "Customer portal" : "Employee portal"}
            </h2>
            <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:6 }}>
              Your name
            </label>
            <input value={name} onChange={e=>setName(e.target.value)}
              placeholder="Enter your name"
              style={{ width:"100%", padding:"10px 14px", border:"1px solid #e5e7eb",
                borderRadius:8, fontSize:14, color:"#111827", outline:"none", marginBottom:"1rem" }} />
            <button disabled={!name.trim()}
              onClick={()=>onLogin(mode, name.trim())}
              style={{ width:"100%", padding:"11px",
                background: name.trim() ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#e5e7eb",
                color: name.trim() ? "#fff" : "#9ca3af",
                border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor: name.trim() ? "pointer" : "default" }}>
              Enter portal →
            </button>
          </div>
        )}

        {mode==="admin" && (
          <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, padding:"1.5rem" }}>
            <button onClick={()=>{ setMode("select"); setErr(""); }}
              style={{ background:"none", border:"none", color:"#9ca3af", fontSize:13,
                cursor:"pointer", padding:0, marginBottom:"1.25rem", display:"flex", alignItems:"center", gap:4 }}>
              ← Back
            </button>
            <h2 style={{ fontSize:17, fontWeight:600, color:"#111827", margin:"0 0 4px" }}>Admin login</h2>
            <p style={{ fontSize:12, color:"#9ca3af", margin:"0 0 1.25rem" }}>
            
            </p>
            {[
              ["Email", email, setEmail, "email", "admin@commentroute.com"],
              ["Password", pass, setPass, "password", "••••••••"],
            ].map(([label, val, setter, type, ph])=>(
              <div key={label} style={{ marginBottom:"0.875rem" }}>
                <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:5 }}>
                  {label}
                </label>
                <input value={val} onChange={e=>setter(e.target.value)} type={type}
                  placeholder={ph}
                  style={{ width:"100%", padding:"10px 14px", border:"1px solid #e5e7eb",
                    borderRadius:8, fontSize:14, color:"#111827", outline:"none" }} />
              </div>
            ))}
            {err && <p style={{ color:"#ef4444", fontSize:13, margin:"0 0 10px" }}>{err}</p>}
            <button onClick={handleAdminLogin}
              style={{ width:"100%", padding:"11px",
                background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
                color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer" }}>
              Sign in →
            </button>
          </div>
        )}

        <p style={{ fontSize:11, color:"#d1d5db", textAlign:"center", marginTop:"1.5rem" }}>
          Demonstration build — no real authentication
        </p>
      </div>
    </div>
  );
}

/* ─── submit form ────────────────────────────────────────────────────── */

function SubmitForm({ sourceType, authorName, onSuccess }) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const isOffice = sourceType==="office_report";

  const submit = async () => {
    if (!comment.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/submit_ticket`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ author:authorName, comment:comment.trim(), source_type:sourceType }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onSuccess(data); setComment("");
    } catch { setError("Could not reach the server. Is the backend running?"); }
    setLoading(false);
  };

  return (
    <div>
      {isOffice && (
        <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8,
          padding:"10px 14px", marginBottom:14, fontSize:13, color:"#b91c1c",
          display:"flex", gap:8, alignItems:"flex-start" }}>
          <span>🔒</span>
          <span>Reports are confidential. Critical incidents go directly to Compliance & HR.</span>
        </div>
      )}
      <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={5}
        placeholder={ isOffice
          ? "Describe the incident — what happened, when, and who was involved..."
          : "Describe your issue, feedback, or suggestion about the product..." }
        style={{ width:"100%", padding:"12px 14px", border:"1px solid #e5e7eb",
          borderRadius:8, fontSize:14, color:"#111827", resize:"vertical",
          outline:"none", lineHeight:1.6, background:"#fafafa" }} />
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10 }}>
        <span style={{ fontSize:12, color:"#d1d5db" }}>{comment.length} chars</span>
        <button onClick={submit} disabled={!comment.trim()||loading}
          style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 20px",
            background: comment.trim()&&!loading ? (isOffice?"#ef4444":"#6366f1") : "#e5e7eb",
            color: comment.trim()&&!loading ? "#fff" : "#9ca3af",
            border:"none", borderRadius:8, fontSize:14, fontWeight:600, cursor: comment.trim()&&!loading?"pointer":"default" }}>
          {loading && <Spinner />}
          {loading ? "Submitting..." : isOffice ? "Submit report" : "Submit feedback"}
        </button>
      </div>
      {error && <p style={{ fontSize:13, color:"#ef4444", marginTop:8 }}>{error}</p>}
    </div>
  );
}

/* ─── ticket result card ─────────────────────────────────────────────── */

function TicketResult({ ticket, onDismiss }) {
  if (!ticket) return null;
  return (
    <div style={{ animation:"slideUp 0.3s ease", background:"#fff",
      border:"1px solid #e5e7eb", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
        <div>
          <p style={{ fontSize:12, color:"#9ca3af", margin:"0 0 2px" }}>Ticket created</p>
          <p style={{ fontSize:22, fontWeight:700, color:"#111827", margin:0 }}>#{ticket.ticket_id}</p>
        </div>
        <button onClick={onDismiss}
          style={{ background:"none", border:"none", color:"#9ca3af", fontSize:18, cursor:"pointer" }}>✕</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:10, marginBottom:12 }}>
        {[
          ["ASSIGNED TO", <TeamDot team={ticket.team} />],
          ["PRIORITY",    <Badge label={ticket.priority} type="priority" />],
          ["STATUS",      <Badge label={ticket.status} type="status" />],
        ].map(([label,content])=>(
          <div key={label} style={{ background:"#f9fafb", borderRadius:8, padding:"8px 12px" }}>
            <p style={{ fontSize:11, color:"#9ca3af", margin:"0 0 4px", fontWeight:500 }}>{label}</p>
            {content}
          </div>
        ))}
      </div>
      {ticket.routing_note && (
        <div style={{ borderLeft:"3px solid #6366f1", borderRadius:"0 8px 8px 0",
          padding:"10px 14px", background:"#fafafa" }}>
          <p style={{ fontSize:11, color:"#9ca3af", margin:"0 0 4px", fontWeight:500 }}>AI ROUTING SUMMARY</p>
          <p style={{ fontSize:13, color:"#374151", margin:0, lineHeight:1.6 }}>
            {ticket.routing_note.replace(/\*\*/g,"")}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── ticket table ───────────────────────────────────────────────────── */

function TicketTable({ tickets, onView }) {
  if (!tickets?.length) return (
    <div style={{ padding:"3rem", textAlign:"center", color:"#9ca3af", fontSize:14 }}>
      No tickets yet.
    </div>
  );
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr style={{ borderBottom:"1px solid #f3f4f6" }}>
            {["#","Author","Comment","Source","Team","Priority","Status","Date", onView&&""].filter(x=>x!==false).map(h=>(
              <th key={h} style={{ padding:"8px 12px", textAlign:"left",
                fontWeight:500, color:"#9ca3af", whiteSpace:"nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickets.map(t=>(
            <tr key={t.ticket_id} className="tr-hover" style={{ borderBottom:"1px solid #f9fafb" }}>
              <td style={{ padding:"10px 12px", color:"#9ca3af", fontFamily:"monospace" }}>#{t.ticket_id}</td>
              <td style={{ padding:"10px 12px", color:"#374151", whiteSpace:"nowrap" }}>{t.author_name}</td>
              <td style={{ padding:"10px 12px", maxWidth:180, overflow:"hidden",
                textOverflow:"ellipsis", whiteSpace:"nowrap", color:"#374151" }}>{t.comment}</td>
              <td style={{ padding:"10px 12px" }}>
                <span style={{ fontSize:11, padding:"2px 8px", borderRadius:4, fontWeight:500,
                  background: t.source_type==="office_report"?"#fef2f2":"#eff6ff",
                  color: t.source_type==="office_report"?"#b91c1c":"#1d4ed8" }}>
                  {t.source_type==="office_report"?"office":"customer"}
                </span>
              </td>
              <td style={{ padding:"10px 12px" }}><TeamDot team={t.assigned_team} /></td>
              <td style={{ padding:"10px 12px" }}><Badge label={t.priority} type="priority" /></td>
              <td style={{ padding:"10px 12px" }}><Badge label={t.status} type="status" /></td>
              <td style={{ padding:"10px 12px", color:"#9ca3af", whiteSpace:"nowrap" }}>
                {new Date(t.created_at).toLocaleDateString()}
              </td>
              {onView && (
                <td style={{ padding:"10px 12px" }}>
                  <button onClick={()=>onView(t.ticket_id)}
                    style={{ fontSize:12, color:"#6366f1", background:"none", border:"none",
                      cursor:"pointer", fontWeight:500, padding:0 }}>View</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── ticket detail modal ────────────────────────────────────────────── */

function TicketModal({ ticket, onClose, onStatusUpdate, updating }) {
  if (!ticket) return null;
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
        display:"flex", alignItems:"center", justifyContent:"center",
        zIndex:100, padding:"1rem" }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:540,
        maxHeight:"88vh", overflowY:"auto", padding:"1.5rem",
        animation:"slideUp 0.25s ease" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <p style={{ fontSize:12, color:"#9ca3af", margin:0 }}>Ticket details</p>
            <p style={{ fontSize:22, fontWeight:700, color:"#111827", margin:0 }}>#{ticket.ticket_id}</p>
          </div>
          <button onClick={onClose}
            style={{ background:"none", border:"none", fontSize:20, color:"#9ca3af", cursor:"pointer" }}>✕</button>
        </div>

        <div style={{ background:"#f9fafb", borderRadius:8, padding:"12px 14px", marginBottom:14 }}>
          <p style={{ fontSize:11, color:"#9ca3af", margin:"0 0 4px", fontWeight:500 }}>ORIGINAL COMMENT</p>
          <p style={{ fontSize:14, color:"#374151", margin:0, lineHeight:1.6 }}>{ticket.comment}</p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
          {[
            ["Team",     <TeamDot team={ticket.assigned_team} />],
            ["Priority", <Badge label={ticket.priority} type="priority" />],
            ["Status",   <Badge label={ticket.status} type="status" />],
          ].map(([l,c])=>(
            <div key={l} style={{ background:"#f9fafb", borderRadius:8, padding:"8px 12px" }}>
              <p style={{ fontSize:11, color:"#9ca3af", margin:"0 0 4px", fontWeight:500 }}>{l.toUpperCase()}</p>
              {c}
            </div>
          ))}
        </div>

        {ticket.routing_note && (
          <div style={{ borderLeft:"3px solid #6366f1", paddingLeft:12, marginBottom:16 }}>
            <p style={{ fontSize:11, color:"#9ca3af", margin:"0 0 4px", fontWeight:500 }}>AI ROUTING SUMMARY</p>
            <p style={{ fontSize:13, color:"#374151", margin:0, lineHeight:1.6 }}>
              {ticket.routing_note.replace(/\*\*/g,"")}
            </p>
          </div>
        )}

        <div style={{ marginBottom:16 }}>
          <p style={{ fontSize:12, color:"#9ca3af", margin:"0 0 8px", fontWeight:500 }}>UPDATE STATUS</p>
          <div style={{ display:"flex", gap:8 }}>
            {["Open","In Progress","Resolved"].map(s=>(
              <button key={s} onClick={()=>onStatusUpdate(ticket.ticket_id,s)}
                disabled={updating||ticket.status===s}
                style={{ padding:"7px 14px", borderRadius:8,
                  border: ticket.status===s ? "none" : "1px solid #e5e7eb",
                  fontSize:13, fontWeight: ticket.status===s ? 600 : 400,
                  background: ticket.status===s ? "#111827" : "#fff",
                  color: ticket.status===s ? "#fff" : "#374151",
                  opacity: updating ? 0.6 : 1, cursor: updating||ticket.status===s?"default":"pointer" }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {ticket.history?.length>0 && (
          <div>
            <p style={{ fontSize:12, color:"#9ca3af", margin:"0 0 8px", fontWeight:500 }}>STATUS HISTORY</p>
            {ticket.history.map(h=>(
              <div key={h.id} style={{ display:"flex", gap:10, fontSize:12, marginBottom:6, alignItems:"center" }}>
                <span style={{ color:"#9ca3af", whiteSpace:"nowrap" }}>
                  {new Date(h.updated_at).toLocaleString()}
                </span>
                <Badge label={h.new_status} type="status" />
                {h.changed_by && <span style={{ color:"#9ca3af" }}>by {h.changed_by}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── customer page ──────────────────────────────────────────────────── */

function CustomerApp({ name, onLogout }) {
  const [page,       setPage]       = useState("submit");
  const [lastTicket, setLastTicket] = useState(null);
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(false);

  const fetchHistory = useCallback(async ()=>{
    setLoading(true);
    try {
      const res  = await fetch(`${API}/tickets?source_type=customer_review&limit=50`);
      const data = await res.json();
      setHistory(data.filter(t=>t.author_name===name));
    } catch {}
    setLoading(false);
  },[name]);

  useEffect(()=>{ if(page==="history") fetchHistory(); },[page,fetchHistory]);

  return (
    <AppShell role="customer" name={name} onLogout={onLogout} activePage={page} onNav={setPage}>
      {page==="submit" && (
        <div style={{ maxWidth:680, animation:"fadeIn 0.3s ease" }}>
          <h1 style={{ fontSize:22, fontWeight:700, color:"#111827", margin:"0 0 4px", letterSpacing:"-0.02em" }}>
            Submit feedback
          </h1>
          <p style={{ fontSize:14, color:"#9ca3af", margin:"0 0 1.5rem" }}>
            Report a bug, share a review, or request a feature.
          </p>
          <TicketResult ticket={lastTicket} onDismiss={()=>setLastTicket(null)} />
          <div style={{ background:"#fff", border:"1px solid #f3f4f6", borderRadius:12, padding:"1.25rem" }}>
            <SubmitForm sourceType="customer_review" authorName={name}
              onSuccess={t=>{ setLastTicket(t); }} />
          </div>
        </div>
      )}
      {page==="history" && (
        <div style={{ animation:"fadeIn 0.3s ease" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
            <div>
              <h1 style={{ fontSize:22, fontWeight:700, color:"#111827", margin:"0 0 4px", letterSpacing:"-0.02em" }}>
                My tickets
              </h1>
              <p style={{ fontSize:14, color:"#9ca3af", margin:0 }}>All feedback you've submitted.</p>
            </div>
            <button onClick={fetchHistory}
              style={{ padding:"7px 14px", border:"1px solid #e5e7eb", borderRadius:8,
                fontSize:13, color:"#6366f1", background:"#fff", cursor:"pointer" }}>
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>
          <div style={{ background:"#fff", border:"1px solid #f3f4f6", borderRadius:12, overflow:"hidden" }}>
            <TicketTable tickets={history} />
          </div>
        </div>
      )}
    </AppShell>
  );
}

/* ─── employee page ──────────────────────────────────────────────────── */

function EmployeeApp({ name, onLogout }) {
  const [page,       setPage]       = useState("submit");
  const [lastTicket, setLastTicket] = useState(null);
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(false);

  const fetchHistory = useCallback(async ()=>{
    setLoading(true);
    try {
      const res  = await fetch(`${API}/tickets?source_type=office_report&limit=50`);
      const data = await res.json();
      setHistory(data.filter(t=>t.author_name===name));
    } catch {}
    setLoading(false);
  },[name]);

  useEffect(()=>{ if(page==="history") fetchHistory(); },[page,fetchHistory]);

  return (
    <AppShell role="employee" name={name} onLogout={onLogout} activePage={page} onNav={setPage}>
      {page==="submit" && (
        <div style={{ maxWidth:680, animation:"fadeIn 0.3s ease" }}>
          <h1 style={{ fontSize:22, fontWeight:700, color:"#111827", margin:"0 0 4px", letterSpacing:"-0.02em" }}>
            Internal report
          </h1>
          <p style={{ fontSize:14, color:"#9ca3af", margin:"0 0 1.5rem" }}>
            Submit a workplace concern, HR incident, or internal process issue.
          </p>
          <TicketResult ticket={lastTicket} onDismiss={()=>setLastTicket(null)} />
          <div style={{ background:"#fff", border:"1px solid #f3f4f6", borderRadius:12, padding:"1.25rem" }}>
            <SubmitForm sourceType="office_report" authorName={name}
              onSuccess={t=>{ setLastTicket(t); }} />
          </div>
        </div>
      )}
      {page==="history" && (
        <div style={{ animation:"fadeIn 0.3s ease" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
            <div>
              <h1 style={{ fontSize:22, fontWeight:700, color:"#111827", margin:"0 0 4px", letterSpacing:"-0.02em" }}>
                My reports
              </h1>
              <p style={{ fontSize:14, color:"#9ca3af", margin:0 }}>Your submitted internal reports.</p>
            </div>
            <button onClick={fetchHistory}
              style={{ padding:"7px 14px", border:"1px solid #e5e7eb", borderRadius:8,
                fontSize:13, color:"#0ea5e9", background:"#fff", cursor:"pointer" }}>
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>
          <div style={{ background:"#fff", border:"1px solid #f3f4f6", borderRadius:12, overflow:"hidden" }}>
            <TicketTable tickets={history} />
          </div>
        </div>
      )}
    </AppShell>
  );
}

/* ─── admin app ──────────────────────────────────────────────────────── */

function AdminApp({ name, onLogout }) {
  const [page,    setPage]    = useState("overview");
  const [stats,   setStats]   = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ team:"", status:"", source_type:"", priority:"" });
  const [selTicket, setSelTicket]   = useState(null);
  const [updating,  setUpdating]    = useState(false);

  const fetchAll = useCallback(async ()=>{
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k,v])=>{ if(v) params.set(k,v); });
      params.set("limit","200");
      const [sRes,tRes] = await Promise.all([
        fetch(`${API}/dashboard/stats`),
        fetch(`${API}/tickets?${params}`),
      ]);
      setStats(await sRes.json());
      setTickets(await tRes.json());
    } catch {}
    setLoading(false);
  },[filters]);

  useEffect(()=>{ fetchAll(); },[fetchAll]);

  const openTicket = async id=>{
    const res = await fetch(`${API}/tickets/${id}`);
    setSelTicket(await res.json());
  };

  const updateStatus = async (id,status)=>{
    setUpdating(true);
    await fetch(`${API}/tickets/${id}/status`,{
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ status, changed_by:name }),
    });
    await openTicket(id);
    await fetchAll();
    setUpdating(false);
  };

  return (
    <AppShell role="admin" name={name} onLogout={onLogout} activePage={page} onNav={setPage}>

      {loading ? (
        <div style={{ display:"flex", alignItems:"center", gap:10, color:"#9ca3af", fontSize:14 }}>
          <Spinner /> Loading...
        </div>
      ) : (
        <>
          {/* ── overview ── */}
          {page==="overview" && (
            <div style={{ animation:"fadeIn 0.3s ease" }}>
              <h1 style={{ fontSize:22, fontWeight:700, color:"#111827", margin:"0 0 4px", letterSpacing:"-0.02em" }}>
                Overview
              </h1>
              <p style={{ fontSize:14, color:"#9ca3af", margin:"0 0 1.5rem" }}>
                Live metrics across both portals.
              </p>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:"1.5rem" }}>
                <StatCard label="Total"      value={stats?.total_tickets}       accent="#6366f1" />
                <StatCard label="Open"       value={stats?.open_tickets}        accent="#f59e0b" />
                <StatCard label="In progress" value={stats?.in_progress_tickets} accent="#8b5cf6" />
                <StatCard label="Resolved"   value={stats?.resolved_tickets}    accent="#10b981" />
                <StatCard label="Critical"   value={stats?.critical_tickets} sub="immediate action" accent="#ef4444" />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
                <div style={{ background:"#fff", border:"1px solid #f3f4f6", borderRadius:12, padding:"1.25rem" }}>
                  <p style={{ fontSize:13, fontWeight:600, color:"#111827", margin:"0 0 16px" }}>Tickets by team</p>
                  <BarChart data={stats?.by_team} colorMap={TEAM_COLOR} />
                </div>
                <div style={{ background:"#fff", border:"1px solid #f3f4f6", borderRadius:12, padding:"1.25rem" }}>
                  <p style={{ fontSize:13, fontWeight:600, color:"#111827", margin:"0 0 16px" }}>Source breakdown</p>
                  <DonutChart data={stats?.by_source} />
                  {stats?.by_team_and_source?.length>0 && (
                    <div style={{ marginTop:18 }}>
                      <p style={{ fontSize:11, color:"#9ca3af", margin:"0 0 8px", fontWeight:600, letterSpacing:"0.06em" }}>
                        TEAM × SOURCE
                      </p>
                      {stats.by_team_and_source.map(r=>(
                        <div key={r.team+r.source_type}
                          style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:5 }}>
                          <span style={{ color:"#6b7280" }}>
                            {r.team.split(" ")[0]} ×{" "}
                            <span style={{ color: r.source_type==="office_report"?"#ef4444":"#6366f1" }}>
                              {r.source_type==="office_report"?"office":"customer"}
                            </span>
                          </span>
                          <span style={{ fontWeight:600, color:"#111827" }}>{r.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div style={{ background:"#fff", border:"1px solid #f3f4f6", borderRadius:12, padding:"1.25rem" }}>
                  <p style={{ fontSize:13, fontWeight:600, color:"#111827", margin:"0 0 14px" }}>Priority distribution</p>
                  {stats?.by_priority?.length ? stats.by_priority.map(p=>{
                    const c = PRIORITY_STYLE[p.priority]||{ text:"#374151" };
                    const pct = Math.round((p.count/(stats.total_tickets||1))*100);
                    return (
                      <div key={p.priority} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                        <Badge label={p.priority} type="priority" />
                        <div style={{ flex:1, background:"#f3f4f6", borderRadius:4, height:8 }}>
                          <div style={{ width:`${pct}%`, height:"100%", background:c.text, borderRadius:4 }} />
                        </div>
                        <span style={{ fontSize:12, fontWeight:600, color:"#111827", width:24, textAlign:"right" }}>
                          {p.count}
                        </span>
                      </div>
                    );
                  }) : <p style={{ fontSize:13, color:"#9ca3af" }}>No data yet</p>}
                </div>
                <div style={{ background:"#fff", border:"1px solid #f3f4f6", borderRadius:12, padding:"1.25rem" }}>
                  <p style={{ fontSize:13, fontWeight:600, color:"#111827", margin:"0 0 14px" }}>Status funnel</p>
                  {stats?.by_status?.length ? stats.by_status.map(s=>{
                    const c = STATUS_STYLE[s.status]||{ text:"#374151" };
                    const pct = Math.round((s.count/(stats.total_tickets||1))*100);
                    return (
                      <div key={s.status} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                        <Badge label={s.status} type="status" />
                        <div style={{ flex:1, background:"#f3f4f6", borderRadius:4, height:8 }}>
                          <div style={{ width:`${pct}%`, height:"100%", background:c.text, borderRadius:4 }} />
                        </div>
                        <span style={{ fontSize:12, fontWeight:600, color:"#111827", width:24, textAlign:"right" }}>
                          {s.count}
                        </span>
                      </div>
                    );
                  }) : <p style={{ fontSize:13, color:"#9ca3af" }}>No data yet</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── all tickets ── */}
          {page==="tickets" && (
            <div style={{ animation:"fadeIn 0.3s ease" }}>
              <h1 style={{ fontSize:22, fontWeight:700, color:"#111827", margin:"0 0 4px", letterSpacing:"-0.02em" }}>
                All tickets
              </h1>
              <p style={{ fontSize:14, color:"#9ca3af", margin:"0 0 1.25rem" }}>
                Filter, review, and update ticket status.
              </p>
              <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
                {[
                  ["source_type","All sources",   [["","All sources"],["customer_review","Customer"],["office_report","Office"]]],
                  ["team",       "All teams",      [["","All teams"],...TEAMS.map(t=>[t,t])]],
                  ["status",     "All statuses",   [["","All statuses"],["Open","Open"],["In Progress","In Progress"],["Resolved","Resolved"]]],
                  ["priority",   "All priorities", [["","All priorities"],["Normal","Normal"],["High","High"],["Critical","Critical"]]],
                ].map(([key,,options])=>(
                  <select key={key} value={filters[key]}
                    onChange={e=>setFilters(f=>({...f,[key]:e.target.value}))}
                    style={{ padding:"7px 12px", border:"1px solid #e5e7eb", borderRadius:8,
                      fontSize:13, color:"#374151", background:"#fff", outline:"none" }}>
                    {options.map(([val,label])=>(
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                ))}
                <button onClick={()=>setFilters({team:"",status:"",source_type:"",priority:""})}
                  style={{ padding:"7px 14px", border:"1px solid #e5e7eb", borderRadius:8,
                    fontSize:13, color:"#9ca3af", background:"#fff", cursor:"pointer" }}>
                  Clear
                </button>
                <span style={{ fontSize:13, color:"#9ca3af", padding:"7px 0", marginLeft:"auto" }}>
                  {tickets.length} tickets
                </span>
              </div>
              <div style={{ background:"#fff", border:"1px solid #f3f4f6", borderRadius:12, overflow:"hidden" }}>
                <TicketTable tickets={tickets} onView={openTicket} />
              </div>
            </div>
          )}

          {/* ── model analytics ── */}
          {page==="analytics" && (
            <div style={{ animation:"fadeIn 0.3s ease" }}>
              <h1 style={{ fontSize:22, fontWeight:700, color:"#111827", margin:"0 0 4px", letterSpacing:"-0.02em" }}>
                Model analytics
              </h1>
              <p style={{ fontSize:14, color:"#9ca3af", margin:"0 0 1.5rem" }}>
                LightGBM performance, label distribution, and routing pipeline.
              </p>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:"1.5rem" }}>
                <StatCard label="Macro F1"         value="0.8156"  accent="#6366f1" />
                <StatCard label="Training samples" value="158K"    accent="#10b981" />
                <StatCard label="Validation set"   value="39.6K"   accent="#0ea5e9" />
                <StatCard label="Classes"          value="4"       accent="#8b5cf6" />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
                <div style={{ background:"#fff", border:"1px solid #f3f4f6", borderRadius:12, padding:"1.25rem" }}>
                  <p style={{ fontSize:13, fontWeight:600, color:"#111827", margin:"0 0 4px" }}>
                    ML label distribution
                  </p>
                  <p style={{ fontSize:12, color:"#9ca3af", margin:"0 0 16px" }}>
                    Raw LightGBM output before keyword override rules
                  </p>
                  {stats?.model_label_distribution?.length ? stats.model_label_distribution.map(d=>{
                    const colors = ["#0ea5e9","#8b5cf6","#10b981","#ef4444"];
                    const pct    = Math.round((d.count/(stats.total_tickets||1))*100);
                    return (
                      <div key={d.label} style={{ marginBottom:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontSize:12, color:"#374151", display:"flex", gap:8, alignItems:"center" }}>
                            <span style={{ fontFamily:"monospace", fontSize:11, background:"#f3f4f6",
                              padding:"1px 6px", borderRadius:4 }}>label {d.label}</span>
                            {d.label_name}
                          </span>
                          <span style={{ fontSize:12, color:"#9ca3af" }}>{d.count} ({pct}%)</span>
                        </div>
                        <div style={{ background:"#f3f4f6", borderRadius:4, height:10 }}>
                          <div style={{ width:`${pct}%`, height:"100%",
                            background:colors[d.label]||"#6366f1", borderRadius:4,
                            transition:"width 0.5s ease" }} />
                        </div>
                      </div>
                    );
                  }) : (
                    <p style={{ fontSize:13, color:"#9ca3af" }}>Submit tickets first to see label distribution.</p>
                  )}
                </div>

                <div style={{ background:"#fff", border:"1px solid #f3f4f6", borderRadius:12, padding:"1.25rem" }}>
                  <p style={{ fontSize:13, fontWeight:600, color:"#111827", margin:"0 0 16px" }}>
                    Routing pipeline
                  </p>
                  {[
                    ["Comment received",      "Raw text from customer or employee", "#6366f1"],
                    ["LightGBM classification","TF-IDF features → label 0–3",       "#8b5cf6"],
                    ["Keyword override",       "HR / Engineering / Product rules",   "#f59e0b"],
                    ["Priority assignment",    "label + source_type logic",          "#ef4444"],
                    ["Gemini routing note",    "1-2 sentence action summary",        "#10b981"],
                    ["Ticket stored",          "SQLite DB, team notified",           "#0ea5e9"],
                  ].map(([step,detail,color],i)=>(
                    <div key={step} style={{ display:"flex", gap:12, marginBottom:12 }}>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                        <div style={{ width:26, height:26, borderRadius:"50%",
                          background:color+"18", color, fontSize:11, fontWeight:700,
                          display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          {i+1}
                        </div>
                        {i<5 && <div style={{ width:1, height:12, background:"#f3f4f6", margin:"2px 0" }} />}
                      </div>
                      <div style={{ paddingTop:4 }}>
                        <p style={{ fontSize:13, fontWeight:500, color:"#374151", margin:0 }}>{step}</p>
                        <p style={{ fontSize:12, color:"#9ca3af", margin:0 }}>{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background:"#fff", border:"1px solid #f3f4f6", borderRadius:12, padding:"1.25rem" }}>
                <p style={{ fontSize:13, fontWeight:600, color:"#111827", margin:"0 0 16px" }}>Model details</p>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:0 }}>
                  {[
                    ["Algorithm",          "LightGBM (LGBM Classifier)"],
                    ["Text features",      "TF-IDF, 50k features, bigrams"],
                    ["Categorical encoding","OneHotEncoder (race, religion, gender)"],
                    ["Numerical features", "27 engineered columns"],
                    ["Class balancing",    "class_weight='balanced'"],
                    ["n_estimators",       "1000, learning_rate=0.05"],
                    ["num_leaves",         "127, subsample=0.8"],
                    ["Validation Macro F1","0.8156"],
                  ].map(([k,v])=>(
                    <div key={k} style={{ display:"flex", justifyContent:"space-between",
                      padding:"8px 0", borderBottom:"1px solid #f9fafb", fontSize:13,
                      gap:12, flexWrap:"wrap" }}>
                      <span style={{ color:"#9ca3af" }}>{k}</span>
                      <span style={{ fontWeight:500, color:"#374151", textAlign:"right" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <TicketModal ticket={selTicket} onClose={()=>setSelTicket(null)}
        onStatusUpdate={updateStatus} updating={updating} />
    </AppShell>
  );
}

/* ─── root ───────────────────────────────────────────────────────────── */

export default function App() {
  const [role,     setRole]     = useState(()=>localStorage.getItem("cr_role")||null);
  const [userName, setUserName] = useState(()=>localStorage.getItem("cr_name")||"");

  const handleLogin = (r,n)=>{
    localStorage.setItem("cr_role",r);
    localStorage.setItem("cr_name",n);
    setRole(r); setUserName(n);
  };

  const handleLogout = ()=>{
    localStorage.removeItem("cr_role");
    localStorage.removeItem("cr_name");
    setRole(null); setUserName("");
  };

  if (!role)              return <LoginPage onLogin={handleLogin} />;
  if (role==="customer")  return <CustomerApp  name={userName} onLogout={handleLogout} />;
  if (role==="employee")  return <EmployeeApp  name={userName} onLogout={handleLogout} />;
  if (role==="admin")     return <AdminApp     name={userName} onLogout={handleLogout} />;
}
