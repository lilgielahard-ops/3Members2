# 3Members2[3Members.html](https://github.com/user-attachments/files/23013032/3Members.html)
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>3Members — Ping & Localidade</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@3.4.1/dist/css/bootstrap.min.css" rel="stylesheet">

<style>
  :root{
    --bg-dark:#111214;
    --bg-light:#1e1f23;
    --accent:#4f91ff;
    --muted:rgba(255,255,255,0.75);
    --card-bg:rgba(255,255,255,0.03);
  }
  html,body{height:100%;margin:0;font-family:'Kanit',sans-serif;background:linear-gradient(180deg,var(--bg-dark),var(--bg-light)); color:#fff;}
  #wrapper{position:relative; z-index:10; padding:20px; min-height:100vh;}
  .white-box{background:var(--card-bg); border-radius:12px; padding:18px; margin-bottom:18px; box-shadow:0 8px 24px rgba(0,0,0,0.5);}
  .btn-primary{background:var(--accent); border:none; color:#fff; font-weight:700;}
  .btn-primary:hover{opacity:0.9; transform: translateY(-1px);}
  .inline-timer{display:inline-block;margin-left:12px;font-weight:700;color:var(--accent);}
  .small-muted{ color: var(--muted); font-size:13px; }
  .result-row{display:flex; gap:12px; align-items:center; flex-wrap:wrap;}
  .chip{background: rgba(255,255,255,0.03); padding:8px 12px; border-radius:10px; color:var(--muted); font-weight:600;}
</style>
</head>
<body>

<div id="wrapper" class="container-fluid">
  <div class="row">
    <div class="col-md-6 col-md-offset-3">
      <div class="white-box">
        <h3 class="box-title">Action Hub — Ping & Localidade</h3>
        <p class="small-muted">Interface visual — estimativa de latência (HTTP) e geolocalização por IP.</p>

        <form class="form-horizontal" onsubmit="return false;">
          <div class="form-group">
            <label class="control-label">Target</label>
            <input class="form-control" id="host" placeholder="example.com or 1.1.1.1" />
          </div>

          <div class="form-group">
            <label class="control-label">Port</label>
            <input class="form-control" id="port" placeholder="80 or 443 (opcional)" />
          </div>

          <div class="form-group">
            <label class="control-label">Time (s)</label>
            <input class="form-control" id="time" placeholder="30" />
            <span class="small-muted">Contador visual apenas. Máx: 22000 s.</span>
          </div>

          <div class="form-group">
            <button class="btn btn-primary" id="startBtn" type="button">Start</button>
            <button class="btn btn-default" id="clearBtn" type="button" style="margin-left:8px;">Clear</button>
            <span id="timerDisplay" class="inline-timer" style="display:none;">00:00</span>
          </div>
        </form>

        <div id="actionLog" style="margin-top:18px; color:var(--muted);">
          Nenhuma ação em andamento.
        </div>

        <hr style="border-color: rgba(255,255,255,0.03); margin-top:14px;">

        <div id="liveResults">
          <div class="result-row">
            <div class="chip">IP: <span id="resIP">—</span></div>
            <div class="chip">Ping (ms): <span id="resPing">—</span></div>
            <div class="chip">Localidade: <span id="resLoc">—</span></div>
            <div class="chip">ASN/Org: <span id="resOrg">—</span></div>
          </div>
          <div id="resNotes" style="margin-top:10px;color:var(--muted);font-size:13px;">Clique <strong>Start</strong>.</div>
        </div>
      </div>
    </div>
  </div>
</div>

<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script>
function formatTime(s){
  s=Math.max(0,Math.floor(s));
  const mm=Math.floor(s/60).toString().padStart(2,'0');
  const ss=(s%60).toString().padStart(2,'0');
  return mm+':'+ss;
}

async function resolveHostnameToIPs(host){
  const ipRegex=/^(25[0-5]|2[0-4]\d|1?\d{1,2})(\.(25[0-5]|2[0-4]\d|1?\d{1,2})){3}$/;
  if(ipRegex.test(host)) return [host];
  try{
    const resp=await fetch('https://dns.google/resolve?name='+encodeURIComponent(host)+'&type=A',{cache:'no-store'});
    const json=await resp.json();
    if(json && Array.isArray(json.Answer)){
      return Array.from(new Set(json.Answer.filter(a=>a.type===1).map(a=>a.data)));
    }
  }catch(e){console.warn(e);}
  return [];
}

async function measureHttpPing(targetHost,port){
  const scheme = (!port||port==443)?'https':'http';
  const url = `${scheme}://${targetHost}${port&&(scheme==='http'?port!=80:port!=443)?':' + port:''}/favicon.ico`;
  try{
    const start=performance.now();
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),3000);
    await fetch(url,{method:'GET',mode:'no-cors',cache:'no-store',signal:controller.signal});
    clearTimeout(timeout);
    return Math.round(performance.now()-start);
  }catch{return null;}
}

async function geolocateIP(ip){
  try{
    const resp=await fetch('https://ipapi.co/'+encodeURIComponent(ip)+'/json/',{cache:'no-store'});
    const json=await resp.json();
    return {city:json.city||'',region:json.region||'',country:json.country_name||'',org:json.org||json.asn||''};
  }catch{return null;}
}

function setResult(id,val){document.getElementById(id).textContent=val||'—';}

let countdownInterval=null;
document.getElementById('startBtn').addEventListener('click',async()=>{
  const host=document.getElementById('host').value.trim();
  const port=document.getElementById('port').value.trim();
  let seconds=parseInt(document.getElementById('time').value)||30;
  if(seconds>22000) seconds=22000;

  const timerEl=document.getElementById('timerDisplay');
  const actionLog=document.getElementById('actionLog');

  setResult('resIP','—'); setResult('resPing','—'); setResult('resLoc','—'); setResult('resOrg','—');
  document.getElementById('resNotes').textContent='Resolvendo...';

  if(!host){actionLog.innerHTML='Por favor insira host/IP'; return;}

  timerEl.style.display='inline-block'; timerEl.textContent=formatTime(seconds);
  actionLog.innerHTML=`Simulação em execução — target: <b>${host}</b> ${port?('port:'+port):''}`;

  const ips=await resolveHostnameToIPs(host);
  const ip=(ips&&ips.length>0)?ips[0]:null;
  setResult('resIP',ip||'não resolvido');

  const ping=await measureHttpPing(host,port);
  setResult('resPing',ping!==null?ping+' ms':'—');
  document.getElementById('resNotes').textContent=ping!==null?'Ping aproximado via fetch HTTP':'Não foi possível medir ping';

  if(ip){
    const geo=await geolocateIP(ip);
    if(geo){
      const loc=[geo.city,geo.region,geo.country].filter(Boolean).join(', ');
      setResult('resLoc',loc||'—'); setResult('resOrg',geo.org||'—');
    }
  }

  if(countdownInterval) clearInterval(countdownInterval);
  countdownInterval=setInterval(()=>{
    seconds--; timerEl.textContent=formatTime(seconds);
    if(seconds<=0){
      clearInterval(countdownInterval); countdownInterval=null;
      timerEl.style.display='none';
      actionLog.innerHTML='Simulação finalizada — nenhuma ação externa executada.';
      document.getElementById('resNotes').textContent='Medições concluídas.';
    }
  },1000);
});

document.getElementById('clearBtn').addEventListener('click',()=>{
  document.getElementById('host').value=''; document.getElementById('port').value='';
  document.getElementById('time').value=''; document.getElementById('timerDisplay').style.display='none';
  if(countdownInterval){clearInterval(countdownInterval);countdownInterval=null;}
  const actionLog=document.getElementById('actionLog'); actionLog.textContent='Nenhuma ação em andamento.';
  setResult('resIP','—'); setResult('resPing','—'); setResult('resLoc','—'); setResult('resOrg','—');
  document.getElementById('resNotes').textContent='Clique Start para medir.';
});
</script>
</body>
</html>
