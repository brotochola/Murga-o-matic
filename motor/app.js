// La página: controles, sonido, dibujo y exportación. El compositor está en compositor.js.
import { componer, RANGOS, PB, acorde } from './compositor.js';
import { DEMOS } from './demos.js';
import { MODELO } from './modelo.js';
import { TIMBRE } from './timbre.js';

const DATOS = {"ritmos":[{"id":3,"nombre":"Marcha camión 2/4","tpc":2,"compas":0.894,"compases":2,"bpm":134.2,"archivo":"loops/03.wav"},{"id":4,"nombre":"Marcha camión 4/4","tpc":4,"compas":2.7999,"compases":2,"bpm":85.7,"archivo":"loops/04.wav"},{"id":6,"nombre":"Base de murga","tpc":4,"compas":2.0055,"compases":2,"bpm":119.7,"archivo":"loops/06.wav"},{"id":8,"nombre":"Candombe","tpc":4,"compas":1.9122,"compases":2,"bpm":125.5,"archivo":"loops/08.wav"},{"id":9,"nombre":"Pa'l costado","tpc":4,"compas":2.1376,"compases":2,"bpm":112.3,"archivo":"loops/09.wav"},{"id":10,"nombre":"Plena","tpc":4,"compas":1.7264,"compases":2,"bpm":139.0,"archivo":"loops/10.wav"},{"id":11,"nombre":"Bossa nova","tpc":4,"compas":2.8521,"compases":2,"bpm":84.1,"archivo":"loops/11.wav"},{"id":13,"nombre":"Conga","tpc":4,"compas":1.7319,"compases":2,"bpm":138.6,"archivo":"loops/13.wav"},{"id":14,"nombre":"Beat","tpc":4,"compas":1.7248,"compases":2,"bpm":139.1,"archivo":"loops/14.wav"},{"id":15,"nombre":"Bolero moderno","tpc":4,"compas":2.5466,"compases":2,"bpm":94.2,"archivo":"loops/15.wav"},{"id":17,"nombre":"Son cubano","tpc":4,"compas":1.9632,"compases":2,"bpm":122.2,"archivo":"loops/17.wav"},{"id":18,"nombre":"Montuno cubano","tpc":4,"compas":2.4945,"compases":2,"bpm":96.2,"archivo":"loops/18.wav"},{"id":19,"nombre":"Rumba cubana","tpc":4,"compas":2.4165,"compases":2,"bpm":99.3,"archivo":"loops/19.wav"},{"id":20,"nombre":"Miles Davis","tpc":4,"compas":2.6557,"compases":2,"bpm":90.4,"archivo":"loops/20.wav"}],"frases":{"1":{"archivo":"frases/01.wav","ultimo":5.6657,"seg":6.553},"5":{"archivo":"frases/05.wav","ultimo":2.798,"seg":3.999},"7":{"archivo":"frases/07.wav","ultimo":3.6629,"seg":4.196}},"acompana":{"3":[1,null],"4":[1,null],"6":[5,7]}};

const mod=(a,n)=>((a%n)+n)%n;
class Rng{constructor(s){this.a=(s*9973+17)>>>0} rand(){let t=this.a+=0x6d2b79f5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296} uni(a,b){return a+(b-a)*this.rand()}}
const NOTAS=["Do","Do#","Re","Mib","Mi","Fa","Fa#","Sol","Lab","La","Sib","Si"];
const NOMBRES_CUERDA={bajos:"Bajos",segundos:"Segundos",primos:"Primos",sobreprimos:"Sobreprimos",tercia:"Tercia"};
const CUERDAS={
  bajos:{cantores:2,pan:-.55,rango:"sol2–sol3"},
  segundos:{cantores:3,pan:-.25,rango:"do3–re4"},
  primos:{cantores:4,pan:.05,rango:"fa#3–la4"},
  sobreprimos:{cantores:3,pan:.35,rango:"do4–re5"},
  tercia:{cantores:1,pan:.6,rango:"mi4–fa5"}};
const ESTILOS={todas:"Todas juntas",trasnochada:"La Trasnochada",catalina:"Agarrate Catalina",muneca:"La Gran Muñeca",pasteles:"Metele que son Pasteles"};
const TEXTO_TIPO={clarinada:"a capela, en bloque",coro:"coro en bloque",pleno:"coro pleno",duo:"pocas voces",llamada:"la batería llama",cierre:"acorde final"};

// ============================================================ audio
const SR=44100;
const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
const decodeCtx=new OAC(1,1,SR);
const MUDO=new Audio("data:audio/wav;base64,UklGRvQHAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YdAHAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==");MUDO.setAttribute("playsinline","");
const cache=new Map();
function cargar(url){if(!cache.has(url))cache.set(url,fetch(url).then(r=>{if(!r.ok)throw new Error(`no se pudo bajar ${url} (error ${r.status})`);return r.arrayBuffer()})
  .then(b=>new Promise((ok,mal)=>{const p=decodeCtx.decodeAudioData(b,ok,()=>mal(new Error(`no se pudo leer ${url}`)));if(p&&p.catch)p.catch(()=>{})})).catch(e=>{cache.delete(url);throw e}));return cache.get(url)}
const BANCOS=["musyng","fluid"];
// Hay muestras de mi2 a mi5 (40 a 76): una nota más allá se canta con la última, corrida unos semitonos
const muestraDe=m=>Math.max(40,Math.min(76,m));

// El timbre: las muestras son un "aah" oscuro; el coro de murga es parejo y filoso. Esta curva sale de medir
// el espectro de las voces reales (herramientas/timbre.js) y se aplica con un filtro de fase lineal.
const IR_N=1024,irs=new Map();
function curvaDb(f){const T=TIMBRE;if(f<=T[0][0])return T[0][1];if(f>=T[T.length-1][0])return T[T.length-1][1];
  for(let i=1;i<T.length;i++)if(f<=T[i][0]){const x=Math.log(f/T[i-1][0])/Math.log(T[i][0]/T[i-1][0]);return T[i-1][1]+x*(T[i][1]-T[i-1][1])}return 0}
function respuesta(brillo){const k=brillo.toFixed(2);if(irs.has(k))return irs.get(k);
  const N=IR_N,h=new Float32Array(N),H=new Float64Array(N/2+1);
  for(let i=1;i<=N/2;i++){const fr=i*SR/N;H[i]=Math.pow(10,brillo*curvaDb(fr)/20)*(fr<95?(fr/95)**2:1)}
  for(let n=0;n<N;n++){let v=H[0];const w=2*Math.PI*(n-N/2)/N;for(let i=1;i<N/2;i++)v+=2*H[i]*Math.cos(w*i);h[n]=v/N*(.5-.5*Math.cos(2*Math.PI*n/(N-1)))}
  irs.set(k,h);return h}
function eq(ctx,input,brillo){const c=ctx.createConvolver();c.normalize=false;const b=ctx.createBuffer(1,IR_N,ctx.sampleRate);b.copyToChannel(respuesta(brillo),0);c.buffer=b;input.connect(c);return c}

// Cada sección tiene su tempo: T(q) pasa de semicorcheas a segundos
function mapaTiempo(pieza){
  // dentro de una sección, los calderones estiran el tiempo
  const local=(s,x)=>{let u=x;for(const[a,b,f]of s.estirar||[])u+=(f-1)*Math.max(0,Math.min(x,b)-a);return u*s.paso};
  let t=0;for(const s of pieza.secs){s.paso=60/(s.tempo*4);s.t0=t;s.t1=t+local(s,s.largo);t=s.t1}
  const L=pieza.secs;
  const T=q=>{let lo=0,hi=L.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(L[m].inicio<=q)lo=m;else hi=m-1}const s=L[lo];return s.t0+local(s,q-s.inicio)};
  return{T,fin:t};
}

// Cada cantor se mezcla a mano sobre arrays (mucho más rápido que un nodo por nota);
// el motor de audio solo aplica la ecualización al final.
async function renderCuerda(k,eventos,P,muestras){
  const len=Math.ceil(P.total*SR),L=new Float32Array(len),R=new Float32Array(len);
  const cfg=CUERDAS[k];const rng=new Rng(P.seed*31+k.length*7);
  const ataque=Math.round(.09*SR),subida=Math.round(.012*SR),caida=Math.round(.09*SR),xf=Math.round(.1*SR);
  for(let cantor=0;cantor<cfg.cantores;cantor++){
    const banco=BANCOS[cantor%2];const desaf=rng.uni(-9,9);
    const pan=Math.max(-1,Math.min(1,cfg.pan+rng.uni(-.12,.12)));const gl=Math.cos((pan+1)*Math.PI/4),gr=Math.sin((pan+1)*Math.PI/4);
    for(const[ini,d,m,vel,solo]of eventos){if(solo&&cantor>0)continue;const buf=muestras[banco][m];if(!buf)continue;const x=buf.getChannelData(0);
      const t0=P.T(ini),largo=P.T(ini+d)-t0;
      const dur=largo*(d>=3?.97:.84);const i0=Math.round((t0+rng.uni(0,.022))*SR);
      const g=Math.pow(vel/127,1.6)*rng.uni(.85,1)/(solo?1.1:Math.sqrt(cfg.cantores));const rate=Math.pow(2,(desaf+rng.uni(-4,4))/1200+(m-muestraDe(m))/12);
      const n=Math.min(Math.round(dur*SR)+caida,len-i0);const ls=Math.round(.8*SR),le=x.length-Math.round(.15*SR),per=le-ls;
      const at=i=>{const j=Math.floor(i),f=i-j;return x[j]+(x[j+1]-x[j])*f};
      let pos=ataque;
      for(let s=0;s<n;s++){
        if(pos>=le)pos-=per;
        let v=at(pos);
        if(pos>le-xf){const w=(pos-(le-xf))/xf;v=v*(1-w)+at(pos-per)*w}  // fundido en el punto de loop
        let e=1;if(s<subida)e=s/subida;else if(s>n-caida)e=Math.max(0,(n-s)/caida);
        const o=v*g*e;L[i0+s]+=o*gl;R[i0+s]+=o*gr;pos+=rate}
    }
  }
  const ctx=new OAC(2,len,SR);const b=ctx.createBuffer(2,len,SR);b.copyToChannel(L,0);b.copyToChannel(R,1);
  const src=ctx.createBufferSource();src.buffer=b;eq(ctx,src,P.brillo).connect(ctx.destination);src.start(0,IR_N/2/SR);
  return ctx.startRendering();
}

// Rebanadas: dónde empieza cada golpe de un loop. Para cambiar el tempo sin cambiar la afinación, cada golpe
// se coloca en su lugar nuevo tal como fue grabado, como en una caja de ritmos sampleada.
const rebanadasDe=new Map();
function rebanadas(buf){if(rebanadasDe.has(buf))return rebanadasDe.get(buf);
  const a=buf.getChannelData(0),b=buf.numberOfChannels>1?buf.getChannelData(1):a,sr=buf.sampleRate,h=Math.round(.004*sr),m=Math.floor(a.length/h);
  const E=new Float32Array(m);for(let i=0;i<m;i++){let s=0;for(let j=i*h;j<(i+1)*h;j++){const v=a[j]+b[j];s+=v*v}E[i]=Math.log(1e-7+s)}
  const O=[0];let ult=0;
  for(let i=5;i<m-1;i++){let p=0;for(let k=2;k<=5;k++)p+=E[i-k];const sube=E[i]-p/4;
    if(sube>1.2&&i-ult>=10&&E[i]>=E[i+1]-.2){O.push(Math.max(0,(i-2)*h)/sr);ult=i}}
  rebanadasDe.set(buf,O);return O}
// Repite un loop a otro tempo, golpe por golpe, sobre arrays (miles de nodos de audio serían lentísimos).
// Más rápido: cada golpe se corta donde entra el siguiente. Más lento: queda un respiro de milisegundos antes del golpe.
function pistaRebanada(ctx,buf,dur,rate){const sr=buf.sampleRate,n=Math.ceil(dur*sr),out=ctx.createBuffer(2,n,sr),O=rebanadas(buf),fin=buf.duration,ln=fin/rate;
  const fi=Math.round(.0015*sr),fo=Math.round(.002*sr);
  for(let ch=0;ch<2;ch++){const x=buf.getChannelData(Math.min(ch,buf.numberOfChannels-1)),y=out.getChannelData(ch);
    for(let t=0;t<dur;t+=ln)for(let i=0;i<O.length;i++){const a=O[i],b=i+1<O.length?O[i+1]:fin,w=t+a/rate;if(w>=dur)break;
      const L=Math.round(Math.min(b-a+.006,(b-a)/rate+.002)*sr),i0=Math.round(w*sr),s0=Math.round(a*sr);
      for(let k=0;k<L&&i0+k<n&&s0+k<x.length;k++){let e=1;if(i&&k<fi)e=k/fi;else if(k>L-fo)e=(L-k)/fo;y[i0+k]+=x[s0+k]*e}}}
  return out}

// La batería son siempre los loops: cada sección con el suyo, a su tempo
async function renderPercusion(P,secs){
  const len=Math.ceil(P.total*SR);const ctx=new OAC(2,len,SR);
  const tocar=(buf,when,off=0,dur,fadeOut=0,decay=false,dest=ctx.destination,rate=1)=>{const s=ctx.createBufferSource();s.buffer=buf;s.playbackRate.value=rate;const g=ctx.createGain();s.connect(g).connect(dest);
    let w=when,o=off;if(w<0){o-=w*rate;w=0}const D=dur??((buf.duration-o)/rate);if(D<=0)return;
    g.gain.setValueAtTime(1,w);if(decay){g.gain.setTargetAtTime(0,w+.05,.35)}else if(fadeOut){g.gain.setValueAtTime(1,w+Math.max(0,D-fadeOut));g.gain.linearRampToValueAtTime(0,w+D)}
    s.start(w,o,D*rate)};
  for(let i=0;i<secs.length;i++){const s=secs[i];const t0=s.t0,t1=s.t1;
    const ritmo=DATOS.ritmos.find(r=>r.id===s.loop)||DATOS.ritmos[2];
    const[,corte]=DATOS.acompana[ritmo.id]||[null,null];
    if(s.tipo==="llamada"){const sigR=secs[i+1]?.loop??s.loop;const[ll]=DATOS.acompana[sigR]||[null];if(ll){const f=DATOS.frases[ll];tocar(await cargar(f.archivo),t1-f.ultimo)}continue}   // su último golpe cae en el 1 que sigue
    if(s.golpe){const b=await cargar(ritmo.archivo);tocar(b,t0,0,1.6,0,true);continue}
    if(!s.bateria)continue;
    const loop=await cargar(ritmo.archivo);const rate=s.tempo/ritmo.bpm;const ln=loop.duration/rate;
    const sig=secs[i+1];const hayCorte=corte&&sig&&!sig.bateria&&sig.tipo!=="llamada"&&!sig.sinCorte;let finLoop=t1;
    if(hayCorte)finLoop=t1-DATOS.frases[corte].ultimo;
    let dest=ctx.destination;
    if(s.fade){const g=ctx.createGain();g.gain.setValueAtTime(s.fadeFinal?.3:1,t0);g.gain.linearRampToValueAtTime(s.fadeFinal?.02:.3,t1);g.connect(ctx.destination);dest=g}   // la bajada se apaga
    if(Math.abs(rate-1)>=.012){tocar(pistaRebanada(ctx,loop,finLoop-t0,rate),t0,0,finLoop-t0,(hayCorte||!sig||!sig.bateria)?.02:0,false,dest,1)}
    else for(let t=t0;t<finLoop-1e-4;t+=ln){const d=Math.min(ln,finLoop-t);const ultimo=t+ln>=finLoop-1e-4;tocar(loop,t,0,d,(ultimo&&(hayCorte||!sig||!sig.bateria))?.02:0,false,dest,rate)}
    if(hayCorte){const f=DATOS.frases[corte];tocar(await cargar(f.archivo),finLoop,0,Math.min(f.seg,f.ultimo+.9),.5)}}
  return ctx.startRendering();
}

function picoDe(bufs){let p=1e-9;const n=bufs[0].length;for(let ch=0;ch<2;ch++){const datos=bufs.map(b=>b.getChannelData(ch));for(let i=0;i<n;i+=2){let s=0;for(const d of datos)s+=d[i];const a=Math.abs(s);if(a>p)p=a}}return p}
function procesar(buf,escala,drive){const k=Math.tanh(drive);for(let ch=0;ch<buf.numberOfChannels;ch++){const d=buf.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=Math.tanh(drive*d[i]*escala)/k}}
function salaIR(ctx){const sr=ctx.sampleRate,n=Math.floor(.7*sr),ir=ctx.createBuffer(2,n,sr);const r=new Rng(5);for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<n;i++)d[i]=(r.rand()*2-1)*Math.exp(-7*i/n)}return ir}

// ============================================================ estado
const ORDEN=["bajos","segundos","primos","sobreprimos","tercia"];
const LLAMADAS=Object.fromEntries(DATOS.ritmos.map(r=>{const a=DATOS.acompana[r.id];if(!a||!a[0])return[r.id,0];const c4=r.compas*4/r.tpc;return[r.id,Math.ceil((DATOS.frases[a[0]].ultimo+.05)/c4)]}));
const S={recita:0,forma:"retirada",estilo:"todas",tonica:9,modo:"menor",ritmo:0,tempo:0,largo:"normal",seed:1,brillo:1,clarinada:true,cancionFinal:true,modula:true,tercia:0,mix:{bajos:1,segundos:1,primos:1,sobreprimos:1,tercia:1,bateria:.42},mute:{},
  pieza:null,stems:null,P:null,ac:null,nodos:null,inicio:0,offset:0,tocando:false,gen:0};
const $=id=>document.getElementById(id);

function estadoTexto(t,err){$("status").textContent=t;$("status").className="status"+(err?" err":"")}

async function muestrasPara(ev){
  const notas=new Set();for(const k in ev)for(const e of ev[k])notas.add(e[2]);
  const out={musyng:{},fluid:{}};
  await Promise.all([...notas].flatMap(m=>BANCOS.map(async b=>{out[b][m]=await cargar(`coro/${b}/${muestraDe(m)}.mp3`)})));
  return out;
}

async function generar(){
  const gen=++S.gen;detener(true);$("play").disabled=true;$("play").textContent="Componiendo…";estadoTexto("Componiendo y cantando…");
  try{
    const pieza=componer(MODELO,{forma:S.forma,estilo:S.estilo,tonica:S.tonica,modo:S.modo,semilla:S.seed,largo:S.largo,tempo:S.tempo||null,ritmo:S.ritmo||null,clarinada:S.clarinada,cancionFinal:S.cancionFinal,modula:S.modula,tercia:S.tercia,recita:S.recita,llamadas:LLAMADAS});
    const{T,fin}=mapaTiempo(pieza);const total=fin+2.5;
    const P={T,total,seed:S.seed,brillo:S.brillo};
    const muestras=await muestrasPara(pieza.ev);if(gen!==S.gen)return;
    const voces=[];for(const k of ORDEN){voces.push(await renderCuerda(k,pieza.ev[k],P,muestras));if(gen!==S.gen)return}
    const perc=await renderPercusion(P,pieza.secs);if(gen!==S.gen)return;
    const pv=picoDe(voces);const drive=1+.8*S.brillo;voces.forEach(b=>procesar(b,1/pv,drive));
    const pp=picoDe([perc]);procesar(perc,1/pp,1.05);
    window.murga={S};S.pieza=pieza;S.P=P;S.stems={...Object.fromEntries(ORDEN.map((k,i)=>[k,voces[i]])),bateria:perc};S.offset=0;rollCache=null;
    dibujarTodo();$("play").disabled=false;$("play").textContent="Tocar";
    const c=pieza.secs.find(s=>s.tipo!=="clarinada"&&s.bateria)||pieza.secs[0];
    estadoTexto(`${S.forma==="presentacion"?"Presentación":"Retirada"} en ${NOTAS[S.tonica]} ${S.modo} · ${ESTILOS[S.estilo]} · ${c.tempo} BPM · ${fmt(total)}`);
  }catch(e){console.error(e);estadoTexto(`No se pudieron preparar los sonidos: ${e&&e.message||e}. Recargá la página para reintentar.`,true);$("play").textContent="Tocar"}
}

// ============================================================ reproducción
function grafo(ctx,dest,offset,when){
  const master=ctx.createGain();master.gain.value=.9;const comp=ctx.createDynamicsCompressor();comp.threshold.value=-10;comp.ratio.value=3;comp.attack.value=.01;comp.release.value=.2;
  master.connect(comp).connect(dest);
  const vozBus=ctx.createGain();vozBus.connect(master);const rev=ctx.createConvolver();rev.buffer=salaIR(ctx);const send=ctx.createGain();send.gain.value=.16;vozBus.connect(send).connect(rev).connect(master);
  const gains={},srcs=[];
  for(const k of[...ORDEN,"bateria"]){const g=ctx.createGain();g.gain.value=S.mute[k]?0:S.mix[k]*(k==="bateria"?1:.9);g.connect(k==="bateria"?master:vozBus);gains[k]=g;
    const s=ctx.createBufferSource();s.buffer=S.stems[k];s.connect(g);s.start(when,offset);srcs.push(s)}
  return{gains,srcs};
}
function desbloquear(){
  try{if(navigator.audioSession)navigator.audioSession.type="playback"}catch(e){}       // iOS: que suene aunque el teléfono esté en silencio
  try{MUDO.play().catch(()=>{})}catch(e){}
  if(!S.ac){const AC=window.AudioContext||window.webkitAudioContext;S.ac=new AC()}
  if(S.ac.state!=="running")S.ac.resume().catch(()=>{});
  const b=S.ac.createBuffer(1,1,22050),s=S.ac.createBufferSource();s.buffer=b;s.connect(S.ac.destination);s.start(0);
}
function tocar(){if(!S.stems)return;desbloquear();
  setTimeout(()=>{if(S.tocando&&S.ac.state!=="running")estadoTexto("El navegador no deja arrancar el audio. Tocá Pausa y de nuevo Tocar; en iPhone revisá que no esté en silencio.",true)},800);
  const when=S.ac.currentTime+.05;S.nodos=grafo(S.ac,S.ac.destination,S.offset,when);S.inicio=when-S.offset;S.tocando=true;$("play").textContent="Pausa";
  S.nodos.srcs[0].onended=()=>{if(S.tocando&&posicion()>=S.P.total-.1){detener();S.offset=0;pintarCursor()}};requestAnimationFrame(cuadro)}
function detener(reset){if(S.nodos){S.nodos.srcs.forEach(s=>{try{s.stop()}catch(e){}});S.nodos=null}
  if(S.tocando&&!reset)S.offset=posicion();S.tocando=false;if(reset)S.offset=0;$("play").textContent="Tocar"}
function posicion(){return S.tocando?Math.min(S.ac.currentTime-S.inicio,S.P.total):S.offset}
function saltar(t){const was=S.tocando;detener();S.offset=Math.max(0,Math.min(t,S.P.total-.05));if(was)tocar();pintarCursor()}
function cuadro(){pintarCursor();if(S.tocando)requestAnimationFrame(cuadro)}
$("play").onclick=()=>{try{S.tocando?detener():tocar()}catch(e){console.error(e);S.tocando=false;$("play").textContent="Tocar";estadoTexto(`No se pudo tocar: ${e&&e.message||e}`,true)}};

// ============================================================ dibujo
const fmt=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const unicos=l=>l.filter((a,i)=>i===0||a!==l[i-1]);
function nomTono(s){return `${NOTAS[s.tonica]} ${s.modo}`}
function dibujarTodo(){
  const P=S.P,secs=S.pieza.secs,tl=$("timeline");tl.innerHTML="";
  const add=(nombre,t0,t1,cap)=>{const d=document.createElement("div");d.className="sec"+(cap?" cap":"");d.style.flex=`${t1-t0} 0 0`;d.textContent=nombre;d.title=`${nombre} · ${fmt(t0)}`;tl.appendChild(d)};
  secs.forEach(s=>add(s.nombre,s.t0,s.t1,!s.bateria&&s.tipo!=="llamada"));
  add("",secs[secs.length-1].t1,P.total,false);
  const ph=document.createElement("div");ph.className="ph";ph.id="ph";tl.appendChild(ph);
  const tb=$("tabla");tb.innerHTML="";
  for(const s of secs){const tr=document.createElement("tr");
    const ritmo=DATOS.ritmos.find(r=>r.id===s.loop);
    const tex=`${TEXTO_TIPO[s.tipo]||"coro"} · ${nomTono(s)} · ${s.tempo} BPM${s.bateria&&ritmo?" · "+ritmo.nombre:""}`;
    tr.innerHTML=`<td class="t">${fmt(s.t0)}</td><td>${s.nombre}</td><td><span class="pill${s.bateria||s.tipo==="llamada"?"":" cap"}">${tex}</span></td><td class="ac"></td>`;
    tr.querySelector(".ac").textContent=s.acordes?.length?unicos(s.acordes).join("  "):"—";tr.style.cursor="pointer";tr.onclick=()=>saltar(s.t0);tb.appendChild(tr)}
  dibujarRoll();pintarCursor();
}
function dibujarRoll(){
  const cv=$("roll"),dpr=window.devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;cv.width=w*dpr;cv.height=h*dpr;const g=cv.getContext("2d");g.scale(dpr,dpr);
  const P=S.P,lo=38,hi=78,X=t=>t/P.total*w,Y=m=>h-(m-lo+1)/(hi-lo+1)*h;
  g.fillStyle=css("--well");g.fillRect(0,0,w,h);
  g.strokeStyle=css("--line");g.lineWidth=1;for(const m of[48,60,72]){g.beginPath();g.moveTo(0,Y(m)+.5);g.lineTo(w,Y(m)+.5);g.stroke()}
  g.fillStyle=css("--muted");g.font=`11px ${css("--mono")}`;for(const[m,n]of[[48,"do3"],[60,"do4"],[72,"do5"]])g.fillText(n,4,Y(m)-3);
  let ultAc=-1e9;for(const s of S.pieza.secs){const x=X(s.t0);g.fillStyle=css("--line");g.fillRect(x,0,1,h);
    (s.acordes||[]).forEach((ac,c,l)=>{if(c&&l[c-1]===ac)return;const q=s.pasoAcorde?s.pasoAcorde[c]:c*8;const xx=X(P.T(s.inicio+q))+3;if(xx-ultAc<g.measureText(ac).width+8)return;ultAc=xx;g.fillStyle=css("--muted");g.fillText(ac,xx,h-5)})}
  for(const k of ORDEN){if(S.mute[k])g.globalAlpha=.18;g.fillStyle=css("--"+k);
    for(const[ini,d,m]of S.pieza.ev[k]){const t0=P.T(ini),x=X(t0),ww=Math.max(2,X(P.T(ini+d)-t0)-1),y=Y(m);g.fillRect(x,y-(h/(hi-lo+1))+1,ww,h/(hi-lo+1)-1)}g.globalAlpha=1}
}

function pintarCursor(){if(!S.P)return;const t=posicion();$("time").textContent=`${fmt(t)} / ${fmt(S.P.total)}`;const ph=$("ph");if(ph)ph.style.left=`calc(${t/S.P.total*100}% - 1px)`;
  dibujarRollCursor(t)}
let rollCache=null;
function dibujarRollCursor(t){const cv=$("roll");const dpr=window.devicePixelRatio||1;const g=cv.getContext("2d",{willReadFrequently:true});
  if(!rollCache||rollCache.w!==cv.width||rollCache.h!==cv.height||rollCache.v!==S.gen+":"+JSON.stringify(S.mute)){dibujarRoll();rollCache={img:g.getImageData(0,0,cv.width,cv.height),w:cv.width,h:cv.height,v:S.gen+":"+JSON.stringify(S.mute)}}
  else g.putImageData(rollCache.img,0,0);
  g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle=css("--ink");g.fillRect(t/S.P.total*cv.clientWidth-1,0,2,cv.clientHeight)}
function clickSeek(el,ev){const r=el.getBoundingClientRect();saltar((ev.clientX-r.left)/r.width*S.P.total)}
$("timeline").onclick=e=>S.P&&clickSeek($("timeline"),e);$("roll").onclick=e=>S.P&&clickSeek($("roll"),e);
window.addEventListener("resize",()=>{if(S.P){rollCache=null;pintarCursor()}});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{rollCache=null;if(S.P)pintarCursor()});

// Se arranca por la mejor presentación: la clarinada a capela y la entrada de la batería
{const d=DEMOS.filter(x=>x.forma==="presentacion").sort((a,b)=>b.nota-a.nota)[0];
 if(d){S.forma=d.forma;S.estilo=d.estilo;S.tonica=d.tonica;S.modo=d.modo;S.seed=d.semilla}}

// ============================================================ controles
$("tonica").innerHTML=NOTAS.map((n,i)=>`<option value="${i}">${n}</option>`).join("");$("tonica").value=S.tonica;$("modo").value=S.modo;
$("estilo").innerHTML=Object.entries(ESTILOS).filter(([k])=>MODELO.estilos[k]).map(([k,n])=>`<option value="${k}">${n}</option>`).join("");$("estilo").value=S.estilo;
$("ritmo").innerHTML=`<option value="0">Como el corpus (Base de murga, sobre todo)</option>`+DATOS.ritmos.map(r=>`<option value="${r.id}">${r.nombre} · ${r.bpm} BPM</option>`).join("");$("ritmo").value=S.ritmo;
let deb;const regen=()=>{clearTimeout(deb);deb=setTimeout(generar,250)};
const DEF={retirada:[9,"menor"],presentacion:[2,"mayor"]};
// El modo que más usa cada murga en cada parte (en el corpus, la Trasnochada presenta en menor y se retira en mayor)
const modoDe=(forma,estilo)=>{const h=MODELO.estilos[estilo]?.modo?.[forma];return h?(h.mayor>=h.menor?"mayor":"menor"):DEF[forma][1]};
$("forma").querySelectorAll("button").forEach(b=>b.onclick=()=>{$("forma").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));S.forma=b.dataset.v;S.tonica=DEF[S.forma][0];S.modo=modoDe(S.forma,S.estilo);$("tonica").value=S.tonica;$("modo").value=S.modo;$("campoFinal").style.display=S.forma==="retirada"?"":"none";regen()});
$("forma").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===S.forma));$("campoFinal").style.display=S.forma==="retirada"?"":"none";$("semilla").value=S.seed;
$("estilo").onchange=e=>{S.estilo=e.target.value;S.modo=modoDe(S.forma,S.estilo);$("modo").value=S.modo;regen()};
$("tonica").onchange=e=>{S.tonica=+e.target.value;regen()};$("modo").onchange=e=>{S.modo=e.target.value;regen()};
$("ritmo").onchange=e=>{S.ritmo=+e.target.value;regen()};
$("largo").onchange=e=>{S.largo=e.target.value;regen()};
$("tempo").onchange=e=>{S.tempo=Math.max(0,Math.round(+e.target.value||0));e.target.value=S.tempo||"";regen()};
$("semilla").onchange=e=>{S.seed=Math.max(1,Math.floor(+e.target.value||1));e.target.value=S.seed;regen()};
$("otra").onclick=()=>{S.seed=1+Math.floor(Math.random()*99998);$("semilla").value=S.seed;regen()};
$("brillo").onchange=e=>{S.brillo=+e.target.value;regen()};
$("recita").onchange=e=>{S.recita=+e.target.value;regen()};
// Demos: las semillas que mejor le caen al jurado
{const caja=$("demos");const NOM={trasnochada:"La Trasnochada",catalina:"Agarrate Catalina"};
 for(const d of DEMOS){const b=document.createElement("button");b.className="btn";b.textContent=`${d.forma==="retirada"?"Retirada":"Presentación"} · ${NOM[d.estilo]||d.estilo}`;
  b.onclick=()=>{S.forma=d.forma;S.estilo=d.estilo;S.tonica=d.tonica;S.modo=d.modo;S.seed=d.semilla;S.largo="normal";S.tempo=0;S.recita=0;$("recita").value=0;
   $("forma").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===d.forma));$("estilo").value=d.estilo;$("tonica").value=d.tonica;$("modo").value=d.modo;$("semilla").value=d.semilla;$("largo").value="normal";$("tempo").value="";$("campoFinal").style.display=d.forma==="retirada"?"":"none";generar()};
  caja.appendChild(b)}
 caja.parentElement.style.display=DEMOS.length?"":"none"}
$("tercia").onchange=e=>{S.tercia=+e.target.value;regen()};
for(const k of["clarinada","cancionFinal","modula"])$(k).onchange=e=>{S[k]=e.target.checked;regen()};

const mixer=$("mixer");
for(const k of[...ORDEN,"bateria"]){const row=document.createElement("div");row.className="ch";
  row.innerHTML=`<i style="background:var(--${k})"></i><div><b>${k==="bateria"?"Batería":NOMBRES_CUERDA[k]}</b><span class="rng">${k==="bateria"?"loop real":CUERDAS[k].rango}</span></div>
   <input type="range" min="0" max="1.5" step="0.05" value="${S.mix[k]}" id="vol-${k}" aria-label="Volumen ${k}"><button class="mute" aria-pressed="false" id="mute-${k}" aria-label="Silenciar ${k}">M</button>`;
  mixer.appendChild(row);
  row.querySelector("input").oninput=e=>{S.mix[k]=+e.target.value;aplicarMix(k)};
  row.querySelector("button").onclick=e=>{S.mute[k]=!S.mute[k];e.target.setAttribute("aria-pressed",S.mute[k]);aplicarMix(k);rollCache=null;if(S.P)pintarCursor()}}
function aplicarMix(k){if(S.nodos&&S.ac)S.nodos.gains[k].gain.setTargetAtTime(S.mute[k]?0:S.mix[k]*(k==="bateria"?1:.9),S.ac.currentTime,.02)}
$("legend").innerHTML=ORDEN.map(k=>`<span><i style="background:var(--${k})"></i>${NOMBRES_CUERDA[k]}</span>`).join("")+`<span>Tocá el coro o las secciones para saltar.</span>`;

// ============================================================ exportar
function wav(buf){const n=buf.length,ch=2,ab=new ArrayBuffer(44+n*ch*2),v=new DataView(ab);const w=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
  w(0,"RIFF");v.setUint32(4,36+n*ch*2,true);w(8,"WAVE");w(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,ch,true);v.setUint32(24,SR,true);v.setUint32(28,SR*ch*2,true);v.setUint16(32,ch*2,true);v.setUint16(34,16,true);w(36,"data");v.setUint32(40,n*ch*2,true);
  const L=buf.getChannelData(0),R=buf.getChannelData(1);let o=44;for(let i=0;i<n;i++){for(const d of[L,R]){const s=Math.max(-1,Math.min(1,d[i]));v.setInt16(o,s<0?s*32768:s*32767,true);o+=2}}return new Uint8Array(ab)}
function vlq(n){const b=[n&127];while(n>>=7)b.unshift((n&127)|128);return b}
function midi(){const tpq=480,t16=120;const pistas=[];
  const pista=evs=>{evs.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const out=[];let ahora=0;for(const[t,,bytes]of evs){out.push(...vlq(Math.max(0,t-ahora)),...bytes);ahora=Math.max(ahora,t)}out.push(0,0xFF,0x2F,0);return out};
  const txt=(t,tipo,s)=>{const b=[...new TextEncoder().encode(s)];return[t,0,[0xFF,tipo,...vlq(b.length),...b]]};
  const meta=[[0,0,[0xFF,0x58,4,4,2,24,8]]];
  for(const s of S.pieza.secs){const us=Math.round(60e6/s.tempo);meta.push([s.inicio*t16,0,[0xFF,0x51,3,us>>16&255,us>>8&255,us&255]]);meta.push(txt(s.inicio*t16,6,s.nombre));
    (s.acordes||[]).forEach((g,c,l)=>{if(c&&l[c-1]===g)return;const a=acorde(g);const q=s.pasoAcorde?s.pasoAcorde[c]:c*8;meta.push(txt((s.inicio+q)*t16,1,`${g} (${NOTAS[mod(s.tonica+a.raiz,12)]})`))})}
  pistas.push(pista(meta));
  ORDEN.forEach((k,ch)=>{const e=[txt(0,3,NOMBRES_CUERDA[k]),[0,0,[0xC0|ch,52]],[0,0,[0xB0|ch,10,Math.round(64+63*CUERDAS[k].pan)]]];
    for(const[ini,d,m,vel]of S.pieza.ev[k]){const on=ini*t16;e.push([on,1,[0x90|ch,m,Math.min(127,vel)]],[on+d*t16-10,0,[0x80|ch,m,0]])}pistas.push(pista(e))});
  const head=[..."MThd"].map(c=>c.charCodeAt(0)).concat([0,0,0,6,0,1,0,pistas.length,tpq>>8,tpq&255]);
  const body=pistas.flatMap(p=>[..."MTrk"].map(c=>c.charCodeAt(0)).concat([p.length>>>24&255,p.length>>>16&255,p.length>>>8&255,p.length&255],p));
  return new Uint8Array(head.concat(body))}

const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return d=>{let c=0xFFFFFFFF;for(let i=0;i<d.length;i++)c=t[(c^d[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}})();
function zip(files){const parts=[],central=[];let off=0;const enc=new TextEncoder();
  for(const[name,data]of files){const nb=enc.encode(name),crc=CRC(data);const h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(8,0,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,nb.length,true);
    parts.push(new Uint8Array(h.buffer),nb,data);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,nb.length,true);c.setUint32(42,off,true);
    central.push(new Uint8Array(c.buffer),nb);off+=30+nb.length+data.length}
  const csize=central.reduce((a,b)=>a+b.length,0);const e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,csize,true);e.setUint32(16,off,true);
  return new Blob([...parts,...central,new Uint8Array(e.buffer)],{type:"application/zip"})}
function estructuraTxt(){const P=S.P;const l=[`Murga-o-matic · ${S.forma} · ${NOTAS[S.tonica]} ${S.modo} · ${ESTILOS[S.estilo]} · semilla ${S.seed}`,""];
  for(const s of S.pieza.secs)l.push(`${fmt(s.t0)}  ${s.nombre} · ${TEXTO_TIPO[s.tipo]||"coro"} · ${nomTono(s)} · ${s.tempo} BPM${s.acordes?.length?" · "+unicos(s.acordes).join(" "):""}`);
  l.push("",`Duración: ${fmt(P.total)}`,"Batería: La Tríada (Iribarne, García, Cánepa). Coro: muestras FluidR3 y MusyngKite.");return l.join("\n")}

$("exportar").onclick=async()=>{if(!S.stems)return;const st=$("expStatus");st.textContent="Mezclando…";
  try{const ctx=new OAC(2,Math.ceil(S.P.total*SR),SR);grafo(ctx,ctx.destination,0,0);const mix=await ctx.startRendering();
    let p=1e-9;for(let ch=0;ch<2;ch++){const d=mix.getChannelData(ch);for(let i=0;i<d.length;i++)p=Math.max(p,Math.abs(d[i]))}for(let ch=0;ch<2;ch++){const d=mix.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]*=.95/p}
    const base=`murga_${S.forma}_${NOTAS[S.tonica].replace("#","s")}${S.modo==="menor"?"m":""}_semilla${S.seed}`;
    const blob=zip([[base+"/mezcla.wav",wav(mix)],[base+"/coro.mid",midi()],[base+"/estructura.txt",new TextEncoder().encode(estructuraTxt())]]);
    const dl=window.claude?.use?await window.claude.use("downloads"):null;
    if(dl){await dl.save({filename:base+".zip",data:blob});st.textContent="Guardado.";return}
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=base+".zip";document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),60000);st.textContent="Descargado.";
  }catch(e){st.textContent=e?.code==="declined"?"Descarga cancelada.":"No se pudo descargar. Probá de nuevo.";console.error(e)}};

generar();
