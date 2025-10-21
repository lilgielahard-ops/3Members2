// measureHttpPing: tenta HTTPS quando a página está em HTTPS
async function measureHttpPing(targetHost, port){
  if(!targetHost) return null;

  const portNum = port ? parseInt(port, 10) : null;
  const pageIsHttps = (location.protocol === 'https:');

  // Decide se vamos usar https ou http
  // Se a página está em HTTPS, só podemos usar HTTPS (para evitar Mixed Content)
  let scheme;
  if(pageIsHttps){
    scheme = 'https';
  } else {
    // página é http: — podemos escolher baseado no porto (443 -> https)
    scheme = (portNum === 443) ? 'https' : 'http';
  }

  // Se a página é https mas o utilizador especificou explicitamente uma porta típica http,
  // alertamos que o browser vai bloquear pedidos http (opcional).
  if(pageIsHttps && portNum && portNum !== 443){
    console.warn('Página HTTPS: pedidos HTTP para portas não seguras serão bloqueados (mixed content). Tentando apenas HTTPS.');
    // continuamos a tentar https; se o alvo não tiver https vai falhar/timeout e retornará null.
  }

  const needsPort = portNum && !((scheme === 'http' && portNum === 80) || (scheme === 'https' && portNum === 443));
  const url = `${scheme}://${targetHost}${needsPort ? ':' + portNum : ''}/favicon.ico?cb=${Date.now()}`;

  return new Promise((resolve) => {
    let finished = false;
    const img = new Image();
    const start = performance.now();
    const timeoutMs = 3000;
    const timer = setTimeout(() => {
      if(finished) return;
      finished = true;
      img.onload = img.onerror = null;
      resolve(null); // timeout -> não conseguimos medir
    }, timeoutMs);

    img.onload = function(){
      if(finished) return;
      finished = true;
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(Math.round(performance.now() - start));
    };
    img.onerror = function(){
      if(finished) return;
      finished = true;
      clearTimeout(timer);
      img.onload = img.onerror = null;
      // mesmo que tenha erro, tempo é informação útil
      resolve(Math.round(performance.now() - start));
    };

    try {
      img.src = url;
    } catch(e){
      clearTimeout(timer);
      resolve(null);
    }
  });
}
