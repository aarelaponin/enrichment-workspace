import { useState, useEffect, useRef } from "react";

const STMTS = [
  { id:"STM-2024-06", ref:"LHV Jun 2024", total:45, new_c:0, work:5, ready:12, conf:28, err:0 },
  { id:"STM-2024-07", ref:"LHV Jul 2024", total:52, new_c:3, work:8, ready:15, conf:22, err:4 },
  { id:"STM-2024-08", ref:"SWD Aug 2024", total:38, new_c:38, work:0, ready:0, conf:0, err:0 },
];
const WS = [
  { id:"ENR-001",s:"S",dt:"2024-07-02",ty:"SEC_BUY",de:"Purchase AAPL 500 shares @ 198.50 NASDAQ",dc:"D",am:99250,fe:125,to:99375,cy:"USD",cu:"CUST001",as:"AAPL",cp:"LHV",or:"pipeline",co:"rule_match",st:"enriched",er:"" },
  { id:"ENR-002",s:"B",dt:"2024-07-02",ty:"SEC_BUY",de:"Payment for AAPL purchase settlement T+2",dc:"D",am:99375,fe:0,to:99375,cy:"USD",cu:"CUST001",as:"AAPL",cp:"LHV",or:"pipeline",co:"rule_match",st:"paired",er:"" },
  { id:"ENR-003",s:"S",dt:"2024-07-05",ty:"BOND_BUY",de:"Purchase DE Govt Bond 4.5% 2029 face 50000",dc:"D",am:48750,fe:75,to:48825,cy:"EUR",cu:"CUST002",as:"DE0001",cp:"SWD",or:"pipeline",co:"rule_match",st:"enriched",er:"" },
  { id:"ENR-004",s:"S",dt:"2024-07-08",ty:"DIV_INCOME",de:"Dividend income MSFT Q2 2024 ex-date 2024-06-20",dc:"C",am:1200,fe:0,to:1200,cy:"EUR",cu:"CUST003",as:"MSFT",cp:"LHV",or:"pipeline",co:"rule_match",st:"ready",er:"" },
  { id:"ENR-005",s:"B",dt:"2024-07-10",ty:"CASH_IN_OUT",de:"Wire transfer incoming from Nordea client ref 7721",dc:"C",am:25000,fe:15,to:24985,cy:"EUR",cu:"CUST001",as:"",cp:"NRD",or:"pipeline",co:"tentative",st:"manual_review",er:"" },
  { id:"ENR-006",s:"S",dt:"2024-07-11",ty:"SEC_SELL",de:"Sale TSLA 200 shares @ 255.30 NASDAQ",dc:"C",am:51060,fe:95,to:50965,cy:"USD",cu:"CUST002",as:"TSLA",cp:"LHV",or:"pipeline",co:"rule_match",st:"ready",er:"" },
  { id:"ENR-007",s:"B",dt:"2024-07-12",ty:"FX_EXCHANGE",de:"FX conversion USD/EUR spot rate 1.0892",dc:"D",am:15000,fe:22.5,to:15022.5,cy:"USD",cu:"CUST001",as:"",cp:"LHV",or:"pipeline",co:"rule_match",st:"enriched",er:"" },
  { id:"ENR-008",s:"S",dt:"2024-07-15",ty:"SEC_BUY",de:"Purchase NVDA 100 shares @ 875.20 block trade",dc:"D",am:87520,fe:150,to:87670,cy:"USD",cu:"",as:"NVDA",cp:"LHV",or:"pipeline",co:"rule_match",st:"error",er:"Missing customer_code: no customer resolution rule matched for this transaction." },
  { id:"ENR-009",s:"B",dt:"2024-07-15",ty:"COMMISSION",de:"Commission fee Q2 2024 advisory services",dc:"D",am:3500,fe:0,to:3500,cy:"EUR",cu:"CUST003",as:"",cp:"LHV",or:"pipeline",co:"rule_match",st:"ready",er:"" },
  { id:"ENR-010",s:"S",dt:"2024-07-18",ty:"SEC_BUY",de:"Purchase AMZN 50 shares @ 3450.00",dc:"D",am:172500,fe:200,to:172700,cy:"USD",cu:"CUST001",as:"AMZN",cp:"SWD",or:"pipeline",co:"tentative",st:"in_review",er:"" },
  { id:"ENR-011",s:"S",dt:"2024-07-20",ty:"BOND_COUPON",de:"Coupon payment EE Govt Bond 3.2% 2026",dc:"C",am:1600,fe:0,to:1600,cy:"EUR",cu:"CUST002",as:"EE0002",cp:"LHV",or:"pipeline",co:"rule_match",st:"adjusted",er:"" },
  { id:"ENR-012",s:"B",dt:"2024-07-22",ty:"",de:"Unknown transfer ref MISC-9928374",dc:"C",am:450,fe:0,to:450,cy:"EUR",cu:"",as:"",cp:"",or:"pipeline",co:"unclassified",st:"error",er:"Unclassified: no type determined. Customer and counterparty missing." },
  { id:"ENR-013",s:"M",dt:"2024-07-25",ty:"CASH_IN_OUT",de:"Manual adj: missing deposit from client wire",dc:"C",am:600,fe:0,to:600,cy:"USD",cu:"CUST001",as:"",cp:"LHV",or:"manual",co:"manual_override",st:"enriched",er:"" },
  { id:"ENR-014",s:"S",dt:"2024-07-03",ty:"SEC_SELL",de:"Sale GOOGL 80 shares @ 178.90 (split child 1/2)",dc:"C",am:14312,fe:45,to:14267,cy:"USD",cu:"CUST003",as:"GOOGL",cp:"LHV",or:"split",co:"rule_match",st:"enriched",er:"" },
  { id:"ENR-015",s:"S",dt:"2024-07-03",ty:"SEC_SELL",de:"Sale GOOGL 120 shares @ 178.90 (split child 2/2)",dc:"C",am:21468,fe:67.5,to:21400.5,cy:"USD",cu:"CUST001",as:"GOOGL",cp:"LHV",or:"split",co:"rule_match",st:"enriched",er:"" },
];
const PQ = [
  { id:"PO-001",ty:"SEC_BUY",dt:"2024-06-15",de:"Purchase META 300 shares @ 485.20",dc:"D",to:145860,cy:"USD",cu:"CUST001",as:"META",cp:"LHV",by:"anna.tamm",at:"2024-07-28 14:32",st:"pending",er:"" },
  { id:"PO-002",ty:"DIV_INCOME",dt:"2024-06-20",de:"Dividend income AAPL Q2 2024",dc:"C",to:920,cy:"USD",cu:"CUST002",as:"AAPL",cp:"LHV",by:"anna.tamm",at:"2024-07-28 14:32",st:"pending",er:"" },
  { id:"PO-003",ty:"SEC_SELL",dt:"2024-06-22",de:"Sale INTC 500 shares @ 31.20",dc:"C",to:15525,cy:"USD",cu:"CUST003",as:"INTC",cp:"SWD",by:"anna.tamm",at:"2024-07-28 15:01",st:"error",er:"GL rule not found for SEC_SELL with counterparty SWD" },
];
const PD = [
  { id:"PO-100",ty:"SEC_BUY",dt:"2024-06-02",de:"Purchase AAPL 200 shares @ 189.50",dc:"D",to:37975,cy:"USD",eu:34886,cu:"CUST001",as:"AAPL",cp:"LHV",jr:"JE-2024-00142",pa:"2024-07-28 16:00",by:"anna.tamm" },
  { id:"PO-101",ty:"BOND_COUPON",dt:"2024-06-10",de:"Coupon DE Govt Bond 4.5% 2029",dc:"C",to:1125,cy:"EUR",eu:1125,cu:"CUST002",as:"DE0001",cp:"LHV",jr:"JE-2024-00143",pa:"2024-07-28 16:00",by:"anna.tamm" },
  { id:"PO-102",ty:"FX_EXCHANGE",dt:"2024-06-12",de:"FX EUR/USD spot 1.0845",dc:"D",to:20000,cy:"EUR",eu:20000,cu:"CUST001",as:"",cp:"LHV",jr:"JE-2024-00144",pa:"2024-07-28 16:01",by:"anna.tamm" },
  { id:"PO-103",ty:"SEC_SELL",dt:"2024-06-14",de:"Sale MSFT 150 shares @ 420.10",dc:"C",to:62940,cy:"USD",eu:57825,cu:"CUST003",as:"MSFT",cp:"LHV",jr:"JE-2024-00145",pa:"2024-07-28 16:01",by:"anna.tamm" },
];
const SM = [
  { id:"ENR-014",og:"split",st:"enriched",gr:"a3f8b2c1",sq:1,dt:"2024-07-03",s:"S",ty:"SEC_SELL",de:"Sale GOOGL 80 shares (child 1/2)",to:14267,cy:"USD",cu:"CUST003",no:"Split from ENR-050: 40% to CUST003",ca:"2024-07-29 10:15" },
  { id:"ENR-015",og:"split",st:"enriched",gr:"a3f8b2c1",sq:2,dt:"2024-07-03",s:"S",ty:"SEC_SELL",de:"Sale GOOGL 120 shares (child 2/2)",to:21400.5,cy:"USD",cu:"CUST001",no:"Split from ENR-050: 60% to CUST001",ca:"2024-07-29 10:15" },
  { id:"ENR-016",og:"merge",st:"ready",gr:"d7e1f9a0",sq:null,dt:"2024-07-01",s:"S",ty:"SEC_BUY",de:"Merged: 3 SEC_BUY orders for TSLA",to:89550,cy:"USD",cu:"CUST002",no:"Merged from: ENR-030, ENR-031, ENR-032",ca:"2024-07-28 16:42" },
];

const SM_ = {new:{b:"#E3F2FD",f:"#1565C0"},processing:{b:"#FFF3E0",f:"#E65100"},enriched:{b:"#E8F5E9",f:"#2E7D32"},error:{b:"#FFEBEE",f:"#C62828"},manual_review:{b:"#FFF8E1",f:"#F57F17"},in_review:{b:"#F3E5F5",f:"#6A1B9A"},adjusted:{b:"#E0F2F1",f:"#00695C"},ready:{b:"#C8E6C9",f:"#1B5E20"},paired:{b:"#E8EAF6",f:"#283593"},superseded:{b:"#F5F5F5",f:"#9E9E9E"},confirmed:{b:"#E8F5E9",f:"#1B5E20"},pending:{b:"#E3F2FD",f:"#1565C0"},posted:{b:"#C8E6C9",f:"#1B5E20"},revoked:{b:"#F5F5F5",f:"#9E9E9E"}};
const CM_ = {rule_match:{b:"#E8F5E9",f:"#2E7D32"},tentative:{b:"#FFF8E1",f:"#F57F17"},unclassified:{b:"#FFEBEE",f:"#C62828"},manual_override:{b:"#E0F2F1",f:"#00695C"}};
const RT = {error:"#FFF5F5",manual_review:"#FFFDE7",ready:"#F1F8E9"};
const fmt = v => v!=null&&v!==0?Number(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"";
const trc = (s,n=52) => s&&s.length>n?s.slice(0,n)+"...":s;

const SB = ({v})=>{const c=SM_[v]||{b:"#f1f5f9",f:"#64748b"};return<span style={{background:c.b,color:c.f,padding:"2px 10px",borderRadius:12,fontSize:".79em",fontWeight:v==="error"||v==="ready"?700:500,whiteSpace:"nowrap",textDecoration:v==="superseded"||v==="revoked"?"line-through":"none"}}>{(v||"—").replace(/_/g," ")}</span>;};
const CB = ({v})=>{const c=CM_[v]||{b:"#f1f5f9",f:"#64748b"};return<span style={{background:c.b,color:c.f,padding:"2px 8px",borderRadius:8,fontSize:".75em",fontWeight:500,whiteSpace:"nowrap"}}>{(v||"—").replace(/_/g," ")}</span>;};
const OB = ({v})=>{const c=v==="split"?{b:"#F3E5F5",f:"#6A1B9A"}:v==="merge"?{b:"#E0F2F1",f:"#00695C"}:{b:"#f1f5f9",f:"#64748b"};return<span style={{background:c.b,color:c.f,padding:"2px 8px",borderRadius:8,fontSize:".75em",fontWeight:600}}>{v}</span>;};
const DC = ({v})=><span style={{color:v==="D"?"#C62828":"#2E7D32",fontWeight:700,fontFamily:"monospace",fontSize:".87em"}}>{v}</span>;
const Am = ({v,b})=><span style={{fontFamily:"monospace",fontSize:".85em",fontWeight:b?700:400}}>{fmt(v)}</span>;
const Sc = ({v})=><span style={{fontWeight:600,fontSize:".8em",color:v==="S"?"#1565C0":v==="B"?"#6A1B9A":"#00695C",background:v==="S"?"#E3F2FD":v==="B"?"#F3E5F5":"#E0F2F1",padding:"1px 6px",borderRadius:3}}>{v}</span>;
const Ck = ({checked,onChange,ind})=>{const r=useRef();useEffect(()=>{if(r.current)r.current.indeterminate=ind;},[ind]);return<input ref={r} type="checkbox" checked={checked} onChange={onChange} style={{width:15,height:15,accentColor:"#1a365d",cursor:"pointer"}}/>;};
const Bt = ({children,p,d:dng,sm,dis,onClick,ic})=><button disabled={dis} onClick={onClick} style={{display:"inline-flex",alignItems:"center",gap:5,padding:sm?"5px 11px":"8px 16px",borderRadius:5,border:p||dng?"none":"1px solid #cbd5e1",background:dis?"#e2e8f0":dng?"#dc2626":p?"#1a365d":"#fff",color:dis?"#94a3b8":p||dng?"#fff":"#334155",fontWeight:600,fontSize:sm?".77em":".83em",cursor:dis?"not-allowed":"pointer",whiteSpace:"nowrap"}}>{ic&&<span style={{fontSize:"1.05em"}}>{ic}</span>}{children}</button>;
const Tt = ({m,onClose})=>{useEffect(()=>{const t=setTimeout(onClose,4500);return()=>clearTimeout(t);},[onClose]);return<div style={{position:"fixed",top:16,right:16,background:"#1a365d",color:"#fff",padding:"10px 20px",borderRadius:8,boxShadow:"0 8px 28px rgba(0,0,0,.22)",zIndex:9999,fontSize:".86em",display:"flex",alignItems:"center",gap:9,animation:"fi .25s ease"}}><span style={{color:"#6ee7b7"}}>✓</span>{m}<button onClick={onClose} style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:14,marginLeft:8}}>×</button></div>;};

const Ov = ({children,onClose})=><div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(15,23,42,.48)",backdropFilter:"blur(3px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:10,boxShadow:"0 20px 60px rgba(0,0,0,.18)",maxWidth:700,width:"100%",maxHeight:"84vh",overflow:"auto"}}>{children}</div></div>;
const DH = ({t,ic,onClose})=><div style={{padding:"14px 20px",borderBottom:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:"1.05em"}}>{ic}</span><h3 style={{margin:0,fontSize:".98em",color:"#1e293b",fontWeight:600}}>{t}</h3></div><button onClick={onClose} style={{background:"none",border:"none",fontSize:17,color:"#94a3b8",cursor:"pointer"}}>×</button></div>;
const TH = ({children,a="left",w})=><th style={{padding:"7px 9px",textAlign:a,fontSize:".72em",color:"#64748b",borderBottom:"2px solid #e2e8f0",fontWeight:700,letterSpacing:".04em",textTransform:"uppercase",width:w,whiteSpace:"nowrap",position:"sticky",top:0,background:"#f8fafc",zIndex:1}}>{children}</th>;
const TD = ({children,a="left",bg,style:sx})=><td style={{padding:"6px 9px",textAlign:a,fontSize:".85em",borderBottom:"1px solid #f1f5f9",background:bg,...sx}}>{children}</td>;

function FS({title,n,children}){const[o,setO]=useState(true);return<div style={{marginTop:14}}><button onClick={()=>setO(!o)} style={{display:"flex",alignItems:"center",gap:7,width:"100%",background:"none",border:"none",borderBottom:"2px solid #e2e8f0",padding:"7px 0 5px",cursor:"pointer",textAlign:"left"}}><span style={{fontSize:".68em",color:"#94a3b8",fontWeight:700,background:"#f1f5f9",padding:"1px 5px",borderRadius:3}}>§{n}</span><span style={{fontSize:".86em",fontWeight:700,color:"#1e293b",flex:1}}>{title}</span><span style={{color:"#94a3b8",fontSize:".8em"}}>{o?"▾":"▸"}</span></button>{o&&<div style={{padding:"8px 0 2px"}}>{children}</div>}</div>;}
function FR({children}){return<div style={{display:"flex",gap:12,marginBottom:7,flexWrap:"wrap"}}>{children}</div>;}
function FF({l,v,ed,mu,mo,bo,wi,dc:isDc,badge,err,hi,ph}){const c=SM_[v]||CM_[v];return<div style={{flex:wi?"1 1 100%":"1 1 28%",minWidth:wi?200:110}}><div style={{fontSize:".68em",color:"#64748b",fontWeight:600,marginBottom:2}}>{l}</div>{badge&&c?<span style={{background:c.b,color:c.f,padding:"2px 9px",borderRadius:12,fontSize:".8em",fontWeight:500}}>{(v||"").replace(/_/g," ")}</span>:isDc?<span style={{color:v==="D"?"#C62828":"#2E7D32",fontWeight:700,fontSize:".88em"}}>{v==="D"?"D (Debit)":"C (Credit)"}</span>:ed?<input defaultValue={v} placeholder={ph||""} style={{width:"100%",fontSize:".86em",padding:"4px 7px",border:hi?"2px solid #f59e0b":"1px solid #e2e8f0",borderRadius:4,fontFamily:mo?"monospace":"inherit",fontWeight:bo?700:400,background:hi?"#FFFDE7":"#fff"}}/>:err?<div style={{fontSize:".83em",color:"#C62828",padding:"5px 8px",background:"#FFF5F5",borderRadius:4,border:"1px solid #fecaca"}}>{v}</div>:<div style={{fontSize:".86em",padding:"4px 0",color:mu?"#94a3b8":"#1e293b",fontFamily:mo?"monospace":"inherit",fontWeight:bo?700:400}}>{v||"—"}</div>}</div>;}

export default function App() {
  const [menu, setMenu] = useState("workspace");
  const [stmF, setStmF] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [dlg, setDlg] = useState(null);
  const [form, setForm] = useState(null);
  const [pSel, setPSel] = useState(new Set());

  const ready = WS.filter(r=>r.st==="ready");
  const togSel = id=>setSel(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const togAll = d=>setSel(p=>p.size===d.length?new Set():new Set(d.map(r=>r.id)));
  const sr = WS.filter(r=>sel.has(r.id));
  const ed = s=>["enriched","error","manual_review","in_review","adjusted","paired"].includes(s);

  const mis = [
    {id:"workspace",l:"Enrichment Workspace",ic:"📋",bd:WS.length},
    {id:"ready",l:"Ready for Posting",ic:"✓",bd:ready.length},
    {id:"queue",l:"Posting Queue",ic:"📤",bd:PQ.length},
    {id:"posted",l:"Posted Operations",ic:"📗",bd:PD.length},
    {id:"history",l:"Split/Merge History",ic:"🔀",bd:SM.length},
  ];

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"Segoe UI,Helvetica Neue,Arial,sans-serif",fontSize:14,color:"#1e293b",background:"#f1f5f9"}}>
      <style>{`@keyframes fi{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}} @keyframes si{from{transform:translateX(30px);opacity:0}to{transform:translateX(0);opacity:1}} ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px} *{box-sizing:border-box}`}</style>

      {/* Sidebar */}
      <div style={{width:232,background:"#1a365d",color:"#fff",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"16px 18px 12px",borderBottom:"1px solid rgba(255,255,255,.1)"}}>
          <div style={{fontSize:"1.02em",fontWeight:700,letterSpacing:".03em"}}>GAM</div>
          <div style={{fontSize:".7em",color:"#94a3b8",marginTop:1}}>Genesis Asset Management</div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"10px 0"}}>
          <div style={{padding:"10px 18px 5px",fontSize:".66em",fontWeight:700,color:"#64748b",letterSpacing:".08em"}}>ENRICHMENT</div>
          {mis.map(m=>(
            <button key={m.id} onClick={()=>{setMenu(m.id);setSel(new Set());setForm(null);setPSel(new Set());}} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"8px 18px",border:"none",background:menu===m.id?"rgba(255,255,255,.12)":"transparent",color:menu===m.id?"#fff":"#cbd5e1",cursor:"pointer",fontSize:".84em",textAlign:"left",borderLeft:menu===m.id?"3px solid #6ee7b7":"3px solid transparent"}}>
              <span style={{width:18,textAlign:"center"}}>{m.ic}</span><span style={{flex:1}}>{m.l}</span>
              {m.bd!=null&&<span style={{background:"rgba(255,255,255,.15)",padding:"1px 7px",borderRadius:10,fontSize:".76em",fontWeight:600}}>{m.bd}</span>}
            </button>
          ))}
          <div style={{padding:"14px 18px 5px",fontSize:".66em",fontWeight:700,color:"#64748b",letterSpacing:".08em"}}>OTHER</div>
          {[{id:"stm",l:"Statements",ic:"📁"},{id:"mdm",l:"Master Data",ic:"⚙"}].map(m=>(
            <button key={m.id} onClick={()=>{setMenu(m.id);}} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"8px 18px",border:"none",background:menu===m.id?"rgba(255,255,255,.12)":"transparent",color:menu===m.id?"#fff":"#cbd5e1",cursor:"pointer",fontSize:".84em",textAlign:"left",borderLeft:menu===m.id?"3px solid #6ee7b7":"3px solid transparent"}}>
              <span style={{width:18,textAlign:"center"}}>{m.ic}</span><span style={{flex:1}}>{m.l}</span>
            </button>
          ))}
        </div>
        <div style={{padding:"10px 18px",borderTop:"1px solid rgba(255,255,255,.1)",fontSize:".73em",color:"#64748b"}}>
          👤 anna.tamm<br/>Joget DX 8.1
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"10px 22px",background:"#fff",borderBottom:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <h1 style={{margin:0,fontSize:"1.05em",fontWeight:700}}>{mis.find(m=>m.id===menu)?.l||"GAM"}</h1>
            {stmF&&<span style={{fontSize:".78em",color:"#64748b"}}>Filtered: {stmF} <button onClick={()=>setStmF(null)} style={{background:"none",border:"none",color:"#3b82f6",cursor:"pointer",fontSize:".82em",textDecoration:"underline"}}>Clear</button></span>}
          </div>
          <div style={{fontSize:".76em",color:"#94a3b8"}}>Period: Jun–Aug 2024</div>
        </div>

        <div style={{flex:1,overflow:"auto",padding:menu==="workspace"?0:"18px 22px"}}>

          {/* ════ WORKSPACE ═══════════════════════════════════════════ */}
          {menu==="workspace"&&<div style={{display:"flex",flexDirection:"column",height:"100%"}}>
            {/* Summary */}
            {!stmF&&<div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"14px 22px"}}>
              <div style={{fontSize:".78em",fontWeight:700,color:"#64748b",marginBottom:8,letterSpacing:".04em",textTransform:"uppercase"}}>Statement Overview</div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#f8fafc"}}><TH>Statement</TH><TH a="right">Records</TH><TH a="right">New</TH><TH a="right">Working</TH><TH a="right">Ready</TH><TH a="right">Confirmed</TH><TH a="right">Errors</TH></tr></thead>
                <tbody>{STMTS.map(s=><tr key={s.id} onClick={()=>setStmF(s.id)} style={{cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <TD><span style={{color:"#1a365d",fontWeight:600}}>{s.ref}</span> <span style={{color:"#94a3b8",fontSize:".76em"}}>{s.id}</span></TD>
                  <TD a="right" style={{fontWeight:600}}>{s.total}</TD>
                  <TD a="right"><span style={{color:s.new_c>0?"#1565C0":"#94a3b8"}}>{s.new_c}</span></TD>
                  <TD a="right"><span style={{color:s.work>0?"#6A1B9A":"#94a3b8"}}>{s.work}</span></TD>
                  <TD a="right"><span style={{color:s.ready>0?"#1B5E20":"#94a3b8",fontWeight:s.ready>0?600:400}}>{s.ready}</span></TD>
                  <TD a="right"><span style={{color:s.conf>0?"#2E7D32":"#94a3b8"}}>{s.conf}</span></TD>
                  <TD a="right"><span style={{color:s.err>0?"#C62828":"#94a3b8",fontWeight:s.err>0?700:400}}>{s.err>0?"⚠ "+s.err:s.err}</span></TD>
                </tr>)}</tbody>
              </table>
              <div style={{marginTop:6,fontSize:".74em",color:"#94a3b8",fontStyle:"italic"}}>Click a statement row to filter the workspace below</div>
            </div>}

            {/* Toolbar */}
            <div style={{padding:"9px 22px",background:"#fff",borderBottom:"1px solid #e2e8f0",display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
              <Bt p sm dis={!sr.some(r=>r.st==="ready")} onClick={()=>setDlg({t:"confirm",d:sr})} ic="✓">Confirm for Posting</Bt>
              <Bt sm dis={!sr.some(r=>["enriched","adjusted","in_review","paired"].includes(r.st))} onClick={()=>{setToast("Records marked as ready");setSel(new Set());}} ic="→">Mark as Ready</Bt>
              <div style={{width:1,height:22,background:"#e2e8f0"}}/>
              <Bt sm dis={sr.length!==1||!["enriched","adjusted","in_review","ready"].includes(sr[0]?.st)} onClick={()=>setDlg({t:"split",d:sr[0]})} ic="⑂">Split</Bt>
              <Bt sm dis={sr.length<2||!sr.every(r=>["enriched","adjusted","in_review"].includes(r.st))} onClick={()=>setDlg({t:"merge",d:sr})} ic="⊕">Merge</Bt>
              <div style={{width:1,height:22,background:"#e2e8f0"}}/>
              <Bt sm dis={!sr.some(r=>["error","manual_review"].includes(r.st))} onClick={()=>{setToast("Records reset for reprocessing");setSel(new Set());}} ic="↻">Reprocess</Bt>
              <Bt sm d dis={!sr.some(r=>["new","error","manual_review"].includes(r.st))} onClick={()=>setDlg({t:"del"})} ic="×">Delete</Bt>
              <div style={{flex:1}}/>
              <Bt sm onClick={()=>setDlg({t:"manual"})} ic="＋">New Manual Entry</Bt>
              {sel.size>0&&<span style={{fontSize:".76em",color:"#64748b",padding:"3px 9px",background:"#f1f5f9",borderRadius:4}}>{sel.size} selected</span>}
            </div>

            {/* Filters */}
            <div style={{padding:"7px 22px",background:"#fafbfc",borderBottom:"1px solid #f1f5f9",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:".73em",color:"#94a3b8",fontWeight:600}}>FILTERS</span>
              <select style={{fontSize:".8em",padding:"3px 7px",border:"1px solid #e2e8f0",borderRadius:4}}><option>All Statuses</option>{["enriched","error","manual_review","in_review","adjusted","ready","paired"].map(s=><option key={s}>{s.replace(/_/g," ")}</option>)}</select>
              <select style={{fontSize:".8em",padding:"3px 7px",border:"1px solid #e2e8f0",borderRadius:4}}><option>All Sources</option><option>Bank (B)</option><option>Securities (S)</option><option>Manual (M)</option></select>
              <select style={{fontSize:".8em",padding:"3px 7px",border:"1px solid #e2e8f0",borderRadius:4}}><option>All Types</option>{["SEC_BUY","SEC_SELL","BOND_BUY","BOND_COUPON","DIV_INCOME","CASH_IN_OUT","FX_EXCHANGE","COMMISSION"].map(t=><option key={t}>{t}</option>)}</select>
              <input placeholder="Customer..." style={{fontSize:".8em",padding:"3px 7px",border:"1px solid #e2e8f0",borderRadius:4,width:90}}/>
              <input placeholder="Search description..." style={{fontSize:".8em",padding:"3px 7px",border:"1px solid #e2e8f0",borderRadius:4,width:140}}/>
            </div>

            {/* Main datalist */}
            <div style={{flex:1,overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:1180}}>
                <thead><tr style={{background:"#f8fafc"}}>
                  <TH w="34px"><Ck checked={sel.size===WS.length&&WS.length>0} ind={sel.size>0&&sel.size<WS.length} onChange={()=>togAll(WS)}/></TH>
                  <TH w="86px">Status</TH><TH w="38px">Src</TH><TH w="80px">Date</TH><TH w="92px">Type</TH><TH>Description</TH><TH w="34px" a="center">D/C</TH><TH w="92px" a="right">Amount</TH><TH w="72px" a="right">Fee</TH><TH w="96px" a="right">Total</TH><TH w="36px">Ccy</TH><TH w="74px">Customer</TH><TH w="56px">Asset</TH><TH w="38px">CP</TH><TH w="52px">Origin</TH><TH w="74px">Conf.</TH>
                </tr></thead>
                <tbody>{WS.map(r=>{const bg=RT[r.st]||"";return[
                  <tr key={r.id} style={{background:bg,cursor:"pointer"}} onMouseEnter={e=>{if(!bg)e.currentTarget.style.background="#fafbfc"}} onMouseLeave={e=>{if(!bg)e.currentTarget.style.background=""}}>
                    <TD bg={bg}><Ck checked={sel.has(r.id)} onChange={()=>togSel(r.id)}/></TD>
                    <TD bg={bg}><SB v={r.st}/></TD>
                    <TD bg={bg}><Sc v={r.s}/></TD>
                    <TD bg={bg} style={{fontSize:".82em",color:"#475569"}}>{r.dt}</TD>
                    <TD bg={bg} style={{fontSize:".82em",fontWeight:600}}>{r.ty||<span style={{color:"#dc2626",fontStyle:"italic"}}>—</span>}</TD>
                    <TD bg={bg} style={{fontSize:".82em"}} onClick={()=>setForm(r)}><span style={{color:"#1a365d",textDecoration:"underline",textDecorationColor:"#cbd5e1",cursor:"pointer"}}>{trc(r.de)}</span></TD>
                    <TD a="center" bg={bg}><DC v={r.dc}/></TD>
                    <TD a="right" bg={bg}><Am v={r.am}/></TD>
                    <TD a="right" bg={bg}><Am v={r.fe}/></TD>
                    <TD a="right" bg={bg}><Am v={r.to} b/></TD>
                    <TD bg={bg} style={{fontSize:".8em",fontWeight:600}}>{r.cy}</TD>
                    <TD bg={bg} style={{fontSize:".8em"}}>{r.cu||<span style={{color:"#dc2626"}}>⚠ missing</span>}</TD>
                    <TD bg={bg} style={{fontSize:".8em"}}>{r.as||"—"}</TD>
                    <TD bg={bg} style={{fontSize:".8em"}}>{r.cp||"—"}</TD>
                    <TD bg={bg} style={{fontSize:".76em"}}>{r.or}</TD>
                    <TD bg={bg}><CB v={r.co}/></TD>
                  </tr>,
                  r.st==="error"&&r.er&&<tr key={r.id+"e"} style={{background:"#FFF5F5"}}><td/><td colSpan={15} style={{padding:"3px 9px 7px",fontSize:".78em",color:"#C62828",fontStyle:"italic",borderBottom:"1px solid #fecaca"}}>⚠ {r.er}</td></tr>
                ];})}</tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{padding:"8px 22px",background:"#fff",borderTop:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:".8em",color:"#64748b"}}>
              <div>Showing 1–{WS.length} of {WS.length}</div>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                Page size: <select style={{fontSize:".88em",padding:"1px 5px",border:"1px solid #e2e8f0",borderRadius:3}}><option>20</option><option>10</option><option>50</option></select>
                <span>Page 1 of 1</span>
                <button disabled style={{border:"1px solid #e2e8f0",background:"#fff",borderRadius:3,padding:"1px 7px",color:"#94a3b8"}}>‹</button>
                <button disabled style={{border:"1px solid #e2e8f0",background:"#fff",borderRadius:3,padding:"1px 7px",color:"#94a3b8"}}>›</button>
              </div>
            </div>
          </div>}

          {/* ════ READY FOR POSTING ════════════════════════════════════ */}
          {menu==="ready"&&<div style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",overflow:"hidden"}}>
            <div style={{padding:"9px 14px",borderBottom:"1px solid #e2e8f0",display:"flex",gap:7}}>
              <Bt p sm dis={sel.size===0} onClick={()=>setDlg({t:"confirm",d:ready.filter(r=>sel.has(r.id))})} ic="✓">Confirm for Posting</Bt>
              <Bt sm dis={sel.size===0} onClick={()=>{setToast("Returned to workspace");setSel(new Set());}}>Return to Workspace</Bt>
            </div>
            <div style={{overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:950}}>
              <thead><tr style={{background:"#f8fafc"}}><TH w="34px"><Ck checked={sel.size===ready.length&&ready.length>0} ind={sel.size>0&&sel.size<ready.length} onChange={()=>togAll(ready)}/></TH><TH w="38px">Src</TH><TH w="80px">Date</TH><TH w="92px">Type</TH><TH>Description</TH><TH w="34px" a="center">D/C</TH><TH w="92px" a="right">Amount</TH><TH w="72px" a="right">Fee</TH><TH w="96px" a="right">Total</TH><TH w="36px">Ccy</TH><TH w="74px">Customer</TH><TH w="56px">Asset</TH><TH w="38px">CP</TH></tr></thead>
              <tbody>{ready.map(r=><tr key={r.id} style={{background:"#F1F8E9"}}>
                <TD bg="#F1F8E9"><Ck checked={sel.has(r.id)} onChange={()=>togSel(r.id)}/></TD>
                <TD bg="#F1F8E9"><Sc v={r.s}/></TD><TD bg="#F1F8E9" style={{fontSize:".82em"}}>{r.dt}</TD><TD bg="#F1F8E9" style={{fontSize:".82em",fontWeight:600}}>{r.ty}</TD><TD bg="#F1F8E9" style={{fontSize:".82em"}}>{trc(r.de)}</TD><TD a="center" bg="#F1F8E9"><DC v={r.dc}/></TD><TD a="right" bg="#F1F8E9"><Am v={r.am}/></TD><TD a="right" bg="#F1F8E9"><Am v={r.fe}/></TD><TD a="right" bg="#F1F8E9"><Am v={r.to} b/></TD><TD bg="#F1F8E9" style={{fontSize:".8em",fontWeight:600}}>{r.cy}</TD><TD bg="#F1F8E9" style={{fontSize:".8em"}}>{r.cu}</TD><TD bg="#F1F8E9" style={{fontSize:".8em"}}>{r.as||"—"}</TD><TD bg="#F1F8E9" style={{fontSize:".8em"}}>{r.cp}</TD>
              </tr>)}</tbody>
            </table></div>
          </div>}

          {/* ════ POSTING QUEUE ════════════════════════════════════════ */}
          {menu==="queue"&&<div style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",overflow:"hidden"}}>
            <div style={{padding:"9px 14px",borderBottom:"1px solid #e2e8f0",display:"flex",gap:7}}>
              <Bt sm d dis={pSel.size===0} onClick={()=>setDlg({t:"revoke",d:PQ.filter(r=>pSel.has(r.id)&&r.st==="pending")})} ic="↩">Revoke</Bt>
              <Bt sm dis={!PQ.some(r=>pSel.has(r.id)&&r.st==="error")} onClick={()=>{setToast("Error records reset for retry");setPSel(new Set());}} ic="↻">Retry</Bt>
            </div>
            <div style={{overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:1000}}>
              <thead><tr style={{background:"#f8fafc"}}><TH w="34px"><Ck checked={pSel.size===PQ.length&&PQ.length>0} ind={pSel.size>0&&pSel.size<PQ.length} onChange={()=>setPSel(p=>p.size===PQ.length?new Set():new Set(PQ.map(r=>r.id)))}/></TH><TH w="76px">Status</TH><TH w="80px">Date</TH><TH w="92px">Type</TH><TH>Description</TH><TH w="34px" a="center">D/C</TH><TH w="96px" a="right">Total</TH><TH w="36px">Ccy</TH><TH w="74px">Customer</TH><TH w="56px">Asset</TH><TH w="38px">CP</TH><TH w="80px">Confirmed</TH><TH w="110px">Conf. Date</TH></tr></thead>
              <tbody>{PQ.map(r=>[
                <tr key={r.id} style={{background:r.st==="error"?"#FFF5F5":""}}>
                  <TD bg={r.st==="error"?"#FFF5F5":""}><Ck checked={pSel.has(r.id)} onChange={()=>setPSel(p=>{const n=new Set(p);n.has(r.id)?n.delete(r.id):n.add(r.id);return n;})}/></TD>
                  <TD bg={r.st==="error"?"#FFF5F5":""}><SB v={r.st}/></TD><TD bg={r.st==="error"?"#FFF5F5":""} style={{fontSize:".82em"}}>{r.dt}</TD><TD bg={r.st==="error"?"#FFF5F5":""} style={{fontSize:".82em",fontWeight:600}}>{r.ty}</TD><TD bg={r.st==="error"?"#FFF5F5":""} style={{fontSize:".82em"}}>{trc(r.de)}</TD><TD a="center" bg={r.st==="error"?"#FFF5F5":""}><DC v={r.dc}/></TD><TD a="right" bg={r.st==="error"?"#FFF5F5":""}><Am v={r.to} b/></TD><TD bg={r.st==="error"?"#FFF5F5":""} style={{fontSize:".8em",fontWeight:600}}>{r.cy}</TD><TD bg={r.st==="error"?"#FFF5F5":""} style={{fontSize:".8em"}}>{r.cu}</TD><TD bg={r.st==="error"?"#FFF5F5":""} style={{fontSize:".8em"}}>{r.as||"—"}</TD><TD bg={r.st==="error"?"#FFF5F5":""} style={{fontSize:".8em"}}>{r.cp}</TD><TD bg={r.st==="error"?"#FFF5F5":""} style={{fontSize:".8em"}}>{r.by}</TD><TD bg={r.st==="error"?"#FFF5F5":""} style={{fontSize:".8em",color:"#64748b"}}>{r.at}</TD>
                </tr>,
                r.st==="error"&&r.er&&<tr key={r.id+"e"} style={{background:"#FFF5F5"}}><td/><td colSpan={12} style={{padding:"3px 9px 7px",fontSize:".78em",color:"#C62828",fontStyle:"italic",borderBottom:"1px solid #fecaca"}}>⚠ {r.er}</td></tr>
              ])}</tbody>
            </table></div>
          </div>}

          {/* ════ POSTED OPERATIONS ════════════════════════════════════ */}
          {menu==="posted"&&<div style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",overflow:"hidden"}}>
            <div style={{padding:"9px 14px",borderBottom:"1px solid #e2e8f0",fontSize:".8em",color:"#64748b",fontStyle:"italic"}}>Read-only audit trail — posted journal entries</div>
            <div style={{overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:1050}}>
              <thead><tr style={{background:"#f8fafc"}}><TH w="110px">Posted</TH><TH w="80px">Trx Date</TH><TH w="92px">Type</TH><TH>Description</TH><TH w="34px" a="center">D/C</TH><TH w="96px" a="right">Total</TH><TH w="36px">Ccy</TH><TH w="92px" a="right">EUR Amt</TH><TH w="74px">Customer</TH><TH w="56px">Asset</TH><TH w="38px">CP</TH><TH w="96px">Journal</TH><TH w="76px">By</TH></tr></thead>
              <tbody>{PD.map(r=><tr key={r.id}>
                <TD style={{fontSize:".8em",color:"#64748b"}}>{r.pa}</TD><TD style={{fontSize:".82em"}}>{r.dt}</TD><TD style={{fontSize:".82em",fontWeight:600}}>{r.ty}</TD><TD style={{fontSize:".82em"}}>{trc(r.de)}</TD><TD a="center"><DC v={r.dc}/></TD><TD a="right"><Am v={r.to} b/></TD><TD style={{fontSize:".8em",fontWeight:600}}>{r.cy}</TD><TD a="right"><Am v={r.eu}/></TD><TD style={{fontSize:".8em"}}>{r.cu}</TD><TD style={{fontSize:".8em"}}>{r.as||"—"}</TD><TD style={{fontSize:".8em"}}>{r.cp}</TD><TD style={{fontSize:".8em",color:"#1a365d",fontWeight:600,fontFamily:"monospace"}}>{r.jr}</TD><TD style={{fontSize:".8em",color:"#64748b"}}>{r.by}</TD>
              </tr>)}</tbody>
            </table></div>
          </div>}

          {/* ════ SPLIT/MERGE HISTORY ═════════════════════════════════ */}
          {menu==="history"&&<div style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",overflow:"hidden"}}>
            <div style={{padding:"9px 14px",borderBottom:"1px solid #e2e8f0",fontSize:".8em",color:"#64748b",fontStyle:"italic"}}>Read-only audit — split and merge operations</div>
            <div style={{overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:1050}}>
              <thead><tr style={{background:"#f8fafc"}}><TH w="58px">Origin</TH><TH w="76px">Status</TH><TH w="66px">Group</TH><TH w="34px">Seq</TH><TH w="80px">Date</TH><TH w="38px">Src</TH><TH w="92px">Type</TH><TH>Description</TH><TH w="96px" a="right">Total</TH><TH w="36px">Ccy</TH><TH w="74px">Customer</TH><TH w="180px">Lineage Note</TH><TH w="110px">Created</TH></tr></thead>
              <tbody>{SM.map(r=><tr key={r.id}>
                <TD><OB v={r.og}/></TD><TD><SB v={r.st}/></TD><TD style={{fontSize:".76em",fontFamily:"monospace",color:"#64748b"}}>{r.gr.slice(0,8)}</TD><TD style={{textAlign:"center"}}>{r.sq||"—"}</TD><TD style={{fontSize:".82em"}}>{r.dt}</TD><TD><Sc v={r.s}/></TD><TD style={{fontSize:".82em",fontWeight:600}}>{r.ty}</TD><TD style={{fontSize:".82em"}}>{trc(r.de,42)}</TD><TD a="right"><Am v={r.to} b/></TD><TD style={{fontSize:".8em",fontWeight:600}}>{r.cy}</TD><TD style={{fontSize:".8em"}}>{r.cu}</TD><TD style={{fontSize:".76em",color:"#64748b",fontStyle:"italic"}}>{trc(r.no,46)}</TD><TD style={{fontSize:".8em",color:"#64748b"}}>{r.ca}</TD>
              </tr>)}</tbody>
            </table></div>
          </div>}

          {/* Placeholder pages */}
          {menu==="stm"&&<div style={{padding:36,textAlign:"center",color:"#94a3b8"}}><div style={{fontSize:42,marginBottom:10}}>📁</div><p>Statements list — each row links to Enrichment Workspace</p></div>}
          {menu==="mdm"&&<div style={{padding:36,textAlign:"center",color:"#94a3b8"}}><div style={{fontSize:42,marginBottom:10}}>⚙</div><p>Master Data: Customers, Assets, Counterparties, FX Rates, Transaction Types</p></div>}
        </div>
      </div>

      {/* ════ FORM SLIDE-OVER ════════════════════════════════════════ */}
      {form&&<div style={{position:"fixed",inset:0,zIndex:900,display:"flex"}}>
        <div onClick={()=>setForm(null)} style={{flex:1,background:"rgba(15,23,42,.3)",backdropFilter:"blur(2px)"}}/>
        <div style={{width:580,background:"#fff",boxShadow:"-6px 0 36px rgba(0,0,0,.1)",overflow:"auto",animation:"si .2s ease"}}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#f8fafc",position:"sticky",top:0,zIndex:2}}>
            <div><div style={{fontSize:".74em",color:"#64748b"}}>Enrichment Record</div><h2 style={{margin:"1px 0 0",fontSize:".96em",fontWeight:700}}>{form.id}</h2></div>
            <div style={{display:"flex",gap:7,alignItems:"center"}}><SB v={form.st}/><button onClick={()=>setForm(null)} style={{background:"none",border:"none",fontSize:18,color:"#94a3b8",cursor:"pointer"}}>×</button></div>
          </div>
          <div style={{padding:"0 20px 18px"}}>
            <FS title="Traceability" n="1"><FR><FF l="Source Type" v={form.s==="S"?"Securities":form.s==="B"?"Bank":"Manual"}/><FF l="Source Trx ID" v={form.id+"-src"} mu/><FF l="Statement" v="STM-2024-07" mu/></FR></FS>
            {form.or!=="pipeline"&&<FS title="Lineage" n="2"><FR><FF l="Origin" v={form.or}/><FF l="Parent ID" v="ENR-050" mu/><FF l="Group" v="a3f8b2c1" mu/><FF l="Seq" v="1" mu/></FR><FR><FF l="Lineage Note" v={"Split from ENR-050: allocation to "+form.cu} wi/></FR></FS>}
            <FS title="Transaction" n="3"><FR><FF l="Transaction Date" v={form.dt} ed={ed(form.st)}/><FF l="Settlement Date" v="2024-07-04" ed={ed(form.st)}/><FF l="D/C" v={form.dc} dc/></FR><FR><FF l="Amount" v={fmt(form.am)} mo ed={ed(form.st)}/><FF l="Fee" v={fmt(form.fe)} mo ed={ed(form.st)}/><FF l="Total" v={fmt(form.to)} mo bo/></FR><FR><FF l="Source Currency" v={form.cy} ed={ed(form.st)}/></FR><FR><FF l="Description" v={form.de} wi ed={ed(form.st)}/></FR></FS>
            <FS title="Classification" n="4"><FR><FF l="Internal Type" v={form.ty||"—"} ed={ed(form.st)} hi={!form.ty}/><FF l="Confidence" v={form.co} badge/><FF l="Matched Rule" v="R-SEC-001" mu/></FR></FS>
            <FS title="Currency & FX" n="5"><FR><FF l="Validated Currency" v={form.cy}/><FF l="FX Rate to EUR" v={form.cy==="EUR"?"1.0000":"1.0892"} mo ed={form.cy!=="EUR"&&ed(form.st)}/><FF l="Rate Date" v="2024-07-02"/></FR><FR><FF l="Rate Source" v={form.cy==="EUR"?"—":"ECB"}/><FF l="EUR Amount" v={fmt(form.cy==="EUR"?form.to:form.to/1.0892)} mo/><FF l="EUR Parallel" v="No"/></FR></FS>
            <FS title="Resolved Entities" n="6"><FR><FF l="Customer ID" v={form.cu?"cid-"+form.cu:""} ed={ed(form.st)} hi={!form.cu}/><FF l="Customer Code" v={form.cu} ed={ed(form.st)} hi={!form.cu}/><FF l="Match Method" v={form.cu?"isin_lookup":"—"} mu/></FR><FR><FF l="Asset ID" v={form.as?"aid-"+form.as:""} ed={ed(form.st)}/><FF l="ISIN" v={form.as?"US0000"+form.as:""}/><FF l="Asset Category" v={form.as?"equity":""}/></FR><FR><FF l="Counterparty ID" v={form.cp?"cpid-"+form.cp:""} ed={ed(form.st)}/><FF l="CP Code" v={form.cp}/><FF l="CP Source" v={form.cp?"config":"—"} mu/></FR></FS>
            {(form.fe>0||form.st==="paired")&&<FS title="Fee & Pairing" n="7"><FR><FF l="Has Fee" v={form.fe>0?"Y":"N"}/><FF l="Fee Trx ID" v={form.fe>0?"ENR-xxx-fee":"—"} mu/><FF l="Pair ID" v={form.st==="paired"?"PAIR-001":"—"} mu/></FR></FS>}
            <FS title="Status & Notes" n="8"><FR><FF l="Status" v={form.st} badge/><FF l="Enrichment Time" v="2024-07-28 09:15:32" mu/><FF l="Version" v="1" mu/></FR>{form.st==="error"&&form.er&&<FR><FF l="Error Message" v={form.er} wi err/></FR>}<FR><FF l="Processing Notes" v="" wi ed={ed(form.st)} ph="Add notes about this record..."/></FR></FS>
          </div>
          <div style={{padding:"12px 20px",borderTop:"1px solid #e2e8f0",display:"flex",gap:7,justifyContent:"space-between",background:"#f8fafc",position:"sticky",bottom:0,zIndex:2}}>
            <div style={{display:"flex",gap:7}}>
              {ed(form.st)&&<Bt p onClick={()=>{setForm(null);setToast("Record saved")}}>Save</Bt>}
              <Bt onClick={()=>setForm(null)}>Close</Bt>
            </div>
            <div style={{display:"flex",gap:7}}>
              {["enriched","adjusted","in_review","paired"].includes(form.st)&&<Bt sm onClick={()=>{setForm(null);setToast("Marked as ready")}} ic="→">Mark as Ready</Bt>}
              {form.st==="ready"&&<Bt sm onClick={()=>{setForm(null);setToast("Returned to editing")}} ic="↩">Return to Editing</Bt>}
              {["enriched","adjusted","in_review"].includes(form.st)&&<Bt sm onClick={()=>{setForm(null);setDlg({t:"split",d:form})}} ic="⑂">Split</Bt>}
            </div>
          </div>
        </div>
      </div>}

      {/* ════ DIALOGS ════════════════════════════════════════════════ */}
      {dlg?.t==="confirm"&&<Ov onClose={()=>setDlg(null)}><DH t="Confirm for Posting — Reconciliation" ic="✓" onClose={()=>setDlg(null)}/><div style={{padding:20}}>
        <div style={{display:"flex",gap:18,marginBottom:14,fontSize:".86em",color:"#475569"}}><div><strong>Statement:</strong> STM-2024-07</div><div><strong>Confirming:</strong> {dlg.d?.length||0} records</div></div>
        <table style={{width:"100%",borderCollapse:"collapse",marginBottom:12}}><thead><tr style={{background:"#f8fafc"}}>{["Currency","Source Input","Output (posted+batch)","Remaining","Discrepancy"].map(h=><th key={h} style={{padding:"7px 9px",textAlign:h==="Currency"?"left":"right",fontSize:".72em",color:"#64748b",borderBottom:"2px solid #e2e8f0",fontWeight:700,letterSpacing:".04em",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
        <tbody><tr><TD style={{fontWeight:600}}>EUR</TD><TD a="right"><Am v={52575}/></TD><TD a="right"><Am v={38000}/></TD><TD a="right"><Am v={14575}/></TD><TD a="right"><span style={{color:"#16a34a",fontWeight:600}}>0.00 ✓</span></TD></tr><tr><TD style={{fontWeight:600}}>USD</TD><TD a="right"><Am v={273817.5}/></TD><TD a="right"><Am v={162305}/></TD><TD a="right"><Am v={111512.5}/></TD><TD a="right"><span style={{color:"#16a34a",fontWeight:600}}>0.00 ✓</span></TD></tr></tbody></table>
        <p style={{fontSize:".8em",color:"#64748b",marginBottom:18,fontStyle:"italic"}}>Partial confirmation — active records remain. Discrepancies may resolve as remaining records are processed.</p>
        <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Bt p onClick={()=>{setDlg(null);setToast((dlg.d?.length||0)+" records confirmed for posting");setSel(new Set());}}>Confirm ({dlg.d?.length||0})</Bt><Bt onClick={()=>setDlg(null)}>Cancel</Bt></div>
      </div></Ov>}

      {dlg?.t==="split"&&<Ov onClose={()=>setDlg(null)}><DH t="Split Transaction" ic="⑂" onClose={()=>setDlg(null)}/><div style={{padding:20}}>
        <div style={{background:"#f8fafc",borderRadius:6,padding:12,marginBottom:16,fontSize:".86em"}}>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}><div><span style={{color:"#64748b"}}>Source:</span> <strong>{dlg.d?.id}</strong></div><div><span style={{color:"#64748b"}}>Type:</span> <strong>{dlg.d?.ty}</strong></div><div><span style={{color:"#64748b"}}>Asset:</span> <strong>{dlg.d?.as}</strong></div><div><span style={{color:"#64748b"}}>Amount:</span> <strong>{fmt(dlg.d?.am)}</strong> {dlg.d?.cy}</div></div>
        </div>
        <div style={{fontSize:".8em",fontWeight:700,marginBottom:8}}>Allocations:</div>
        <table style={{width:"100%",borderCollapse:"collapse",marginBottom:8}}><thead><tr style={{background:"#f8fafc"}}><th style={{padding:"6px 8px",textAlign:"left",fontSize:".72em",color:"#64748b",borderBottom:"2px solid #e2e8f0",fontWeight:700,width:28}}>#</th><th style={{padding:"6px 8px",textAlign:"left",fontSize:".72em",color:"#64748b",borderBottom:"2px solid #e2e8f0",fontWeight:700}}>Customer</th><th style={{padding:"6px 8px",textAlign:"right",fontSize:".72em",color:"#64748b",borderBottom:"2px solid #e2e8f0",fontWeight:700}}>Amount</th><th style={{padding:"6px 8px",textAlign:"right",fontSize:".72em",color:"#64748b",borderBottom:"2px solid #e2e8f0",fontWeight:700}}>Fee</th><th style={{padding:"6px 8px",textAlign:"right",fontSize:".72em",color:"#64748b",borderBottom:"2px solid #e2e8f0",fontWeight:700}}>Total</th></tr></thead>
        <tbody>{[{n:1,c:"CUST001",p:.6},{n:2,c:"CUST002",p:.4}].map(r=>{const a=Math.round((dlg.d?.am||0)*r.p*100)/100,f=Math.round((dlg.d?.fe||0)*r.p*100)/100;return<tr key={r.n}><TD>{r.n}</TD><TD><select style={{fontSize:".88em",padding:"3px 7px",border:"1px solid #e2e8f0",borderRadius:4,width:"100%"}}><option>{r.c}</option><option>CUST003</option></select></TD><TD a="right"><input defaultValue={fmt(a)} style={{width:95,textAlign:"right",fontSize:".86em",padding:"3px 7px",border:"1px solid #e2e8f0",borderRadius:4,fontFamily:"monospace"}} readOnly/></TD><TD a="right"><input defaultValue={fmt(f)} style={{width:75,textAlign:"right",fontSize:".86em",padding:"3px 7px",border:"1px solid #e2e8f0",borderRadius:4,fontFamily:"monospace"}} readOnly/></TD><TD a="right" style={{fontWeight:700,fontFamily:"monospace",fontSize:".86em"}}>{fmt(a+f)}</TD></tr>;})}</tbody></table>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 9px",background:"#f8fafc",borderRadius:6,fontSize:".82em",marginBottom:14}}>
          <div style={{display:"flex",gap:14}}><span>Sum: <strong>{fmt(dlg.d?.am)}</strong></span><span>Fee Sum: <strong>{fmt(dlg.d?.fe)}</strong></span></div>
          <span style={{color:"#16a34a",fontWeight:700}}>Remaining: 0.00 ✓</span>
        </div>
        <button style={{fontSize:".8em",color:"#3b82f6",background:"none",border:"none",cursor:"pointer",marginBottom:14}}>+ Add Row</button>
        <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Bt p onClick={()=>{setDlg(null);setForm(null);setToast("Split complete: 2 records created from "+dlg.d?.id);setSel(new Set());}}>Confirm Split</Bt><Bt onClick={()=>setDlg(null)}>Cancel</Bt></div>
      </div></Ov>}

      {dlg?.t==="merge"&&<Ov onClose={()=>setDlg(null)}><DH t="Merge Transactions" ic="⊕" onClose={()=>setDlg(null)}/><div style={{padding:20}}>
        <div style={{fontSize:".82em",fontWeight:600,marginBottom:8}}>Merging {dlg.d?.length} records:</div>
        <table style={{width:"100%",borderCollapse:"collapse",marginBottom:14}}><thead><tr style={{background:"#f8fafc"}}>{["Record","Type","Amount","Fee","Total"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:h==="Record"||h==="Type"?"left":"right",fontSize:".72em",color:"#64748b",borderBottom:"2px solid #e2e8f0",fontWeight:700}}>{h}</th>)}</tr></thead>
        <tbody>{dlg.d?.map(r=><tr key={r.id}><TD style={{fontFamily:"monospace",fontSize:".82em"}}>{r.id}</TD><TD style={{fontWeight:600,fontSize:".82em"}}>{r.ty}</TD><TD a="right"><Am v={r.am}/></TD><TD a="right"><Am v={r.fe}/></TD><TD a="right"><Am v={r.to} b/></TD></tr>)}
        <tr style={{borderTop:"2px solid #e2e8f0"}}><TD style={{fontWeight:700}}>TOTAL</TD><TD/><TD a="right"><Am v={dlg.d?.reduce((s,r)=>s+r.am,0)} b/></TD><TD a="right"><Am v={dlg.d?.reduce((s,r)=>s+r.fe,0)}/></TD><TD a="right"><Am v={dlg.d?.reduce((s,r)=>s+r.to,0)} b/></TD></tr></tbody></table>
        <div style={{fontSize:".8em",fontWeight:700,marginBottom:8}}>Merged Record Fields:</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 14px",marginBottom:16}}>
          {[{l:"Internal Type",v:dlg.d?.[0]?.ty},{l:"Customer",v:dlg.d?.[0]?.cu},{l:"Asset",v:dlg.d?.[0]?.as},{l:"Counterparty",v:dlg.d?.[0]?.cp},{l:"D/C",v:dlg.d?.[0]?.dc},{l:"Date",v:dlg.d?.reduce((m,r)=>r.dt<m?r.dt:m,dlg.d[0]?.dt)}].map(f=><div key={f.l}><div style={{fontSize:".72em",color:"#64748b",fontWeight:600,marginBottom:2}}>{f.l}</div><input defaultValue={f.v} style={{width:"100%",fontSize:".86em",padding:"4px 7px",border:"1px solid #e2e8f0",borderRadius:4}}/></div>)}
          <div style={{gridColumn:"span 2"}}><div style={{fontSize:".72em",color:"#64748b",fontWeight:600,marginBottom:2}}>Description</div><input defaultValue={`Merged: ${dlg.d?.length} ${dlg.d?.[0]?.ty} orders`} style={{width:"100%",fontSize:".86em",padding:"4px 7px",border:"1px solid #e2e8f0",borderRadius:4}}/></div>
        </div>
        <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Bt p onClick={()=>{setDlg(null);setToast(dlg.d?.length+" records merged into 1");setSel(new Set());}}>Confirm Merge</Bt><Bt onClick={()=>setDlg(null)}>Cancel</Bt></div>
      </div></Ov>}

      {dlg?.t==="revoke"&&<Ov onClose={()=>setDlg(null)}><DH t="Revoke Posting Operation" ic="↩" onClose={()=>setDlg(null)}/><div style={{padding:20}}>
        <p style={{fontSize:".86em",color:"#475569",margin:"0 0 10px"}}>Revoking <strong>{dlg.d?.length||0}</strong> posting operations. Returns linked records to editable status.</p>
        <div style={{background:"#f8fafc",borderRadius:6,padding:10,marginBottom:14,fontSize:".82em"}}><div style={{fontWeight:600,marginBottom:5}}>Affected records:</div>{dlg.d?.map(r=><div key={r.id} style={{color:"#475569",padding:"1px 0"}}>• {r.id} ({r.ty}, {r.as||"cash"}, {fmt(r.to)} {r.cy})</div>)}</div>
        <div style={{marginBottom:14}}><div style={{fontSize:".76em",color:"#64748b",fontWeight:600,marginBottom:3}}>Reason for revocation *</div><textarea placeholder="Describe why..." style={{width:"100%",height:70,fontSize:".86em",padding:"7px 9px",border:"1px solid #e2e8f0",borderRadius:4,resize:"vertical",fontFamily:"inherit"}}/></div>
        <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Bt d onClick={()=>{setDlg(null);setToast("Posting operations revoked");setPSel(new Set());}}>Revoke</Bt><Bt onClick={()=>setDlg(null)}>Cancel</Bt></div>
      </div></Ov>}

      {dlg?.t==="del"&&<Ov onClose={()=>setDlg(null)}><DH t="Delete Records" ic="×" onClose={()=>setDlg(null)}/><div style={{padding:20}}>
        <p style={{fontSize:".86em",color:"#475569"}}>Delete <strong>{sr.filter(r=>["new","error","manual_review"].includes(r.st)).length}</strong> selected records? This cannot be undone.</p>
        <div style={{display:"flex",gap:9,justifyContent:"flex-end",marginTop:14}}><Bt d onClick={()=>{setDlg(null);setToast("Records deleted");setSel(new Set());}}>Delete</Bt><Bt onClick={()=>setDlg(null)}>Cancel</Bt></div>
      </div></Ov>}

      {dlg?.t==="manual"&&<Ov onClose={()=>setDlg(null)}><DH t="New Manual Enrichment Record" ic="＋" onClose={()=>setDlg(null)}/><div style={{padding:20}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 14px",marginBottom:16}}>
          <div style={{gridColumn:"span 2"}}><div style={{fontSize:".72em",color:"#64748b",fontWeight:600,marginBottom:2}}>Statement *</div><select style={{width:"100%",fontSize:".86em",padding:"4px 7px",border:"1px solid #e2e8f0",borderRadius:4}}><option>STM-2024-07 (LHV Jul 2024)</option><option>STM-2024-06</option></select></div>
          <div><div style={{fontSize:".72em",color:"#64748b",fontWeight:600,marginBottom:2}}>Type *</div><select style={{width:"100%",fontSize:".86em",padding:"4px 7px",border:"1px solid #e2e8f0",borderRadius:4}}><option>CASH_IN_OUT</option><option>SEC_BUY</option><option>SEC_SELL</option><option>COMMISSION</option></select></div>
          <div><div style={{fontSize:".72em",color:"#64748b",fontWeight:600,marginBottom:2}}>Date *</div><input type="date" defaultValue="2024-07-25" style={{width:"100%",fontSize:".86em",padding:"4px 7px",border:"1px solid #e2e8f0",borderRadius:4}}/></div>
          <div><div style={{fontSize:".72em",color:"#64748b",fontWeight:600,marginBottom:2}}>D/C *</div><select style={{width:"100%",fontSize:".86em",padding:"4px 7px",border:"1px solid #e2e8f0",borderRadius:4}}><option>C (Credit)</option><option>D (Debit)</option></select></div>
          <div><div style={{fontSize:".72em",color:"#64748b",fontWeight:600,marginBottom:2}}>Amount *</div><input placeholder="0.00" style={{width:"100%",fontSize:".86em",padding:"4px 7px",border:"1px solid #e2e8f0",borderRadius:4,fontFamily:"monospace"}}/></div>
          <div><div style={{fontSize:".72em",color:"#64748b",fontWeight:600,marginBottom:2}}>Currency *</div><input defaultValue="EUR" style={{width:"100%",fontSize:".86em",padding:"4px 7px",border:"1px solid #e2e8f0",borderRadius:4}}/></div>
          <div><div style={{fontSize:".72em",color:"#64748b",fontWeight:600,marginBottom:2}}>Customer *</div><select style={{width:"100%",fontSize:".86em",padding:"4px 7px",border:"1px solid #e2e8f0",borderRadius:4}}><option>CUST001</option><option>CUST002</option><option>CUST003</option></select></div>
          <div style={{gridColumn:"span 2"}}><div style={{fontSize:".72em",color:"#64748b",fontWeight:600,marginBottom:2}}>Description *</div><input placeholder="Manual adj: reason..." style={{width:"100%",fontSize:".86em",padding:"4px 7px",border:"1px solid #e2e8f0",borderRadius:4}}/></div>
        </div>
        <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Bt p onClick={()=>{setDlg(null);setToast("Manual record created");}}>Create</Bt><Bt onClick={()=>setDlg(null)}>Cancel</Bt></div>
      </div></Ov>}

      {toast&&<Tt m={toast} onClose={()=>setToast(null)}/>}
    </div>
  );
}
