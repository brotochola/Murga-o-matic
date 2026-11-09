// La página: controles, sonido, dibujo y exportación. El compositor está en compositor.js; los cantores sintéticos
// y el letrista, en cantor/; la partitura con letra, en vista.js; la partitura coral, el PDF y la letra con acordes, en papeles.js.
import { componer, RANGOS, PB, acorde } from './compositor.js';
import { DEMOS } from './demos.js';
import { MODELO } from './modelo.js';
import { TIMBRE } from './timbre.js';
import { metrica, silabear, cantores } from './cantor/coro.js';
import { cantar } from './cantor/cantor.js';
import { cantorDifonos, vozDelCantor } from './cantor/difonos.js';
import * as plantel from './plantel.js';   // el plantel: los bancos de voces de UTAU (bancos/plantel.json)
import { cuantoAdorna } from './cantor/adornos.js';
import { disenar } from './cantor/eq.js';
import { medir, versosDe } from './cantor/letra.js';
import { partesAEscribir } from './cantor/letrista.js';
import { escribirLetraLocal } from './cantor/letrista_local.js';
import { CURVA } from './cantor/timbre.js';
import { mostrarProceso } from './vista.js';
import { crearMultipista } from './multipista.js';
import { nombreAcorde, textoConAcordes, mostrarPartitura, pdfPartitura, cargarScript, escritas } from './papeles.js';
import { guardarMurga, leerMurga, borrarMurga, listarMurgas, nuevoId } from './murgas.js';

const DATOS = {"ritmos":[{"id":3,"nombre":"Marcha camión 2/4","tpc":2,"compas":0.8931,"compases":2,"bpm":134.4,"archivo":"loops/03.wav"},{"id":4,"nombre":"Marcha camión 4/4","tpc":4,"compas":2.7963,"compases":2,"bpm":85.8,"archivo":"loops/04.wav"},{"id":6,"nombre":"Base de murga","tpc":4,"compas":2.0109,"compases":2,"bpm":119.3,"archivo":"loops/06.wav"},{"id":8,"nombre":"Candombe","tpc":4,"compas":1.909,"compases":2,"bpm":125.7,"archivo":"loops/08.wav"},{"id":9,"nombre":"Pa'l costado","tpc":4,"compas":2.1441,"compases":2,"bpm":111.9,"archivo":"loops/09.wav"},{"id":10,"nombre":"Plena","tpc":4,"compas":1.729,"compases":2,"bpm":138.8,"archivo":"loops/10.wav"},{"id":11,"nombre":"Bossa nova","tpc":4,"compas":2.856,"compases":2,"bpm":84.0,"archivo":"loops/11.wav"},{"id":13,"nombre":"Conga","tpc":4,"compas":1.7225,"compases":2,"bpm":139.3,"archivo":"loops/13.wav"},{"id":14,"nombre":"Beat","tpc":4,"compas":1.7239,"compases":2,"bpm":139.2,"archivo":"loops/14.wav"},{"id":15,"nombre":"Bolero moderno","tpc":4,"compas":2.55,"compases":2,"bpm":94.1,"archivo":"loops/15.wav"},{"id":17,"nombre":"Son cubano","tpc":4,"compas":1.96,"compases":2,"bpm":122.4,"archivo":"loops/17.wav"},{"id":18,"nombre":"Montuno cubano","tpc":4,"compas":2.4999,"compases":2,"bpm":96.0,"archivo":"loops/18.wav"},{"id":19,"nombre":"Rumba cubana","tpc":4,"compas":2.4175,"compases":2,"bpm":99.3,"archivo":"loops/19.wav"},{"id":20,"nombre":"Miles Davis","tpc":4,"compas":2.6515,"compases":2,"bpm":90.5,"archivo":"loops/20.wav"}],"frases":{"1":{"archivo":"frases/01.wav","ultimo":5.6657,"seg":6.553},"5":{"archivo":"frases/05.wav","ultimo":2.798,"seg":3.999},"7":{"archivo":"frases/07.wav","ultimo":3.6629,"seg":4.196}},"acompana":{"3":[1,null],"4":[1,null],"6":[5,7]}};

const mod=(a,n)=>((a%n)+n)%n;
class Rng{constructor(s){this.a=(s*9973+17)>>>0} rand(){let t=this.a+=0x6d2b79f5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296} uni(a,b){return a+(b-a)*this.rand()}}
const NOTAS=["Do","Do#","Re","Mib","Mi","Fa","Fa#","Sol","Lab","La","Sib","Si"];
const NOMBRES_CUERDA={bajos:"Bajos",segundos:"Segundos",primos:"Primos",sobreprimos:"Sobreprimos",tercia:"Tercia"};
// Cuántos por cuerda y dónde se paran: como en cantor/coro.js (Sin Disfraz: segundos a un costado, sobreprimos en el
// medio, primos al otro; dos o tres sobreprimos contando la tercia). panDe() da vuelta el lado con la formación de La Teja.
const CUERDAS={
  bajos:{cantores:2,pan:-.72,rango:"sol2–re4"},
  segundos:{cantores:3,pan:-.42,rango:"do3–re4"},
  primos:{cantores:5,pan:.42,rango:"fa#3–la4"},
  sobreprimos:{cantores:2,pan:-.02,rango:"do4–la4"},
  tercia:{cantores:1,pan:.1,rango:"re4–la4"}};
const panDe=k=>CUERDAS[k].pan*(S.formacion==="teja"?-1:1);
// Adornos en las notas largas de las clarinadas y de los finales (cantor/adornos.js): ninguno, algunos o muchos
const ADORNOS_COR={ninguno:0,algunos:1,muchos:1.8};
// Cuánto gritan los cantores de difonos (cantor/difonos.js, gritar()): nada, como salieron o el doble
const GRITO_COR={no:0,si:1,mucho:1.6};
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
    const pan=Math.max(-1,Math.min(1,panDe(k)+rng.uni(-.12,.12)));const gl=Math.cos((pan+1)*Math.PI/4),gr=Math.sin((pan+1)*Math.PI/4);
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
// Un murguista con las muestras de coro («aah», sin letra), cuando cada uno canta con su voz: sus notas (las de
// cantores(), en segundos), cada una con la muestra de su altura, como un cantor de renderCuerda. La muestra ya es un
// grupito de voces. Devuelve { x, sr, inicio } como los de difonos; el timbre (eq) se le pone al sumar la cuerda.
async function cantarMuestras(notas,o){
  if(!notas.length)return{x:new Float32Array(0),sr:SR,inicio:0};
  const bufs={};await Promise.all([...new Set(notas.map(n=>Math.round(n.midi)))].map(async m=>{bufs[m]=await cargar(`coro/${o.banco}/${muestraDe(m)}.mp3`)}));
  const t0=Math.max(0,notas[0].t0-.05),fin=Math.max(...notas.map(n=>n.t1))+.2,len=Math.ceil((fin-t0)*SR),y=new Float32Array(len);
  const rng=new Rng((o.semilla||1)*31+7),desaf=rng.uni(-9,9)+(o.cents||0);
  const ataque=Math.round(.09*SR),subida=Math.round(.012*SR),caida=Math.round(.09*SR),xf=Math.round(.1*SR);
  for(const[k,nt]of notas.entries()){if(k%64===63)await pausa();const m=Math.round(nt.midi),x=bufs[m]&&bufs[m].getChannelData(0);if(!x)continue;
    const i0=Math.round((nt.t0-t0+rng.uni(0,.022))*SR);if(i0>=len)continue;
    const g=Math.pow(nt.vel??.7,1.23)*rng.uni(.85,1),rate=Math.pow(2,(desaf+rng.uni(-4,4))/1200+(nt.midi-muestraDe(m))/12);
    const n=Math.min(Math.round((nt.t1-nt.t0)*SR)+caida,len-i0),ls=Math.round(.8*SR),le=x.length-Math.round(.15*SR),per=le-ls;
    const at=i=>{const j=Math.floor(i),f=i-j;return x[j]+(x[j+1]-x[j])*f};
    let pos=ataque;
    for(let s=0;s<n;s++){
      if(pos>=le)pos-=per;
      let v=at(pos);
      if(pos>le-xf){const w=(pos-(le-xf))/xf;v=v*(1-w)+at(pos-per)*w}
      let e=1;if(s<subida)e=s/subida;else if(s>n-caida)e=Math.max(0,(n-s)/caida);
      y[i0+s]+=v*g*e;pos+=rate}}
  return{x:y,sr:SR,inicio:t0};
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
// La batería, sección por sección. Cada compás toca el loop de su sección, o el que se eligió para ese compás
// (pieza.bateria[q del compás]: el número de ritmo, o 0 = sin batería; también en las partes a capela). Los compases
// seguidos con el mismo loop son un tramo y el loop arranca al principio del tramo; el corte antes de una parte a
// capela y la llamada siguen como estaban.
const COMPAS=16;
function loopDeCompas(pieza,s,q){const b=pieza.bateria||{};return q in b?b[q]:(s.bateria&&s.tipo!=="llamada"&&!s.golpe?s.loop:0)}
async function renderPercusion(P,secs,bateria={}){
  const len=Math.ceil(P.total*SR);const ctx=new OAC(2,len,SR);
  const tocar=(buf,when,off=0,dur,fadeOut=0,decay=false,dest=ctx.destination,rate=1)=>{const s=ctx.createBufferSource();s.buffer=buf;s.playbackRate.value=rate;const g=ctx.createGain();s.connect(g).connect(dest);
    let w=when,o=off;if(w<0){o-=w*rate;w=0}const D=dur??((buf.duration-o)/rate);if(D<=0)return;
    g.gain.setValueAtTime(1,w);if(decay){g.gain.setTargetAtTime(0,w+.05,.35)}else if(fadeOut){g.gain.setValueAtTime(1,w+Math.max(0,D-fadeOut));g.gain.linearRampToValueAtTime(0,w+D)}
    s.start(w,o,D*rate)};
  const pz={bateria};
  // los loops y las frases que va a usar, pedidos todos juntos (de a uno, cada uno esperaba al anterior)
  {const ids=new Set();for(const s of secs){ids.add(s.loop);for(let q=s.inicio;q<s.inicio+s.largo;q+=COMPAS)ids.add(loopDeCompas(pz,s,q))}
   const us=new Set([DATOS.ritmos[2].archivo]);for(const id of ids){const r=DATOS.ritmos.find(x=>x.id===id);if(r)us.add(r.archivo);for(const f of DATOS.acompana[id]||[])if(f)us.add(DATOS.frases[f].archivo)}
   await Promise.all([...us].map(u=>cargar(u).catch(()=>{})))}
  for(let i=0;i<secs.length;i++){const s=secs[i];const t0=s.t0,t1=s.t1;
    const ritmoSec=DATOS.ritmos.find(r=>r.id===s.loop)||DATOS.ritmos[2];
    if(s.tipo==="llamada"){const sigR=secs[i+1]?.loop??s.loop;const[ll]=DATOS.acompana[sigR]||[null];if(ll){const f=DATOS.frases[ll];tocar(await cargar(f.archivo),t1-f.ultimo)}continue}   // su último golpe cae en el 1 que sigue
    if(s.golpe){const b=await cargar(ritmoSec.archivo);tocar(b,t0,0,1.6,0,true);continue}
    // los tramos
    const tramos=[];for(let q=s.inicio;q<s.inicio+s.largo;q+=COMPAS){const id=loopDeCompas(pz,s,q),u=tramos[tramos.length-1];if(u&&u.id===id)u.q1=q+COMPAS;else tramos.push({id,q0:q,q1:Math.min(q+COMPAS,s.inicio+s.largo)})}
    if(!tramos.some(u=>u.id))continue;
    let dest=ctx.destination;
    if(s.fade){const g=ctx.createGain();g.gain.setValueAtTime(s.fadeFinal?.3:1,t0);g.gain.linearRampToValueAtTime(s.fadeFinal?.02:.3,t1);g.connect(ctx.destination);dest=g}   // la bajada se apaga
    const sig=secs[i+1];
    for(let k=0;k<tramos.length;k++){const u=tramos[k];if(!u.id)continue;
      const ritmo=DATOS.ritmos.find(r=>r.id===u.id)||ritmoSec,[,corte]=DATOS.acompana[ritmo.id]||[null,null];
      const a=P.T(u.q0),z=P.T(u.q1),ultimoTramo=k===tramos.length-1,sigueSin=!tramos[k+1]?.id;
      const loop=await cargar(ritmo.archivo);const rate=s.tempo/ritmo.bpm;const ln=loop.duration/rate;
      const hayCorte=ultimoTramo&&corte&&sig&&!sig.bateria&&sig.tipo!=="llamada"&&!sig.sinCorte&&s.bateria;let finLoop=z;
      if(hayCorte)finLoop=z-DATOS.frases[corte].ultimo;
      const apagar=hayCorte||(ultimoTramo?(!sig||!sig.bateria):sigueSin);
      if(Math.abs(rate-1)>=.012){tocar(pistaRebanada(ctx,loop,finLoop-a,rate),a,0,finLoop-a,apagar?.02:0,false,dest,1)}
      else for(let t=a;t<finLoop-1e-4;t+=ln){const d=Math.min(ln,finLoop-t);const ultimo=t+ln>=finLoop-1e-4;tocar(loop,t,0,d,(ultimo&&apagar)?.02:0,false,dest,rate)}
      if(hayCorte){const f=DATOS.frases[corte];tocar(await cargar(f.archivo),finLoop,0,Math.min(f.seg,f.ultimo+.9),.5)}}}
  return ctx.startRendering();
}

function picoDe(bufs){let p=1e-9;const n=Math.max(...bufs.map(b=>b.length));for(let ch=0;ch<2;ch++){const datos=bufs.map(b=>b.getChannelData(ch));for(let i=0;i<n;i+=2){let s=0;for(const d of datos)s+=d[i]||0;const a=Math.abs(s);if(a>p)p=a}}return p}   // las cuerdas que callan (el solista) son de una muestra
function procesar(buf,escala,drive){const k=Math.tanh(drive);for(let ch=0;ch<buf.numberOfChannels;ch++){const d=buf.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=Math.tanh(drive*d[i]*escala)/k}}
// La sala donde cantan todos juntos (la batería va seca): 20 ms de silencio, unos primeros rebotes distintos en cada
// lado y una cola que se apaga en 1,6 s en los graves y en 0,7 s arriba de 2,5 kHz, sin lo de abajo de 120 Hz.
// Antes era ruido blanco de 0,7 s, y casi no se oía. Cuánta sala: S.sala, en la mezcla.
const IRS={};
// Dónde cantan: cada lugar con su sala (cuánto tarda en llegar el primer rebote, cuánto dura la cola en los graves
// y arriba de 2,5 kHz, los primeros rebotes y un eco de las paredes de enfrente), cuánto se manda a la sala, a qué
// distancia están los cantores (sin micrófonos llegan con menos agudos) y cuánto de la batería suena en la sala. Con
// micrófonos (Teatro de Verano, tablado) las voces van cerca y casi secas; sin micrófonos (club, cancha) la sala se oye
// mucho, las voces llegan de lejos y la batería también rebota. «Sala» (S.sala, 0,5 = lo de cada lugar) escala el envío.
const LUGARES={
  teatro:{nombre:"Teatro de Verano, con micrófonos",pre:.03,grave:1.1,agudo:.5,primeros:[19,29,41,59],eco:0,envio:.24,lejos:0,bateria:.06,hint:"Al aire libre y con micrófonos: las voces cerca, presentes, con un poco de rebote del anfiteatro."},
  tablado:{nombre:"Tablado de barrio, con micrófonos",pre:.02,grave:.8,agudo:.4,primeros:[13,23,37],eco:.11,envio:.3,lejos:-1.5,bateria:.1,hint:"El escenario del barrio: micrófonos simples y un eco de las casas de enfrente."},
  club:{nombre:"Club de barrio, sin micrófonos",pre:.015,grave:1.5,agudo:.8,primeros:[9,14,21,29,38,47,61],eco:0,envio:.55,lejos:-4,bateria:.35,hint:"Sin micrófonos, en el salón del club: la sala se oye mucho y los cantores llegan desde unos metros."},
  cancha:{nombre:"Cancha techada, sin micrófonos",pre:.025,grave:2.6,agudo:1.2,primeros:[17,29,43,61,83],eco:.18,envio:.7,lejos:-6,bateria:.5,hint:"Una cancha de fútbol 5 o un gimnasio: todo retumba, las voces llegan de lejos."},
  calle:{nombre:"En la calle",pre:.01,grave:.45,agudo:.22,primeros:[7,19],eco:.07,envio:.12,lejos:-2,bateria:.04,hint:"En la calle o en la plaza: casi sin rebotes, sólo un poco de las fachadas."}};
const lugar=()=>LUGARES[S.lugar]||LUGARES.teatro;
function salaIR(ctx){const sr=ctx.sampleRate,L=lugar(),clave=sr+"|"+S.lugar;
  if(!IRS[clave]){const largo=Math.max(L.grave,L.agudo)*1.2+L.eco+.1,n=Math.floor(largo*sr),pre=Math.round(L.pre*sr),r=new Rng(5),kl=1-Math.exp(-2*Math.PI*2500/sr),kh=1-Math.exp(-2*Math.PI*120/sr);
    IRS[clave]=[0,1].map(ch=>{const d=new Float32Array(n+pre);let lo=0,hp=0;
      for(let i=0;i<n;i++){const t=i/sr,w=r.rand()*2-1;lo+=(w-lo)*kl;const v=(lo*Math.exp(-6.9*t/L.grave)+(w-lo)*.8*Math.exp(-6.9*t/L.agudo))*Math.min(1,t/.03);hp+=(v-hp)*kh;d[pre+i]=v-hp}
      L.primeros.forEach((ms,k)=>{const i=pre+Math.round((ms+ch*2.7+k*.9*ch)*sr/1000);if(i<d.length)d[i]+=(k%2?-1:1)*.5*Math.pow(.8,k)});
      if(L.eco){const i=pre+Math.round((L.eco+ch*.004)*sr);for(let k=0;k<Math.round(.006*sr)&&i+k<d.length;k++)d[i+k]+=.35*Math.sin(Math.PI*k/(.006*sr))*(r.rand()*2-1)}
      return d})}
  const ir=ctx.createBuffer(2,IRS[clave][0].length,sr);ir.copyToChannel(IRS[clave][0],0);ir.copyToChannel(IRS[clave][1],1);return ir}
const envio=()=>lugar().envio*S.sala/.5;

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
  const adornosDe=c=>cuantoAdorna(c.cuerda,c.semilla,c.c||0)*(ADORNOS_COR[S.adornos]??1);
  const enHilo=async c=>{await pausa();return cantar(c.notas,{sr:SR,tipo:c.tipo,semilla:c.semilla,retraso:c.retraso,adornos:adornosDe(c),separar:true})};
  const tarea=async w=>{while(i<lista.length&&sigue()){const j=i++,c=lista[j];let r;
    if(w){try{r=await enObrero(w,{notas:c.notas,opc:{sr:SR,tipo:c.tipo,semilla:c.semilla,retraso:c.retraso,adornos:adornosDe(c)}})}catch(e){console.warn("canta la página:",e.message);w=null;r=await enHilo(c)}}
    else r=await enHilo(c);
    if(sigue())alListo(j,r)}};
  await Promise.all(ws.length?ws.map(tarea):[tarea(null)]);
}
let IR_CANTOR=null;
async function cantarCuerdas(pieza,P,gen,incremental){
  const L=S.letra,letras=letrasPorSeccion();
  L.sil=silabear(pieza,letras);
  const lista=cantores(pieza,L.sil.porQ,{semilla:S.semCoro,formacion:S.formacion});
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
// Cuando cada uno canta con su voz, la voz de un murguista puede ser una de MBROLA, la de un banco del plantel, las
// muestras de coro («aah», sin letra) o los formantes (la voz armada desde cero). NIVEL_MOTOR: cada motor sale con
// otro volumen; esto los empareja con los de MBROLA (medido en la página: herramientas/probar_voces.mjs).
const VOZ_MUESTRAS="muestras",VOZ_FORMANTES="formantes";
const VOCES_PROPIAS={[VOZ_MUESTRAS]:"Muestras de coro",[VOZ_FORMANTES]:"Formantes"};
const nombreVoz=v=>VOCES_PROPIAS[v]||plantel.nombreDeVoz(v);
// (2026-11-09, los trece con cada voz, contra los trece con es2: muestras -16,0 dB, formantes +11,8 dB; con eso, en
// otra pieza, -0,1 y +1,0 dB. Los bancos, todos más bajos: MIKE -6,6, Sheep Oveja -7,3, Sanfu -6,0, Vincen-oto Legato
// -6,2 dB. Con una sola clase de voz no cambia nada, la página iguala el pico; sirve cuando se mezclan.)
const NIVEL_MOTOR={muestras:6.3,formantes:.24,banco:2.1};
const mbHilo={};
async function difonosEnHilo(notas,opc){const v=opc.voz||"es2";
  if(!mbHilo[v])mbHilo[v]=(async()=>{const[{crearMbrola},wasm,voz]=await Promise.all([import("./cantor/mbrola.js"),...["vendor/mbrola/mbrola.wasm","vendor/mbrola/"+v].map(u=>fetch(new URL(u,import.meta.url)).then(x=>{if(!x.ok)throw new Error("no se pudo bajar "+u);return x.arrayBuffer()}))]);return crearMbrola(wasm,new Uint8Array(voz))})();
  const[{cantarDifonos},mb]=await Promise.all([import("./cantor/difonos.js"),mbHilo[v]]);await pausa();return cantarDifonos(mb,notas,opc)}
// Sólo se canta lo que cambió: cada cantante canta siempre en el mismo obrero (que se acuerda de las frases que ya
// cantó: difonos.js, opc.memo), y una cuerda se vuelve a sumar sólo si cambió algo de sus cantantes (las notas, la
// sílaba, la voz, el volumen o el paneo). incremental: las cuerdas que no cambiaron quedan como estaban en S.stems.
function huella(t){let h=0x811c9dc5;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,0x01000193)}return(h>>>0).toString(36)+t.length.toString(36)}
// Un cantor sumado a mano a una cuerda (L, R a SR, L[0] es la muestra `desde` de la pieza): pasado a SR con
// interpolación lineal, como un AudioBufferSourceNode de Chrome, con su volumen y el paneo de potencia constante de un
// StereoPannerNode con entrada mono. r: { x, sr, inicio }.
function sumarAMano(r,[g,pan],L,R,desde=0){const x=r.x;if(!x||x.length<2)return;
  const a=(Math.max(-1,Math.min(1,pan))+1)*Math.PI/4,gl=g*Math.cos(a),gr=g*Math.sin(a),k=r.sr/SR;
  const n0=Math.max(desde,Math.ceil(r.inicio*SR)),n1=Math.min(desde+L.length,Math.floor((r.inicio+(x.length-1)/r.sr)*SR));
  for(let n=n0;n<n1;n++){const p=(n-r.inicio*SR)*k,j=p|0,v=x[j]+(x[j+1]-x[j])*(p-j);L[n-desde]+=v*gl;R[n-desde]+=v*gr}}

// Los cantores de difonos (MBROLA), de banco, de muestras o de formantes, cada uno con su voz y sus valores: lo que
// cantan en toda la pieza (sus notas, sus opciones, su volumen y su paneo).
// Con «sólo un solista», canta el primero de los primos (la melodía) y las otras cuerdas callan.
function listaDeCantores(pieza,solo){
  const L=S.letra,letras=letrasPorSeccion();
  L.sil=silabear(pieza,letras);
  let todos=cantores(pieza,L.sil.porQ,{semilla:S.semCoro,formacion:S.formacion});
  if(solo)todos=[todos.find(x=>x.cuerda==="primos")||todos[0]];
  todos=todos.map((c,i)=>({...c,clave:c.cuerda+(c.c||0),lugar:i}));
  // lo que se cambió a mano en «Los cantantes» (y quién canta solo o está callado)
  const lista=todos.filter(c=>!(S.ajustes[c.clave]||{}).mudo&&(!S.soloCantor||solo||c.clave===S.soloCantor));
  // «Sólo un solista» canta con la voz del primer primo del plantel (MIKE: la que mejor se entiende, docs/solistas_reales.md), o con es2
  for(const c of lista){const aj=S.ajustes[c.clave]||{};
    const o={...cantorDifonos(c.cuerda,aj.semilla??c.semilla,{c:solo?0:c.c||0}),voz:solo?(plantel.vozDeLugar("primos0")??"es2"):(plantel.vozDeLugar(c.clave)??vozDelCantor(c.c||0)),...elegidos(aj)};o.adornos*=ADORNOS_COR[S.adornos]??1;o.grito*=GRITO_COR[S.grito]??1;
    c.opc={...o,retraso:o.retraso+(c.retraso||0),memo:true};c.motor="difonos";
    // con las muestras de coro («aah», sin letra) o con los formantes: su afinación, su garganta y sus adornos
    // (los mismos valores que muestra el inspector: los de su tarjeta, o los que se cambiaron a mano)
    if(o.voz===VOZ_MUESTRAS){c.motor="muestras";c.opc={banco:BANCOS[(c.c||0)%2],semilla:aj.semilla??c.semilla,cents:100*(o.transporte||0)}}
    else if(o.voz===VOZ_FORMANTES){c.motor="formantes";c.opc={sr:SR,tipo:c.tipo,semilla:aj.semilla??c.semilla,retraso:c.retraso||0,adornos:o.adornos,desafinacion:o.transporte||0,escalaFormantes:1/(o.tracto||1),memo:true}}
    else if(plantel.esDeBanco(o.voz)){const vb=plantel.opcionesBanco(o.voz,c.cuerda,c.opc,elegidos(aj),c.c||0);
      c.respaldo={...c.opc,voz:vozDelCantor(c.c||0)};if(vb){c.motor="banco";c.opc=vb}else c.opc=c.respaldo}
    c.mezcla=[(solo?1:c.ganancia)*Math.pow(10,(aj.db||0)/20)*(NIVEL_MOTOR[c.motor]??1),aj.pan??(solo?0:c.pan)]}
  return lista;
}
// las notas de un cantor que empiezan en una sección
const notasEn=(c,s)=>c.notas.filter(n=>n.t0>=s.t0-1e-6&&n.t0<s.t1-1e-6);
// lo que canta una sección: un pedazo por cuerda, desde un segundo antes (las respiraciones, la entrada desde abajo)
// hasta tres después (lo que queda sonando); se suman con los de las secciones vecinas
const extensionDe=s=>{const a=Math.max(0,Math.floor((s.t0-1)*SR)),b=Math.min(Math.ceil(S.P.total*SR),Math.ceil((s.t1+3)*SR));return[a,Math.max(a+1,b)]};

// Las voces se cantan por sección: S.clips[nombre] = { cuerdas: { bajos: { b (AudioBuffer), inicio (s), firma } … },
// pico }. Al tocar, cada pedazo suena en su lugar (grafo) y entra en vivo si se termina de cantar mientras suena
// (clipEnVivo). Una sección vuelve a cantar sólo las cuerdas que cambiaron (la firma: sus notas, sílabas, voces,
// volúmenes y paneos); los cantantes que no cambiaron salen de la memoria de su obrero. Todas las voces al mismo
// pico: S.pvClips, el pico de la sección más fuerte (las cuerdas sumadas).
async function cantarUnaSeccion(s,gen,paso){
  const pieza=S.pieza,P=S.P,lista=listaDeCantores(pieza,S.voces==="solista"),[a,b]=extensionDe(s),n=b-a;
  const clip=S.clips.get(s.nombre)||{cuerdas:{},pico:0},hacer=[];
  for(const k of ORDEN){const js=lista.filter(c=>c.cuerda===k).map(c=>({...c,notas:notasEn(c,s)})).filter(c=>c.notas.length);
    const firma=huella(JSON.stringify([a,n,P.brillo,js.map(c=>[c.clave,c.notas,c.motor,c.opc,c.mezcla])]));
    if(clip.cuerdas[k]?.firma===firma)continue;
    hacer.push({k,js,firma})}
  if(!hacer.length)return 0;
  const todos=hacer.flatMap(h=>h.js),res=new Map();let hechos=0;
  const uno=async(c,w)=>{let r=null;
    if(c.motor==="muestras")r=await cantarMuestras(c.notas,c.opc);
    else if(c.motor==="formantes"){if(w){try{r=await enObrero(w,{notas:c.notas,opc:c.opc})}catch(e){console.warn("canta la página:",e.message)}}
      if(!r){await pausa();r=cantar(c.notas,{...c.opc,separar:true})}}
    else{const msg={motor:c.motor||"difonos",notas:c.notas,opc:c.opc};
      if(w){try{if(msg.motor==="banco")await plantel.presentar(w,msg.opc.banco,enObrero);r=await enObrero(w,msg)}catch(e){console.warn("canta la página:",e.message)}}
      if(!r)r=await difonosEnHilo(msg.notas,msg.motor==="banco"?c.respaldo:msg.opc)}
    res.set(c.clave,r);hechos++;if(gen===S.gen)avance(paso(hechos/todos.length),`Cantando «${s.nombre}»: ${hechos} de ${todos.length} cantores…`)};
  avance(paso(0),`Cantando «${s.nombre}»: 0 de ${todos.length} cantores…`);
  const ws=losObreros();
  if(ws.length){const colas=ws.map(()=>[]);for(const c of todos)colas[c.lugar%ws.length].push(c);
    await Promise.all(colas.map(async(q,i)=>{for(const c of q){if(gen!==S.gen)return;await uno(c,ws[i])}}))}
  else for(const c of todos){if(gen!==S.gen)break;await uno(c,null)}
  if(gen!==S.gen||pieza!==S.pieza)return-1;
  for(const{k,js,firma}of hacer){
    // los de MBROLA y de banco se suman a mano (sumarAMano); los que llevan un filtro (el color del coro real de los
    // formantes, el timbre de las muestras), con Web Audio
    const L=new Float32Array(n),R=new Float32Array(n),filtrados=[];
    for(const c of js){const r=res.get(c.clave);if(!r)continue;if(r.voz||c.motor==="muestras")filtrados.push(c);else sumarAMano(r,c.mezcla,L,R,a)}
    if(filtrados.length){
      const ctx=new OAC(2,n,SR),t0=a/SR;
      // los filtros de fase lineal atrasan media respuesta: esos cantores arrancan esa media respuesta antes
      const filtro=ir=>{const f=ctx.createConvolver();f.normalize=false;const bb=ctx.createBuffer(1,ir.length,SR);bb.copyToChannel(ir,0);f.buffer=bb;f.connect(ctx.destination);return f};
      let fMuestras=null,fFormantes=null;
      const poner=(x,sr,inicio,c,dest,atraso=0)=>{if(!x||!x.length)return;const bb=ctx.createBuffer(1,x.length,sr);bb.copyToChannel(x,0);
        const src=ctx.createBufferSource();src.buffer=bb;const g=ctx.createGain();g.gain.value=c.mezcla[0];const p=ctx.createStereoPanner();p.pan.value=c.mezcla[1];
        src.connect(g).connect(p).connect(dest);const t=inicio-atraso-t0;src.start(Math.max(0,t),Math.max(0,-t))};
      for(const c of filtrados){const r=res.get(c.clave);
        if(r.voz){if(!IR_CANTOR)IR_CANTOR=disenar(CURVA,SR,2048);fFormantes??=filtro(IR_CANTOR);
          poner(r.voz,SR,0,c,fFormantes,IR_CANTOR.length/2/SR);poner(r.ruido,SR,0,c,ctx.destination)}
        else{fMuestras??=filtro(respuesta(P.brillo));poner(r.x,r.sr,r.inicio,c,fMuestras,IR_N/2/SR)}}
      const bb=await ctx.startRendering();if(gen!==S.gen)return-1;
      const bl=bb.getChannelData(0),br=bb.getChannelData(1);for(let i=0;i<n;i++){L[i]+=bl[i];R[i]+=br[i]}}
    const buf=decodeCtx.createBuffer(2,n,SR);buf.copyToChannel(L,0);buf.copyToChannel(R,1);
    clip.cuerdas[k]={b:buf,inicio:a/SR,firma};await pausa();if(gen!==S.gen)return-1}
  // el pico de la sección, con las cuerdas sumadas (todas tienen la misma extensión)
  const bs=ORDEN.map(k=>clip.cuerdas[k]?.b).filter(Boolean);clip.pico=bs.length?picoDe(bs):0;
  S.clips.set(s.nombre,clip);S.vozHecha=true;
  const pv=Math.max(1e-9,...[...S.clips.values()].map(c=>c.pico));S.pvClips=pv;
  clipEnVivo(s.nombre);
  return hacer.length;
}
// La cola de secciones para cantar, en el orden de la pieza; «primero» las pone adelante (la que se pidió a mano).
// Un solo trabajo a la vez; lo que se pide mientras canta se suma a la cola. generar() y «Parar» la vacían (S.gen).
const colaSecciones=[];let cantandoSecciones=null,seccionEnCurso=null;
function pedirSecciones(nombres,{primero=false}={}){if(!S.pieza)return;
  const orden=S.pieza.secs.map(x=>x.nombre),nuevas=[...new Set(nombres)].filter(x=>orden.includes(x)&&!colaSecciones.includes(x));
  if(primero)colaSecciones.unshift(...nuevas);else{colaSecciones.push(...nuevas);colaSecciones.sort((x,y)=>orden.indexOf(x)-orden.indexOf(y))}
  if(!colaSecciones.length&&!cantandoSecciones)return;
  S.mp3=null;S.cantando=true;pasos();
  if(!cantandoSecciones)cantandoSecciones=correrSecciones().finally(()=>{cantandoSecciones=null})}
async function correrSecciones(){
  const gen=S.gen;let hechas=0,cantadas=0;
  try{
    if(S.letraEn){avance(.01,"Esperando la letra…");await S.letraEn}
    await Promise.race([plantel.listo,new Promise(r=>setTimeout(r,4000))]);   // qué bancos están
    while(colaSecciones.length&&gen===S.gen){
      const nombre=colaSecciones.shift(),s=S.pieza.secs.find(x=>x.nombre===nombre);if(!s)continue;seccionEnCurso=nombre;
      const total=hechas+colaSecciones.length+1,paso=x=>(hechas+x)/total;
      const r=await cantarUnaSeccion(s,gen,paso);if(r<0||gen!==S.gen)return;
      hechas++;if(r>0)cantadas++;
      actualizarVistas();pasos()}
  }catch(e){if(gen!==S.gen)return;console.error(e);estadoTexto(`No se pudo cantar: ${e&&e.message||e}`,true)}
  finally{seccionEnCurso=null;S.cantos=(S.cantos||0)+1;if(gen===S.gen){S.cantando=false;avance(null);
    if(sint()){S.letra.cantada=S.letra.textos.map(x=>x.slice());S.letra.pendiente=false;$("avisoLetra").hidden=true}
    if(!$("status").classList.contains("err"))resumen();guardarLuego();pasos()}}
}
// las secciones que tienen algo para cantar
const seccionesConVoz=()=>S.pieza?S.pieza.secs.filter(s=>s.tipo!=="llamada"&&ORDEN.some(k=>S.pieza.ev[k].some(e=>e[0]>=s.inicio&&e[0]<s.inicio+s.largo))):[];
// un pedazo que se terminó de cantar mientras suena: entra en vivo, en su lugar (y el de antes de esa sección se calla)
function clipEnVivo(nombre){const N=S.nodos;if(!N||!S.tocando||!N.clipSrcs)return;
  for(const x of N.clipSrcs.get(nombre)||[])try{x.stop()}catch(e){}
  for(const k of ORDEN)N.norm[k].gain.setTargetAtTime(1/(S.pvClips||1),S.ac.currentTime,.05);
  ponerClip(S.ac,nombre,S.clips.get(nombre),N.norm,S.ac.currentTime+.05,N.clipSrcs,S.inicio)}
// los pedazos de una sección, en su lugar: `cero` es el momento (del contexto) en que empieza la pieza
function ponerClip(ctx,nombre,clip,norm,desde,clipSrcs,cero){const srcs=[];
  for(const k of ORDEN){const c=clip?.cuerdas[k];if(!c)continue;const fin=cero+c.inicio+c.b.duration;if(fin<=desde)continue;
    const src=ctx.createBufferSource();src.buffer=c.b;src.connect(norm[k]);const t=cero+c.inicio;
    if(t>=desde)src.start(t);else src.start(desde,desde-t);srcs.push(src)}
  clipSrcs.set(nombre,srcs)}

// ============================================================ los cantantes de difonos, uno por uno
const NOMBRE_CANTOR={bajos:"Bajo",segundos:"Segundo",primos:"Primo",sobreprimos:"Sobreprimo",tercia:"Tercia"};
const PARAMS=[
  ["tracto","Garganta",.8,1.2,.01,v=>`${v<1?"":"+"}${Math.round((v-1)*100)} %`,"El largo de la garganta: más corta, la voz más clara; más larga, más oscura."],
  ["transporte","Afinación",-.5,.5,.01,v=>`${v>0?"+":""}${Math.round(v*100)} cents`,"Cuánto canta alto o bajo toda la pieza (100 cents son un semitono)."],
  ["vibrato","Vibrato",0,.8,.01,v=>`${v.toFixed(2)} st`,"Cuánto ondula la nota en las notas largas. Los solistas de murga vibran unos 0,4 semitonos."],
  ["vibVel","Velocidad vibrato",4,7.5,.1,v=>`${v.toFixed(1)} Hz`,"Cuántas veces por segundo ondula la nota. Los murguistas, unas 5."],
  ["inclinacion","Brillo",-4,4,.1,v=>`${v>0?"+":""}${v.toFixed(1)} dB/oct`,"Más agudos (brillante) o menos (opaco)."],
  ["color","Color propio",0,10,.5,v=>`±${v} dB`,"Su timbre propio: unas ondas en el espectro que lo hacen distinto de los demás."],
  ["consonantes","Dicción",.8,1.6,.01,v=>`× ${v.toFixed(2)}`,"Consonantes más largas (más de 1) o más cortas. En las voces de banco conviene dejarla cerca de 1: estira la grabación."],
  ["pique","Entrada desde abajo",0,3,.05,v=>v<.01?"entra justo":`${Math.round(v*100)} cents`,"Cuánto arranca desde abajo al entrar después de un silencio. Los murguistas de verdad, unos 2 semitonos."],
  ["caida","Caída al final",0,4,.05,v=>v<.01?"no cae":`${Math.round(v*100)} cents`,"Cuánto cae la nota al final de algunas frases. Los de verdad, unos 2 semitonos en dos de cada tres finales."],
  ["respira","Respiración",0,2,.1,v=>v<.01?"no respira":v===1?"como los de verdad":`× ${v.toFixed(1)}`,"Cuánto se oye cuando toma aire antes de algunas frases. En el coro real respiran unos 7 de 13, antes de un tercio de las frases, 33 dB abajo del canto."],
  ["adornos","Adornos",0,1,.05,v=>v<.01?"canta liso":`${Math.round(v*100)} % de las notas largas`,"En las notas largas de las clarinadas y los finales: vibrato, trino, una vuelta o pasarse a otra voz del acorde."],
  ["grito","Grito",0,1.5,.05,v=>v<.01?"no grita":v<.45?"grita poco":v<.9?"grita":"grita mucho","La boca más abierta y la voz apretada y pareja: grita como en el tablado."],
  ["retraso","Retraso",-.03,.06,.001,v=>`${Math.round(v*1000)} ms`,"Cuánto entra tarde (o antes, si es negativo) respecto del coro."],
  ["db","Volumen",-12,6,.5,v=>`${v>0?"+":""}${v} dB`,"Su volumen en la mezcla."],
  ["pan","Paneo",-1,1,.05,v=>v<-.02?`${Math.round(-v*100)} izq.`:v>.02?`${Math.round(v*100)} der.`:"centro","Dónde suena, de izquierda a derecha."]];
const CLAVES_CANTOR=["voz",...PARAMS.map(p=>p[0]).filter(k=>k!=="db"&&k!=="pan"),...plantel.PARAMS_BANCO.map(p=>p[0])];
const elegidos=aj=>Object.fromEntries(CLAVES_CANTOR.filter(k=>aj[k]!=null).map(k=>[k,aj[k]]));
function guardarAjustes(){try{localStorage.setItem("murga.cantantes",JSON.stringify(S.ajustes))}catch(e){}guardarLuego()}
// Cada lugar del coro (bajos0, primos3…) tiene su murguista: un nombre, una cara (DiceBear, sale del nombre) y sus
// valores. No cambian con la semilla de la pieza (tienen la suya, S.semCoro): si cambiás la música cantan los mismos.
// Lo que se cambia a mano, el nombre y la cara se guardan en S.ajustes[lugar]. Al cambiar un valor, en un momento
// vuelve a cantar sólo ese cantante (cantarDeNuevo es incremental).
const NOMBRES=["Martín","Gonzalo","Diego","Sebastián","Nicolás","Federico","Agustín","Matías","Santiago","Rodrigo","Pablo","Andrés","Germán","Leonardo","Fabián","Gustavo","Marcelo","Fernando","Alejandro","Javier","Ignacio","Facundo","Mauricio","Emiliano","Bruno","Joaquín","Lucas","Mateo","Felipe","Raúl","Walter","Carlos","Jorge","Daniel","Alfredo","Rubén","Néstor","Horacio","Hugo","Julio","Pepe","Tato","Cacho","Toto","Pocho","Lalo","Nacho","Fito","Beto","Tito","Coco","Quique","Pancho","Chiche"];
// (miniavs, con fondos de colores; la semilla es el nombre, u otra si se pidió «Otra cara»)
const caraDe=semilla=>`https://api.dicebear.com/10.x/miniavs/svg?backgroundColor=ff5d8f,ffb703,43aa8b,4d96ff,b57bff&seed=${encodeURIComponent(semilla)}`;
// sin internet (o si DiceBear no contesta), las iniciales en un círculo del color de la cuerda
const COLOR_CUERDA={bajos:"#c0392b",segundos:"#c97a12",primos:"#2b2e6e",sobreprimos:"#0f8a7e",tercia:"#8e3fb3"};
const iniciales=(nombre,cuerda)=>"data:image/svg+xml,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${COLOR_CUERDA[cuerda]||"#5d6079"}"/><text x="32" y="41" font-family="sans-serif" font-size="26" font-weight="700" text-anchor="middle" fill="#fff">${esc((nombre||"?").slice(0,2))}</text></svg>`);
// crossOrigin: DiceBear contesta con CORS, y así la cara entra aunque el navegador le ponga a la página la regla de
// «sólo lo del mismo sitio» (COEP: la pone, por ejemplo, el service worker de otro proyecto servido en el mismo puerto)
function ponerCara(img,x){img.crossOrigin="anonymous";img.onerror=()=>{img.onerror=null;img.src=iniciales(x.nombre,x.c.cuerda)};img.src=caraDe(x.cara)}
const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
const nombreNota=m=>`${NOTAS[((m%12)+12)%12]} ${Math.floor(m/12)-1}`;
const LIBRO={bajos:"según Sin Disfraz, los segundos (los bajos incluidos) van de Do 3 a Do 4",segundos:"según Sin Disfraz, van de Do 3 a Do 4",primos:"según Sin Disfraz, van de Sol 3 a Sol 4",sobreprimos:"según Sin Disfraz, van de Mi 4 a La 4, y un buen sobreprimo llega a Si 4",tercia:"según Sin Disfraz, la tercia canta en el registro de los sobreprimos"};
const LUGAR=(()=>{let n=0;const o={};for(const k of Object.keys(CUERDAS)){o[k]=n;n+=CUERDAS[k].cantores}return o})();
function nombresDelCoro(){if(nombresDelCoro.k===S.semCoro)return nombresDelCoro.v;const r=new Rng(S.semCoro*31+7),a=NOMBRES.slice();
  for(let i=a.length-1;i>0;i--){const j=Math.floor(r.rand()*(i+1));[a[i],a[j]]=[a[j],a[i]]}nombresDelCoro.k=S.semCoro;return nombresDelCoro.v=a}
function losCantantes(){if(!S.pieza)return[];
  return cantores(S.pieza,S.letra.sil?.porQ||new Map(),{semilla:S.semCoro,formacion:S.formacion}).map(c=>{const n=c.c||0,clave=c.cuerda+n,aj=S.ajustes[clave]||{},lugar=LUGAR[c.cuerda]+n;
    const nombre=aj.nombre||nombresDelCoro()[lugar%NOMBRES.length];
    return{c,clave,n,lugar,nombre,cara:aj.cara||nombre,base:{...cantorDifonos(c.cuerda,aj.semilla??c.semilla,{c:n}),voz:plantel.vozDeLugar(clave)??vozDelCantor(n),db:0,pan:c.pan,semilla:aj.semilla??c.semilla}}})}
// los valores que no cantan (nombre, cara) no hacen volver a cantar
const NO_CANTAN=new Set(["nombre","cara"]);
let temporizadorCanto=null;
// (espera un momento por si cambian otra cosa enseguida: así canta una vez)
function programarCanto(){clearTimeout(temporizadorCanto);temporizadorCanto=setTimeout(()=>{if(S.pieza)cantarDeNuevo()},400)}
function cambiarCantante(clave,k,v){S.ajustes={...S.ajustes,[clave]:{...(S.ajustes[clave]||{}),[k]:v}};guardarAjustes();dibujarCantantes();if(!NO_CANTAN.has(k))programarCanto()}
// Las voces que puede tener un murguista, para un <select>: los bancos del plantel, MBROLA y las dos sin banco
function opcionesDeVoz(vv){const op=(v,t,mas="")=>`<option value="${esc(v)}"${v===vv?" selected":""}${mas}>${esc(t)}</option>`;
  return`<optgroup label="Bancos de voz cantada (el plantel)">${plantel.vocesDeBanco().map(v=>op(v.valor,v.nombre+(v.disponible?"":" (no está)"),`${v.disponible?"":" disabled"} title="${esc(v.disponible?v.nota:v.falta)}"`)).join("")}</optgroup>`+
    `<optgroup label="MBROLA (difonos de voces de habla)">${["es2","es1","es4"].map(v=>op(v,v+(v==="es4"?" (la más pobre)":""))).join("")}</optgroup>`+
    `<optgroup label="Otras">${op(VOZ_MUESTRAS,"Muestras de coro: «aah», sin letra")}${op(VOZ_FORMANTES,"Formantes: voz armada desde cero")}</optgroup>`}
const AYUDA_VOZ="La voz de este murguista: una voz cantada de un banco del plantel (arriba, en «El plantel»), los difonos de MBROLA (voces de habla), las muestras de coro («aah», sin letra) o los formantes (voz armada desde cero). Las de banco que no están aparecen apagadas: buscá su archivo en el plantel.";
// Lo que se le puede cambiar a un murguista de muestras o de formantes (lo demás es de los de difonos y de banco)
const PARAMS_DE={[VOZ_MUESTRAS]:new Set(["transporte","db","pan"]),[VOZ_FORMANTES]:new Set(["tracto","transporte","adornos","db","pan"])};
// La voz de uno o de varios murguistas (null: la que le toca en el plantel). Si la murga no cantaba cada uno con su
// voz (muestras o formantes para todos), pasa a eso y canta entera; si no, vuelven a cantar sólo esos.
function elegirVozDe(claves,v){const a={...S.ajustes};for(const c of claves){const o={...(a[c]||{})};if(v==null)delete o.voz;else o.voz=v;a[c]=o}
  S.ajustes=a;guardarAjustes();
  if(!difonos())elegirVoces("difonos");else programarCanto();
  dibujarCantantes()}
let cantanteAbierto=null,notaAbierta=null;const deshacer=[];
function actualizarInspector(){const cant=!!cantanteAbierto,nota=!!notaAbierta;
  $("inspCantante").hidden=!cant;$("cantVacio").hidden=cant;$("devNota").hidden=!nota;$("inspNota").hidden=!nota;
  $("procesoBloque").hidden=!sint();$("inspectorVacio").hidden=sint();
  if(!nota)multipista.elegirNota(null)}
function abrirCantante(clave){cantanteAbierto=clave;actualizarInspector();dibujarCantantes();abrirPanel("cantantes");
  if(matchMedia("(max-width:999px)").matches)$("inspCantante").scrollIntoView({behavior:"smooth",block:"nearest"})}
function dibujarInspCantante(){
  const x=losCantantes().find(y=>y.clave===cantanteAbierto);
  if(!x){cantanteAbierto=null;actualizarInspector();return}
  // una voz de banco canta con sus valores (ESTILO_BANCO, su vibrato, su grito: plantel.opcionesBanco), no con los de
  // MBROLA: el inspector muestra ésos (la garganta no: a mano se cuenta como la de MBROLA)
  const aj=S.ajustes[x.clave]||{},vv0=aj.voz??x.base.voz,vb=plantel.esDeBanco(vv0)?plantel.opcionesBanco(vv0,x.c.cuerda,x.base,{},x.n):null;
  const val=k=>aj[k]??(vb&&k!=="tracto"&&k!=="voz"&&vb[k]!=null?vb[k]:x.base[k]),k=x.c.cuerda;
  ponerCara($("icCara"),x);if(document.activeElement!==$("icNombre"))$("icNombre").value=x.nombre;
  $("icCuerda").textContent=`${NOMBRE_CANTOR[k]}${CUERDAS[k].cantores>1?` ${x.n+1}`:""}${x.n===0&&CUERDAS[k].cantores>1?" · lleva la cuerda":""}`;
  const ms=x.c.notas.map(n=>n.midi);
  $("icRango").innerHTML=ms.length?`En esta pieza canta de <b>${nombreNota(Math.min(...ms))}</b> a <b>${nombreNota(Math.max(...ms))}</b>. El compositor deja a los ${NOMBRES_CUERDA[k].toLowerCase()} entre ${nombreNota(RANGOS[k][0])} y ${nombreNota(RANGOS[k][1])}; ${LIBRO[k]}.`:"En esta pieza no canta.";
  $("icSolo").setAttribute("aria-pressed",S.soloCantor===x.clave);$("icMudo").setAttribute("aria-pressed",!!aj.mudo);
  const ps=$("icParams");ps.innerHTML="";
  const fila=(nombre,ctrl,out)=>{const r=document.createElement("label");r.className="param";r.innerHTML=`<span>${nombre}</span>`;r.append(ctrl);const o=document.createElement("output");o.textContent=out;r.append(o);ps.append(r);return o};
  const vv=val("voz"),sel=document.createElement("select");
  sel.innerHTML=opcionesDeVoz(vv);
  sel.title=AYUDA_VOZ;
  sel.onchange=()=>elegirVozDe([x.clave],sel.value);fila("Voz",sel,plantel.esDeBanco(vv)&&!plantel.vozDisponible(vv)?"no está: canta MBROLA":"");
  {const v=document.createElement("button");v.className="btn ghost";v.style.cssText="justify-self:start;padding:3px 8px;font-size:13px";v.textContent="Ver los modelos disponibles";v.onclick=()=>verModelos(true);ps.append(v)}
  if(PARAMS_DE[vv]){const h=document.createElement("p");h.className="hint";h.textContent=vv===VOZ_MUESTRAS?"Canta su línea con una muestra de coro («aah»), sin letra: la muestra ya es un grupito de voces. Se le cambian la afinación, el volumen y el paneo.":"Canta la letra con la voz de formantes, armada desde cero (la de «Formantes» para toda la murga). Se le cambian la garganta, la afinación, los adornos, el volumen y el paneo.";ps.append(h)}
  for(const[p,nombre,mn,mx,paso,fmt,ayuda]of PARAMS){if(PARAMS_DE[vv]&&!PARAMS_DE[vv].has(p))continue;const r=document.createElement("input");r.type="range";r.min=mn;r.max=mx;r.step=paso;r.value=val(p);
    const o=fila(nombre,r,fmt(+val(p)));if(ayuda){r.title=ayuda;o.parentElement.title=ayuda}r.oninput=()=>{o.textContent=fmt(+r.value)};r.onchange=()=>cambiarCantante(x.clave,p,+r.value)}
  // las voces de banco tienen además los valores de los resamplers de UTAU (docs/plan_cantantes.md)
  if(plantel.esDeBanco(vv))for(const[p,nombre,mn,mx,paso,fmt,ayuda]of plantel.PARAMS_BANCO){const r=document.createElement("input");r.type="range";r.min=mn;r.max=mx;r.step=paso;
    const v0=aj[p]??plantel.valorDeVoz(vv,p)??(p==="modulacion"?1:0);r.value=v0;r.title=ayuda;
    const o=fila(nombre,r,fmt(+v0));o.parentElement.title=ayuda;r.oninput=()=>{o.textContent=fmt(+r.value)};r.onchange=()=>cambiarCantante(x.clave,p,+r.value)}
}
function dibujarCantantes(){
  const caja=$("listaCantantes"),sec=$("cantantes");sec.hidden=!S.pieza;
  if(sec.hidden){actualizarInspector();return}
  let lista=losCantantes();if(S.voces==="solista")lista=lista.filter(x=>x.clave==="primos0");
  caja.innerHTML="";
  if(!difonos()){const a=document.createElement("p");a.className="hint aviso-voces";a.innerHTML=`Ahora toda la murga canta con ${S.voces==="muestras"?"las muestras de coro, sin letra":"los formantes"}: los murguistas no cantan con su voz. Para escucharlos, cada uno con la suya y con la letra: <button class="btn">Que canten con su voz</button>`;
    a.querySelector("button").title="Pasa a «Cada uno con su voz»: cada murguista canta con la voz que le toca (abajo, en su tarjeta)";a.querySelector("button").onclick=()=>elegirVoces("difonos");caja.append(a)}
  // toda la murga con una voz: la misma para los trece, o la de cada uno en el plantel
  const todos=losCantantes(),vs=new Set(todos.map(x=>(S.ajustes[x.clave]||{}).voz??null)),una=vs.size===1?[...vs][0]:undefined,vt=$("vozTodos");
  vt.innerHTML=`${una===undefined?'<option value="*" selected>Cada uno con una voz distinta (elegida a mano)</option>':""}<option value=""${una===null?" selected":""}>La de cada uno en el plantel</option>${opcionesDeVoz(una??"")}`;
  vt.onchange=()=>{if(vt.value!=="*")elegirVozDe(todos.map(x=>x.clave),vt.value||null)};
  for(const x of lista){const aj=S.ajustes[x.clave]||{},val=k=>aj[k]??x.base[k],k=x.c.cuerda;
    const d=document.createElement("div");d.className="tarjeta"+(Object.keys(aj).some(q=>!["mudo","nombre","cara"].includes(q))?" cambiado":"")+(x.clave===cantanteAbierto?" abierta":"")+(aj.mudo?" callado":"");
    d.tabIndex=0;d.setAttribute("role","button");d.setAttribute("aria-label",`${x.nombre}, ${NOMBRE_CANTOR[k].toLowerCase()}: ver y cambiar`);
    d.innerHTML=`<img alt="" loading="lazy"><div><b>${esc(x.nombre)}</b><small><i style="background:var(--${k})"></i>${NOMBRE_CANTOR[k]}${CUERDAS[k].cantores>1?" "+(x.n+1):""} · ${esc(nombreVoz(val("voz")))}${plantel.esDeBanco(val("voz"))&&!plantel.vozDisponible(val("voz"))?" (no está)":""}</small></div>
      <span class="acc"><button class="solo" aria-pressed="${S.soloCantor===x.clave}" title="Escucharlo solo">Solo</button><button class="mudo" aria-pressed="${!!aj.mudo}" title="Que no cante">Callar</button></span>`;
    ponerCara(d.querySelector("img"),x);
    d.onclick=()=>abrirCantante(x.clave);d.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();abrirCantante(x.clave)}};
    d.querySelector(".solo").onclick=e=>{e.stopPropagation();alternarSolo(x.clave)};
    d.querySelector(".mudo").onclick=e=>{e.stopPropagation();cambiarCantante(x.clave,"mudo",!aj.mudo)};
    caja.append(d)}
  if(cantanteAbierto)dibujarInspCantante()}
// «Escucharlo solo» es pedir escucharlo: canta aunque las voces todavía no se hayan cantado
function alternarSolo(clave){S.soloCantor=S.soloCantor===clave?null:clave;dibujarCantantes();
  if(difonos()){const ya=[...S.clips.keys()];pedirSecciones(ya.length?ya:[seccionElegida()?.nombre].filter(Boolean),{primero:true})}else if(sint())cantarVoces(true)}
// un murguista a un archivo, y de un archivo a un lugar del coro
function exportarCantante(){const x=losCantantes().find(y=>y.clave===cantanteAbierto);if(!x)return;const aj=S.ajustes[x.clave]||{};
  const datos={tipo:"murguista",version:1,nombre:x.nombre,cara:x.cara,cuerda:x.c.cuerda,semilla:aj.semilla??x.base.semilla};
  for(const k of CLAVES_CANTOR)datos[k]=aj[k]??x.base[k];
  guardar(new Blob([JSON.stringify(datos,null,1)],{type:"application/json"}),`murguista_${x.nombre.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g,"_")}.json`).then(t=>estadoTexto(t)).catch(e=>estadoTexto(`No se pudo exportar: ${e?.message||e}`,true))}
async function importarCantante(archivo){if(!archivo||!cantanteAbierto)return;
  try{const d=JSON.parse(await archivo.text());if(d.tipo!=="murguista")throw new Error("no es un murguista exportado del Murga-o-matic");
    const viejo=S.ajustes[cantanteAbierto]||{},nuevo={nombre:String(d.nombre||"").slice(0,40)||undefined,cara:d.cara?String(d.cara).slice(0,80):undefined};
    if(Number.isFinite(d.semilla))nuevo.semilla=d.semilla;
    for(const[k,,mn,mx]of PARAMS)if(k!=="db"&&k!=="pan"&&Number.isFinite(d[k]))nuevo[k]=Math.max(mn,Math.min(mx,d[k]));
    if(["es1","es2","es4",VOZ_MUESTRAS,VOZ_FORMANTES].includes(d.voz)||plantel.esDeBanco(d.voz))nuevo.voz=d.voz;
    for(const[k,,mn,mx]of plantel.PARAMS_BANCO)if(Number.isFinite(d[k]))nuevo[k]=Math.max(mn,Math.min(mx,d[k]));
    for(const k of["db","pan","mudo"])if(viejo[k]!=null)nuevo[k]=viejo[k];
    S.ajustes={...S.ajustes,[cantanteAbierto]:nuevo};guardarAjustes();dibujarCantantes();programarCanto();
    estadoTexto(`${nuevo.nombre||"El murguista"} canta ahora en este lugar${d.cuerda&&d.cuerda!==cantanteAbierto.replace(/\d+$/,"")?` (era de los ${NOMBRES_CUERDA[d.cuerda]?.toLowerCase()||d.cuerda})`:""}.`)}
  catch(e){estadoTexto(`No se pudo importar: ${e?.message||e}`,true)}}

// ============================================================ estado
const ORDEN=["bajos","segundos","primos","sobreprimos","tercia"];
const LLAMADAS=Object.fromEntries(DATOS.ritmos.map(r=>{const a=DATOS.acompana[r.id];if(!a||!a[0])return[r.id,0];const c4=r.compas*4/r.tpc;return[r.id,Math.ceil((DATOS.frases[a[0]].ultimo+.05)/c4)]}));
const S={version:2,formacion:"union",adornos:"algunos",grito:"si",sala:.5,recita:0,forma:"retirada",estilo:"todas",tonica:9,modo:"menor",ritmo:0,tempo:0,largo:"normal",seed:1,brillo:1,clarinada:true,cancionFinal:true,modula:true,tercia:0,mix:{bajos:1,segundos:1,primos:1,sobreprimos:1,tercia:1,bateria:.42},mute:{},solo:{},secElegida:null,
  voces:"muestras",semCoro:1,lugar:"teatro",acordes:{},tonos:{},clips:new Map(),pvClips:0,editando:null,ajustes:{},soloCantor:null,pieza:null,stems:null,P:null,ac:null,nodos:null,inicio:0,offset:0,tocando:false,gen:0,mp3:null,
  letra:{partes:[],textos:[],diags:null,temas:null,editados:new Set(),sel:{i:0,k:0},sil:null,marcas:[],semLetra:1,pendiente:false,cantada:null}};
const $=id=>document.getElementById(id);
try{S.ajustes=JSON.parse(localStorage.getItem("murga.cantantes")||"{}")||{}}catch(e){}
// la formación del coro y los adornos se guardan en este navegador
try{const c=JSON.parse(localStorage.getItem("murga.coro")||"{}")||{};if(c.formacion==="union"||c.formacion==="teja")S.formacion=c.formacion;if(c.adornos in ADORNOS_COR)S.adornos=c.adornos;if(c.grito in GRITO_COR)S.grito=c.grito;if(c.sala>=0&&c.sala<=1)S.sala=+c.sala;if(Number.isInteger(c.semCoro)&&c.semCoro>0)S.semCoro=c.semCoro;if(c.lugar in LUGARES)S.lugar=c.lugar}catch(e){}
function guardarCoro(){try{localStorage.setItem("murga.coro",JSON.stringify({formacion:S.formacion,adornos:S.adornos,grito:S.grito,sala:S.sala,semCoro:S.semCoro,lugar:S.lugar}))}catch(e){}guardarLuego()}
function mostrarCoro(){$("formacion").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===S.formacion));$("adornos").value=S.adornos;$("grito").value=S.grito;$("sala").value=S.sala;$("lugar").value=S.lugar;$("lugarHint").textContent=lugar().hint;$("campoAdornos").hidden=!sint();$("campoGrito").hidden=!difonos()}
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

function ocupado(texto){$("play").disabled=true;$("play").textContent=texto;for(const id of["mp3","pdf","txt","exportar","recantar","otraLetra","lailareo","otraMusica","otraLetra2","lailareo2","cantarVoces","cantarSeccion","secCantar"])$(id).disabled=true}
function listo(){$("play").disabled=false;$("play").textContent=S.tocando?"Pausa":"Tocar";for(const id of["mp3","pdf","txt","exportar","recantar","otraLetra","lailareo","otraMusica","otraLetra2","lailareo2","cantarVoces","cantarSeccion","secCantar"])$(id).disabled=false;avance(null);pasos()}
function resumen(){const c=S.pieza.secs.find(s=>s.tipo!=="clarinada"&&s.bateria)||S.pieza.secs[0];
  let t=`${S.forma==="presentacion"?"Presentación":"Retirada"} en ${NOTAS[S.tonica]} ${S.modo} · ${ESTILOS[S.estilo]} · ${c.tempo} BPM · ${fmt(S.P.total)}`;
  if(sint()){const L=S.letra,v=L.partes.reduce((a,p)=>a+p.versos.length,0),ok=L.partes.reduce((a,p,i)=>a+p.versos.filter((x,k)=>L.textos[i][k].trim()&&medir(L.textos[i][k]).n===x.silabas).length,0);t+=` · ${v} versos, ${ok} justos en la música`}
  estadoTexto(t)}
// Todas las voces al mismo pico (y un poco de saturación). Si sólo cambiaron algunas cuerdas, esas se escalan con el
// mismo factor que la última vez: las otras ya están procesadas, y así no cambia el volumen de lo que no se tocó.
function normalizarVoces(voces){const drive=sint()?1.02:1+.8*S.brillo;S.firmas=voces.firmas||null;
  // si cambiaron todas (otra voz para toda la murga), el pico se mide de nuevo
  if(voces.cambiadas&&S.pv&&voces.cambiadas.size<ORDEN.length){ORDEN.forEach((k,i)=>{if(voces.cambiadas.has(k))procesar(voces[i],1/S.pv,drive)});return}
  const pv=picoDe(voces);S.pv=pv;voces.forEach(b=>procesar(b,1/pv,drive))}

const firmaLetra=()=>JSON.stringify(S.letra.partes.map(p=>[p.nombre,p.versos.map(v=>v.silabas)]));
// Los pasos: 1, la música (componer), 2, la letra, y la batería; enseguida se ven el multipista, la partitura y la letra,
// y se puede tocar (con la batería). 3, las voces: las canta el botón «Cantar las voces» (cantarVoces), porque con
// los bancos tardan minutos. generar() hace la música y la letra; las voces, si opc.cantar (cambió cómo cantan y ya
// estaban cantadas). Con la música nueva, las voces de antes ya no van: quedan sin cantar.
async function generar(opc={}){
  const gen=++S.gen;detener(true);S.mp3=null;S.cantando=false;const que=opc.pieza?"Preparando…":"Componiendo…";ocupado(que);avance(.02,que);
  try{
    const C=S.version===1?await version1():{componer,MODELO};if(gen!==S.gen)return;
    if(!opc.pieza){notaAbierta=null;deshacer.length=0}
    const pieza=opc.pieza||C.componer(C.MODELO,{forma:S.forma,estilo:S.estilo,tonica:S.tonica,modo:S.modo,semilla:S.seed,largo:S.largo,tempo:S.tempo||null,ritmo:S.ritmo||null,clarinada:S.clarinada,cancionFinal:S.cancionFinal,modula:S.modula,tercia:S.tercia,recita:S.recita,llamadas:LLAMADAS,acordes:S.acordes,tonos:S.tonos});
    const{T,fin}=mapaTiempo(pieza);const total=fin+2.5;
    const P={T,total,seed:S.seed,brillo:S.brillo};
    const percP=renderPercusion(P,pieza.secs,pieza.bateria||{});
    // la letra que ya había (una murga guardada, o sólo cambiaron acordes) entra enseguida; una nueva se escribe
    // después de mostrar la música (el letrista tarda un par de segundos con una pieza larga)
    let escribir=false;
    if(sint()){
      // si sólo cambiaron acordes, la letra (y lo que editaste) se queda: las notas por verso son las mismas
      const L=S.letra,antes=opc.mantenerLetra&&L.textos.length?{textos:L.textos,diags:L.diags,temas:L.temas,editados:new Set(L.editados),sel:L.sel,firma:firmaLetra()}:null;
      armarLetra(pieza,T);
      const g=opc.letra,encaja=t=>Array.isArray(t)&&t.length===L.partes.length&&t.every((v,i)=>Array.isArray(v)&&v.length===L.partes[i].versos.length);
      if(g&&encaja(g.textos)){L.textos=g.textos.map(v=>v.slice());L.diags=g.diags||null;L.temas=g.temas||null;L.editados=new Set(g.editados||[]);L.sel=g.sel||{i:0,k:0};if(g.semLetra)L.semLetra=g.semLetra;$("tema").value=g.tema||""}
      else if(antes&&antes.firma===firmaLetra()){L.textos=antes.textos;L.diags=antes.diags;L.temas=antes.temas;L.editados=antes.editados;L.sel=antes.sel}
      else{L.textos=L.partes.map(p=>p.versos.map(()=>""));L.diags=null;escribir=true}
      L.cantada=null;L.pendiente=false;$("avisoLetra").hidden=true;
    }
    // la música ya se ve (el multipista, la partitura, los cantantes), y se puede tocar en cuanto está la batería
    window.murga={S};S.pieza=pieza;S.P=P;S.stems={bateria:null};S.firmas=null;S.pv=null;S.vozHecha=false;S.offset=0;
    colaSecciones.length=0;S.clips=new Map();S.pvClips=0;
    dibujarTodo();pasos();
    // la letra se escribe en un obrero mientras se arma la batería; la página no se traba
    // (si mientras tanto se pide otra letra o se escribe un verso, queda ésa; «Cantar las voces» la espera: S.letraEn)
    const sem=S.letra.semLetra;
    S.letraEn=escribir?letristaEnObrero(pedidoLetra(pieza)).then(r=>{if(gen!==S.gen&&S.pieza!==pieza)return;S.letraEn=null;
      if(S.letra.semLetra===sem&&S.letra.textos.every(v=>v.every(t=>!t))){aplicarLetra(r);libreto();actualizarVistas();if(!S.cantando)resumen();guardarLuego();pasos()}}):null;
    avance(.5,"Armando la batería de La Tríada…");
    const perc=await percP;if(gen!==S.gen)return;
    const pp=picoDe([perc]);procesar(perc,1/pp,1.05);
    S.stems={bateria:perc};
    listo();if(S.letraEn)estadoTexto("Escribiendo la letra…");else{resumen();guardarLuego()}
    if(opc.cantar){if(Array.isArray(opc.cantar)&&difonos())pedirSecciones(opc.cantar);else cantarVoces(false)}
  }catch(e){if(gen!==S.gen)return;console.error(e);avance(null);estadoTexto(`No se pudo armar la pieza: ${e&&e.message||e}. Recargá la página para reintentar.`,true);$("play").textContent="Tocar"}
}

// Paso 3, las voces. Mientras cantan, la página se usa igual (se toca lo que ya hay: la batería y las voces de antes);
// al terminar, las voces nuevas entran donde iba sonando. incremental: sólo lo que cambió desde la última vez (las
// cuerdas que no cambiaron quedan, y en cada obrero los cantores que no cambiaron salen de la memoria). Otra llamada,
// o «Parar», corta la que estaba (S.gen).
async function cantarVoces(incremental=true){
  if(!S.pieza)return;
  // cada uno con su voz: por sección (todas las que tienen algo para cantar; las que no cambiaron se saltean)
  if(difonos()){pedirSecciones(seccionesConVoz().map(x=>x.nombre));return}
  const gen=++S.gen;S.mp3=null;S.cantando=true;pasos();
  try{
    if(S.letraEn){avance(.01,"Esperando la letra…");await S.letraEn;if(gen!==S.gen)return}
    let voces;
    if(sint())voces=await cantarCuerdas(S.pieza,S.P,gen,incremental);
    else{avance(.1,"Cargando las muestras del coro…");
      const muestras=await muestrasPara(S.pieza.ev);if(gen!==S.gen)return;
      voces=[];for(const[i,k]of ORDEN.entries()){avance(.2+.7*i/ORDEN.length,`Cantando: ${NOMBRES_CUERDA[k].toLowerCase()}…`);await pausa();voces.push(await renderCuerda(k,S.pieza.ev[k],S.P,muestras));if(gen!==S.gen)return}}
    if(!voces||gen!==S.gen)return;
    normalizarVoces(voces);
    const sonaba=S.tocando,t=posicion();if(sonaba)detener();
    S.stems={...Object.fromEntries(ORDEN.map((k,i)=>[k,voces[i]])),bateria:S.stems.bateria};S.offset=t;S.vozHecha=true;S.cantando=false;
    if(sint()){S.letra.cantada=S.letra.textos.map(x=>x.slice());S.letra.pendiente=false;$("avisoLetra").hidden=true}
    if(sonaba)tocar();
    actualizarVistas();avance(null);resumen();guardarLuego();pasos();S.cantos=(S.cantos||0)+1;
  }catch(e){if(gen!==S.gen)return;console.error(e);S.cantando=false;avance(null);estadoTexto(`No se pudo cantar: ${e&&e.message||e}`,true);pasos()}
}
// Algo cambió en lo que cantan (un cantante, un verso, una nota, cómo gritan…): si las voces ya estaban cantadas (o
// cantando), se vuelve a cantar sólo eso; si no, quedan para el botón
function cantarDeNuevo(){if(!S.pieza)return;
  if(difonos()){if(S.clips.size||S.cantando)pedirSecciones([...S.clips.keys(),...colaSecciones,...(seccionEnCurso?[seccionEnCurso]:[])]);else pasos();return}
  if(S.vozHecha||S.cantando)return cantarVoces(true);pasos()}
function pararVoces(){if(!S.cantando)return;++S.gen;colaSecciones.length=0;S.cantando=false;avance(null);resumen();pasos()}
// cantar la sección elegida (primero, aunque estén cantando otras)
function cantarSeccionElegida(){const s=seccionElegida();if(!s||!S.pieza)return;if(!difonos()){cantarVoces(true);return}pedirSecciones([s.nombre],{primero:true})}

// Los tres pasos, arriba: qué está hecho y el botón de cada uno
function pasos(){
  const p=S.pieza,L=S.letra;
  $("pasoMusicaTxt").textContent=p&&S.P?`${S.forma==="presentacion"?"Presentación":"Retirada"} en ${NOTAS[S.tonica]} ${S.modo} · ${fmt(S.P.total)}`:"componiendo…";
  $("pasoMusica").className="etapa "+(p?"hecho":"trabajando");
  const conLetra=sint();$("otraLetra2").hidden=!conLetra;$("lailareo2").hidden=!conLetra;
  if(!conLetra){$("pasoLetraTxt").textContent="sin letra: todos cantan con muestras de coro";$("pasoLetra").className="etapa nada"}
  else if(p&&L.partes.length){const v=L.partes.reduce((a,x)=>a+x.versos.length,0);$("pasoLetraTxt").textContent=`${v} versos${L.pendiente?" · cambiaste la letra":""}`;$("pasoLetra").className="etapa hecho"}
  else{$("pasoLetraTxt").textContent="…";$("pasoLetra").className="etapa trabajando"}
  const b=$("cantarVoces"),t=$("pasoVocesTxt"),quien=quienesCantan(),bs=$("cantarSeccion"),sec=seccionElegida();
  // cada uno con su voz: por sección
  const porSec=difonos(),secsV=porSec?seccionesConVoz():[],hay=secsV.filter(x=>S.clips.has(x.nombre)).length;
  bs.hidden=!porSec||!sec;if(sec){bs.textContent=`Cantar «${sec.nombre.length>18?sec.nombre.slice(0,17)+"…":sec.nombre}»`;bs.title=`Cantar sólo la sección elegida (${sec.nombre}): tarda mucho menos que la pieza entera. Se elige tocándola en el multipista.`}
  $("secCantar").hidden=!porSec;
  if(porSec&&S.cantando){t.textContent=`cantando… ${colaSecciones.length?`faltan ${colaSecciones.length+1} secciones`:"la última sección"} · ${quien}`;b.textContent="Parar";b.title="Dejar de cantar (lo que ya cantó cada uno queda guardado: la próxima vez sigue de ahí)";$("pasoVoces").className="etapa trabajando"}
  else if(porSec&&hay<secsV.length&&!(hay&&L.pendiente)){t.textContent=hay?`${hay} de ${secsV.length} secciones cantadas · ${quien}`:`sin cantar · ${quien}`;b.textContent=hay?"Cantar el resto":"Cantar todo";b.title="Cantar todas las secciones, una por una: cada una suena apenas está (también mientras tocás). Con los bancos, la pieza entera tarda unos minutos.";$("pasoVoces").className="etapa pendiente"}
  else if(S.cantando){t.textContent=`cantando… ${quien}`;b.textContent="Parar";b.title="Dejar de cantar (lo que ya cantó cada uno queda guardado: la próxima vez sigue de ahí)";$("pasoVoces").className="etapa trabajando"}
  else if(!S.vozHecha){t.textContent=`sin cantar · ${quien}`;b.textContent="Cantar las voces";b.title="Que canten los murguistas, cada uno con su voz. Con los bancos tarda unos minutos; mientras, la página se usa igual.";$("pasoVoces").className="etapa pendiente"}
  else if(L.pendiente){t.textContent="cantan la letra de antes";b.textContent="Cantar esta letra";b.title="Vuelven a cantar sólo los versos que cambiaron";$("pasoVoces").className="etapa pendiente"}
  else{t.textContent=`cantadas · ${quien} · si cambiás algo, vuelve a cantar sólo eso`;b.textContent="Cantantes";b.title="Ver y cambiar a los trece murguistas";$("pasoVoces").className="etapa hecho"}
  b.dataset.que=S.cantando?"parar":(porSec?hay<secsV.length:!S.vozHecha)||L.pendiente?"cantar":"ver";
  $("mp3").disabled=!S.vozHecha||S.cantando;$("mp3").title=S.vozHecha?"":"Primero cantá las voces";
}
// quiénes cantan, en pocas palabras: «9 con bancos, 4 con MBROLA»
function quienesCantan(){if(!S.pieza)return"";if(S.voces==="muestras")return"todos con muestras de coro";if(S.voces==="sintetizadas")return"todos con formantes";
  if(S.voces==="solista")return`un solista, con ${nombreVoz((S.ajustes.primos0||{}).voz??plantel.vozDeLugar("primos0")??"es2")}`;
  const n={};for(const x of losCantantes()){const aj=S.ajustes[x.clave]||{};if(aj.mudo)continue;const v=aj.voz??x.base.voz;
    const k=plantel.esDeBanco(v)?(plantel.vozDisponible(v)?"con bancos":"con MBROLA"):v===VOZ_MUESTRAS?"con muestras de coro":v===VOZ_FORMANTES?"con formantes":"con MBROLA";n[k]=(n[k]||0)+1}
  return Object.entries(n).sort((a,b)=>b[1]-a[1]).map(([k,c])=>`${c} ${k}`).join(", ")}

// ============================================================ reproducción
function grafo(ctx,dest,offset,when){
  const master=ctx.createGain();master.gain.value=.9;const comp=ctx.createDynamicsCompressor();comp.threshold.value=-10;comp.ratio.value=3;comp.attack.value=.01;comp.release.value=.2;
  master.connect(comp).connect(dest);
  const L=lugar(),vozBus=ctx.createGain(),lejos=ctx.createBiquadFilter();lejos.type="highshelf";lejos.frequency.value=3500;lejos.gain.value=L.lejos;vozBus.connect(lejos);lejos.connect(master);
  const rev=ctx.createConvolver();rev.buffer=salaIR(ctx);const send=ctx.createGain();send.gain.value=envio();lejos.connect(send).connect(rev).connect(master);
  const sendBat=ctx.createGain();sendBat.gain.value=L.bateria*S.sala/.5;sendBat.connect(rev);
  const gains={},srcs=[];
  for(const k of[...ORDEN,"bateria"]){const g=ctx.createGain();g.gain.value=ganancia(k);g.connect(k==="bateria"?master:vozBus);if(k==="bateria")g.connect(sendBat);gains[k]=g;
    if(!S.stems[k])continue;   // las voces sin cantar todavía: suena lo que hay
    const s=ctx.createBufferSource();s.buffer=S.stems[k];s.connect(g);s.start(when,offset);srcs.push(s)}
  // las voces cantadas por sección (S.clips): cada pedazo en su lugar, todas al mismo pico
  const norm={};for(const k of ORDEN){norm[k]=ctx.createGain();norm[k].gain.value=1/(S.pvClips||1);norm[k].connect(gains[k])}
  const clipSrcs=new Map();for(const[nombre,clip]of S.clips)ponerClip(ctx,nombre,clip,norm,when,clipSrcs,when-offset);
  return{gains,srcs,send,sendBat,norm,clipSrcs};
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
function detener(reset){if(S.nodos){S.nodos.srcs.forEach(s=>{try{s.stop()}catch(e){}});for(const l of S.nodos.clipSrcs?.values()||[])l.forEach(s=>{try{s.stop()}catch(e){}});S.nodos=null}
  if(S.tocando&&!reset)S.offset=posicion();S.tocando=false;if(reset)S.offset=0;$("play").textContent="Tocar"}
function posicion(){return S.tocando?Math.min(S.ac.currentTime-S.inicio,S.P.total):S.offset}
function saltar(t){const was=S.tocando;detener();S.offset=Math.max(0,Math.min(t,S.P.total-.05));if(was)tocar();pintarCursor()}
function cuadro(){pintarCursor();if(S.tocando)requestAnimationFrame(cuadro)}
$("play").onclick=()=>{try{S.tocando?detener():tocar()}catch(e){console.error(e);S.tocando=false;$("play").textContent="Tocar";estadoTexto(`No se pudo tocar: ${e&&e.message||e}`,true)}};

// ============================================================ dibujo
const fmt=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
const unicos=l=>l.filter((a,i)=>i===0||a!==l[i-1]);
function nomTono(s){return `${NOTAS[s.tonica]} ${s.modo}`}
const nombreRitmo=id=>id?DATOS.ritmos.find(r=>r.id===id)?.nombre||`Ritmo ${id}`:"Sin batería";
const CORTO={3:"Camión 2/4",4:"Camión 4/4",6:"Base",8:"Candombe",9:"Pa'l costado",10:"Plena",11:"Bossa",13:"Conga",14:"Beat",15:"Bolero",17:"Son",18:"Montuno",19:"Rumba",20:"Miles"};
const cortoRitmo=id=>id?CORTO[id]||nombreRitmo(id):"—";
// El multipista (multipista.js): lo que se toca ahí llega acá
const multipista=crearMultipista($("multipista"),{
  alBuscar:t=>{if(S.P)saltar(t)},
  alElegirSeccion:nombre=>elegirSeccion(nombre),
  alAcorde:(nombre,j,el)=>popAcorde(nombre,j,el),
  alElegirVerso:(i,k,q)=>{const s=seccionDeQ(q);if(s&&s.nombre!==S.secElegida)elegirSeccion(s.nombre);if(sint())elegir(i,k,false,true)},
  alMudo:k=>{S.mute={...S.mute,[k]:!S.mute[k]};aplicarMixTodo();guardarLuego()},
  alSolo:k=>{S.solo={...S.solo,[k]:!S.solo[k]};aplicarMixTodo()},
  alVolumen:(k,v)=>{S.mix[k]=v;aplicarMix(k)},
  alVolumenFin:()=>{S.mp3=null;guardarLuego()},
  alBateria:(q,el)=>popBateria(q,el),
  alElegirNota:n=>abrirNota(n),
  alMoverNota:(n,d)=>{abrirNota(n,false);cambiarNota({op:"p",v:d});popNota()}});
{let z=(()=>{try{return localStorage.getItem("murga.zoom")}catch(e){return null}})();if(z==null&&matchMedia("(max-width:620px)").matches)z="1";   // en el teléfono, de entrada más compases
 if(z!=null&&+z>=0&&+z<=4){$("zoom").value=z;multipista.zoom(+z)}}
$("zoom").onchange=e=>{multipista.zoom(+e.target.value);try{localStorage.setItem("murga.zoom",e.target.value)}catch(x){}};
$("seguir").onchange=e=>multipista.seguir(e.target.checked);
$("detener").onclick=()=>{if(!S.P)return;detener(true);pintarCursor()};
$("mas").onclick=()=>{const a=$("barraMas").classList.toggle("abierta");$("mas").setAttribute("aria-expanded",a)};

function dibujarTodo(){
  if(!S.pieza.secs.some(s=>s.nombre===S.secElegida))S.secElegida=S.pieza.secs[0].nombre;
  $("posTotal").textContent=Math.ceil(totalQ()/16);
  $("cantada").hidden=!sint();actualizarInspector();dibujarCantantes();
  if(sint()){libreto();chips()}
  actualizarVistas();pintarCursor();
  delete $("hoja").dataset.lista;if(abiertos.includes("grabada"))verPartitura(false);
}
const totalQ=()=>{const u=S.pieza.secs[S.pieza.secs.length-1];return u.inicio+u.largo};
const seccionDeQ=q=>S.pieza?.secs.find(s=>q>=s.inicio&&q<s.inicio+s.largo)||null;
const seccionElegida=()=>S.pieza?.secs.find(s=>s.nombre===S.secElegida)||S.pieza?.secs[0];
// los acordes se cambian donde la pieza guarda su tema (s.memoria); las bajadas que repiten la «Bajada» la siguen
const editableAc=s=>!!s.memoria&&(s.acordes?.length||0)>1;
const OPCIONES_ACORDE={mayor:["I","ii","iii","IV","V","V7","vi","viio","I7","II7","III7","VI7","iv","bVI","bVII","i"],menor:["i","iio","bIII","iv","v","V","V7","bVI","bVII","viio","I7","IV7","bII","I"]};
const opcionesAcorde=(s,g)=>[...new Set([g,...OPCIONES_ACORDE[s.modo]])];
const acordesOriginales=s=>s.memoria?.plan?.flatMap(u=>u.ac)||[];
function cambiarAcorde(nombre,i,g){const s=S.pieza.secs.find(x=>x.nombre===nombre);if(!s)return;
  const a={...(S.acordes[nombre]||{})};if(acordesOriginales(s)[i]===g)delete a[i];else a[i]=g;
  const todos={...S.acordes};if(Object.keys(a).length)todos[nombre]=a;else delete todos[nombre];S.acordes=todos;recomponerSeccion(nombre)}
function datosMultipista(){
  const P=S.P,pieza=S.pieza,L=S.letra,secs=pieza.secs,tq=totalQ();
  const notas=[];for(const k of ORDEN)pieza.ev[k].forEach(([q,d,p],i)=>notas.push({q,d,p,cuerda:k,i}));
  const versos=[],silabas=[];
  if(sint()&&L.sil)for(const s of secs){const i=L.partes.findIndex(p=>p.secciones.includes(s.nombre));if(i<0)continue;
    for(let k=0;L.sil.detalle.has(s.nombre+"|"+k);k++){const det=L.sil.detalle.get(s.nombre+"|"+k);if(!det.reparto.length)continue;
      const esc2=escritas(L.textos[i][k],det.reparto),r0=det.reparto[0].notas[0],rz=det.reparto[det.reparto.length-1],z=rz.notas[rz.notas.length-1];
      versos.push({q0:r0.q,q1:z.q+z.d,texto:L.textos[i][k]?.trim()||"(la la la)",i,k});
      det.reparto.forEach((r,j)=>{const a=r.notas[0],b=r.notas[r.notas.length-1];silabas.push({q0:a.q,q1:b.q+b.d,texto:esc2?.[j]?.replace(/\s+/g,"‿")||r.texto,acento:r.acento,i,k})})}}
  const bateria=[];
  for(const s of secs){let ant=null;for(let q=s.inicio;q<s.inicio+s.largo;q+=COMPAS){
    if(s.tipo==="llamada"||s.golpe){bateria.push({q,id:0,fijo:true,nombre:s.golpe?"Un golpe de batería":"La llamada: la batería llama al ritmo que sigue",corto:s.golpe?"golpe":"llamada",igual:ant==="f"});ant="f";continue}
    const id=loopDeCompas(pieza,s,q);bateria.push({q,id,propio:q in(pieza.bateria||{}),nombre:nombreRitmo(id),corto:cortoRitmo(id),igual:ant===id});ant=id}}
  return{T:P.T,totalQ:tq,compases:Math.ceil(tq/16),notas,versos,silabas,bateria,
    secciones:secs.map(s=>({nombre:s.nombre,tipo:s.tipo,cantada:S.clips.has(s.nombre),q0:s.inicio,q1:s.inicio+s.largo,bateria:s.bateria||s.tipo==="llamada",textura:TEXTO_TIPO[s.tipo]||"coro",editable:editableAc(s),
      acordes:(s.acordes||[]).map((g,j)=>({grado:g,nombre:nombreAcorde(g,s.tonica,s.modo),cambiado:j in(S.acordes[s.nombre]||{})}))}))};
}
function actualizarVistas(){
  if(!S.pieza)return;
  if(sint())S.letra.sil=silabear(S.pieza,letrasPorSeccion());
  multipista.volumenes(S.mix);multipista.silenciar(S.mute,S.solo);multipista.elegirSeccion(S.secElegida);
  multipista.elegir(sint()?S.letra.sel.i:null,sint()?S.letra.sel.k:null);multipista.elegirNota(notaAbierta);
  multipista.datos(datosMultipista());
  if(sint()){proceso();estadoLetra()}
  dibujarSeccion();
}
let temporizador=null;
function actualizarLuego(){clearTimeout(temporizador);temporizador=setTimeout(actualizarVistas,350)}

function pintarCursor(){if(!S.P)return;const t=posicion();$("time").textContent=`${fmt(t)} / ${fmt(S.P.total)}`;
  multipista.tiempo(t,S.tocando);$("posCompas").textContent=Math.floor(multipista.qEn(t)/16)+1;
  if(S.tocando&&$("seguir").checked&&!$("secCaja").contains(document.activeElement)){const n=multipista.seccionEn(t);if(n&&n!==S.secElegida)elegirSeccion(n)}
  if(sint())seguirVerso(t)}

// ── la sección elegida, abajo del multipista: sus acordes, el loop de cada compás y su letra ──
function elegirSeccion(nombre,mover){S.secElegida=nombre;multipista.elegirSeccion(nombre);dibujarSeccion();pasos();
  if(mover){const s=seccionElegida();if(s)multipista.irA(s.t0)}}
function dibujarSeccion(){const s=seccionElegida();if(!s)return;const secs=S.pieza.secs,ix=secs.indexOf(s);
  const c0=Math.round(s.inicio/16)+1,c1=Math.ceil((s.inicio+s.largo)/16);
  $("secNombre").textContent=s.nombre;
  $("secInfo").textContent=`${TEXTO_TIPO[s.tipo]||"coro"} · ${nomTono(s)} · ${s.tempo} BPM · ${c1>c0?`compases ${c0} a ${c1}`:`compás ${c0}`} · empieza en ${fmt(s.t0)}${difonos()&&s.tipo!=="llamada"?(S.clips.has(s.nombre)?" · ♪ voces cantadas":" · sin voces todavía"):""}`;
  $("secAnt").disabled=ix<=0;$("secSig").disabled=ix>=secs.length-1;
  tonoDeSeccion(s);acordesDeSeccion(s);bateriaDeSeccion(s);letraDeSeccion(s)}
// El tono de la sección: se elige la tónica y el modo, y se compone de nuevo sólo esta sección (y las que la repiten)
// en ese tono, como al cambiar un acorde. S.tonos[nombre] se guarda con la murga; el del plan, s.tonoPlan.
function tonoDeSeccion(s){const t=$("secTonica"),m=$("secModo"),caja=$("secTono"),plan=s.tonoPlan||{tonica:s.tonica,modo:s.modo};
  const fijo=s.tipo==="llamada"||!!s.repite;caja.hidden=s.tipo==="llamada";
  t.innerHTML=NOTAS.map((n,i)=>`<option value="${i}"${i===s.tonica?" selected":""}>${n}${i===plan.tonica&&plan.modo===s.modo&&s.nombre in S.tonos?" (el del plan)":""}</option>`).join("");m.value=s.modo;
  t.disabled=m.disabled=fijo;caja.classList.toggle("cambiado",s.nombre in S.tonos);
  caja.title=s.repite?`Sigue el tono de «${s.repite}»: se cambia ahí.`:`El tono de esta sección. El compositor la puso en ${NOTAS[plan.tonica]} ${plan.modo}; al cambiarlo se compone de nuevo sólo esta sección${secs_que_repiten(s)} en el tono nuevo, y vuelve a cantar sólo eso.`}
const secs_que_repiten=s=>{const r=S.pieza.secs.filter(x=>x.repite===s.nombre).length;return r?` (y las ${r} que la repiten)`:""};
function cambiarTono(){const s=seccionElegida();if(!s||s.repite||s.tipo==="llamada")return;const plan=s.tonoPlan||{tonica:s.tonica,modo:s.modo};
  const t=+$("secTonica").value,m=$("secModo").value,todos={...S.tonos};
  if(t===plan.tonica&&m===plan.modo)delete todos[s.nombre];else todos[s.nombre]={tonica:t,modo:m};S.tonos=todos;
  estadoTexto(`${s.nombre}: componiendo en ${NOTAS[t]} ${m}…`);recomponerSeccion(s.nombre).then(()=>{if(!S.cantando)estadoTexto(`${s.nombre} quedó en ${NOTAS[t]} ${m}${s.nombre in S.tonos?"":" (el tono del plan)"}.`)})}
$("secTonica").onchange=cambiarTono;$("secModo").onchange=cambiarTono;
$("secAnt").onclick=()=>{const secs=S.pieza?.secs,i=secs?.indexOf(seccionElegida());if(i>0)elegirSeccion(secs[i-1].nombre,true)};
$("secSig").onclick=()=>{const secs=S.pieza?.secs,i=secs?.indexOf(seccionElegida());if(secs&&i<secs.length-1)elegirSeccion(secs[i+1].nombre,true)};
$("secEscuchar").onclick=()=>{const s=seccionElegida();if(!s||!S.P)return;saltar(s.t0);if(!S.tocando)tocar()};
function acordesDeSeccion(s){const caja=$("secAcordes");caja.innerHTML="";
  if(!s.acordes?.length){caja.innerHTML=`<p class="hint">${s.tipo==="llamada"?"Acá no canta nadie: la batería llama.":"Sin acordes."}</p>`;return}
  if(!editableAc(s)){const p=document.createElement("p");p.className="lista-ac";p.textContent=unicos(s.acordes.map(g=>nombreAcorde(g,s.tonica,s.modo))).join(" · ");caja.append(p);
    const h=document.createElement("p");h.className="hint";
    if(s.repite){h.textContent=`Son los acordes de «${s.repite}»: se cambian ahí, y esta parte los sigue. `;const b=document.createElement("button");b.className="btn";b.textContent=`Ir a «${s.repite}»`;b.onclick=()=>elegirSeccion(s.repite,true);caja.append(h,b)}
    else{h.textContent="Esta parte es un acorde solo: no se cambia.";caja.append(h)}
    return}
  const propios=S.acordes[s.nombre]||{},orig=acordesOriginales(s);
  const h=document.createElement("p");h.className="hint";h.textContent="Dos acordes por compás. Al cambiar uno se rehace sólo esta sección (y las que la repiten): la melodía se corre a la nota del acorde más cercana en los tiempos fuertes y las voces se arman de nuevo; después vuelven a cantar sólo sus frases.";
  const g=document.createElement("div");g.className="cards-ac";
  for(let b=0;b<s.acordes.length;b+=2){const c=document.createElement("div");c.className="card-ac";c.innerHTML=`<span class="nb">compás ${Math.round(s.inicio/16)+b/2+1}</span><div class="dos"></div>`;
    for(const i of[b,b+1]){if(i>=s.acordes.length)break;const gr=s.acordes[i],sel=document.createElement("select");
      sel.setAttribute("aria-label",`Compás ${Math.round(s.inicio/16)+b/2+1}, ${i%2?"segunda":"primera"} mitad`);
      sel.innerHTML=opcionesAcorde(s,gr).map(x=>`<option value="${x}"${x===gr?" selected":""}>${nombreAcorde(x,s.tonica,s.modo)}${x===orig[i]&&i in propios?" (el original)":""}</option>`).join("");
      sel.title=`${nombreAcorde(gr,s.tonica,s.modo)} (${gr})`;if(i in propios)sel.classList.add("cambiado");
      sel.onchange=()=>cambiarAcorde(s.nombre,i,sel.value);c.querySelector(".dos").append(sel)}
    g.append(c)}
  caja.append(h,g);
  if(Object.keys(propios).length){const r=document.createElement("button");r.className="btn";r.style.marginTop="8px";r.textContent="Volver a los acordes originales";
    r.onclick=()=>{const a={...S.acordes};delete a[s.nombre];S.acordes=a;recomponerSeccion(s.nombre)};caja.append(r)}}
const OPCIONES_LOOP=()=>[...DATOS.ritmos.map(r=>r.id),0];
function bateriaDeSeccion(s){const caja=$("secBateria");caja.innerHTML="";
  if(s.tipo==="llamada"||s.golpe){caja.innerHTML=`<p class="hint">${s.golpe?"Un golpe de batería, para cerrar.":"La llamada: la batería llama, con la frase del ritmo que sigue."} No se cambia de a compás.</p>`;return}
  const def=loopDeCompas({bateria:{}},s,s.inicio),qs=[];for(let q=s.inicio;q<s.inicio+s.largo;q+=COMPAS)qs.push(q);
  const ids=qs.map(q=>loopDeCompas(S.pieza,s,q)),todos=ids.every(x=>x===ids[0])?ids[0]:null;
  const opts=(corto,actual)=>OPCIONES_LOOP().map(x=>`<option value="${x}"${x===actual?" selected":""}>${corto&&x?cortoRitmo(x):nombreRitmo(x)}${x===def?(corto?" (sección)":" · el de la sección"):""}</option>`).join("");
  const top=document.createElement("label");top.className="ctl todo-bat";top.innerHTML=`Toda la sección <select>${todos==null?'<option value="" selected>varios</option>':""}${opts(false,todos)}</select>`;
  top.querySelector("select").onchange=e=>{if(e.target.value==="")return;cambiarBateria(qs,+e.target.value)};
  const h=document.createElement("p");h.className="hint";h.textContent="El loop de cada compás (también en las partes a capela). Al cambiarlo se rearma sólo la batería.";
  const l=document.createElement("div");l.className="lista-bat";
  qs.forEach((q,j)=>{const lab=document.createElement("label");lab.innerHTML=`compás ${q/16+1}<select>${opts(true,ids[j])}</select>`;const sel=lab.querySelector("select");
    if(q in(S.pieza.bateria||{}))sel.classList.add("cambiado");sel.onchange=()=>cambiarBateria(q,+sel.value);l.append(lab)});
  caja.append(top,h,l);
  if(qs.some(q=>q in(S.pieza.bateria||{}))){const r=document.createElement("button");r.className="btn";r.style.marginTop="8px";r.textContent="Volver al loop de la sección";r.onclick=()=>cambiarBateria(qs,def);caja.append(r)}}
function letraDeSeccion(s){const caja=$("secLetra");
  if(!sint()){caja.innerHTML=`<p class="hint">Las muestras de coro cantan «aah». Con Formantes o Difonos (en «La pieza») el coro canta una letra, y acá se escribe la de esta parte.</p>`;delete caja.dataset.parte;return}
  const L=S.letra,i=L.partes.findIndex(p=>p.secciones.includes(s.nombre));
  if(i<0){caja.innerHTML=`<p class="hint">${s.tipo==="llamada"?"En la llamada no se canta.":"Esta parte no tiene letra."}</p>`;delete caja.dataset.parte;return}
  const p=L.partes[i];
  if(caja.dataset.parte===String(i)&&caja.contains(document.activeElement)){caja.querySelectorAll("label[data-k]").forEach(lab=>cuenta(lab,L.textos[i][+lab.dataset.k],p.versos[+lab.dataset.k].silabas));return}
  caja.dataset.parte=i;seguirVerso.u=null;
  caja.innerHTML=`<p class="hint"><b>${esc(p.nombre)}</b>${p.secciones.length>1?` · se canta ${p.secciones.length} veces: ${p.secciones.map(esc).join(", ")}`:""}. Al terminar un verso (Enter, o al salir del renglón) vuelven a cantar sólo esas frases.</p><div class="sec-versos"></div>`;
  const box=caja.querySelector(".sec-versos");
  p.versos.forEach((v,k)=>{const lab=document.createElement("label");lab.dataset.i=i;lab.dataset.k=k;if(L.sel.i===i&&L.sel.k===k)lab.classList.add("elegido");
    lab.innerHTML=`<span>${k+1}</span><input type="text" autocomplete="off" spellcheck="false" placeholder="${v.silabas} sílaba${v.silabas===1?"":"s"}"><span class="cuenta" title="sílabas cantadas / notas del verso"></span>`;
    const inp=lab.querySelector("input");inp.value=L.textos[i][k];inp.setAttribute("aria-label",`Verso ${k+1} de ${p.nombre}`);
    inp.addEventListener("input",()=>versoEscrito(i,k,inp.value,inp));inp.addEventListener("change",cantarPronto);
    inp.addEventListener("focus",()=>elegir(i,k,true));inp.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();const sig=box.querySelector(`label[data-k="${k+1}"] input`);if(sig)sig.focus();else inp.blur()}});
    cuenta(lab,inp.value,v.silabas);box.append(lab)})}
// un verso escrito (en la letra o en la sección): se copia al otro lugar, y al terminarlo vuelve a cantar
function versoEscrito(i,k,texto,desde){const L=S.letra,v=L.partes[i].versos[k];L.textos[i][k]=texto;L.editados.add(i+"|"+k);
  for(const inp of[$(`v-${i}-${k}`),document.querySelector(`#secLetra label[data-i="${i}"][data-k="${k}"] input`)]){if(!inp)continue;if(inp!==desde)inp.value=texto;cuenta(inp.closest("li,label"),texto,v.silabas)}
  marcarPendiente();actualizarLuego()}
let temporizadorLetra=null;
function cantarPronto(){clearTimeout(temporizadorLetra);temporizadorLetra=setTimeout(()=>{if(S.letra.pendiente)cantarDeNuevo()},350)}

// ── el globito del multipista: elegir un acorde o el loop de un compás ──
const pop=$("popover");let popAncla=null;
function abrirPopover(ancla,titulo,opciones,nota,extra,opc={}){pop.innerHTML="";pop.className="popover"+(opc.clase?" "+opc.clase:"");const h=document.createElement("h3");h.textContent=titulo;pop.append(h);
  if(nota){const p=document.createElement("p");p.className="hint";p.textContent=nota;pop.append(p)}
  for(const o of[...opciones,...(extra||[])]){const b=document.createElement("button");b.type="button";b.innerHTML=`${esc(o.texto)}${o.sub?`<small>${esc(o.sub)}</small>`:""}`;if(o.actual)b.setAttribute("aria-current","true");if(o.otro)b.className="otro";
    b.onclick=()=>{if(!o.queda)cerrarPopover(false);o.hacer()};pop.append(b)}
  pop.hidden=false;popAncla=ancla;pop.setAttribute("aria-label",titulo);
  ubicarPopover();
  (opc.foco&&[...pop.querySelectorAll("button")].find(b=>b.textContent===opc.foco)||pop.querySelector('[aria-current="true"]')||pop.querySelector("button"))?.focus({preventScroll:true})}
function ubicarPopover(){if(pop.hidden||!popAncla)return;const r=popAncla.getBoundingClientRect();
  if(!popAncla.isConnected||r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth){cerrarPopover(false);return}
  const w=pop.offsetWidth,hh=pop.offsetHeight,x=Math.min(Math.max(8,r.left),innerWidth-w-8);let y=r.bottom+4;if(y+hh>innerHeight-8)y=Math.max(8,r.top-hh-4);
  pop.style.left=x+"px";pop.style.top=y+"px"}
function cerrarPopover(volver=true){if(pop.hidden)return;pop.hidden=true;const a=popAncla;popAncla=null;if(volver&&a?.isConnected)a.focus({preventScroll:true})}
document.addEventListener("pointerdown",e=>{if(!pop.hidden&&!pop.contains(e.target)&&!popAncla?.contains(e.target))cerrarPopover(false)},true);
pop.addEventListener("keydown",e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();cerrarPopover();return}
  if(e.key!=="ArrowDown"&&e.key!=="ArrowUp")return;e.preventDefault();const bs=[...pop.querySelectorAll("button")],i=bs.indexOf(document.activeElement);bs[(i+(e.key==="ArrowDown"?1:bs.length-1))%bs.length]?.focus()});
addEventListener("scroll",ubicarPopover,{passive:true});$("multipista").addEventListener("scroll",ubicarPopover,{capture:true,passive:true});
addEventListener("resize",ubicarPopover);
function popAcorde(nombre,j,el){const s=S.pieza?.secs.find(x=>x.nombre===nombre);if(!s)return;elegirSeccion(nombre);
  const c=Math.floor((s.inicio+j*8)/16)+1,g=s.acordes[j],tit=`${nombreAcorde(g,s.tonica,s.modo)} · compás ${c}${s.acordes.length>1?`, ${j%2?"2.ª":"1.ª"} mitad`:""}`;
  if(!editableAc(s)){abrirPopover(el,tit,[],s.repite?`Son los acordes de «${s.repite}»: se cambian ahí.`:"Esta parte es un acorde solo: no se cambia.",s.repite?[{texto:`Ir a «${s.repite}»`,otro:true,hacer:()=>elegirSeccion(s.repite,true)}]:[]);return}
  const orig=acordesOriginales(s)[j],propio=j in(S.acordes[nombre]||{});
  abrirPopover(el,tit,opcionesAcorde(s,g).map(x=>({texto:nombreAcorde(x,s.tonica,s.modo),sub:x+(propio&&x===orig?" · el original":""),actual:x===g,hacer:()=>{if(x!==g)cambiarAcorde(nombre,j,x)}})))}
function popBateria(q,el){const s=seccionDeQ(q);if(!s)return;elegirSeccion(s.nombre);const c=q/16+1;
  if(s.tipo==="llamada"||s.golpe){abrirPopover(el,`Batería · compás ${c}`,[],s.golpe?"Un golpe de batería: no se cambia.":"La llamada: la batería llama al ritmo que sigue. No se cambia.");return}
  const id=loopDeCompas(S.pieza,s,q),def=loopDeCompas({bateria:{}},s,q),qs=[];for(let x=s.inicio;x<s.inicio+s.largo;x+=COMPAS)qs.push(x);
  abrirPopover(el,`Batería · compás ${c}`,OPCIONES_LOOP().map(x=>({texto:nombreRitmo(x),sub:x===def?"el de la sección":"",actual:x===id,hacer:()=>{if(x!==id)cambiarBateria(q,x)}})),null,
    id!==def||qs.some(x=>loopDeCompas(S.pieza,s,x)!==id)?[{texto:`${nombreRitmo(id)} en toda «${s.nombre}»`,otro:true,hacer:()=>cambiarBateria(qs,id)}]:[])}

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
const pedidoLetra=pieza=>({forma:S.forma,tema:$("tema").value.trim(),metrica:metrica(pieza),semilla:S.seed*1000+S.letra.semLetra});
function aplicarLetra(r){const L=S.letra;L.textos=r.textos.map(t=>t.slice());L.diags=r.diags;L.temas=r.temas;L.editados.clear()}
function escribirLetra(pieza){aplicarLetra(escribirLetraLocal(pedidoLetra(pieza)))}
// El letrista en un obrero (cantor/letrista_obrero.js), para que la página no se trabe con una pieza larga; si el
// obrero no anda, escribe la página
let letristaW=null,idLetra=0;const pendLetra=new Map();
function letristaEnObrero(o){
  try{if(!letristaW){letristaW=new Worker(new URL("./cantor/letrista_obrero.js",import.meta.url),{type:"module"});
    letristaW.onmessage=({data})=>{const p=pendLetra.get(data.id);if(!p)return;pendLetra.delete(data.id);if(data.error)p.mal(new Error(data.error));else p.ok(data.r)};
    letristaW.onerror=e=>{e.preventDefault?.();for(const p of pendLetra.values())p.mal(new Error("el obrero del letrista no arrancó"));pendLetra.clear();letristaW=null}}}
  catch(e){return Promise.resolve(escribirLetraLocal(o))}
  return new Promise((ok,mal)=>{const id=++idLetra;pendLetra.set(id,{ok,mal});letristaW.postMessage({id,...o})})
    .catch(e=>{console.warn("la letra se escribe en la página:",e.message);return escribirLetraLocal(o)})}
function letrasPorSeccion(){const L={};S.letra.partes.forEach((p,i)=>{for(const s of p.secciones)L[s]=S.letra.textos[i].map(t=>t.trim())});return L}
function chips(){$("temas").innerHTML=TEMAS[S.forma].map(t=>`<button type="button" class="chip-tema">${t}</button>`).join("");
  $("temas").querySelectorAll("button").forEach(b=>b.onclick=()=>{$("tema").value=b.textContent;otraLetra()})}
function libreto(){
  const L=S.letra,box=$("libreto");box.innerHTML="";seguirVerso.u=null;
  L.partes.forEach((p,i)=>{
    const sec=document.createElement("section");sec.className="parte";
    const otras=p.secciones.length>1?`<p class="se-canta">Se canta ${p.secciones.length} veces: ${p.secciones.join(" · ")}</p>`:"";
    sec.innerHTML=`<header><h3></h3><p class="funcion"></p>${otras}</header><ol class="versos"></ol>`;
    sec.querySelector("h3").textContent=p.nombre;sec.querySelector(".funcion").textContent=p.funcion;
    const ol=sec.querySelector("ol");
    p.versos.forEach((v,k)=>{const li=document.createElement("li");li.className="verso";li.dataset.i=i;li.dataset.k=k;const id=`v-${i}-${k}`;
      li.innerHTML=`<label class="sr" for="${id}">Verso ${k+1} de ${p.nombre}</label><input id="${id}" type="text" autocomplete="off" spellcheck="false" placeholder="${v.silabas} sílaba${v.silabas===1?"":"s"}${v.silabas>1?", "+v.tipo:""}"><span class="cuenta" title="sílabas cantadas / notas del verso"></span>`;
      const inp=li.querySelector("input");inp.value=L.textos[i][k];
      inp.addEventListener("input",()=>versoEscrito(i,k,inp.value,inp));inp.addEventListener("change",cantarPronto);
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
function marcarPendiente(){const L=S.letra;L.pendiente=!!S.vozHecha&&JSON.stringify(L.textos)!==JSON.stringify(L.cantada);$("avisoLetra").hidden=!L.pendiente;S.mp3=null;guardarLuego();pasos()}
async function otraLetra(){if(!S.pieza||!sint())return;const pieza=S.pieza,sem=++S.letra.semLetra;estadoTexto("Escribiendo otra letra…");
  const r=await letristaEnObrero(pedidoLetra(pieza));if(pieza!==S.pieza||sem!==S.letra.semLetra)return;
  aplicarLetra(r);libreto();actualizarVistas();resumen();marcarPendiente();cantarDeNuevo()}
function lailareo(){if(!S.pieza||!sint())return;const s=["la","ra","la","la","ra","lai","la","ra"];const L=S.letra;
  L.textos=L.partes.map(p=>p.versos.map(v=>Array.from({length:v.silabas},(_,j)=>s[j%s.length]).join(" ")));L.diags=null;L.editados.clear();
  libreto();actualizarVistas();cantarDeNuevo()}
function seguirVerso(t){let m=null;for(const x of S.letra.marcas){if(x.t<=t+.05)m=x;else break}
  const clave=m&&(S.tocando||t>0)?m.i+"|"+m.k:"";if(seguirVerso.u===clave)return;seguirVerso.u=clave;
  document.querySelectorAll(".sonando").forEach(e=>e.classList.remove("sonando"));if(!clave)return;
  document.querySelectorAll(`.verso[data-i="${m.i}"][data-k="${m.k}"],#secLetra label[data-i="${m.i}"][data-k="${m.k}"]`).forEach(e=>e.classList.add("sonando"))}
function proceso(){const L=S.letra,{i,k}=L.sel,p=L.partes[i];if(!p){$("proceso").innerHTML="";return}
  const texto=L.textos[i]?.[k]||"";
  mostrarProceso($("proceso"),{P:S.pieza,partes:L.partes,i,k,texto,n:medir(texto).n,diag:L.diags?.[i]?.[k],det:L.sil?.detalle.get(p.secciones[0]+"|"+k),temas:L.temas,editado:L.editados.has(i+"|"+k),forma:S.forma});
  $("proceso").querySelectorAll("[data-ir]").forEach(b=>b.onclick=()=>{
    const lista=L.partes.flatMap((pp,ii)=>pp.versos.map((_,kk)=>[ii,kk]));
    const pos=lista.findIndex(([ii,kk])=>ii===i&&kk===k),sig=lista[Math.max(0,Math.min(lista.length-1,pos+ +b.dataset.ir))];
    elegir(sig[0],sig[1],false,false,true)})}
function elegir(i,k,desdeLetra,desdePartitura,mover){
  S.letra.sel={i,k};
  document.querySelectorAll(".verso.elegido,#secLetra label.elegido").forEach(e=>e.classList.remove("elegido"));
  document.querySelectorAll(`.verso[data-i="${i}"][data-k="${k}"],#secLetra label[data-i="${i}"][data-k="${k}"]`).forEach(e=>e.classList.add("elegido"));
  multipista.elegir(i,k);
  if(desdeLetra||mover){const m=S.letra.marcas.find(x=>x.i===i&&x.k===k&&(!desdeLetra||!S.secElegida||seccionDeQ(multipista.qEn(x.t))?.nombre===S.secElegida))||S.letra.marcas.find(x=>x.i===i&&x.k===k);if(m)multipista.irA(m.t)}
  proceso()}
$("otraLetra").onclick=otraLetra;$("lailareo").onclick=lailareo;$("recantar").onclick=cantarDeNuevo;
// los botones de los pasos, arriba
$("otraMusica").onclick=()=>$("otra").click();$("otraLetra2").onclick=otraLetra;$("lailareo2").onclick=lailareo;
$("cantarSeccion").onclick=cantarSeccionElegida;$("secCantar").onclick=cantarSeccionElegida;
$("cantarVoces").onclick=e=>{const q=e.currentTarget.dataset.que;if(q==="parar")pararVoces();else if(q==="ver")abrirPanel("cantantes");else cantarVoces(true)};
$("cantantesReset").onclick=()=>{S.ajustes={};S.soloCantor=null;guardarAjustes();dibujarCantantes();programarCanto()};
$("otrosCantantes").onclick=()=>{S.semCoro=1+Math.floor(Math.random()*99998);S.ajustes={};S.soloCantor=null;guardarAjustes();guardarCoro();dibujarCantantes();programarCanto()};
$("icNombre").oninput=e=>{const v=e.target.value.trim().slice(0,40);if(cantanteAbierto)cambiarCantante(cantanteAbierto,"nombre",v||undefined)};
$("icCaraOtra").onclick=()=>{if(!cantanteAbierto)return;const x=losCantantes().find(y=>y.clave===cantanteAbierto);cambiarCantante(cantanteAbierto,"cara",(x?.nombre||"")+"-"+Math.floor(Math.random()*9999))};
$("icSolo").onclick=()=>cantanteAbierto&&alternarSolo(cantanteAbierto);
$("icMudo").onclick=()=>{if(!cantanteAbierto)return;cambiarCantante(cantanteAbierto,"mudo",!(S.ajustes[cantanteAbierto]||{}).mudo)};
$("icReiniciar").onclick=()=>{if(!cantanteAbierto)return;const a={...S.ajustes},v=a[cantanteAbierto]||{};delete a[cantanteAbierto];
  const queda={};for(const k of["nombre","cara"])if(v[k]!=null)queda[k]=v[k];if(Object.keys(queda).length)a[cantanteAbierto]=queda;S.ajustes=a;guardarAjustes();dibujarCantantes();programarCanto()};
$("icExportar").onclick=exportarCantante;
$("icImportar").onchange=e=>{importarCantante(e.target.files[0]);e.target.value=""};
$("icCerrar").onclick=()=>{cantanteAbierto=null;actualizarInspector();dibujarCantantes()};
$("tema").addEventListener("keydown",e=>{if(e.key==="Enter")otraLetra()});

// Se arranca por la mejor presentación: la clarinada a capela y la entrada de la batería
{const d=DEMOS.filter(x=>x.forma==="presentacion").sort((a,b)=>b.nota-a.nota)[0];
 if(d){S.forma=d.forma;S.estilo=d.estilo;S.tonica=d.tonica;S.modo=d.modo;S.seed=d.semilla}}
// Las voces: lo que diga la dirección (la vieja /cantada manda acá), si no la última elección
{let v=new URLSearchParams(location.search).get("voces");if(!v)try{v=localStorage.getItem("murga.voces")}catch(e){}
 if(["sintetizadas","muestras","difonos","solista"].includes(v))S.voces=v}

// ============================================================ controles
const HINT_VOCES={muestras:"Toda la murga con muestras «aah» de coro: suena a coro, sin palabras, y sale enseguida.",sintetizadas:"Toda la murga con cantores de formantes (voz armada desde cero), que cantan una letra escrita para esta melodía. Tarda unos segundos más.",
  difonos:"Cada murguista canta la letra con la voz que le toca: un banco de voz cantada del plantel, los difonos de MBROLA, las muestras de coro o los formantes. Se elige en su tarjeta (abajo), o para todos juntos en «Toda la murga con».",
  solista:"Un solo cantor, el primero de los primos, canta la melodía con la letra sobre la batería: para escuchar bien cómo canta. Canta con su voz (la de su tarjeta)."};
function mostrarVoces(){const b=difonos()?"difonos":S.voces;$("voces").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===b));$("vocesHint").textContent=HINT_VOCES[S.voces];$("campoBrillo").hidden=sint();$("campoSolista").hidden=!difonos();$("soloSolista").checked=S.voces==="solista";$("campoAdornos").hidden=!sint();$("campoGrito").hidden=!difonos()}
// (la música queda; la letra, si hace falta, se escribe; las voces vuelven a cantar si ya estaban cantadas)
const elegirVoces=v=>{if(S.voces===v)return;S.voces=v;try{localStorage.setItem("murga.voces",S.voces)}catch(e){}mostrarVoces();generar({pieza:S.pieza,letra:fotoLetra(),cantar:S.clips.size?[...S.clips.keys()]:S.vozHecha||S.cantando})};
$("voces").querySelectorAll("button").forEach(b=>b.onclick=()=>{if(b.dataset.v==="difonos"&&difonos())return;elegirVoces(b.dataset.v==="difonos"&&$("soloSolista").checked?"solista":b.dataset.v)});
$("soloSolista").onchange=e=>elegirVoces(e.target.checked?"solista":"difonos");
mostrarVoces();
$("tonica").innerHTML=NOTAS.map((n,i)=>`<option value="${i}">${n}</option>`).join("");$("tonica").value=S.tonica;$("modo").value=S.modo;
$("estilo").innerHTML=Object.entries(ESTILOS).filter(([k])=>MODELO.estilos[k]).map(([k,n])=>`<option value="${k}">${n}</option>`).join("");$("estilo").value=S.estilo;
$("ritmo").innerHTML=`<option value="0">Como el corpus (Base de murga, sobre todo)</option>`+DATOS.ritmos.map(r=>`<option value="${r.id}">${r.nombre} · ${r.bpm} BPM</option>`).join("");$("ritmo").value=S.ritmo;
let deb;const regen=(mantener)=>{if(mantener!==true){S.acordes={};S.tonos={}}clearTimeout(deb);deb=setTimeout(generar,250)};
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
$("brillo").onchange=e=>{S.brillo=+e.target.value;if(S.P)S.P.brillo=S.brillo;cantarDeNuevo()};
$("recita").onchange=e=>{S.recita=+e.target.value;regen()};
// Demos: las semillas que mejor le caen al jurado
{const caja=$("demos");const NOM=ESTILOS;
 for(const d of DEMOS){const b=document.createElement("button");b.className="btn";b.textContent=`${d.forma==="retirada"?"Retirada":"Presentación"} · ${NOM[d.estilo]||d.estilo}`;
  b.onclick=()=>{S.acordes={};S.tonos={};S.forma=d.forma;S.estilo=d.estilo;S.tonica=d.tonica;S.modo=d.modo;S.seed=d.semilla;S.largo="normal";S.tempo=0;S.recita=0;$("recita").value=0;
   $("forma").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===d.forma));$("estilo").value=d.estilo;$("tonica").value=d.tonica;$("modo").value=d.modo;$("semilla").value=d.semilla;$("largo").value="normal";$("tempo").value="";$("campoFinal").style.display=d.forma==="retirada"?"":"none";generar()};
  caja.appendChild(b)}
 caja.parentElement.style.display=DEMOS.length?"":"none"}
$("tercia").onchange=e=>{S.tercia=+e.target.value;regen()};
// la formación y los adornos no cambian la pieza: se canta de nuevo, con la misma letra
$("formacion").querySelectorAll("button").forEach(b=>b.onclick=()=>{if(S.formacion===b.dataset.v)return;S.formacion=b.dataset.v;guardarCoro();mostrarCoro();if(!S.pieza)return;cantarDeNuevo()});
$("adornos").onchange=e=>{S.adornos=e.target.value;guardarCoro();if(S.pieza&&sint())cantarDeNuevo()};
$("grito").onchange=e=>{S.grito=e.target.value;guardarCoro();if(S.pieza&&difonos())cantarDeNuevo()};
$("sala").oninput=e=>{S.sala=+e.target.value;guardarCoro();if(S.nodos&&S.ac){S.nodos.send.gain.setTargetAtTime(envio(),S.ac.currentTime,.03);S.nodos.sendBat.gain.setTargetAtTime(lugar().bateria*S.sala/.5,S.ac.currentTime,.03)}};
$("lugar").innerHTML=Object.entries(LUGARES).map(([k,L])=>`<option value="${k}">${L.nombre}</option>`).join("");
$("lugar").onchange=e=>{S.lugar=e.target.value;guardarCoro();mostrarCoro();S.mp3=null;if(S.tocando){const t=posicion();detener();S.offset=t;tocar()}};
mostrarCoro();
$("version").onchange=e=>{S.version=+e.target.value;regen()};
for(const k of["clarinada","cancionFinal","modula"])$(k).onchange=e=>{S[k]=e.target.checked;regen()};

// La mezcla: volumen, M (silenciar) y S (sólo esa) de cada pista están en el multipista. Con algún S prendido suenan sólo
// las que lo tienen. Lo mismo vale para el MP3 y el WAV: se baja lo que suena.
function ganancia(k){const hay=Object.values(S.solo).some(Boolean);return S.mute[k]||(hay&&!S.solo[k])?0:S.mix[k]*(k==="bateria"?1:.9)}
function aplicarMix(k){if(S.nodos&&S.ac)S.nodos.gains[k].gain.setTargetAtTime(ganancia(k),S.ac.currentTime,.02)}
function aplicarMixTodo(){for(const k of[...ORDEN,"bateria"])aplicarMix(k);multipista.silenciar(S.mute,S.solo);S.mp3=null}

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
  ORDEN.forEach((k,ch)=>{const e=[txt(0,3,NOMBRES_CUERDA[k]),[0,0,[0xC0|ch,52]],[0,0,[0xB0|ch,10,Math.round(64+63*panDe(k))]]];
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
  if(!S.stems)return;const btn=$("mp3"),clave=S.gen+JSON.stringify(S.mix)+JSON.stringify(S.mute)+JSON.stringify(S.solo)+S.lugar+S.sala;
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
async function verPartitura(irAhi){
  const caja=$("grabada");
  if(!S.pieza)return;
  if(irAhi){abrirPanel("grabada");return}
  if($("hoja").dataset.lista)return;$("hoja").dataset.lista="1";
  $("grabadaNota").textContent=sint()?"Cinco pentagramas, de la tercia a los bajos, con la letra debajo de cada nota y los acordes arriba.":"Cinco pentagramas, de la tercia a los bajos, con los acordes arriba. Con cantores sintéticos aparece también la letra.";
  $("hoja").textContent="Escribiendo la partitura…";
  try{await mostrarPartitura($("hoja"),datosPapeles())}
  catch(e){console.error(e);delete $("hoja").dataset.lista;$("hoja").textContent=`No se pudo dibujar la partitura: ${e?.message||e}`}}

// ============================================================ los paneles de arriba
// Los botones de la barra abren un panel (uno a la vez) arriba del multipista. Un panel está si su contenido está
// (la letra, sólo con cantores que cantan; los cantantes, sólo con difonos): si no, su botón no aparece.
// Los paneles flotan encima del multipista, como ventanas: varios a la vez, se arrastran de la cabeza, se agrandan
// desde la esquina de abajo a la derecha, y se acuerdan dónde quedaron y de qué tamaño (en este navegador). Tocar uno
// lo trae adelante; Escape cierra el de adelante. En el teléfono suben desde abajo, de a uno.
const BOTONES_PANEL=[...document.querySelectorAll(".barra [data-panel]")];
const abiertos=[];   // de atrás para adelante
const ANCHO_PANEL={pPieza:780,pMezcla:600,cantantes:1040,cantada:600,grabada:920,tabExportar:560,tabAcerca:720};
let lugarPanel={};try{lugarPanel=JSON.parse(localStorage.getItem("murga.paneles")||"{}")||{}}catch(e){}
const guardarLugares=()=>{try{localStorage.setItem("murga.paneles",JSON.stringify(lugarPanel))}catch(e){}};
const angosto=()=>matchMedia("(max-width:820px)").matches;
function ubicarPanel(p){if(angosto())return;
  const l=lugarPanel[p.id]||{},arriba=document.querySelector(".barra").getBoundingClientRect().bottom+6,n=abiertos.length;
  const w=Math.min(l.w||ANCHO_PANEL[p.id]||640,innerWidth-16);
  const x=Math.max(8,Math.min(l.x??innerWidth-w-16-28*n,innerWidth-w-8)),y=Math.max(8,Math.min(l.y??arriba+28*n,innerHeight-80));
  p.style.left=x+"px";p.style.top=y+"px";p.style.right="auto";p.style.width=w+"px";p.style.maxHeight=(innerHeight-y-8)+"px";
  if(l.h)p.style.height=Math.min(l.h,innerHeight-y-8)+"px";else p.style.removeProperty("height")}
function alFrente(id){const i=abiertos.indexOf(id);if(i>=0)abiertos.splice(i,1);abiertos.push(id);abiertos.forEach((x,j)=>{$(x).style.zIndex=40+j})}
function abrirPanel(id,alternar=false){const p=$(id);if(!p||p.hidden)return;
  if(abiertos.includes(id)){if(alternar&&abiertos[abiertos.length-1]===id)cerrarPanel(id);else{alFrente(id);pintarPaneles()}return}
  if(angosto())abiertos.slice().forEach(x=>cerrarPanel(x));
  ubicarPanel(p);alFrente(id);pintarPaneles();
  if(id==="grabada")verPartitura(false)}
function cerrarPanel(id=abiertos[abiertos.length-1]){const i=abiertos.indexOf(id);if(i<0)return;abiertos.splice(i,1);pintarPaneles()}
function pintarPaneles(){for(const b of BOTONES_PANEL){const id=b.dataset.panel,on=abiertos.includes(id);b.setAttribute("aria-pressed",on);b.setAttribute("aria-expanded",on);$(id).classList.toggle("abierto",on)}}
function revisarPaneles(){for(const b of BOTONES_PANEL)b.hidden=$(b.dataset.panel).hidden;for(const id of abiertos.slice())if($(id).hidden)cerrarPanel(id)}
BOTONES_PANEL.forEach(b=>{b.setAttribute("aria-controls",b.dataset.panel);b.onclick=()=>{$("barraMas").classList.remove("abierta");$("mas").setAttribute("aria-expanded",false);abrirPanel(b.dataset.panel,true)}});
document.querySelectorAll(".cerrar-panel").forEach(b=>b.onclick=()=>cerrarPanel(b.closest(".panel-sup").id));
// arrastrar de la cabeza; agrandar desde la esquina (el resize de CSS) y guardar el tamaño al soltar
for(const b of BOTONES_PANEL){const p=$(b.dataset.panel),cab=p.querySelector(":scope>.cabeza");
  p.addEventListener("pointerdown",e=>{if(abiertos[abiertos.length-1]!==p.id)alFrente(p.id);
    const r=p.getBoundingClientRect();if(!angosto()&&e.clientX>r.right-22&&e.clientY>r.bottom-22)p.dataset.agrandando="1"},true);
  if(cab)cab.addEventListener("pointerdown",e=>{if(angosto()||e.button!==0||e.target.closest("button,input,select,a,label"))return;
    e.preventDefault();cab.setPointerCapture(e.pointerId);const r=p.getBoundingClientRect(),dx=e.clientX-r.left,dy=e.clientY-r.top;
    cab.onpointermove=ev=>{const x=Math.max(80-r.width,Math.min(innerWidth-80,ev.clientX-dx)),y=Math.max(4,Math.min(innerHeight-40,ev.clientY-dy));
      p.style.left=x+"px";p.style.top=y+"px";p.style.maxHeight=(innerHeight-y-8)+"px"};
    cab.onpointerup=()=>{cab.onpointermove=cab.onpointerup=null;const q=p.getBoundingClientRect();lugarPanel[p.id]={...lugarPanel[p.id],x:Math.round(q.left),y:Math.round(q.top)};guardarLugares()}})}
addEventListener("pointerup",()=>{for(const id of abiertos){const p=$(id);if(!p.dataset.agrandando)continue;delete p.dataset.agrandando;
  const q=p.getBoundingClientRect();lugarPanel[id]={...lugarPanel[id],x:Math.round(q.left),y:Math.round(q.top),w:Math.round(q.width),h:Math.round(q.height)};guardarLugares()}});
// si la ventana del navegador se achica, los paneles quedan adentro
addEventListener("resize",()=>{if(angosto())return;for(const id of abiertos){const p=$(id),q=p.getBoundingClientRect();
  const x=Math.max(8,Math.min(q.left,innerWidth-Math.min(q.width,innerWidth-16)-8)),y=Math.max(8,Math.min(q.top,innerHeight-80));
  p.style.left=x+"px";p.style.top=y+"px";p.style.maxHeight=(innerHeight-y-8)+"px"}});
// «La pieza» manda a «Cantantes», donde se eligen las voces
$("irCantantes").onclick=()=>abrirPanel("cantantes");
// «Ver modelos disponibles»: las voces que hay (cómo canta la murga, la misma voz para todos, el plantel); se acuerda si
// quedó abierto. «La pieza» y el inspector también los abren.
function verModelos(abrir){const m=$("modelos"),b=$("verModelos"),ver=abrir??m.hidden;m.hidden=!ver;b.setAttribute("aria-expanded",ver);b.textContent=ver?"Ocultar los modelos":"Ver modelos disponibles";
  try{localStorage.setItem("murga.modelos",ver?"1":"")}catch(e){}if(ver&&abrir)requestAnimationFrame(()=>m.scrollIntoView({behavior:"smooth",block:"start"}))}
$("verModelos").onclick=()=>verModelos();
try{if(localStorage.getItem("murga.modelos"))verModelos(true)}catch(e){}
$("irCantantes").onclick=()=>{abrirPanel("cantantes");verModelos(true)};
{const mo=new MutationObserver(revisarPaneles);for(const b of BOTONES_PANEL)mo.observe($(b.dataset.panel),{attributes:true,attributeFilter:["hidden"]});revisarPaneles();pintarPaneles()}
// La manija entre el multipista y la sección de abajo: arrastrándola cambia el alto de la sección (se guarda); doble
// clic la achica o la vuelve a abrir; con el teclado, flechas arriba y abajo
{const m=$("manija"),app=document.querySelector(".app");let alto=0;try{alto=+localStorage.getItem("murga.detalle")||0}catch(e){}
 const poner=px=>{alto=Math.round(px);if(alto)app.style.setProperty("--detalle",alto+"px");else app.style.removeProperty("--detalle")};poner(alto);
 const guardarAlto=()=>{try{localStorage.setItem("murga.detalle",String(alto||""))}catch(e){}};
 const limite=px=>Math.max(46,Math.min(innerHeight-240,px)),actual=()=>$("secCaja").getBoundingClientRect().height;
 m.onpointerdown=e=>{e.preventDefault();m.setPointerCapture(e.pointerId);m.classList.add("arrastrando");const y0=e.clientY,h0=actual();
   m.onpointermove=ev=>poner(limite(h0-(ev.clientY-y0)));
   m.onpointerup=()=>{m.onpointermove=m.onpointerup=null;m.classList.remove("arrastrando");guardarAlto()}};
 m.ondblclick=()=>{poner(actual()>80?46:Math.round(innerHeight*.38));guardarAlto()};
 m.onkeydown=e=>{if(e.key!=="ArrowUp"&&e.key!=="ArrowDown")return;e.preventDefault();poner(limite(actual()+(e.key==="ArrowUp"?40:-40)));guardarAlto()}}
// el tema: como el sistema, oscuro o claro (se guarda en este navegador)
const TEMAS_COLOR=["","dark","light"],NOMBRE_TEMA={"":"como el sistema",dark:"oscuro",light:"claro"};
let temaColor="";try{temaColor=localStorage.getItem("murga.tema")||""}catch(e){}if(!TEMAS_COLOR.includes(temaColor))temaColor="";
function ponerTema(t,guardarlo){if(t)document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme;
  $("temaColor").title=`Tema: ${NOMBRE_TEMA[t]} (tocá para cambiarlo)`;$("temaColor").setAttribute("aria-label",`Tema: ${NOMBRE_TEMA[t]}. Cambiar el tema`);
  if(guardarlo)try{localStorage.setItem("murga.tema",t)}catch(e){}multipista.redibujar()}
ponerTema(temaColor);
$("temaColor").onclick=()=>{temaColor=TEMAS_COLOR[(TEMAS_COLOR.indexOf(temaColor)+1)%TEMAS_COLOR.length];ponerTema(temaColor,true)};
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>multipista.redibujar());
// la barra espaciadora toca o pausa; Escape cierra el panel
document.addEventListener("keydown",e=>{if(e.target.closest?.("input,textarea,select,button,[contenteditable],dialog,.popover"))return;
  if(e.key===" "&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!$("play").disabled){e.preventDefault();$("play").click()}
  else if(e.key==="Escape"&&abiertos.length&&!notaAbierta)cerrarPanel()});
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

arrancar();

// ============================================================ las murgas guardadas en este navegador
// Cada murga se guarda sola (IndexedDB, murgas.js) un momento después de cada cambio: la pieza entera, la letra, los
// cantantes y la mezcla. Al abrirla no se vuelve a componer. «Mis murgas» lista las guardadas.
S.murga={id:nuevoId(),nombre:"",creada:Date.now()};
const CLAVES_PIEZA=["forma","estilo","tonica","modo","seed","largo","tempo","ritmo","clarinada","cancionFinal","modula","tercia","recita","version","brillo"];
function fotoLetra(){const L=S.letra;return L.textos.length?{textos:L.textos.map(v=>v.slice()),diags:L.diags,temas:L.temas,editados:[...L.editados],sel:L.sel,semLetra:L.semLetra,tema:$("tema").value}:null}
function foto(){return{id:S.murga.id,nombre:S.murga.nombre||"",creada:S.murga.creada,cambiada:Date.now(),version:1,
  resumen:S.pieza?`${titulo()} · ${ESTILOS[S.estilo]||S.estilo} · ${fmt(S.P?.total||0)}`:"",
  pieza:S.pieza,ajustesPieza:Object.fromEntries(CLAVES_PIEZA.map(k=>[k,S[k]])),acordes:S.acordes,tonos:S.tonos,voces:S.voces,semCoro:S.semCoro,ajustes:S.ajustes,
  coro:{formacion:S.formacion,adornos:S.adornos,grito:S.grito,sala:S.sala,lugar:S.lugar},mix:S.mix,mute:S.mute,secElegida:S.secElegida,letra:fotoLetra()}}
let temporizadorGuardar=null;
function avisoGuardado(t){$("guardado").textContent=t}
function guardarLuego(){if(!S.pieza)return;clearTimeout(temporizadorGuardar);avisoGuardado("Guardando…");temporizadorGuardar=setTimeout(guardarYa,700)}
async function guardarYa(){clearTimeout(temporizadorGuardar);if(!S.pieza)return;
  let f=foto();try{structuredClone(f)}catch(e){f={...f,letra:f.letra&&{...f.letra,diags:null}}}
  try{await guardarMurga(f);try{localStorage.setItem("murga.actual",S.murga.id)}catch(e){}avisoGuardado("Guardada en este navegador")}
  catch(e){console.warn("no se guardó la murga:",e);avisoGuardado("No se pudo guardar")}}
// los controles, como diga S (al abrir una murga)
function sincronizarControles(){
  $("forma").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===S.forma));$("campoFinal").style.display=S.forma==="retirada"?"":"none";
  $("estilo").value=S.estilo;$("tonica").value=S.tonica;$("modo").value=S.modo;$("ritmo").value=S.ritmo;$("largo").value=S.largo;$("tempo").value=S.tempo||"";$("semilla").value=S.seed;
  $("recita").value=S.recita;$("tercia").value=S.tercia;$("brillo").value=S.brillo;$("version").value=S.version;
  for(const k of["clarinada","cancionFinal","modula"])$(k).checked=!!S[k];
  multipista.volumenes(S.mix);multipista.silenciar(S.mute,S.solo);mostrarVoces();mostrarCoro();$("nombreMurga").value=S.murga.nombre||""}
async function abrirMurga(m){
  S.murga={id:m.id,nombre:m.nombre||"",creada:m.creada||Date.now()};
  for(const k of CLAVES_PIEZA)if(m.ajustesPieza?.[k]!==undefined)S[k]=m.ajustesPieza[k];
  S.acordes=m.acordes||{};S.tonos=m.tonos||{};S.soloCantor=null;S.solo={};S.secElegida=m.secElegida||null;if(m.voces)S.voces=m.voces;
  S.semCoro=m.semCoro||1;S.ajustes=m.ajustes||{};Object.assign(S,m.coro||{});S.mix={...S.mix,...(m.mix||{})};S.mute={...(m.mute||{})};
  cantanteAbierto=null;notaAbierta=null;deshacer.length=0;S.firmas=null;S.pv=null;
  sincronizarControles();try{localStorage.setItem("murga.actual",m.id)}catch(e){}
  await generar({pieza:m.pieza,letra:m.letra})}
async function arrancar(){
  plantel.iniciarPlantel($("plantelCaja"));
  plantel.alCambiar(()=>{dibujarCantantes();if(S.pieza&&difonos())cantarDeNuevo()});
  let id=null;try{id=localStorage.getItem("murga.actual")}catch(e){}
  if(id&&!new URLSearchParams(location.search).has("nueva")){try{const m=await leerMurga(id);if(m&&m.pieza){await abrirMurga(m);return}}catch(e){console.warn("no se pudo abrir la última murga:",e)}}
  $("nombreMurga").value="";generar()}
function nuevaMurga(){S.murga={id:nuevoId(),nombre:"",creada:Date.now()};$("nombreMurga").value="";S.seed=1+Math.floor(Math.random()*99998);$("semilla").value=S.seed;
  S.acordes={};S.tonos={};S.solo={};S.letra.semLetra=1;$("tema").value="";cerrarMurgas();generar()}
$("nombreMurga").oninput=e=>{S.murga.nombre=e.target.value.trim().slice(0,60);guardarLuego()};
// «Mis murgas»
async function mostrarMurgas(){const caja=$("listaMurgas");caja.innerHTML="<p class='hint'>Buscando…</p>";
  let l=[];try{l=await listarMurgas()}catch(e){caja.innerHTML=`<p class="hint">No se pudo leer: ${esc(e?.message||e)}</p>`;return}
  if(!l.length){caja.innerHTML="<p class='hint'>Todavía no hay murgas guardadas.</p>";return}
  caja.innerHTML="";
  for(const m of l){const d=document.createElement("div");d.className="murga-fila"+(m.id===S.murga.id?" actual":"");
    d.innerHTML=`<div><b>${esc(m.nombre||"Murga sin nombre")}</b><small>${esc(m.resumen||"")} · ${new Date(m.cambiada).toLocaleString("es-UY",{dateStyle:"short",timeStyle:"short"})}</small></div>
      <span class="acc">${m.id===S.murga.id?"<em>abierta</em>":'<button class="btn abrir">Abrir</button>'}<button class="btn borrar">Borrar</button></span>`;
    d.querySelector(".abrir")?.addEventListener("click",async()=>{cerrarMurgas();try{const x=await leerMurga(m.id);if(x)await abrirMurga(x)}catch(e){estadoTexto(`No se pudo abrir: ${e?.message||e}`,true)}});
    const b=d.querySelector(".borrar");b.onclick=async()=>{if(!b.dataset.seguro){b.dataset.seguro="1";b.textContent="¿Seguro? Borrar";b.classList.add("fuerte");return}
      try{await borrarMurga(m.id);if(m.id===S.murga.id)S.murga={id:nuevoId(),nombre:S.murga.nombre,creada:Date.now()};mostrarMurgas()}catch(e){estadoTexto(`No se pudo borrar: ${e?.message||e}`,true)}};
    caja.append(d)}}
function cerrarMurgas(){const d=$("dialogoMurgas");if(d.open)d.close()}
$("misMurgas").onclick=()=>{guardarYa();$("dialogoMurgas").showModal();mostrarMurgas()};
$("nuevaMurga").onclick=nuevaMurga;$("cerrarMurgas").onclick=cerrarMurgas;
$("dialogoMurgas").addEventListener("click",e=>{if(e.target===$("dialogoMurgas"))cerrarMurgas()});

// ============================================================ editar las notas
// Tocar una nota en la partitura la abre en el inspector; se le cambia la altura (también arrastrándola) o el largo, o
// se la borra. Por defecto el cambio va también a las otras cuerdas que cantan esa misma nota en ese momento (en el
// unísono, la melodía es de todos). Se cambia S.pieza.ev, se guarda, y vuelven a cantar sólo las frases que la tocan.
function notasJuntas(k,i){const e=S.pieza.ev[k][i];if(!e)return[];const out=[[k,i]];
  for(const c of ORDEN){if(c===k)continue;const j=S.pieza.ev[c].findIndex(x=>x[0]===e[0]&&x[2]===e[2]);if(j>=0)out.push([c,j])}return out}
function abrirNota(n,globito=true){const e=S.pieza?.ev[n.cuerda]?.[n.i];if(!e)return;notaAbierta={cuerda:n.cuerda,i:n.i};
  const s=seccionDeQ(e[0]);if(s&&s.nombre!==S.secElegida)elegirSeccion(s.nombre);
  actualizarInspector();multipista.elegirNota(notaAbierta);dibujarInspNota();if(globito)popNota()}
// el globito de la nota, al lado de ella en el multipista: subirla, bajarla, alargarla, borrarla (queda abierto)
function popNota(foco){const a=notaAbierta;if(!a||!S.pieza)return;const e=S.pieza.ev[a.cuerda][a.i];if(!e)return;
  const ancla={getBoundingClientRect:()=>multipista.rectNota(a)||{left:0,top:-9,right:0,bottom:-9,width:0,height:0},isConnected:true,contains:()=>false,focus(){}};
  const j=notasJuntas(a.cuerda,a.i),juntas=$("inJuntas").checked&&j.length>1;
  const op=(texto,o)=>({texto,queda:true,hacer:()=>{cambiarNota(o);popNota(texto)}});
  abrirPopover(ancla,`${nombreNota(e[2])} · ${NOMBRES_CUERDA[a.cuerda]}`,
    [op("▲ semitono",{op:"p",v:1}),op("▼ semitono",{op:"p",v:-1}),op("▲ octava",{op:"p",v:12}),op("▼ octava",{op:"p",v:-12}),op("Más larga",{op:"d",v:1}),op("Más corta",{op:"d",v:-1})],
    `${e[1]} semicorchea${e[1]===1?"":"s"}${juntas?` · también la cambian los ${j.slice(1).map(([c])=>NOMBRES_CUERDA[c].toLowerCase()).join(" y los ")}`:""}`,
    [{texto:"Escuchar",otro:true,queda:true,hacer:()=>$("inEscuchar").click()},{texto:"Borrar",otro:true,hacer:()=>cambiarNota({op:"borrar"})},...(deshacer.length?[{texto:"Deshacer",otro:true,queda:true,hacer:()=>{deshacerNota();popNota("Deshacer")}}]:[])],
    {clase:"rejilla",foco})}
function dibujarInspNota(){const a=notaAbierta;if(!a)return;const e=S.pieza.ev[a.cuerda][a.i];if(!e){notaAbierta=null;actualizarInspector();return}
  const[q,d,p]=e,T=S.P.T,sec=S.pieza.secs.find(s=>q>=s.inicio&&q<s.inicio+s.largo);
  $("inCual").textContent=`${NOMBRES_CUERDA[a.cuerda]}${sec?` · ${sec.nombre}`:""} · ${fmt(T(q))}`;
  $("inNota").innerHTML=`${nombreNota(p)}<small>${d} semicorchea${d===1?"":"s"}</small>`;
  const[r0,r1]=RANGOS[a.cuerda];$("inRango").innerHTML=p<r0||p>r1?`<span class="fuera">Fuera del rango de los ${NOMBRES_CUERDA[a.cuerda].toLowerCase()} (${nombreNota(r0)} a ${nombreNota(r1)}).</span>`:`Rango de los ${NOMBRES_CUERDA[a.cuerda].toLowerCase()}: ${nombreNota(r0)} a ${nombreNota(r1)}.`;
  const j=notasJuntas(a.cuerda,a.i);$("inJuntasCampo").hidden=j.length<2;$("inJuntasTexto").textContent=`También en ${j.slice(1).map(([c])=>NOMBRES_CUERDA[c].toLowerCase()).join(", ")}, que cantan la misma nota`;
  $("inDeshacer").disabled=!deshacer.length}
function cambiarNota({op,v}){const a=notaAbierta;if(!a||!S.pieza)return;
  const lugares=$("inJuntas").checked?notasJuntas(a.cuerda,a.i):[[a.cuerda,a.i]];if(!lugares.length)return;
  const antes=lugares.map(([c,i])=>({c,i,e:[...S.pieza.ev[c][i]]}));
  if(op==="borrar"){for(const[c,i]of lugares.slice().sort((x,y)=>y[1]-x[1]))S.pieza.ev[c].splice(i,1);deshacer.push({tipo:"borrar",antes});notaAbierta=null;actualizarInspector()}
  else{for(const[c,i]of lugares){const e=S.pieza.ev[c][i];
      if(op==="p")e[2]=Math.max(36,Math.min(84,e[2]+v));
      else if(op==="d"){const sig=S.pieza.ev[c].filter(x=>x[0]>e[0]).reduce((m,x)=>Math.min(m,x[0]),Infinity);e[1]=Math.max(1,Math.min(e[1]+v,sig-e[0]))}}
    deshacer.push({tipo:"cambiar",antes});dibujarInspNota()}
  if(deshacer.length>200)deshacer.shift();
  notasCambiadas()}
function deshacerNota(){const u=deshacer.pop();if(!u||!S.pieza)return;
  if(u.tipo==="borrar"){for(const{c,i,e}of u.antes.slice().sort((x,y)=>x.i-y.i))S.pieza.ev[c].splice(i,0,e)}
  else for(const{c,i,e}of u.antes)S.pieza.ev[c][i]=e;
  const x=u.antes[0];notaAbierta={cuerda:x.c,i:x.i};actualizarInspector();multipista.elegirNota(notaAbierta);dibujarInspNota();notasCambiadas()}
let temporizadorNotas=null;
function notasCambiadas(){S.mp3=null;actualizarVistas();guardarLuego();
  clearTimeout(temporizadorNotas);temporizadorNotas=setTimeout(cantarDeNuevo,600)}
document.querySelectorAll("#inspNota [data-op]").forEach(b=>b.onclick=()=>{const o=b.dataset.op;cambiarNota(o==="borrar"?{op:"borrar"}:{op:o[0],v:+o.slice(1)})});
$("inDeshacer").onclick=deshacerNota;
$("inEscuchar").onclick=()=>{const a=notaAbierta;if(!a)return;const e=S.pieza.ev[a.cuerda][a.i];if(!e)return;saltar(Math.max(0,S.P.T(e[0])-1.5));if(!S.tocando)tocar()};
$("inCerrar").onclick=()=>{notaAbierta=null;actualizarInspector()};
document.addEventListener("keydown",e=>{
  if(e.target.closest?.("input,textarea,select,[contenteditable],.popover,dialog"))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"&&deshacer.length){e.preventDefault();deshacerNota();return}
  if(!notaAbierta)return;
  if(e.key==="ArrowUp"||e.key==="ArrowDown"){e.preventDefault();cambiarNota({op:"p",v:(e.key==="ArrowUp"?1:-1)*(e.shiftKey?12:1)})}
  else if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();cambiarNota({op:"borrar"})}
  else if(e.key==="Escape"){notaAbierta=null;actualizarInspector()}});

// ============================================================ cambiar una parte sin regenerar todo
// El loop de un compás: se rearma sólo la batería (las voces quedan como están).
async function cambiarBateria(qs,id){if(!S.pieza)return;const b={...(S.pieza.bateria||{})};
  for(const q of[].concat(qs)){const s=seccionDeQ(q);if(!s||s.tipo==="llamada"||s.golpe)continue;const def=loopDeCompas({bateria:{}},s,q);if(id===def)delete b[q];else b[q]=id}
  S.pieza.bateria=b;actualizarVistas();await rearmarBateria()}
async function rearmarBateria(){const gb=S.genBat=(S.genBat||0)+1,pieza=S.pieza,P=S.P;estadoTexto("Armando la batería…");
  try{const perc=await renderPercusion(P,pieza.secs,pieza.bateria||{});if(gb!==S.genBat||pieza!==S.pieza||P!==S.P)return;procesar(perc,1/picoDe([perc]),1.05);
    const sonaba=S.tocando,t=posicion();if(sonaba)detener();S.stems={...S.stems,bateria:perc};S.mp3=null;S.offset=t;if(sonaba)tocar();actualizarVistas();resumen();guardarLuego()}
  catch(e){console.error(e);estadoTexto(`No se pudo armar la batería: ${e?.message||e}`,true)}}
// Los acordes de una sección: se compone la pieza con los acordes nuevos y de ahí se toma sólo esa sección (sus notas y
// sus golpes); el resto de la pieza queda igual, y vuelven a cantar sólo las frases de esa sección.
async function recomponerSeccion(nombre){if(!S.pieza)return;
  const C=S.version===1?await version1():{componer,MODELO};
  const nueva=C.componer(C.MODELO,{...S.pieza.opciones,acordes:S.acordes,tonos:S.tonos}),vieja=S.pieza;
  const igual=nueva.secs.length===vieja.secs.length&&nueva.secs.every((x,i)=>x.nombre===vieja.secs[i].nombre&&x.inicio===vieja.secs[i].inicio&&x.largo===vieja.secs[i].largo);
  if(!igual){generar({mantenerLetra:true});return}
  const cuales=vieja.secs.map((x,i)=>x.nombre===nombre||x.repite===nombre?i:-1).filter(i=>i>=0);if(!cuales.length)return;
  for(const i of cuales){const v=vieja.secs[i],q0=v.inicio,q1=q0+v.largo;
    for(const k of ORDEN){vieja.ev[k]=vieja.ev[k].filter(e=>e[0]<q0||e[0]>=q1).concat(nueva.ev[k].filter(e=>e[0]>=q0&&e[0]<q1)).sort((a,b)=>a[0]-b[0]||b[2]-a[2])}
    vieja.secs[i]={...nueva.secs[i],t0:v.t0,t1:v.t1,paso:v.paso}}
  vieja.golpes=vieja.secs.flatMap(x=>x.golpes||[]);
  vieja.opciones={...vieja.opciones,acordes:S.acordes,tonos:S.tonos};
  notaAbierta=null;deshacer.length=0;
  // la letra: los versos de esa sección pueden cambiar de largo; lo escrito se queda donde encaja
  if(sint()){const L=S.letra,antes=fotoLetra();armarLetra(vieja,S.P.T);
    const encaja=t=>Array.isArray(t)&&t.length===L.partes.length&&t.every((x,j)=>Array.isArray(x)&&x.length===L.partes[j].versos.length);
    if(antes&&encaja(antes.textos)){L.textos=antes.textos;L.diags=antes.diags;L.temas=antes.temas;L.editados=new Set(antes.editados);L.sel=antes.sel}else escribirLetra(vieja)}
  dibujarTodo();guardarLuego();
  if(sint())cantarDeNuevo();else generar({pieza:vieja,cantar:S.vozHecha||S.cantando})}
window.murgaPrueba={cambiarBateria,recomponerSeccion,rearmarBateria};   // para las pruebas (herramientas y Playwright)
