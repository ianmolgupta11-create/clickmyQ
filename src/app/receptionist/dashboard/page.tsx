"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList, CalendarDays, UserRound, LogOut, Search, Bell,
  MessageSquare, HelpCircle, Plus, Check, X, Play, ChevronRight,
  Clock, TrendingUp, Users, BarChart2, Pencil, Trash2, Menu, Stethoscope,
  Timer, MonitorPlay, RefreshCw
} from "lucide-react";
import AppointmentAlertModal from "@/components/AppointmentAlertModal";
import SupportModal from "@/components/SupportModal";

const barData = [
  {month:"Jan",val:18},{month:"Feb",val:22},{month:"Mar",val:30},{month:"Apr",val:25},{month:"May",val:20},{month:"Jun",val:28},{month:"Jul",val:35},{month:"Aug",val:24},{month:"Sep",val:29},
];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_H = ["M","T","W","T","F","S","S"];

function MiniCalendar({ accent = "#eab308" }: { accent?: string }) {
  const today = new Date();
  const [cur, setCur] = useState({ y:today.getFullYear(), m:today.getMonth() });
  const firstDay = new Date(cur.y,cur.m,1).getDay();
  const offset = firstDay===0?6:firstDay-1;
  const days = new Date(cur.y,cur.m+1,0).getDate();
  const cells:(number|null)[] = [...Array(offset).fill(null),...Array.from({length:days},(_,i)=>i+1)];
  while(cells.length%7!==0) cells.push(null);
  const isToday = (d:number|null) => d===today.getDate()&&cur.m===today.getMonth()&&cur.y===today.getFullYear();
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontSize:14,fontWeight:700,color:"#1e293b"}}>{MONTHS[cur.m]} {cur.y}</span>
        <div style={{display:"flex",gap:4}}>
          {["‹","›"].map((a,i)=>(
            <button key={i} onClick={()=>setCur(c=>{const nm=c.m+(i?1:-1);return nm<0?{y:c.y-1,m:11}:nm>11?{y:c.y+1,m:0}:{...c,m:nm};})}
              style={{width:26,height:26,borderRadius:8,border:"none",background:i?accent:"#e2e8f0",color:i?"#fff":"#64748b",cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{a}</button>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:6}}>
        {DAYS_H.map((d,i)=><div key={i} style={{textAlign:"center",fontSize:10,fontWeight:600,color:"#94a3b8",padding:"2px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontSize:11,fontWeight:isToday(d)?700:400,padding:"5px 0",borderRadius:8,cursor:d?"pointer":"default",background:isToday(d)?accent:"transparent",color:isToday(d)?"#fff":d?"#334155":"transparent"}}>{d||""}</div>
        ))}
      </div>
    </div>
  );
}

const EMPTY_VITALS = { bp: "", pulse: "", temp: "", weight: "", height: "", spo2: "", rr: "" };
const VITALS_FIELDS: [keyof typeof EMPTY_VITALS, string, string][] = [
  ["bp", "Blood Pressure", "120/80"],
  ["pulse", "Pulse", "72 bpm"],
  ["temp", "Temperature", "98.6°F"],
  ["weight", "Weight", "70 kg"],
  ["height", "Height", "170 cm"],
  ["spo2", "SpO2", "98%"],
  ["rr", "Resp Rate", "16/min"],
];

type Tab = "queue"|"book"|"patients";

const api = async (url: string, method = "GET", body?: any) => {
  const opts: any = { method, credentials: "include", headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return (await fetch(url, opts)).json();
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function ReceptionistDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("queue");
  const [queueData, setQueueData] = useState<any>(null);
  const [qDoctorFilter, setQDoctorFilter] = useState("");
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [booking, setBooking] = useState({patientName:"",mobile:"",age:"",deptId:"",doctorId:"",timeSlot:"09:00",type:"OPD"});
  const [vitals, setVitals] = useState({ ...EMPTY_VITALS });
  const [showVitals, setShowVitals] = useState(false);
  const [payMethod, setPayMethod] = useState<"CASH" | "UPI" | "CARD" | "CHEQUE" | "INSURANCE">("CASH");
  const [bookingMsg, setBookingMsg] = useState({ t: "", c: "" });
  const [booked, setBooked] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [hospitalSettings, setHospitalSettings] = useState<any>(null);

  const loadQueue = async () => {
    try {
      const r = await api(`/api/appointments/queue?date=${todayStr()}${qDoctorFilter ? `&doctorId=${qDoctorFilter}` : ""}`);
      if (r.success) setQueueData(r.data);
    } catch {}
  };

  const loadPatients = async () => {
    try {
      const r = await api(`/api/patients?limit=20`);
      if (r.success) {
        const list = r.data?.data || r.data || [];
        setPatients(Array.isArray(list) ? list : []);
      }
    } catch {}
  };

  const loadMasters = async () => {
    try {
      const [d, dept] = await Promise.all([
        api(`/api/config/doctors?simple=true`),
        api(`/api/config/departments?simple=true`),
      ]);
      if (d.success) setDoctors(Array.isArray(d.data) ? d.data : []);
      if (dept.success) setDepartments(Array.isArray(dept.data) ? dept.data : []);
    } catch {}
  };

  useEffect(()=>{
    fetch("/api/auth/me",{credentials:"include"}).then(r=>r.json()).then(d=>{
      if(!d.success){router.push("/login");return;}
      setUser(d.data);
      setLoading(false);
      fetch("/api/config/settings",{credentials:"include"}).then(r=>r.json()).then(s=>{
        if(s.success && s.data?.settings) setHospitalSettings(s.data.settings);
      }).catch(()=>{});
      loadQueue(); loadPatients(); loadMasters();
    }).catch(()=>router.push("/login"));
  },[router]);

  const logout = async()=>{await fetch("/api/auth/logout",{method:"POST",credentials:"include"});router.push("/login");};
  const statusToUi = (s: string) => {
    const m: Record<string,string> = { SCHEDULED: "waiting", CONFIRMED: "confirmed", CHECKED_IN: "waiting", IN_PROGRESS: "in-progress", COMPLETED: "completed", CANCELLED: "cancelled", NO_SHOW: "cancelled", RESCHEDULED: "waiting" };
    return m[s] || "waiting";
  };
  // Flat view for legacy references — grouped queue merged in lifecycle order
  const queue = queueData ? [...(queueData.waiting||[]), ...(queueData.inProgress||[]), ...(queueData.completed||[])] : [];
  const checkIn = async (id: string) => {
    const r = await api(`/api/appointments/${id}/checkin`, "POST");
    if (r.success) loadQueue();
  };
  // Auto-refresh the live queue every 15s while the queue tab is open
  useEffect(() => {
    const iv = setInterval(() => { if (tab === "queue") loadQueue(); }, 15000);
    return () => clearInterval(iv);
  }, [tab, qDoctorFilter]);
  const updateStatus = async (id: string, status: string) => {
    const r = await api(`/api/appointments/${id}`, "PUT", { status });
    if (r.success) loadQueue();
  };
  const handleBook = async (e:React.FormEvent)=>{
    e.preventDefault();
    setBookingMsg({ t: "", c: "" });
    if (!booking.patientName.trim()) { setBookingMsg({ t: "Patient name is required", c: "err" }); return; }
    if (!booking.mobile.trim()) { setBookingMsg({ t: "Mobile number is required", c: "err" }); return; }
    setBookingBusy(true);
    try {
      // 1. Find-or-create patient by phone
      let patientId = "";
      const q = await api(`/api/patients?q=${encodeURIComponent(booking.mobile.trim())}`);
      const found = (q.success ? (Array.isArray(q.data) ? q.data : []) : [])
        .find((p: any) => (p.phone || "").replace(/\D/g, "").endsWith(booking.mobile.trim().replace(/\D/g, "").slice(-10)));
      if (found) {
        patientId = found.id;
      } else {
        const ageNum = booking.age.trim() ? Number(booking.age.trim()) : null;
        if (ageNum !== null && (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 150)) {
          setBookingMsg({ t: "Age must be a number between 0 and 150", c: "err" }); setBookingBusy(false); return;
        }
        const c = await api(`/api/patients`, "POST", { name: booking.patientName.trim(), phone: booking.mobile.trim(), ...(ageNum !== null ? { age: ageNum } : {}) });
        if (!c.success) { setBookingMsg({ t: c.message || "Failed to register patient", c: "err" }); setBookingBusy(false); return; }
        patientId = c.data?.patient?.id;
      }
      if (!patientId) { setBookingMsg({ t: "Could not resolve patient", c: "err" }); setBookingBusy(false); return; }
      // 2. Book appointment (+ optional vitals → DRAFT prescription)
      const vObj: Record<string, string> = {};
      let hasV = false;
      (Object.keys(EMPTY_VITALS) as (keyof typeof EMPTY_VITALS)[]).forEach(k => {
        const v = (vitals[k] || "").trim();
        if (v) { vObj[k] = v; hasV = true; }
      });
      const payload: any = {
        patientId,
        doctorId: booking.doctorId || null,
        departmentId: booking.deptId || null,
        appointmentDate: todayStr(),
        timeSlot: booking.timeSlot,
        type: booking.type === "Follow-up" ? "FOLLOW_UP" : booking.type === "Emergency" ? "EMERGENCY" : "OPD",
        ...(hasV ? { vitals: vObj } : {}),
      };
      payload.payment = {
        method: payMethod,
        notes: "Collected at booking counter",
      };
      const b = await api(`/api/appointments`, "POST", payload);
      if (!b.success) { setBookingMsg({ t: b.message || "Booking failed", c: "err" }); setBookingBusy(false); return; }
      setBooked(true);
      setBookingMsg({ t: `Appointment booked! Token #${b.data?.tokenNumber || "—"}`, c: "ok" });
      loadQueue(); loadPatients();
      setTimeout(()=>{ setBooked(false); setBooking({patientName:"",mobile:"",age:"",deptId:"",doctorId:"",timeSlot:"09:00",type:"OPD"}); setVitals({ ...EMPTY_VITALS }); setShowVitals(false); setPayMethod("CASH"); setBookingMsg({ t: "", c: "" }); setTab("queue"); },1500);
    } catch (err: any) {
      setBookingMsg({ t: err?.message || "Booking failed", c: "err" });
    }
    setBookingBusy(false);
  };
  const initials = (n:string) => n.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase();
  const feeRs = doctors.find((d: any) => d.id === booking.doctorId)?.consultationFee || 0;
  const maxBar = Math.max(...barData.map(b=>b.val));

  if(loading) return <div style={{minHeight:"100vh",background:"#fefce8",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',sans-serif",color:"#64748b",fontSize:13,gap:14}}>
    <div style={{width:32,height:32,border:"3px solid #fef08a",borderTop:"3px solid #eab308",borderRadius:"50%",animation:"sp .8s linear infinite"}}/>
    <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>Loading Receptionist Portal...
  </div>;

  const navItems = [
    {id:"queue" as Tab,   label:"Today's Queue",      icon:<ClipboardList size={16}/>},
    {id:"book" as Tab,    label:"Book Appointment",   icon:<CalendarDays size={16}/>},
    {id:"patients" as Tab,label:"Patients",           icon:<UserRound size={16}/>},
  ];

  return(<>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:#fefce8}::-webkit-scrollbar-thumb{background:#fef08a;border-radius:4px}
      input,select,button{font-family:'Inter',sans-serif}
      .rec{display:flex;height:100vh;overflow:hidden;font-family:'Inter',sans-serif;background:#fefdf0}
      .rec-overlay{display:none;position:fixed;inset:0;background:rgba(15,23,42,0.45);z-index:45;backdrop-filter:blur(2px)}
      .rec-overlay.open{display:block}
      .rec-sb{width:220px;background:#fff;border-right:1px solid #fef08a;display:flex;flex-direction:column;position:fixed;left:0;top:0;bottom:0;z-index:50;box-shadow:2px 0 8px rgba(234,179,8,0.07);transition:transform .25s cubic-bezier(.4,0,.2,1)}
      .rec-burger{display:none;width:36px;height:36px;border-radius:10px;background:#fefce8;border:1px solid #fef08a;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
      .rec-logo{padding:20px 20px 16px;border-bottom:1px solid #fefce8;display:flex;align-items:center;gap:10px}
      .rec-logo-ic{width:36px;height:36px;background:linear-gradient(135deg,#14B8A6,#115E59);border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(14,137,143,0.3)}
      .rec-logo-tx{font-size:14px;font-weight:800;color:#1e293b;letter-spacing:-.02em}
      .rec-logo-sub{font-size:10px;color:#94a3b8;margin-top:0px}
      .rec-nav{flex:1;padding:12px 12px;overflow-y:auto}
      .rec-nav-sec{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;padding:0 8px;margin:12px 0 6px}
      .rec-nb{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border-radius:10px;border:none;background:none;color:#64748b;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;margin-bottom:2px;text-align:left;position:relative}
      .rec-nb:hover{background:#fefce8;color:#92400e}
      .rec-nb.on{background:#fef9c3;color:#854d0e;font-weight:600}
      .rec-nb-dot{display:none;width:3px;height:20px;background:#eab308;border-radius:4px;position:absolute;left:0}
      .rec-nb.on .rec-nb-dot{display:block}
      .rec-nb svg{color:#94a3b8;flex-shrink:0}
      .rec-nb.on svg{color:#ca8a04}
      .rec-sb-foot{padding:14px 16px 18px;border-top:1px solid #fefce8}
      .rec-user{display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;background:#fefce8;border:1px solid #fef08a;margin-bottom:10px}
      .rec-av{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#eab308,#f97316);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0}
      .rec-uname{font-size:11px;font-weight:600;color:#1e293b}
      .rec-urole{font-size:10px;font-weight:500;color:#ca8a04}
      .rec-logout{width:100%;padding:8px;border-radius:9px;background:#fff5f5;border:1px solid #fee2e2;color:#ef4444;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s}
      .rec-logout:hover{background:#fee2e2}
      .rec-main{margin-left:220px;flex:1;display:flex;flex-direction:column;height:100vh;overflow:hidden}
      .rec-topbar{height:64px;background:#fff;border-bottom:1px solid #fef08a;display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:relative;z-index:40;flex-shrink:0;box-shadow:0 1px 4px rgba(234,179,8,0.07)}
      .rec-search-wrap{display:flex;align-items:center;gap:8px;background:#fefce8;border:1px solid #fef08a;border-radius:10px;padding:8px 14px;width:280px}
      .rec-search-wrap:focus-within{border-color:#fcd34d}
      .rec-search{background:none;border:none;outline:none;font-size:12px;color:#334155;width:100%}
      .rec-search::placeholder{color:#94a3b8}
      .rec-tb-right{display:flex;align-items:center;gap:12px}
      .rec-notif{width:36px;height:36px;border-radius:10px;background:#fefce8;border:1px solid #fef08a;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative}
      .rec-notif-dot{position:absolute;top:7px;right:7px;width:7px;height:7px;border-radius:50%;background:#eab308;border:1.5px solid #fff}
      .rec-profile{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:#fefce8;border:1px solid #fef08a;cursor:pointer}
      .rec-profile-av{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#eab308,#f97316);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff}
      .rec-profile-name{font-size:11px;font-weight:600;color:#1e293b}
      .rec-profile-role{font-size:10px;color:#ca8a04}
      .rec-body{display:grid;grid-template-columns:1fr 260px;flex:1;overflow:hidden}
      .rec-center{padding:22px 20px;overflow-y:auto}
      .rec-right{background:#fff;border-left:1px solid #fef08a;padding:22px 18px;overflow-y:auto}
      .rec-pg-title{font-size:20px;font-weight:800;color:#1e293b;letter-spacing:-.02em;margin-bottom:18px}
      .rec-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
      .rec-sc{background:#fff;border-radius:14px;padding:18px;border:1px solid #fef08a;display:flex;align-items:center;gap:14px;box-shadow:0 1px 4px rgba(234,179,8,0.07);transition:transform .2s,box-shadow .2s}
      .rec-sc:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.08)}
      .rec-sc-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0}
      .rec-sc-lbl{font-size:10px;font-weight:500;color:#94a3b8;margin-bottom:2px}
      .rec-sc-val{font-size:22px;font-weight:800;color:#1e293b;letter-spacing:-.02em;line-height:1}
      .rec-sc-sub{font-size:10px;color:#94a3b8;margin-top:3px}
      .rec-mid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
      .rec-card{background:#fff;border-radius:14px;border:1px solid #fef08a;box-shadow:0 1px 4px rgba(234,179,8,0.06);overflow:hidden;margin-bottom:16px}
      .rec-card-head{padding:14px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #fefce8}
      .rec-card-title{font-size:13px;font-weight:700;color:#1e293b}
      .rec-card-sub{font-size:10px;color:#94a3b8;margin-top:2px}
      .rec-card-body{padding:16px 18px}
      .rec-tbl{width:100%;border-collapse:collapse}
      .rec-tbl th{text-align:left;font-size:10px;font-weight:600;color:#94a3b8;padding:10px 12px;border-bottom:2px solid #fefce8}
      .rec-tbl td{padding:11px 12px;font-size:12px;color:#475569;border-bottom:1px solid #fefdf0}
      .rec-tbl tr:last-child td{border-bottom:none}
      .rec-tbl tbody tr:hover td{background:#fffdf0}
      .rec-badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:100px;font-size:10px;font-weight:700}
      .rec-action-btn{padding:4px 10px;border-radius:7px;border:none;font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:3px;transition:opacity .15s}
      .rec-action-btn:hover{opacity:.8}
      .rec-chart{display:flex;align-items:flex-end;gap:8px;height:120px}
      .rec-bar-wrap{display:flex;flex-direction:column;align-items:center;gap:5px;flex:1}
      .rec-bar{width:100%;border-radius:5px 5px 0 0;transition:opacity .2s;cursor:pointer;min-width:14px}
      .rec-bar:hover{opacity:.8}
      .rec-bar-lbl{font-size:10px;color:#94a3b8;font-weight:500}
      .rec-form{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      @media(max-width:700px){.rec-form{grid-template-columns:1fr}}
      .rec-field{display:flex;flex-direction:column;gap:6px}
      .rec-lbl{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b}
      .rec-input{background:#fefce8;border:1.5px solid #fef08a;border-radius:9px;padding:10px 13px;font-size:12px;color:#1e293b;outline:none;transition:border-color .2s;width:100%}
      .rec-input::placeholder{color:#94a3b8}
      .rec-input:focus{border-color:#fcd34d;box-shadow:0 0 0 3px rgba(252,211,77,0.25)}
      .rec-submit{padding:12px 28px;border-radius:9px;border:none;background:linear-gradient(135deg,#eab308,#d97706);color:#fff;font-size:12px;font-weight:700;cursor:pointer;margin-top:6px;box-shadow:0 4px 14px rgba(234,179,8,0.3);transition:all .15s}
      .rec-submit:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(234,179,8,0.4)}
      .rec-success{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:9px;background:#f0fdf4;border:1px solid #bbf7d0;font-size:12px;color:#16a34a;font-weight:600;margin-top:10px}
      .rec-right-title{font-size:12px;font-weight:700;color:#1e293b;margin-bottom:12px}
      @media(max-width:900px){
        .rec-sb{transform:translateX(-100%)}
        .rec-sb.open{transform:translateX(0)}
        .rec-main{margin-left:0}
        .rec-burger{display:flex}
        .rec-search-wrap{width:160px}
        .rec-body{grid-template-columns:1fr}
        .rec-right{display:none}
      }
      @media(max-width:600px){
        .rec-topbar{padding:0 14px}
        .rec-search-wrap{width:120px}
        .rec-profile-name,.rec-profile-role{display:none}
        .rec-stats{grid-template-columns:repeat(2,1fr)}
      }
    `}</style>

    <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    <div className="rec">
      {sidebarOpen && <div className="rec-overlay open" onClick={() => setSidebarOpen(false)} />}
      <aside className={`rec-sb${sidebarOpen ? " open" : ""}`}>
        <div className="rec-logo">
          {hospitalSettings?.logo ? (
            <img src={hospitalSettings.logo} alt="Hospital Logo" style={{ width: "100%", maxHeight: 44, objectFit: "contain", display: "block" }} />
          ) : (
            <>
              <div className="rec-logo-ic"><Stethoscope size={18} color="white"/></div>
              <div><div className="rec-logo-tx">{hospitalSettings?.hospitalName || user?.hospital?.name || "clickmyQPro"}</div><div className="rec-logo-sub">Front Desk</div></div>
            </>
          )}
        </div>
        <nav className="rec-nav">
          <div className="rec-nav-sec">Front Desk</div>
          {navItems.map(n=>(
            <button key={n.id} className={`rec-nb${tab===n.id?" on":""}`} onClick={()=>{setTab(n.id);setSidebarOpen(false);}}>
              <div className="rec-nb-dot"/>
              <span style={{color:tab===n.id?"#854d0e":"#94a3b8",display:"flex"}}>{n.icon}</span>
              {n.label}
            </button>
          ))}
          <div className="rec-nav-sec">Settings</div>
          <button className="rec-nb" onClick={() => setSupportOpen(true)}><span style={{color:"#94a3b8",display:"flex"}}><HelpCircle size={16}/></span>Support</button>
        </nav>
        <div className="rec-sb-foot">
          <div className="rec-user">
            <div className="rec-av">{user?.name?initials(user.name):"RC"}</div>
            <div><div className="rec-uname">{user?.name||"Receptionist"}</div><div className="rec-urole">Receptionist</div></div>
          </div>
          <button className="rec-logout" onClick={logout}><LogOut size={13}/>Log Out</button>
        </div>
      </aside>

      <main className="rec-main">
        <header className="rec-topbar">
          <button className="rec-burger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
            {sidebarOpen ? <X size={18} color="#eab308" /> : <Menu size={18} color="#64748b" />}
          </button>
          <div className="rec-search-wrap"><input className="rec-search" placeholder="Search appointments, patients..."/></div>
          <div className="rec-tb-right">
            <div className="rec-notif"><Bell size={16} color="#64748b"/><span className="rec-notif-dot"/></div>
            <div className="rec-profile">
              <div className="rec-profile-av">{user?.name?initials(user.name):"RC"}</div>
              <div><div className="rec-profile-name">{user?.name?.split(" ")[0]||"Receptionist"}</div><div className="rec-profile-role">Front Desk 📋</div></div>
            </div>
          </div>
        </header>

        <div className="rec-body">
          <div className="rec-center">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
              <div className="rec-pg-title" style={{marginBottom:0}}>
                {tab==="queue"?"Today's Appointment Queue":tab==="book"?"Book New Appointment":"Patient Registry"}
              </div>
              <span style={{fontSize:11,color:"#64748b",background:"#fefce8",border:"1px solid #fef08a",padding:"5px 12px",borderRadius:8,fontWeight:500}}>{new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long"})}</span>
            </div>

            <div className="rec-stats">
              {[
                {icon:<ClipboardList size={20} color="#fff"/>,  label:"Total Today",  val:queueData?.stats?.total ?? 0,                    sub:"appointments", bg:"#fefce8", iconBg:"#eab308"},
                {icon:<Clock size={20} color="#fff"/>,           label:"Waiting",      val:queueData?.stats?.waiting ?? 0,                  sub:"in queue",     bg:"#fff7ed", iconBg:"#f97316"},
                {icon:<Play size={20} color="#fff"/>,            label:"In Progress",  val:queueData?.stats?.inProgress ?? 0,               sub:"with doctor",  bg:"#f0fdf4", iconBg:"#10b981"},
                {icon:<Check size={20} color="#fff"/>,           label:"Completed",    val:queueData?.stats?.completed ?? 0,                sub:"done today",   bg:"#F0FDFA", iconBg:"#14B8A6"},
                {icon:<Timer size={20} color="#fff"/>,           label:"Avg Wait",     val:queueData?.stats?.avgWaitMin!=null?`${queueData.stats.avgWaitMin}m`:"—", sub:`max ${queueData?.stats?.maxWaitMin ?? 0}m`, bg:"#fdf2f8", iconBg:"#ec4899"},
              ].map((s,i)=>(
                <div key={i} className="rec-sc" style={{background:s.bg}}>
                  <div className="rec-sc-icon" style={{background:s.iconBg}}>{s.icon}</div>
                  <div><div className="rec-sc-lbl">{s.label}</div><div className="rec-sc-val">{s.val}</div><div className="rec-sc-sub">{s.sub}</div></div>
                </div>
              ))}
            </div>

            {tab==="queue"&&(
              <div className="rec-card">
                <div className="rec-card-head">
                  <div><div className="rec-card-title">Live Queue</div><div className="rec-card-sub">Click actions to update status · auto-refreshes every 15s</div></div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <select className="rec-input" style={{width:180,padding:"7px 10px",fontSize:11}} value={qDoctorFilter} onChange={e=>setQDoctorFilter(e.target.value)}>
                      <option value="">All Doctors</option>
                      {doctors.map((d:any)=><option key={d.id} value={d.id}>Dr. {d.name}</option>)}
                    </select>
                    <a href={`/queue/display`} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:9,border:"1px solid #e2e8f0",background:"#fff",color:"#334155",fontSize:11,fontWeight:700,textDecoration:"none",cursor:"pointer"}}><MonitorPlay size={13}/>Display Board</a>
                    <button onClick={loadQueue} title="Refresh" style={{padding:"7px 9px",borderRadius:9,border:"1px solid #e2e8f0",background:"#fff",color:"#334155",cursor:"pointer",display:"flex"}}><RefreshCw size={13}/></button>
                    <button onClick={()=>setTab("book")} style={{padding:"7px 14px",borderRadius:9,border:"none",background:"#eab308",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",boxShadow:"0 3px 10px rgba(234,179,8,0.3)"}}>+ New Appointment</button>
                  </div>
                </div>
                {queueData?.nowServing?.length>0 && (
                  <div style={{display:"flex",alignItems:"center",gap:14,margin:"14px 16px 0",padding:"12px 18px",borderRadius:12,background:"linear-gradient(135deg,#0F766E,#115E59)",color:"#fff"}}>
                    <span style={{fontSize:10,fontWeight:800,letterSpacing:".08em",opacity:.85}}>NOW SERVING</span>
                    {queueData.nowServing.map((s:any)=>(
                      <span key={s.appointmentId} style={{display:"flex",alignItems:"baseline",gap:6}}>
                        <span style={{fontFamily:"monospace",fontSize:22,fontWeight:800}}>{s.tokenNumber?`#${s.tokenNumber}`:"—"}</span>
                        <span style={{fontSize:11,opacity:.9}}>{s.patientName} · {s.doctorName||""}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{overflowX:"auto"}}>
                  <table className="rec-tbl">
                    <thead><tr><th>Token</th><th>Patient</th><th>Doctor</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {queue.length === 0 && (
                        <tr><td colSpan={6} style={{textAlign:"center",padding:20,fontSize:12,color:"#94a3b8"}}>No appointments today. Book one from the Book tab.</td></tr>
                      )}
                      {queue.map(a=>{ const st = statusToUi(a.status); return (
                        <tr key={a.id}>
                          <td style={{fontFamily:"monospace",color:"#94a3b8",fontSize:10}}>
                            {a.tokenNumber ? `#${a.tokenNumber}` : "—"}
                            {a.checkedIn && a.waitMinutes>0 && <div style={{fontSize:9,color:"#f97316",marginTop:2}}>⏱ {a.waitMinutes}m</div>}
                          </td>
                          <td>
                            <div style={{fontWeight:600,color:"#1e293b",fontSize:12}}>{a.patient?.name || "—"}</div>
                            <div style={{fontSize:10,color:"#94a3b8"}}>{a.patient?.phone || ""}</div>
                            {a.bookingSource === "ONLINE" && <div style={{fontSize:9,fontWeight:700,color:"#0F766E",background:"#F0FDFA",border:"1px solid #99F6E4",borderRadius:4,padding:"1px 5px",display:"inline-block",marginTop:3}}>🌐 Online booking</div>}
                          </td>
                          <td>
                            <div style={{fontSize:11,fontWeight:600,color:"#334155"}}>{a.doctor ? `Dr. ${a.doctor.name}` : "—"}</div>
                            <div style={{fontSize:10,color:"#94a3b8"}}>{a.department?.name || a.doctor?.specialization || ""}</div>
                          </td>
                          <td style={{fontWeight:700,fontSize:11,color:"#334155"}}>{a.timeSlot || "—"}</td>
                          <td><span className="rec-badge" style={st==="in-progress"?{background:"#F0FDFA",color:"#0F766E",border:"1px solid #99F6E4"}:st==="waiting"?{background:"#fefce8",color:"#ca8a04",border:"1px solid #fde68a"}:st==="completed"?{background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0"}:st==="cancelled"?{background:"#fff5f5",color:"#ef4444",border:"1px solid #fecaca"}:{background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0"}}>{st.replace("-"," ")}</span></td>
                          <td>
                            <div style={{display:"flex",gap:6}}>
                              {["SCHEDULED","CONFIRMED","RESCHEDULED"].includes(a.status) && a.bookingSource === "ONLINE" && (
                                <button className="rec-action-btn" onClick={()=>checkIn(a.id)} style={{background:"#fff7ed",color:"#c2410c",border:"1px solid #fed7aa",display:"flex",alignItems:"center",gap:3}}><Check size={11}/>Check-In (Arrived)</button>
                              )}
                              {(st==="waiting"||st==="confirmed")&&(
                                <button className="rec-action-btn" onClick={()=>updateStatus(a.id,"IN_PROGRESS")} style={{background:"#F0FDFA",color:"#0F766E",border:"1px solid #99F6E4",display:"flex",alignItems:"center",gap:3}}><Play size={11}/>Call</button>
                              )}
                              {st!=="completed"&&st!=="cancelled"&&(
                                <button className="rec-action-btn" onClick={()=>updateStatus(a.id,"COMPLETED")} style={{background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0",display:"flex",alignItems:"center",gap:3}}><Check size={11}/>Done</button>
                              )}
                              {st!=="cancelled"&&st!=="completed"&&(
                                <button className="rec-action-btn" onClick={()=>updateStatus(a.id,"CANCELLED")} style={{background:"#fff5f5",color:"#ef4444",border:"1px solid #fecaca",display:"flex",alignItems:"center",gap:3}}><X size={11}/></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab==="book"&&(
              <div className="rec-card">
                <div className="rec-card-head"><div><div className="rec-card-title">Book Appointment</div><div className="rec-card-sub">Schedule for a new or existing patient</div></div></div>
                <div className="rec-card-body">
                  <form onSubmit={handleBook}>
                    <div className="rec-form">
                      <div className="rec-field"><label className="rec-lbl">Patient Name *</label><input className="rec-input" placeholder="Full name" required value={booking.patientName} onChange={e=>setBooking(b=>({...b,patientName:e.target.value}))}/></div>
                      <div className="rec-field"><label className="rec-lbl">Mobile Number *</label><input className="rec-input" placeholder="98765 43210" required value={booking.mobile} onChange={e=>setBooking(b=>({...b,mobile:e.target.value}))}/></div>
                      <div className="rec-field"><label className="rec-lbl">Age</label><input className="rec-input" type="number" min={0} max={150} placeholder="Years" value={booking.age} onChange={e=>setBooking(b=>({...b,age:e.target.value}))}/></div>
                      <div className="rec-field"><label className="rec-lbl">Department</label>
                        <select className="rec-input" style={{cursor:"pointer"}} value={booking.deptId} onChange={e=>setBooking(b=>({...b,deptId:e.target.value}))}>
                          <option value="">Select department</option>
                          {departments.map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                      <div className="rec-field"><label className="rec-lbl">Doctor</label>
                        <select className="rec-input" style={{cursor:"pointer"}} value={booking.doctorId} onChange={e=>setBooking(b=>({...b,doctorId:e.target.value}))}>
                          <option value="">Select doctor</option>
                          {doctors.filter((d:any)=>!booking.deptId || d.departmentId===booking.deptId).map((d:any)=><option key={d.id} value={d.id}>Dr. {d.name}{d.specialization?` — ${d.specialization}`:""}</option>)}
                        </select>
                      </div>
                      <div className="rec-field"><label className="rec-lbl">Time Slot</label>
                        <select className="rec-input" style={{cursor:"pointer"}} value={booking.timeSlot} onChange={e=>setBooking(b=>({...b,timeSlot:e.target.value}))}>
                          {["09:00","09:30","10:00","10:30","11:00","11:30","12:00","14:00","15:00","16:00","17:00"].map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="rec-field"><label className="rec-lbl">Visit Type</label>
                        <select className="rec-input" style={{cursor:"pointer"}} value={booking.type} onChange={e=>setBooking(b=>({...b,type:e.target.value}))}>
                          <option>OPD</option><option>Follow-up</option><option>Emergency</option>
                        </select>
                      </div>
                    </div>
                    <div style={{marginTop:14}}>
                      <div className="rec-lbl" style={{marginBottom:6}}>💳 Payment Method{feeRs > 0 ? ` — Consultation Fee ₹${feeRs}` : ""}</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                        {([
                          { v: "CASH", l: "💵 Cash" },
                          { v: "UPI", l: "📱 UPI" },
                          { v: "CARD", l: "💳 Card" },
                          { v: "CHEQUE", l: "🏦 Cheque" },
                          { v: "INSURANCE", l: "🛡️ Insurance" },
                        ] as const).map(o=>(
                          <button key={o.v} type="button" onClick={()=>setPayMethod(o.v)}
                            style={{padding:"8px 4px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",textAlign:"center",
                              border: payMethod===o.v ? "1.5px solid #eab308" : "1px solid #e2e8f0",
                              background: payMethod===o.v ? "#fefce8" : "#fff",
                              color: payMethod===o.v ? "#854d0e" : "#64748b"}}>
                            {o.l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{marginTop:14,border:"1px solid #fef08a",borderRadius:10,background:"#fffdf5"}}>
                      <button type="button" onClick={()=>setShowVitals(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:"#854d0e"}}>
                        <span>🩺 Vitals (Optional)</span>
                        <span style={{fontSize:11,color:"#a16207"}}>{showVitals ? "▲ Hide" : "▼ Add vitals"}</span>
                      </button>
                      {showVitals && (
                        <div className="rec-form" style={{padding:"0 14px 14px"}}>
                          {VITALS_FIELDS.map(([k,label,ph])=>(
                            <div className="rec-field" key={k}><label className="rec-lbl">{label}</label>
                              <input className="rec-input" placeholder={ph} value={vitals[k]} onChange={e=>setVitals(v=>({...v,[k]:e.target.value}))}/>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {bookingMsg.t && <div style={{marginTop:10,fontSize:12,fontWeight:600,padding:"8px 12px",borderRadius:8,background:bookingMsg.c==="err"?"#fef2f2":"#f0fdf4",color:bookingMsg.c==="err"?"#dc2626":"#16a34a",border:bookingMsg.c==="err"?"1px solid #fecaca":"1px solid #bbf7d0"}}>{bookingMsg.t}</div>}
                    <button type="submit" className="rec-submit" disabled={bookingBusy}>{bookingBusy ? "Booking..." : "Book Appointment →"}</button>
                  </form>
                  {booked&&<div className="rec-success"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Appointment booked! Redirecting to queue...</div>}
                </div>
              </div>
            )}

            {tab==="patients"&&(
              <div className="rec-card">
                <div className="rec-card-head"><div><div className="rec-card-title">Recent Patients</div><div className="rec-card-sub">Latest registered</div></div><button onClick={loadPatients} style={{padding:"6px 12px",borderRadius:8,border:"1px solid #fef08a",background:"#fefce8",fontSize:11,fontWeight:600,cursor:"pointer",color:"#854d0e"}}>↻ Refresh</button></div>
                <div style={{overflowX:"auto"}}>
                <table className="rec-tbl">
                  <thead><tr><th>Patient ID</th><th>Name</th><th>Mobile</th><th>Gender</th><th>Registered</th></tr></thead>
                  <tbody>
                    {patients.length === 0 && (
                      <tr><td colSpan={5} style={{textAlign:"center",padding:20,fontSize:12,color:"#94a3b8"}}>No patients yet.</td></tr>
                    )}
                    {patients.map((p:any)=>(
                      <tr key={p.id}>
                        <td style={{fontFamily:"monospace",color:"#94a3b8",fontSize:10}}>{p.patientId}</td>
                        <td style={{fontWeight:600,color:"#1e293b"}}>{p.name}</td>
                        <td style={{fontSize:11}}>{p.phone || "—"}</td>
                        <td style={{fontSize:11}}>{p.gender || "—"}</td>
                        <td style={{fontSize:11,color:"#64748b"}}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* Quick stats chart */}
            {tab==="queue"&&(
              <div className="rec-card">
                <div className="rec-card-head"><div><div className="rec-card-title">Monthly Appointment Trends</div></div></div>
                <div className="rec-card-body">
                  <div style={{display:"flex",alignItems:"flex-end",gap:0}}>
                    <div style={{display:"flex",flexDirection:"column",justifyContent:"space-between",height:120,paddingRight:8,alignItems:"flex-end"}}>
                      {[40,30,20,10,0].map(v=><span key={v} style={{fontSize:9,color:"#cbd5e1"}}>{v}</span>)}
                    </div>
                    <div className="rec-chart" style={{flex:1}}>
                      {barData.map((b,i)=>(
                        <div key={i} className="rec-bar-wrap">
                          <div className="rec-bar" style={{height:`${(b.val/maxBar)*110}px`,background:i===6?"linear-gradient(180deg,#eab308,#fcd34d)":"linear-gradient(180deg,#fef08a,#fefce8)"}}/>
                          <span className="rec-bar-lbl">{b.month}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rec-right">
            <div style={{marginBottom:22}}>
              <div style={{fontSize:10,fontWeight:600,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}}>Date</div>
              <MiniCalendar accent="#eab308"/>
            </div>
            <div>
              <div className="rec-right-title">Quick Stats</div>
              {[
                {label:"Avg. Wait Time",val:"12 min",icon:"⏱"},
                {label:"Walk-ins Today",val:"3",icon:"🚶"},
                {label:"No-shows",val:"1",icon:"❌"},
                {label:"Rescheduled",val:"2",icon:"🔄"},
              ].map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px",borderRadius:10,background:"#fefce8",border:"1px solid #fef08a",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:15}}>{s.icon}</span>
                    <span style={{fontSize:11,color:"#64748b"}}>{s.label}</span>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:"#854d0e"}}>{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
      <AppointmentAlertModal />
  </>);
}
