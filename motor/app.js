// La página: controles, sonido, dibujo y exportación. El compositor está en compositor.js; los cantores sintéticos
// y el letrista, en cantor/; la partitura con letra, en vista.js; la partitura coral, el PDF y la letra con acordes, en papeles.js.
import { componer, RANGOS, PB, acorde } from './compositor.js';
import { DEMOS } from './demos.js';
import { MODELO } from './modelo.js';
import { TIMBRE } from './timbre.js';
import { metrica, silabear, cantores } from './cantor/coro.js';
import { cantar } from './cantor/cantor.js';
import { cantorDifonos, vozDelCantor } from './cantor/difonos.js';
import { disenar } from './cantor/eq.js';
import { medir, versosDe } from './cantor/letra.js';
import { partesAEscribir } from './cantor/letrista.js';
import { escribirLetraLocal } from './cantor/letrista_local.js';
import { CURVA } from './cantor/timbre.js';
import { crearPartitura, mostrarProceso } from './vista.js';
import { nombreAcorde, textoConAcordes, mostrarPartitura, pdfPartitura, cargarScript, escritas } from './papeles.js';

const DATOS = {"ritmos":[{"id":3,"nombre":"Marcha camión 2/4","tpc":2,"compas":0.8931,"compases":2,"bpm":134.4,"archivo":"loops/03.wav"},{"id":4,"nombre":"Marcha camión 4/4","tpc":4,"compas":2.7963,"compases":2,"bpm":85.8,"archivo":"loops/04.wav"},{"id":6,"nombre":"Base de murga","tpc":4,"compas":2.0109,"compases":2,"bpm":119.3,"archivo":"loops/06.wav"},{"id":8,"nombre":"Candombe","tpc":4,"compas":1.909,"compases":2,"bpm":125.7,"archivo":"loops/08.wav"},{"id":9,"nombre":"Pa'l costado","tpc":4,"compas":2.1441,"compases":2,"bpm":111.9,"archivo":"loops/09.wav"},{"id":10,"nombre":"Plena","tpc":4,"compas":1.729,"compases":2,"bpm":138.8,"archivo":"loops/10.wav"},{"id":11,"nombre":"Bossa nova","tpc":4,"compas":2.856,"compases":2,"bpm":84.0,"archivo":"loops/11.wav"},{"id":13,"nombre":"Conga","tpc":4,"compas":1.7225,"compases":2,"bpm":139.3,"archivo":"loops/13.wav"},{"id":14,"nombre":"Beat","tpc":4,"compas":1.7239,"compases":2,"bpm":139.2,"archivo":"loops/14.wav"},{"id":15,"nombre":"Bolero moderno","tpc":4,"compas":2.55,"compases":2,"bpm":94.1,"archivo":"loops/15.wav"},{"id":17,"nombre":"Son cubano","tpc":4,"compas":1.96,"compases":2,"bpm":122.4,"archivo":"loops/17.wav"},{"id":18,"nombre":"Montuno cubano","tpc":4,"compas":2.4999,"compases":2,"bpm":96.0,"archivo":"loops/18.wav"},{"id":19,"nombre":"Rumba cubana","tpc":4,"compas":2.4175,"compases":2,"bpm":99.3,"archivo":"loops/19.wav"},{"id":20,"nombre":"Miles Davis","tpc":4,"compas":2.6515,"compases":2,"bpm":90.5,"archivo":"loops/20.wav"}],"frases":{"1":{"archivo":"frases/01.wav","ultimo":5.6657,"seg":6.553},"5":{"archivo":"frases/05.wav","ultimo":2.798,"seg":3.999},"7":{"archivo":"frases/07.wav","ultimo":3.6629,"seg":4.196}},"acompana":{"3":[1,null],"4":[1,null],"6":[5,7]}};

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
const ESTILOS={todas:"Todas juntas",trasnochada:"La Trasnochada",catalina:"Agarrate Catalina",bastarda:"Doña Bastarda",asaltantes:"Asaltantes con Patente",milonga:"La Nueva Milonga",cabra:"Cayó la Cabra",muneca:"La Gran Muñeca",pasteles:"Metele que son Pasteles"};
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

function picoDe(bufs){let p=1e-9;const n=Math.max(...bufs.map(b=>b.length));for(let ch=0;ch<2;ch++){const datos=bufs.map(b=>b.getChannelData(ch));for(let i=0;i<n;i+=2){let s=0;for(const d of datos)s+=d[i]||0;const a=Math.abs(s);if(a>p)p=a}}return p}   // las cuerdas que callan (el solista) son de una muestra
function procesar(buf,escala,drive){const k=Math.tanh(drive);for(let ch=0;ch<buf.numberOfChannels;ch++){const d=buf.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=Math.tanh(drive*d[i]*escala)/k}}
function salaIR(ctx){const sr=ctx.sampleRate,n=Math.floor(.7*sr),ir=ctx.createBuffer(2,n,sr);const r=new Rng(5);for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<n;i++)d[i]=(r.rand()*2-1)*Math.exp(-7*i/n)}return ir}

// ============================================================ cantores sintéticos
// Trece voces de fuente glótica y formantes (cantor/cantor.js). Cantan en obreros, varios a la vez; cada cuerda
// se suma en estéreo y su voz pasa por la curva medida contra La Trasnochada (las consonantes no, así no se inflan).
const pausa=()=>new Promise(r=>setTimeout(r,0));
let obreros=null,idObrero=0;
function losObreros(){if(obreros)return obreros;obreros=[];
  try{const n=Math.max(1,Math.min(4,(navigator.hardwareConcurrency||2)-1));for(let i=0;i<n;i++)obreros.push(new Worker(new URL("./cantor/obrero.js",import.meta.url),{type:"module"}))}catch(e){console.warn("sin obreros",e);obreros=[]}
  return obreros}
function enObrero(w,msg){return new Promise((ok,mal)=>{const id=++idObrero;
  const fin=()=>{w.removeEventListener("message",alMsg);w.removeEventListener("error",alErr)};
  const alMsg=e=>{if(e.data?.id!==id)return;fin();e.data.error?mal(new Error(e.data.error)):ok(e.data)};
  const alErr=e=>{fin();e.preventDefault?.();mal(new Error(e.message||"el obrero no arrancó"))};
  w.addEventListener("message",alMsg);w.addEventListener("error",alErr);w.postMessage({id,...msg})})}
async function cantarLista(lista,alListo,sigue){
  let i=0;const ws=losObreros();
  const enHilo=async c=>{await pausa();return cantar(c.notas,{sr:SR,tipo:c.tipo,semilla:c.semilla,retraso:c.retraso,separar:true})};
  const tarea=async w=>{while(i<lista.length&&sigue()){const j=i++,c=lista[j];let r;
    if(w){try{r=await enObrero(w,{notas:c.notas,opc:{sr:SR,tipo:c.tipo,semilla:c.semilla,retraso:c.retraso}})}catch(e){console.warn("canta la página:",e.message);w=null;r=await enHilo(c)}}
    else r=await enHilo(c);
    if(sigue())alListo(j,r)}};
  await Promise.all(ws.length?ws.map(tarea):[tarea(null)]);
}
let IR_CANTOR=null;
async function cantarCuerdas(pieza,P,gen){
  if(difonos())return cantarDifonosCoro(pieza,P,gen,S.voces==="solista");
  const L=S.letra,letras=letrasPorSeccion();
  L.sil=silabear(pieza,letras);
  const lista=cantores(pieza,L.sil.porQ,{semilla:S.seed});
  const len=Math.ceil(P.total*SR),acum={};for(const k of ORDEN)acum[k]={VL:new Float32Array(len),VR:new Float32Array(len),NL:new Float32Array(len),NR:new Float32Array(len)};
  let hechos=0;
  avance(0,`Cantando: 0 de ${lista.length} cantores…`);
  await cantarLista(lista,(j,{voz,ruido})=>{const c=lista[j],a=acum[c.cuerda];
    const gl=Math.cos((c.pan+1)*Math.PI/4)*c.ganancia,gr=Math.sin((c.pan+1)*Math.PI/4)*c.ganancia,m=Math.min(len,voz.length);
    for(let s=0;s<m;s++){a.VL[s]+=voz[s]*gl;a.VR[s]+=voz[s]*gr;a.NL[s]+=ruido[s]*gl;a.NR[s]+=ruido[s]*gr}
    hechos++;avance(hechos/(lista.length+1),`Cantando: ${hechos} de ${lista.length} cantores (${NOMBRES_CUERDA[c.cuerda].toLowerCase()})…`)},()=>gen===S.gen);
  if(gen!==S.gen)return null;
  avance(lista.length/(lista.length+1),"Dándole el color del coro real…");
  if(!IR_CANTOR)IR_CANTOR=disenar(CURVA,SR,2048);
  const voces=[];
  for(const k of ORDEN){const a=acum[k],ctx=new OAC(2,len,SR);
    const bv=ctx.createBuffer(2,len,SR);bv.copyToChannel(a.VL,0);bv.copyToChannel(a.VR,1);
    const bn=ctx.createBuffer(2,len,SR);bn.copyToChannel(a.NL,0);bn.copyToChannel(a.NR,1);
    const conv=ctx.createConvolver();conv.normalize=false;const ir=ctx.createBuffer(1,IR_CANTOR.length,SR);ir.copyToChannel(IR_CANTOR,0);conv.buffer=ir;
    const sv=ctx.createBufferSource();sv.buffer=bv;sv.connect(conv).connect(ctx.destination);sv.start(0,IR_CANTOR.length/2/SR);
    const sn=ctx.createBufferSource();sn.buffer=bn;sn.connect(ctx.destination);sn.start(0);
    voces.push(await ctx.startRendering());if(gen!==S.gen)return null}
  return voces;
}

// Cantores de difonos (cantor/difonos.js con MBROLA): cada uno canta en un obrero y sale a la frecuencia de la voz
// (22.050 Hz, o un poco más o menos según su tracto); Web Audio los pasa a la de la página al sumar cada cuerda.
// Con «sólo un solista», canta el primero de los primos (la melodía) y las otras cuerdas callan.
const mbHilo={};
async function difonosEnHilo(notas,opc){const v=opc.voz||"es2";
  if(!mbHilo[v])mbHilo[v]=(async()=>{const[{crearMbrola},wasm,voz]=await Promise.all([import("./cantor/mbrola.js"),...["vendor/mbrola/mbrola.wasm","vendor/mbrola/"+v].map(u=>fetch(new URL(u,import.meta.url)).then(x=>{if(!x.ok)throw new Error("no se pudo bajar "+u);return x.arrayBuffer()}))]);return crearMbrola(wasm,new Uint8Array(voz))})();
  const[{cantarDifonos},mb]=await Promise.all([import("./cantor/difonos.js"),mbHilo[v]]);await pausa();return cantarDifonos(mb,notas,opc)}
async function cantarDifonosCoro(pieza,P,gen,solo){
  const L=S.letra,letras=letrasPorSeccion();
  L.sil=silabear(pieza,letras);
  let lista=cantores(pieza,L.sil.porQ,{semilla:S.seed});
  if(solo)lista=[lista.find(x=>x.cuerda==="primos")||lista[0]];
  const res=new Array(lista.length);let hechos=0,i=0;
  avance(0,`Cantando: 0 de ${lista.length} cantores…`);
  const tarea=async w=>{while(i<lista.length&&gen===S.gen){const j=i++,c=lista[j],o=cantorDifonos(c.cuerda,c.semilla);
    const msg={motor:"difonos",notas:c.notas,opc:{...o,voz:solo?"es2":vozDelCantor(c.c||0),retraso:o.retraso+(c.retraso||0)}};let r=null;
    if(w){try{r=await enObrero(w,msg)}catch(e){console.warn("canta la página:",e.message);w=null}}
    if(!r)r=await difonosEnHilo(msg.notas,msg.opc);
    res[j]=r;hechos++;avance(hechos/(lista.length+1),`Cantando: ${hechos} de ${lista.length} cantores (${NOMBRES_CUERDA[c.cuerda].toLowerCase()})…`)}};
  const ws=losObreros();await Promise.all(ws.length?ws.map(tarea):[tarea(null)]);
  if(gen!==S.gen)return null;
  avance(lista.length/(lista.length+1),"Sumando las cuerdas…");
  const len=Math.ceil(P.total*SR),voces=[];
  for(const k of ORDEN){const js=lista.map((c,j)=>c.cuerda===k?j:-1).filter(j=>j>=0);
    if(!js.length){voces.push(new OAC(2,1,SR).createBuffer(2,1,SR));continue}
    const ctx=new OAC(2,len,SR);
    for(const j of js){const c=lista[j],r=res[j];if(!r.x.length)continue;
      const b=ctx.createBuffer(1,r.x.length,r.sr);b.copyToChannel(r.x,0);
      const s=ctx.createBufferSource();s.buffer=b;const g=ctx.createGain();g.gain.value=solo?1:c.ganancia;const p=ctx.createStereoPanner();p.pan.value=solo?0:c.pan;
      s.connect(g).connect(p).connect(ctx.destination);s.start(Math.max(0,r.inicio),Math.max(0,-r.inicio))}
    voces.push(await ctx.startRendering());if(gen!==S.gen)return null}
  return voces;
}

// ============================================================ estado
const ORDEN=["bajos","segundos","primos","sobreprimos","tercia"];
const LLAMADAS=Object.fromEntries(DATOS.ritmos.map(r=>{const a=DATOS.acompana[r.id];if(!a||!a[0])return[r.id,0];const c4=r.compas*4/r.tpc;return[r.id,Math.ceil((DATOS.frases[a[0]].ultimo+.05)/c4)]}));
const S={version:2,recita:0,forma:"retirada",estilo:"todas",tonica:9,modo:"menor",ritmo:0,tempo:0,largo:"normal",seed:1,brillo:1,clarinada:true,cancionFinal:true,modula:true,tercia:0,mix:{bajos:1,segundos:1,primos:1,sobreprimos:1,tercia:1,bateria:.42},mute:{},
  voces:"muestras",acordes:{},editando:null,pieza:null,stems:null,P:null,ac:null,nodos:null,inicio:0,offset:0,tocando:false,gen:0,mp3:null,
  letra:{partes:[],textos:[],diags:null,temas:null,editados:new Set(),sel:{i:0,k:0},sil:null,marcas:[],semLetra:1,pendiente:false,cantada:null}};
const $=id=>document.getElementById(id);
const sint=()=>S.voces!=="muestras";      // con letra: los cantores de formantes, los de difonos o el solista
const difonos=()=>S.voces==="difonos"||S.voces==="solista";
// La versión 1 del compositor, con su modelo del 7 de noviembre: se carga sólo si se elige
let V1=null;const version1=async()=>V1||(V1={componer:(await import("./compositor_v1.js")).componer,MODELO:(await import("./modelo_v1.js")).MODELO});

function estadoTexto(t,err){$("status").textContent=t;$("status").className="status"+(err?" err":"")}
function avance(x,t){const a=$("avance");if(x==null){a.hidden=true}else{a.hidden=false;a.value=x}if(t!=null)estadoTexto(t)}

async function muestrasPara(ev){
  const notas=new Set();for(const k in ev)for(const e of ev[k])notas.add(e[2]);
  const out={musyng:{},fluid:{}};
  await Promise.all([...notas].flatMap(m=>BANCOS.map(async b=>{out[b][m]=await cargar(`coro/${b}/${muestraDe(m)}.mp3`)})));
  return out;
}

function ocupado(texto){$("play").disabled=true;$("play").textContent=texto;for(const id of["mp3","pdf","txt","exportar","recantar","otraLetra","lailareo"])$(id).disabled=true}
function listo(){$("play").disabled=false;$("play").textContent=S.tocando?"Pausa":"Tocar";for(const id of["mp3","pdf","txt","exportar","recantar","otraLetra","lailareo"])$(id).disabled=false;avance(null)}
function resumen(){const c=S.pieza.secs.find(s=>s.tipo!=="clarinada"&&s.bateria)||S.pieza.secs[0];
  let t=`${S.forma==="presentacion"?"Presentación":"Retirada"} en ${NOTAS[S.tonica]} ${S.modo} · ${ESTILOS[S.estilo]} · ${c.tempo} BPM · ${fmt(S.P.total)}`;
  if(sint()){const L=S.letra,v=L.partes.reduce((a,p)=>a+p.versos.length,0),ok=L.partes.reduce((a,p,i)=>a+p.versos.filter((x,k)=>L.textos[i][k].trim()&&medir(L.textos[i][k]).n===x.silabas).length,0);t+=` · ${v} versos, ${ok} justos en la música`}
  estadoTexto(t)}
function normalizarVoces(voces){const pv=picoDe(voces);const drive=sint()?1.02:1+.8*S.brillo;voces.forEach(b=>procesar(b,1/pv,drive))}

const firmaLetra=()=>JSON.stringify(S.letra.partes.map(p=>[p.nombre,p.versos.map(v=>v.silabas)]));
async function generar(opc={}){
  const gen=++S.gen;detener(true);S.mp3=null;ocupado("Componiendo…");avance(.02,"Componiendo…");
  try{
    const C=S.version===1?await version1():{componer,MODELO};if(gen!==S.gen)return;
    const pieza=C.componer(C.MODELO,{forma:S.forma,estilo:S.estilo,tonica:S.tonica,modo:S.modo,semilla:S.seed,largo:S.largo,tempo:S.tempo||null,ritmo:S.ritmo||null,clarinada:S.clarinada,cancionFinal:S.cancionFinal,modula:S.modula,tercia:S.tercia,recita:S.recita,llamadas:LLAMADAS,acordes:S.acordes});
    const{T,fin}=mapaTiempo(pieza);const total=fin+2.5;
    const P={T,total,seed:S.seed,brillo:S.brillo};
    const percP=renderPercusion(P,pieza.secs);
    let voces;
    if(sint()){
      avance(.04,"Escribiendo la letra…");await pausa();if(gen!==S.gen)return;
      // si sólo cambiaron acordes, la letra (y lo que editaste) se queda: las notas por verso son las mismas
      const L=S.letra,antes=opc.mantenerLetra&&L.textos.length?{textos:L.textos,diags:L.diags,temas:L.temas,editados:new Set(L.editados),sel:L.sel,firma:firmaLetra()}:null;
      armarLetra(pieza,T);
      if(antes&&antes.firma===firmaLetra()){L.textos=antes.textos;L.diags=antes.diags;L.temas=antes.temas;L.editados=antes.editados;L.sel=antes.sel}else escribirLetra(pieza);
      voces=await cantarCuerdas(pieza,P,gen);if(!voces)return;
      S.letra.cantada=S.letra.textos.map(t=>t.slice());S.letra.pendiente=false;
    }else{
      avance(.1,"Cargando las muestras del coro…");
      const muestras=await muestrasPara(pieza.ev);if(gen!==S.gen)return;
      voces=[];for(const[i,k]of ORDEN.entries()){avance(.2+.6*i/ORDEN.length,`Cantando: ${NOMBRES_CUERDA[k].toLowerCase()}…`);voces.push(await renderCuerda(k,pieza.ev[k],P,muestras));if(gen!==S.gen)return}
    }
    avance(.95,"Sumando la batería de La Tríada…");
    const perc=await percP;if(gen!==S.gen)return;
    normalizarVoces(voces);
    const pp=picoDe([perc]);procesar(perc,1/pp,1.05);
    window.murga={S};S.pieza=pieza;S.P=P;S.stems={...Object.fromEntries(ORDEN.map((k,i)=>[k,voces[i]])),bateria:perc};S.offset=0;
    dibujarTodo();listo();resumen();
  }catch(e){if(gen!==S.gen)return;console.error(e);avance(null);estadoTexto(`No se pudieron preparar los sonidos: ${e&&e.message||e}. Recargá la página para reintentar.`,true);$("play").textContent="Tocar"}
}

// Otra letra o la letra editada: se vuelven a cantar las voces; la música y la batería quedan
async function cantarDeNuevo(){
  if(!S.pieza||!sint())return;
  const gen=++S.gen;const t=posicion();detener();S.mp3=null;ocupado("Cantando…");
  try{
    const voces=await cantarCuerdas(S.pieza,S.P,gen);if(!voces)return;
    normalizarVoces(voces);
    S.stems={...Object.fromEntries(ORDEN.map((k,i)=>[k,voces[i]])),bateria:S.stems.bateria};S.offset=t;
    S.letra.cantada=S.letra.textos.map(x=>x.slice());S.letra.pendiente=false;$("avisoLetra").hidden=true;
    actualizarVistas();listo();resumen();
  }catch(e){if(gen!==S.gen)return;console.error(e);avance(null);estadoTexto(`No se pudo cantar: ${e&&e.message||e}`,true);listo()}
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
const unicos=l=>l.filter((a,i)=>i===0||a!==l[i-1]);
function nomTono(s){return `${NOTAS[s.tonica]} ${s.modo}`}
const partitura=crearPartitura({lienzo:$("roll"),mapa:$("mapa"),leyenda:$("legend"),
  alBuscar:t=>{if(S.P)saltar(t)},
  alElegir:(i,k)=>{if(sint())elegir(i,k,false,true)}});
$("zoomMas").onclick=()=>partitura.zoom(1.4);$("zoomMenos").onclick=()=>partitura.zoom(1/1.4);$("seguir").onchange=e=>partitura.seguir(e.target.checked);

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
    const ac=tr.querySelector(".ac");
    ac.textContent=s.acordes?.length?unicos(s.acordes.map(g=>nombreAcorde(g,s.tonica,s.modo))).join("  "):"—";
    if(s.prepara){const n=document.createElement("small");n.className="prep";n.textContent=` · termina en ${nombreAcorde(s.prepara,s.tonica,s.modo)}, la dominante del tono que sigue`;ac.append(n)}
    if(s.memoria&&s.acordes?.length>1){const b=document.createElement("button");b.className="btn editar";b.textContent=S.editando===s.nombre?"Listo":"Cambiar acordes";b.setAttribute("aria-expanded",S.editando===s.nombre);
      b.onclick=e=>{e.stopPropagation();S.editando=S.editando===s.nombre?null:s.nombre;dibujarTodo()};ac.append(b)}
    else if(s.repite){const n=document.createElement("small");n.className="prep";n.textContent=` · los acordes de «${s.repite}»`;ac.append(n)}
    tr.style.cursor="pointer";tr.onclick=()=>saltar(s.t0);tb.appendChild(tr);
    if(S.editando===s.nombre)tb.appendChild(editorAcordes(s))}
  $("cantada").hidden=!sint();
  $("notaRoll").textContent=sint()?"Cada color es una cuerda; abajo va la letra, cada sílaba donde se canta, en negrita las acentuadas. Tocá para escuchar desde ahí y ver cómo se hizo ese verso; arrastrá para moverte.":"Cada color es una cuerda. Tocá las notas o las secciones para escuchar desde ahí; arrastrá para moverte.";
  if(sint()){libreto();chips()}
  actualizarVistas();pintarCursor();
  if(!$("grabada").hidden)verPartitura(true);
}
// ── cambiar los acordes: de a medio compás; la melodía y las voces se acomodan al acorde nuevo ──
const OPCIONES_ACORDE={mayor:["I","ii","iii","IV","V","V7","vi","viio","I7","II7","III7","VI7","iv","bVI","bVII","i"],menor:["i","iio","bIII","iv","v","V","V7","bVI","bVII","viio","I7","IV7","bII","I"]};
function editorAcordes(s){
  const tr=document.createElement("tr");tr.className="editor";const td=document.createElement("td");td.colSpan=4;tr.append(td);
  const propios=S.acordes[s.nombre]||{};
  td.innerHTML=`<p class="hint">Cada compás tiene dos acordes. Al cambiar uno, la melodía se corre a la nota del acorde más cercana en los tiempos fuertes, y las voces de abajo se arman de nuevo sobre él. El resto de la pieza no cambia.</p><div class="grilla"></div><div class="botones"></div>`;
  const grilla=td.querySelector(".grilla");
  for(let b=0;b<s.acordes.length;b+=2){const c=document.createElement("div");c.className="compas";c.innerHTML=`<span class="nb">${b/2+1}</span>`;
    for(const i of[b,b+1]){if(i>=s.acordes.length)break;const g=s.acordes[i],sel=document.createElement("select");sel.setAttribute("aria-label",`Compás ${b/2+1}, ${i%2?"segunda":"primera"} mitad`);
      const ops=[...new Set([g,...OPCIONES_ACORDE[s.modo]])];
      sel.innerHTML=ops.map(x=>`<option value="${x}"${x===g?" selected":""}>${nombreAcorde(x,s.tonica,s.modo)} (${x})</option>`).join("");
      if(i in propios)sel.classList.add("cambiado");else if(s.cambiados?.includes(i))sel.classList.add("auto");
      sel.onclick=e=>e.stopPropagation();
      sel.onchange=()=>{S.acordes={...S.acordes,[s.nombre]:{...(S.acordes[s.nombre]||{}),[i]:sel.value}};generar({mantenerLetra:true})};
      c.append(sel)}
    grilla.append(c)}
  if(Object.keys(propios).length){const r=document.createElement("button");r.className="btn";r.textContent="Volver a los acordes originales";r.onclick=e=>{e.stopPropagation();const a={...S.acordes};delete a[s.nombre];S.acordes=a;generar({mantenerLetra:true})};td.querySelector(".botones").append(r)}
  tr.onclick=e=>e.stopPropagation();
  return tr;
}
function datosPartitura(){
  const P=S.P,T=P.T,pieza=S.pieza,L=S.letra;
  const notas=[];for(const k of ORDEN)for(const[q,d,p]of pieza.ev[k])notas.push({t0:T(q),t1:T(q+d),p,cuerda:k});
  const silabas=[];
  if(sint()&&L.sil)for(const s of pieza.secs){const i=L.partes.findIndex(p=>p.secciones.includes(s.nombre));if(i<0)continue;
    for(let k=0;L.sil.detalle.has(s.nombre+"|"+k);k++){const det=L.sil.detalle.get(s.nombre+"|"+k),esc=escritas(L.textos[i][k],det.reparto);
      det.reparto.forEach((r,j)=>{const a=r.notas[0],b=r.notas[r.notas.length-1];silabas.push({t0:T(a.q),t1:T(b.q+b.d),texto:esc?.[j]?.replace(/\s+/g,"‿")||r.texto,acento:r.acento,melisma:r.notas.length>1,p:a.p,i,k,j})})}}
  silabas.sort((a,b)=>a.t0-b.t0);
  const compases=[];for(const s of pieza.secs)for(let q=s.inicio;q<s.inicio+s.largo;q+=16)compases.push(T(q));
  return{notas,silabas,compases,secciones:pieza.secs.map(s=>({t0:s.t0,t1:s.t1,nombre:s.nombre,bateria:s.bateria,llamada:s.tipo==="llamada"})),total:P.total};
}
function actualizarVistas(){
  if(!S.pieza)return;
  if(sint())S.letra.sil=silabear(S.pieza,letrasPorSeccion());
  partitura.datos(datosPartitura());partitura.silenciar(S.mute);
  if(sint()){partitura.elegir(S.letra.sel.i,S.letra.sel.k);proceso();estadoLetra()}else partitura.elegir(null);
}
let temporizador=null;
function actualizarLuego(){clearTimeout(temporizador);temporizador=setTimeout(actualizarVistas,350)}

function pintarCursor(){if(!S.P)return;const t=posicion();$("time").textContent=`${fmt(t)} / ${fmt(S.P.total)}`;const ph=$("ph");if(ph)ph.style.left=`calc(${t/S.P.total*100}% - 1px)`;
  partitura.tiempo(t,S.tocando);if(sint())seguirVerso(t)}
function clickSeek(el,ev){const r=el.getBoundingClientRect();saltar((ev.clientX-r.left)/r.width*S.P.total)}
$("timeline").onclick=e=>S.P&&clickSeek($("timeline"),e);

// ============================================================ la letra (cantores sintéticos)
const TEMAS={
  presentacion:["el barrio que resiste","la plata no alcanza","el carnaval de antes","todos mirando el celular"],
  retirada:["la despedida del barrio","lo que nos llevamos","el último tablado","volver el año que viene"]};
function armarLetra(pieza,T){
  const L=S.letra;L.partes=partesAEscribir(metrica(pieza),S.forma);L.sel={i:0,k:0};
  L.marcas=[];
  for(const s of pieza.secs){const i=L.partes.findIndex(p=>p.secciones.includes(s.nombre));if(i<0||!(s.golpes||[]).length)continue;
    versosDe(s.golpes.map(g=>({q:g.q-s.inicio,d:g.d,p:g.top}))).forEach((v,k)=>L.marcas.push({t:T(s.inicio+v.golpes[0].q),i,k}))}
  L.marcas.sort((a,b)=>a.t-b.t);
}
function escribirLetra(pieza){
  const L=S.letra,r=escribirLetraLocal({forma:S.forma,tema:$("tema").value.trim(),metrica:metrica(pieza),semilla:S.seed*1000+L.semLetra});
  L.textos=r.textos.map(t=>t.slice());L.diags=r.diags;L.temas=r.temas;L.editados.clear();
}
function letrasPorSeccion(){const L={};S.letra.partes.forEach((p,i)=>{for(const s of p.secciones)L[s]=S.letra.textos[i].map(t=>t.trim())});return L}
function chips(){$("temas").innerHTML=TEMAS[S.forma].map(t=>`<button type="button" class="chip-tema">${t}</button>`).join("");
  $("temas").querySelectorAll("button").forEach(b=>b.onclick=()=>{$("tema").value=b.textContent;otraLetra()})}
function libreto(){
  const L=S.letra,box=$("libreto");box.innerHTML="";
  L.partes.forEach((p,i)=>{
    const sec=document.createElement("section");sec.className="parte";
    const otras=p.secciones.length>1?`<p class="se-canta">Se canta ${p.secciones.length} veces: ${p.secciones.join(" · ")}</p>`:"";
    sec.innerHTML=`<header><h3></h3><p class="funcion"></p>${otras}</header><ol class="versos"></ol>`;
    sec.querySelector("h3").textContent=p.nombre;sec.querySelector(".funcion").textContent=p.funcion;
    const ol=sec.querySelector("ol");
    p.versos.forEach((v,k)=>{const li=document.createElement("li");li.className="verso";li.dataset.i=i;li.dataset.k=k;const id=`v-${i}-${k}`;
      li.innerHTML=`<label class="sr" for="${id}">Verso ${k+1} de ${p.nombre}</label><input id="${id}" type="text" autocomplete="off" spellcheck="false" placeholder="${v.silabas} sílaba${v.silabas===1?"":"s"}${v.silabas>1?", "+v.tipo:""}"><span class="cuenta" title="sílabas cantadas / notas del verso"></span>`;
      const inp=li.querySelector("input");inp.value=L.textos[i][k];
      inp.addEventListener("input",()=>{L.textos[i][k]=inp.value;L.editados.add(i+"|"+k);cuenta(li,inp.value,v.silabas);marcarPendiente();actualizarLuego()});
      inp.addEventListener("focus",()=>elegir(i,k,true));
      if(L.sel.i===i&&L.sel.k===k)li.classList.add("elegido");
      cuenta(li,inp.value,v.silabas);ol.append(li)});
    box.append(sec)});
  estadoLetra();
}
function cuenta(li,texto,quiere){const c=li.querySelector(".cuenta");
  if(!texto.trim()){c.textContent=`–/${quiere}`;c.dataset.estado="vacio";return}
  const n=medir(texto).n;c.textContent=`${n}/${quiere}`;c.dataset.estado=n===quiere?"ok":Math.abs(n-quiere)<=2?"cerca":"mal";
  c.title=n===quiere?"Entra justo: una sílaba por nota":Math.abs(n-quiere)<=2?"Entra con algún melisma o nota partida":"No entra bien en la música"}
function estadoLetra(){const L=S.letra;let ok=0,tot=0,vacios=0;
  L.partes.forEach((p,i)=>p.versos.forEach((v,k)=>{tot++;const t=L.textos[i][k];if(!t.trim())vacios++;else if(medir(t).n===v.silabas)ok++}));
  $("estadoLetra").textContent=!tot?"":vacios===tot?"Sin letra: el coro canta «la la la».":`${ok} de ${tot} versos entran justo en la música${vacios?` · ${vacios} vacíos (se cantan con «la»)`:""}. Podés editar cualquier verso.`}
function marcarPendiente(){const L=S.letra;L.pendiente=JSON.stringify(L.textos)!==JSON.stringify(L.cantada);$("avisoLetra").hidden=!L.pendiente;S.mp3=null}
function otraLetra(){if(!S.pieza||!sint())return;S.letra.semLetra++;escribirLetra(S.pieza);libreto();actualizarVistas();cantarDeNuevo()}
function lailareo(){if(!S.pieza||!sint())return;const s=["la","ra","la","la","ra","lai","la","ra"];const L=S.letra;
  L.textos=L.partes.map(p=>p.versos.map(v=>Array.from({length:v.silabas},(_,j)=>s[j%s.length]).join(" ")));L.diags=null;L.editados.clear();
  libreto();actualizarVistas();cantarDeNuevo()}
function seguirVerso(t){let m=null;for(const x of S.letra.marcas){if(x.t<=t+.05)m=x;else break}
  document.querySelectorAll(".verso.sonando").forEach(e=>e.classList.remove("sonando"));
  if(!m||(!S.tocando&&t===0))return;
  document.querySelector(`.verso[data-i="${m.i}"][data-k="${m.k}"]`)?.classList.add("sonando")}
function proceso(){const L=S.letra,{i,k}=L.sel,p=L.partes[i];if(!p){$("proceso").innerHTML="";return}
  const texto=L.textos[i]?.[k]||"";
  mostrarProceso($("proceso"),{P:S.pieza,partes:L.partes,i,k,texto,n:medir(texto).n,diag:L.diags?.[i]?.[k],det:L.sil?.detalle.get(p.secciones[0]+"|"+k),temas:L.temas,editado:L.editados.has(i+"|"+k),forma:S.forma});
  $("proceso").querySelectorAll("[data-ir]").forEach(b=>b.onclick=()=>{
    const lista=L.partes.flatMap((pp,ii)=>pp.versos.map((_,kk)=>[ii,kk]));
    const pos=lista.findIndex(([ii,kk])=>ii===i&&kk===k),sig=lista[Math.max(0,Math.min(lista.length-1,pos+ +b.dataset.ir))];
    elegir(sig[0],sig[1],false,false,true)})}
function elegir(i,k,desdeLetra,desdePartitura,mover){
  S.letra.sel={i,k};
  document.querySelectorAll(".verso.elegido").forEach(e=>e.classList.remove("elegido"));
  document.querySelector(`.verso[data-i="${i}"][data-k="${k}"]`)?.classList.add("elegido");
  partitura.elegir(i,k);
  if(desdeLetra||mover){const m=S.letra.marcas.find(x=>x.i===i&&x.k===k);if(m)partitura.irA(m.t)}
  proceso()}
$("otraLetra").onclick=otraLetra;$("lailareo").onclick=lailareo;$("recantar").onclick=cantarDeNuevo;
$("tema").addEventListener("keydown",e=>{if(e.key==="Enter")otraLetra()});

// Se arranca por la mejor presentación: la clarinada a capela y la entrada de la batería
{const d=DEMOS.filter(x=>x.forma==="presentacion").sort((a,b)=>b.nota-a.nota)[0];
 if(d){S.forma=d.forma;S.estilo=d.estilo;S.tonica=d.tonica;S.modo=d.modo;S.seed=d.semilla}}
// Las voces: lo que diga la dirección (la vieja /cantada manda acá), si no la última elección
{let v=new URLSearchParams(location.search).get("voces");if(!v)try{v=localStorage.getItem("murga.voces")}catch(e){}
 if(["sintetizadas","muestras","difonos","solista"].includes(v))S.voces=v}

// ============================================================ controles
const HINT_VOCES={muestras:"Muestras «aah» de coro: suena a coro, sin palabras.",sintetizadas:"Trece cantores de formantes (voz armada desde cero) cantan una letra escrita para esta melodía. Tarda unos segundos más.",
  difonos:"Trece cantores armados con pedacitos de voz grabada (difonos de MBROLA, dos voces), con acento rioplatense: se entiende mucho más la letra. La primera vez baja las voces (8 MB).",
  solista:"Un solo cantor de difonos canta la melodía con la letra, sobre la batería: para escuchar bien cómo canta."};
function mostrarVoces(){const b=difonos()?"difonos":S.voces;$("voces").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===b));$("vocesHint").textContent=HINT_VOCES[S.voces];$("campoBrillo").hidden=sint();$("campoSolista").hidden=!difonos();$("soloSolista").checked=S.voces==="solista"}
const elegirVoces=v=>{if(S.voces===v)return;S.voces=v;try{localStorage.setItem("murga.voces",S.voces)}catch(e){}mostrarVoces();generar()};
$("voces").querySelectorAll("button").forEach(b=>b.onclick=()=>{if(b.dataset.v==="difonos"&&difonos())return;elegirVoces(b.dataset.v==="difonos"&&$("soloSolista").checked?"solista":b.dataset.v)});
$("soloSolista").onchange=e=>elegirVoces(e.target.checked?"solista":"difonos");
mostrarVoces();
$("tonica").innerHTML=NOTAS.map((n,i)=>`<option value="${i}">${n}</option>`).join("");$("tonica").value=S.tonica;$("modo").value=S.modo;
$("estilo").innerHTML=Object.entries(ESTILOS).filter(([k])=>MODELO.estilos[k]).map(([k,n])=>`<option value="${k}">${n}</option>`).join("");$("estilo").value=S.estilo;
$("ritmo").innerHTML=`<option value="0">Como el corpus (Base de murga, sobre todo)</option>`+DATOS.ritmos.map(r=>`<option value="${r.id}">${r.nombre} · ${r.bpm} BPM</option>`).join("");$("ritmo").value=S.ritmo;
let deb;const regen=(mantener)=>{if(mantener!==true){S.acordes={};S.editando=null}clearTimeout(deb);deb=setTimeout(generar,250)};
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
$("brillo").onchange=e=>{S.brillo=+e.target.value;regen(true)};
$("recita").onchange=e=>{S.recita=+e.target.value;regen()};
// Demos: las semillas que mejor le caen al jurado
{const caja=$("demos");const NOM=ESTILOS;
 for(const d of DEMOS){const b=document.createElement("button");b.className="btn";b.textContent=`${d.forma==="retirada"?"Retirada":"Presentación"} · ${NOM[d.estilo]||d.estilo}`;
  b.onclick=()=>{S.acordes={};S.editando=null;S.forma=d.forma;S.estilo=d.estilo;S.tonica=d.tonica;S.modo=d.modo;S.seed=d.semilla;S.largo="normal";S.tempo=0;S.recita=0;$("recita").value=0;
   $("forma").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===d.forma));$("estilo").value=d.estilo;$("tonica").value=d.tonica;$("modo").value=d.modo;$("semilla").value=d.semilla;$("largo").value="normal";$("tempo").value="";$("campoFinal").style.display=d.forma==="retirada"?"":"none";generar()};
  caja.appendChild(b)}
 caja.parentElement.style.display=DEMOS.length?"":"none"}
$("tercia").onchange=e=>{S.tercia=+e.target.value;regen()};
$("version").onchange=e=>{S.version=+e.target.value;regen()};
for(const k of["clarinada","cancionFinal","modula"])$(k).onchange=e=>{S[k]=e.target.checked;regen()};

const mixer=$("mixer");
for(const k of[...ORDEN,"bateria"]){const row=document.createElement("div");row.className="ch";
  row.innerHTML=`<i style="background:var(--${k})"></i><div><b>${k==="bateria"?"Batería":NOMBRES_CUERDA[k]}</b><span class="rng">${k==="bateria"?"loop real":CUERDAS[k].rango}</span></div>
   <input type="range" min="0" max="1.5" step="0.05" value="${S.mix[k]}" id="vol-${k}" aria-label="Volumen ${k}"><button class="mute" aria-pressed="false" id="mute-${k}" aria-label="Silenciar ${k}">M</button>`;
  mixer.appendChild(row);
  row.querySelector("input").oninput=e=>{S.mix[k]=+e.target.value;aplicarMix(k)};
  row.querySelector("button").onclick=e=>{S.mute[k]=!S.mute[k];e.target.setAttribute("aria-pressed",S.mute[k]);aplicarMix(k);partitura.silenciar(S.mute)}}
function aplicarMix(k){if(S.nodos&&S.ac)S.nodos.gains[k].gain.setTargetAtTime(S.mute[k]?0:S.mix[k]*(k==="bateria"?1:.9),S.ac.currentTime,.02)}

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
    (s.acordes||[]).forEach((g,c,l)=>{if(c&&l[c-1]===g)return;const a=acorde(g);const q=s.pasoAcorde?s.pasoAcorde[c]:c*8;meta.push(txt((s.inicio+q)*t16,1,`${nombreAcorde(g,s.tonica,s.modo)} (${g})`))})}
  // con letra: cada sílaba como evento de letra en la pista de los primos
  const sil=sint()?silabasPorQ():null;
  pistas.push(pista(meta));
  ORDEN.forEach((k,ch)=>{const e=[txt(0,3,NOMBRES_CUERDA[k]),[0,0,[0xC0|ch,52]],[0,0,[0xB0|ch,10,Math.round(64+63*CUERDAS[k].pan)]]];
    for(const[ini,d,m,vel]of S.pieza.ev[k]){const on=ini*t16;e.push([on,1,[0x90|ch,m,Math.min(127,vel)]],[on+d*t16-10,0,[0x80|ch,m,0]])}
    if(sil&&k==="primos")for(const[q,x]of sil)if(x.primera)e.push(txt(q*t16,5,x.texto.replace(/‿/g," ")+(x.fin?" ":"-")));
    pistas.push(pista(e))});
  const head=[..."MThd"].map(c=>c.charCodeAt(0)).concat([0,0,0,6,0,1,0,pistas.length,tpq>>8,tpq&255]);
  const body=pistas.flatMap(p=>[..."MTrk"].map(c=>c.charCodeAt(0)).concat([p.length>>>24&255,p.length>>>16&255,p.length>>>8&255,p.length&255],p));
  return new Uint8Array(head.concat(body))}

const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return d=>{let c=0xFFFFFFFF;for(let i=0;i<d.length;i++)c=t[(c^d[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}})();
function zip(files){const parts=[],central=[];let off=0;const enc=new TextEncoder();
  for(const[name,data]of files){const nb=enc.encode(name),crc=CRC(data);const h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,nb.length,true);
    parts.push(new Uint8Array(h.buffer),nb,data);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,nb.length,true);c.setUint32(42,off,true);
    central.push(new Uint8Array(c.buffer),nb);off+=30+nb.length+data.length}
  const csize=central.reduce((a,b)=>a+b.length,0);const e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,csize,true);e.setUint32(16,off,true);
  return new Blob([...parts,...central,new Uint8Array(e.buffer)],{type:"application/zip"})}
function titulo(){return `${S.forma==="presentacion"?"Presentación":"Retirada"} en ${NOTAS[S.tonica]} ${S.modo}`}
function subtitulo(){return `Murga-o-matic · ${ESTILOS[S.estilo]} · semilla ${S.seed}${sint()&&$("tema").value.trim()?` · tema: ${$("tema").value.trim()}`:""}`}
function estructuraTxt(){const P=S.P;const l=[`Murga-o-matic · ${S.forma} · ${NOTAS[S.tonica]} ${S.modo} · ${ESTILOS[S.estilo]} · semilla ${S.seed}`,""];
  for(const s of S.pieza.secs)l.push(`${fmt(s.t0)}  ${s.nombre} · ${TEXTO_TIPO[s.tipo]||"coro"} · ${nomTono(s)} · ${s.tempo} BPM${s.acordes?.length?" · "+unicos(s.acordes.map(g=>nombreAcorde(g,s.tonica,s.modo))).join(" "):""}`);
  l.push("",`Duración: ${fmt(P.total)}`,`Batería: La Tríada (Iribarne, García, Cánepa). Coro: ${sint()?"cantores sintéticos del Murga-o-matic":"muestras FluidR3 y MusyngKite"}.`);return l.join("\n")}
const base=()=>`murga_${S.forma}_${S.estilo}_${NOTAS[S.tonica].replace("#","s")}${S.modo==="menor"?"m":""}_semilla${S.seed}${sint()?"_cantada":""}`;
async function guardar(blob,nombre){
  const dl=window.claude?.use?await window.claude.use("downloads").catch(()=>null):null;
  if(dl){await dl.save({filename:nombre,data:blob});return"Guardado."}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=nombre;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),60000);return"Descargado."}
function avisoExport(t){$("expStatus").textContent=t}
function errorExport(e){console.error(e);avisoExport(e?.code==="declined"?"Descarga cancelada.":`No se pudo: ${e?.message||e}`)}
// La mezcla tal como suena: con los volúmenes y los silencios de la mezcla
async function mezclaFinal(pico=.95){const ctx=new OAC(2,Math.ceil(S.P.total*SR),SR);grafo(ctx,ctx.destination,0,0);const mix=await ctx.startRendering();
  let p=1e-9;for(let ch=0;ch<2;ch++){const d=mix.getChannelData(ch);for(let i=0;i<d.length;i++)p=Math.max(p,Math.abs(d[i]))}for(let ch=0;ch<2;ch++){const d=mix.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]*=pico/p}
  return mix}
function letraTxt(){if(!sint())return null;const L=S.letra;
  return [titulo(),subtitulo(),""].concat(L.partes.flatMap((p,i)=>[p.nombre.toUpperCase()+(p.secciones.length>1?`  (se canta ${p.secciones.length} veces)`:""),...L.textos[i].map(t=>t||"(la la la)"),""])).join("\n")}

$("exportar").onclick=async()=>{if(!S.stems)return;avisoExport("Mezclando…");
  try{const mix=await mezclaFinal();const b=base();
    const files=[[b+"/mezcla.wav",wav(mix)],[b+"/coro.mid",midi()],[b+"/estructura.txt",new TextEncoder().encode(estructuraTxt())]];
    const lt=letraTxt();if(lt)files.push([b+"/letra.txt",new TextEncoder().encode(lt)]);
    avisoExport(await guardar(zip(files),b+".zip"))}catch(e){errorExport(e)}};

// MP3: la mezcla codificada con lamejs (LAME) en el navegador, a 192 kbps, de a pedazos para no trabar la página
let lameCarga=null;
function cargarLame(){if(window.lamejs)return Promise.resolve();if(!lameCarga)lameCarga=cargarScript(new URL("./vendor/lame.min.js",import.meta.url).href).catch(e=>{lameCarga=null;throw e});return lameCarga}
async function codificarMp3(mix,alAvanzar){
  await cargarLame();
  const enc=new window.lamejs.Mp3Encoder(2,SR,192),L=mix.getChannelData(0),R=mix.getChannelData(1),n=L.length,B=1152*32;
  const l16=new Int16Array(B),r16=new Int16Array(B),partes=[];let t=performance.now();
  for(let i=0;i<n;i+=B){const m=Math.min(B,n-i);
    for(let j=0;j<m;j++){const a=Math.max(-1,Math.min(1,L[i+j])),b=Math.max(-1,Math.min(1,R[i+j]));l16[j]=a<0?a*32768:a*32767;r16[j]=b<0?b*32768:b*32767}
    const buf=enc.encodeBuffer(l16.subarray(0,m),r16.subarray(0,m));if(buf.length)partes.push(new Uint8Array(buf));
    if(performance.now()-t>30){alAvanzar(i/n);await pausa();t=performance.now()}}
  const fin=enc.flush();if(fin.length)partes.push(new Uint8Array(fin));
  return new Blob(partes,{type:"audio/mpeg"})}
async function bajarMp3(){
  if(!S.stems)return;const btn=$("mp3"),clave=S.gen+JSON.stringify(S.mix)+JSON.stringify(S.mute);
  try{
    if(!S.mp3||S.mp3.clave!==clave){btn.disabled=true;btn.textContent="Mezclando…";
      const mix=await mezclaFinal(.9);
      const blob=await codificarMp3(mix,x=>{btn.textContent=`MP3… ${Math.round(x*100)} %`});
      S.mp3={clave,blob}}
    const r=await guardar(S.mp3.blob,base()+".mp3");estadoTexto(`MP3 ${r.toLowerCase()} ${(S.mp3.blob.size/1048576).toFixed(1)} MB.`)
  }catch(e){console.error(e);estadoTexto(e?.code==="declined"?"Descarga cancelada.":`No se pudo hacer el MP3: ${e?.message||e}`,true)}
  finally{btn.disabled=!S.stems;btn.textContent="Descargar MP3"}}
$("mp3").onclick=bajarMp3;

// Letra con acordes (o el cifrado por compases, si no hay letra)
$("txt").onclick=async()=>{if(!S.pieza)return;
  try{const txt=textoConAcordes({pieza:S.pieza,titulo:titulo(),subtitulo:subtitulo(),versos:sint()?versosPorSeccion():null});
    avisoExport(await guardar(new Blob([txt],{type:"text/plain;charset=utf-8"}),base()+(sint()?"_letra_y_acordes":"_acordes")+".txt"))}catch(e){errorExport(e)}};

// Partitura coral: a la vista y en PDF
function datosPapeles(){return{pieza:S.pieza,titulo:titulo(),subtitulo:subtitulo(),silabas:sint()?silabasPorQ():null}}
async function verPartitura(forzar){
  const caja=$("grabada");
  if(!forzar&&!caja.hidden){caja.hidden=true;$("verPartitura").setAttribute("aria-expanded","false");$("verPartitura").textContent="Ver la partitura";return}
  if(!S.pieza)return;
  caja.hidden=false;$("verPartitura").setAttribute("aria-expanded","true");$("verPartitura").textContent="Ocultar la partitura";
  $("grabadaNota").textContent=sint()?"Cinco pentagramas, de la tercia a los bajos, con la letra debajo de cada nota y los acordes arriba.":"Cinco pentagramas, de la tercia a los bajos, con los acordes arriba. Con cantores sintéticos aparece también la letra.";
  $("hoja").textContent="Escribiendo la partitura…";
  try{await mostrarPartitura($("hoja"),datosPapeles());if(!forzar)caja.scrollIntoView({behavior:"smooth",block:"start"})}
  catch(e){console.error(e);$("hoja").textContent=`No se pudo dibujar la partitura: ${e?.message||e}`}}
$("verPartitura").onclick=()=>verPartitura(false);
async function bajarPdf(){if(!S.pieza)return;avisoExport("Armando el PDF…");
  try{const blob=await pdfPartitura(datosPapeles());avisoExport(await guardar(blob,base()+"_partitura.pdf"))}catch(e){errorExport(e)}}
$("pdf").onclick=bajarPdf;$("pdf2").onclick=bajarPdf;

// Sílabas por semicorchea y versos por sección, para la partitura y la letra con acordes
function silabasPorQ(){const m=new Map(),L=S.letra;if(!L.sil)return m;
  for(const s of S.pieza.secs){const i=L.partes.findIndex(p=>p.secciones.includes(s.nombre));
    for(let k=0;L.sil.detalle.has(s.nombre+"|"+k);k++){const det=L.sil.detalle.get(s.nombre+"|"+k);
      const esc=i>=0?escritas(L.textos[i][k],det.reparto):null;   // como está escrita: con su h y sus mayúsculas
      det.reparto.forEach((r,j)=>r.notas.forEach((n,x)=>m.set(n.q,{texto:esc?.[j]||r.texto,primera:x===0,fin:r.fin,acento:r.acento,inicioVerso:j===0&&x===0,parte:n.parte,d:n.d})))}}
  return m}
function versosPorSeccion(){const L=S.letra,out=new Map();if(!L.sil)return out;
  for(const s of S.pieza.secs){const i=L.partes.findIndex(p=>p.secciones.includes(s.nombre));if(i<0)continue;const vs=[];
    for(let k=0;L.sil.detalle.has(s.nombre+"|"+k);k++){const det=L.sil.detalle.get(s.nombre+"|"+k);
      vs.push({texto:L.textos[i][k]||"",silabas:det.reparto.map(r=>({texto:r.texto,fin:r.fin,q0:r.notas[0].q,q1:r.notas[r.notas.length-1].q+r.notas[r.notas.length-1].d}))})}
    out.set(s.nombre,vs)}
  return out}

generar();
