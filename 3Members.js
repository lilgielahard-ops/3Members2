// --- Configuração do limite ---
const MAX_SECONDS = 22000; // 22.000 segundos (≈ 6h06m)
let countdownInterval = null;

// Helper: format mm:ss/hh:mm:ss se > 1h
function formatTime(s){
  s = Math.max(0, Math.floor(s));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if(hh > 0) return String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0') + ':' + String(ss).padStart(2,'0');
  return String(mm).padStart(2,'0') + ':' + String(ss).padStart(2,'0');
}

// Validação ao sair do campo time (opcional, melhora UX)
const timeInputEl = document.getElementById('time');
timeInputEl.addEventListener('blur', () => {
  let v = parseInt(timeInputEl.value, 10);
  if(isNaN(v) || v <= 0) { timeInputEl.value = ''; return; }
  if(v > MAX_SECONDS){
    timeInputEl.value = MAX_SECONDS;
    // pequena notificação visual — substitua por sua UI se quiser
    alert('O tempo máximo permitido é ' + MAX_SECONDS + ' segundos (aprox. 6h06m). O valor foi ajustado.');
  }
});

// Start
document.getElementById('startBtn').addEventListener('click', async () => {
  const host = (document.getElementById('host').value || '').trim();
  const port = (document.getElementById('port').value || '').trim();
  let seconds = parseInt(document.getElementById('time').value, 10);

  // Defaults e validação
  if(isNaN(seconds) || seconds <= 0) seconds = 30; // default
  if(seconds > MAX_SECONDS){
    seconds = MAX_SECONDS;
    // atualiza campo para refletir
    document.getElementById('time').value = MAX_SECONDS;
    // mensagem leve (já avisamos também no blur)
    console.warn('Tempo maior que o máximo; ajustado para ' + MAX_SECONDS);
  }

  // UI refs
  const timerEl = document.getElementById('timerDisplay');
  const actionLog = document.getElementById('actionLog');

  // Mostrar timer e log
  timerEl.style.display = 'inline-block';
  timerEl.textContent = formatTime(seconds);
  actionLog.innerHTML = `Simulação em execução — target: <b>${host || '[no target]'}</b> ${port ? ('port: '+port) : ''}`;

  // --- Evita múltiplos timers ---
  if(countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  // === Ações que ocorrem UMA VEZ ao iniciar ===
  // Reseta resultados antigos
  setResultIP('—'); setResultPing('—'); setResultLoc('—'); setResultOrg('—');
  document.getElementById('resNotes').textContent = 'Resolvendo...';

  // 1) Resolve hostname -> IPs (se aplicável)
  try {
    const ips = await resolveHostnameToIPs(host);
    const ip = (ips && ips.length>0) ? ips[0] : null;
    if(ip){ setResultIP(ip); }
    else { setResultIP('não resolvido'); document.getElementById('resNotes').textContent = 'Não foi possível resolver o hostname via DNS-over-HTTPS.'; }
  } catch(e){
    console.warn('Erro ao resolver DNS', e);
    setResultIP('erro');
  }

  // 2) Medir ping (tentativa única)
  try {
    const ping = await measureHttpPing(host, port);
    if(ping !== null) {
      setResultPing(ping);
      document.getElementById('resNotes').textContent = 'Ping aproximado medido via fetch (HTTP).';
    } else {
      setResultPing(null);
      document.getElementById('resNotes').textContent = 'Não foi possível medir ping (bloqueado por CORS ou timeouts).';
    }
  } catch(e){
    console.warn('Erro ao medir ping', e);
    setResultPing(null);
  }

  // 3) Geolocalização (se IP resolvido)
  try {
    const ipText = document.getElementById('resIP').textContent;
    if(ipText && ipText !== '—' && ipText !== 'não resolvido' && ipText !== 'erro') {
      const geo = await geolocateIP(ipText);
      if(geo){
        const locationStr = [geo.city, geo.region, geo.country].filter(Boolean).join(', ');
        setResultLoc(locationStr || '—');
        setResultOrg(geo.org || '—');
      } else {
        setResultLoc('—'); setResultOrg('—');
      }
    }
  } catch(e){
    console.warn('Erro na geolocalização', e);
  }

  // === Inicia o countdown visual (apenas UI) ===
  countdownInterval = setInterval(()=>{
    seconds--;
    timerEl.textContent = formatTime(seconds);
    if(seconds <= 0){
      clearInterval(countdownInterval);
      countdownInterval = null;
      timerEl.style.display = 'none';
      actionLog.innerHTML = 'Simulação finalizada — nenhuma ação externa executada.';
      document.getElementById('resNotes').textContent = 'Medições concluídas.';
    }
  }, 1000);
});

// Clear
document.getElementById('clearBtn').addEventListener('click', ()=>{
  // reset tudo
  document.getElementById('host').value = '';
  document.getElementById('port').value = '';
  document.getElementById('time').value = '';
  document.getElementById('timerDisplay').style.display = 'none';
  if(countdownInterval){ clearInterval(countdownInterval); countdownInterval = null; }
  document.getElementById('actionLog').textContent = 'Nenhuma ação em andamento.';
  setResultIP('—'); setResultPing('—'); setResultLoc('—'); setResultOrg('—');
  document.getElementById('resNotes').textContent = 'Observação: medição de ping é aproximada (HTTP).';
});
