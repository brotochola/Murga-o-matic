#!/usr/bin/env python
# respiraciones_medir.py — ¿se oyen respiraciones antes de las frases en las murgas de verdad? Las mide en las voces
# separadas (murga_trabajo/voces/) para poner respiraciones en el coro y en el solista sintéticos con números.
#
#   python herramientas/respiraciones_medir.py                 las 85 voces -> murga_trabajo/respiraciones/medidas.json
#   python herramientas/respiraciones_medir.py --tramo agarrate_catalina_2008_presentacion   uno solo (prueba)
#   python herramientas/respiraciones_medir.py --sobre 12      otro umbral (dB sobre el piso), --clips 8: trozos para escuchar
#   RESP_CACHE=<carpeta>   guarda los cuadros de cada voz y los reusa (repetir con otro umbral tarda un minuto, no 40)
#     --proc 2   procesos en paralelo (por defecto 2)
#
# Cómo (el detalle y la validación están en docs/respiraciones.md):
#  1. Voz y batería (la separada con Demucs) a mono, 32 kHz. Cuadros de 40 ms cada 10 ms; nivel en 17 bandas de tercio
#     de octava (200 Hz–10 kHz), nivel «de voz» (150 Hz–2 kHz), nivel «de aire» (300 Hz–8 kHz), planitud espectral y
#     periodicidad (autocorrelación).
#  2. «Canta» el cuadro donde el nivel de voz pasa el de la voz fuerte de ese tramo menos 25 dB. Los arranques de frase
#     son los que siguen a 0,4 s o más sin cantar.
#  3. En la 1 s antes del arranque se busca la última tira de cuadros sin cantar, con el aire más de 5 dB arriba del
#     piso de ese tramo, plana (no una nota), que termina a menos de 0,4 s del arranque y dura de 80 ms a 1,2 s.
#  4. Controles: la misma búsqueda en ventanas que terminan 1 s antes del arranque, en huecos de 2,5 s o más (donde
#     no hay que respirar): da la tasa de falsos positivos. Y la correlación del aire con el de la batería, para
#     descartar platos o público que Demucs dejó en la voz.
import sys, os, json, math, subprocess, argparse
import numpy as np

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
VOCES = os.path.join(RAIZ, 'murga_trabajo', 'voces')
BATERIA = os.path.join(RAIZ, 'murga_trabajo', 'bateria')
SOLISTAS = os.path.join(RAIZ, 'murga_trabajo', 'solistas', 'segmentos.json')
SALIDA = os.path.join(RAIZ, 'murga_trabajo', 'respiraciones')

FS = 32000
N = 1280            # 40 ms
NF = 2560           # FFT con relleno de ceros (12,5 Hz por casillero)
HOP = 320           # 10 ms
DT = HOP / FS
BORDES = [200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000]
CENTROS = [round(math.sqrt(a * b)) for a, b in zip(BORDES[:-1], BORDES[1:])]
SOBRE = float(os.environ.get('RESP_SOBRE', 5.0))         # dB del aire sobre el piso para contar como respiración
SIN_CANTO = 0.4     # s sin cantar antes de un arranque
VENT = 1.0          # s antes del arranque donde se busca
RESP_MIN, RESP_MAX = 0.08, 1.2
MAX_GAP = 0.4       # la respiración termina como mucho 0,4 s antes del arranque
VOZ_BAJO = 25.0     # dB bajo la voz fuerte


def decodificar(ruta):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', ruta, '-ac', '1', '-ar', str(FS), '-f', 'f32le', '-'],
                       capture_output=True, check=True).stdout
    return np.frombuffer(b, dtype=np.float32).astype(np.float64)


VENTANA = np.hanning(N)
_wac = np.fft.irfft(np.abs(np.fft.rfft(VENTANA, NF)) ** 2)[:N]
WAC = _wac / _wac[0]
FREQ = np.fft.rfftfreq(NF, 1 / FS)
BANDA_IDX = [np.where((FREQ >= a) & (FREQ < b))[0] for a, b in zip(BORDES[:-1], BORDES[1:])]
IDX_VOZ = np.where((FREQ >= 150) & (FREQ < 2000))[0]
IDX_AIRE = np.where((FREQ >= 300) & (FREQ < 8000))[0]
IDX_PLANO = np.where((FREQ >= 500) & (FREQ < 8000))[0]
IDX_AC = np.where((FREQ >= 100) & (FREQ < 2500))[0]
LAG0, LAG1 = int(FS / 700), int(FS / 70)


def db(p):
    return 10 * np.log10(np.maximum(p, 1e-14))


def cuadros(x, completo=True):
    """Devuelve dict con nivel de voz, de aire, planitud, periodicidad y potencia por banda, cuadro a cuadro."""
    n = max(0, (len(x) - N) // HOP + 1)
    voz = np.zeros(n); aire = np.zeros(n); plano = np.zeros(n); per = np.zeros(n)
    bandas = np.zeros((n, len(CENTROS)))
    paso = 512
    for i0 in range(0, n, paso):
        i1 = min(n, i0 + paso)
        idx = (np.arange(i0, i1)[:, None] * HOP) + np.arange(N)[None, :]
        fr = x[idx] * VENTANA
        X = np.fft.rfft(fr, NF)
        P = (X.real ** 2 + X.imag ** 2) / (VENTANA ** 2).sum()
        voz[i0:i1] = P[:, IDX_VOZ].sum(1)
        aire[i0:i1] = P[:, IDX_AIRE].sum(1)
        q = P[:, IDX_PLANO] + 1e-14
        plano[i0:i1] = np.exp(np.log(q).mean(1)) / q.mean(1)
        for k, ix in enumerate(BANDA_IDX):
            bandas[i0:i1, k] = P[:, ix].sum(1)
        if completo:
            M = np.zeros_like(P); M[:, IDX_AC] = P[:, IDX_AC]
            ac = np.fft.irfft(M, NF, axis=1)[:, :N]
            a0 = np.maximum(ac[:, 0], 1e-14)
            r = (ac[:, LAG0:LAG1] / WAC[None, LAG0:LAG1]).max(1) / a0
            per[i0:i1] = r
    return dict(voz=db(voz), aire=db(aire), plano=plano, per=per, bandas=bandas)


def correr(mask, minimo):
    """Tiras de True: lista de (a, b) con b exclusivo, de largo >= minimo cuadros."""
    out = []; a = None
    for i, v in enumerate(mask):
        if v and a is None: a = i
        if not v and a is not None:
            if i - a >= minimo: out.append((a, i))
            a = None
    if a is not None and len(mask) - a >= minimo: out.append((a, len(mask)))
    return out


def buscar_respiracion(c, canta, piso, hasta, desde_min=0):
    """La última tira plana de aire sin cantar que termina antes de `hasta` (cuadro) y cerca de él.
    Devuelve (a, b) en cuadros o None."""
    d0 = max(desde_min, hasta - int(VENT / DT))
    if hasta - d0 < int(RESP_MIN / DT): return None
    aire = c['aire']
    cand = (~canta[d0:hasta]) & (aire[d0:hasta] > piso + SOBRE) & (c['per'][d0:hasta] < 0.6) & (c['plano'][d0:hasta] > 0.05)
    # cierra huecos de hasta 3 cuadros
    cand = cand.copy()
    for i in range(1, len(cand) - 3):
        if not cand[i] and cand[i - 1] and cand[i + 1:i + 4].any():
            cand[i] = True
    tiras = [(a + d0, b + d0) for a, b in correr(cand, int(RESP_MIN / DT))]
    # que no arranque pegada al final de la frase anterior (eso es la cola de la reverberación, no una inhalación)
    tiras = [(a, b) for a, b in tiras if (hasta - b) * DT <= MAX_GAP and a >= desde_min + int(0.06 / DT)]
    if not tiras: return None
    a, b = tiras[-1]
    if (b - a) * DT > RESP_MAX: return None
    return a, b


def cuartil(v):
    v = [t for t in v if t is not None and np.isfinite(t)]
    if not v: return None
    q = np.percentile(v, [25, 50, 75])
    return dict(n=len(v), q1=round(float(q[0]), 2), mediana=round(float(q[1]), 2), q3=round(float(q[2]), 2))


CACHE = os.environ.get('RESP_CACHE', '')     # carpeta donde guardar los cuadros (para repetir las cuentas sin volver a decodificar)


def cargar_cuadros(nombre):
    arch = os.path.join(CACHE, nombre + '.npz') if CACHE else ''
    if arch and os.path.exists(arch):
        z = np.load(arch)
        c = {k: z[k] for k in ('voz', 'aire', 'plano', 'per', 'bandas')}
        return c, (z['bat'] if 'bat' in z.files and z['bat'].size else None)
    x = decodificar(os.path.join(VOCES, nombre + '.flac'))
    c = cuadros(x)
    del x
    bat = None
    rb = os.path.join(BATERIA, nombre + '.flac')
    if os.path.exists(rb):
        bat = cuadros(decodificar(rb), completo=False)['aire']
        m = min(len(bat), len(c['aire']))
        bat = bat[:m]
    if arch:
        os.makedirs(CACHE, exist_ok=True)
        np.savez(arch, bat=bat if bat is not None else np.zeros(0), **{k: v.astype(np.float32) for k, v in c.items()})
    return c, bat


def medir_tira(c, bat, piso, pisos_banda, ha, hb, a, nivel_voz):
    """Las medidas de una tira de aire [ha, hb) que termina antes del cuadro a (el arranque)."""
    r = {}
    aire = c['aire'][ha:hb]
    r['dur_ms'] = round((hb - ha) * DT * 1000)
    r['gap_ms'] = round((a - hb) * DT * 1000)
    r['pegada'] = r['gap_ms'] < 30      # pegada al arranque: puede ser una consonante (s, ch) y no un soplo
    r['nivel'] = round(float(db(np.mean(10 ** (aire / 10)))) - nivel_voz, 1)
    r['pico'] = round(float(aire.max()) - nivel_voz, 1)
    r['sobre_piso'] = round(float(aire.mean() - piso), 1)
    # forma: dónde está el pico dentro de la tira y cuánto sube y baja (amplitud suavizada 3 cuadros)
    amp = np.convolve(10 ** (aire / 20), np.ones(3) / 3, 'same')
    ip = int(np.argmax(amp))
    r['pico_pos'] = round(ip / max(1, len(amp) - 1), 2)
    r['subida_ms'] = round(ip * DT * 1000)
    r['bajada_ms'] = round((len(amp) - 1 - ip) * DT * 1000)
    # el final contra el pico: ¿se corta de golpe al arrancar la voz?
    r['final_vs_pico_db'] = round(float(aire[-3:].mean() - aire.max()), 1)
    # espectro: potencia por banda de la tira menos el piso del tramo, relativa a su banda más fuerte
    bp = np.maximum(np.mean(c['bandas'][ha:hb], axis=0) - pisos_banda, 1e-14)
    perfil = db(bp)
    r['bandas_db'] = [round(float(v - perfil.max()), 1) for v in perfil]
    r['centroide'] = round(float((np.array(CENTROS) * bp).sum() / bp.sum()))
    r['planitud'] = round(float(np.mean(c['plano'][ha:hb])), 2)
    if bat is not None and hb <= len(bat):
        z0 = max(0, ha - 30); z1 = min(len(bat), hb + 30)
        u, v = c['aire'][z0:z1], bat[z0:z1]
        r['corr_bat'] = round(float(np.corrcoef(u, v)[0, 1]), 2) if len(u) > 5 and v.std() > 0 and u.std() > 0 else None
        r['bat_sobre_voz_db'] = round(float(np.mean(bat[ha:hb]) - np.mean(c['aire'][ha:hb])), 1)
    return r


def procesar(nombre, solistas):
    c, bat = cargar_cuadros(nombre)
    n = len(c['voz'])
    fuerte = np.percentile(c['voz'], 90)
    canta = c['voz'] > fuerte - VOZ_BAJO
    # sacar tiras cortas (menos de 80 ms) de «canto»
    canta2 = np.zeros(n, bool)
    for a, b in correr(canta, 8):
        canta2[a:b] = True
    canta = canta2
    # el piso de aire: mediana en cuadros lejos (>0,3 s) de todo canto
    cerca = np.zeros(n, bool)
    w = int(0.3 / DT)
    idx = np.where(canta)[0]
    for i in idx[::1]:
        pass
    k = np.convolve(canta.astype(float), np.ones(2 * w + 1), 'same') > 0
    lejos = ~k
    if lejos.sum() < 200:
        return dict(nombre=nombre, error='sin silencio para piso', arranques=[])
    piso = float(np.median(c['aire'][lejos]))
    pisos_banda = np.median(c['bandas'][lejos], axis=0)
    # arranques
    tiras = correr(canta, 1)
    arr = []
    for j, (a, b) in enumerate(tiras):
        prev = tiras[j - 1][1] if j else 0
        hueco = (a - prev) * DT
        if j == 0: hueco = a * DT
        if hueco >= SIN_CANTO and a * DT > 1.2:
            arr.append((a, b, hueco, prev))
    sol = solistas.get(nombre, [])
    res = []
    for a, b, hueco, prev in arr:
        t = a * DT
        # solista si el arranque cae al principio de un pasaje estricto
        es_solista = any(abs(t - p['desde']) < 0.5 for p in sol if p.get('estricto'))
        otro = (not es_solista) and any(abs(t - p['desde']) < 0.5 for p in sol)
        grupo = 'solista' if es_solista else ('otro' if otro else 'coro')
        # nivel de las vocales: media (en potencia) de los cuadros que cantan en el primer segundo
        f1 = min(b, a + int(1.0 / DT))
        e_voz_fr = c['aire'][a:min(n, a + int(1.0 / DT))][canta[a:min(n, a + int(1.0 / DT))]]
        if len(e_voz_fr) < 10: continue
        nivel_voz = float(db(np.mean(10 ** (e_voz_fr / 10))))
        r = dict(t=round(t, 2), grupo=grupo, hueco=round(hueco, 2), nivel_voz=round(nivel_voz, 1))
        hit = buscar_respiracion(c, canta, piso, a, prev)
        r['hay'] = hit is not None
        if hit:
            r.update(medir_tira(c, bat, piso, pisos_banda, hit[0], hit[1], a, nivel_voz))
        # control: ventana que termina 0,9 s antes del arranque, sólo si el hueco es de 2 s o más (ahí no hay que respirar)
        if hueco >= 2.0:
            a_c = a - int(0.9 / DT)
            ctl = buscar_respiracion(c, canta, piso, a_c, prev)
            r['ctl'] = ctl is not None
            if ctl:
                r['ctl_medida'] = medir_tira(c, bat, piso, pisos_banda, ctl[0], ctl[1], a_c, nivel_voz)
        res.append(r)
    return dict(nombre=nombre, largo=round(n * DT, 1), piso_aire_db=round(piso, 1), fuerte_voz_db=round(float(fuerte), 1), arranques=res)


def _job(a):
    nombre, solistas = a
    try:
        return procesar(nombre, solistas)
    except Exception as e:
        import traceback
        return dict(nombre=nombre, error=traceback.format_exc(), arranques=[])


def cargar_solistas():
    d = json.load(open(SOLISTAS, encoding='utf8'))
    return {t['tramo']: [p for p in t['pasajes'] if p.get('cantado')] for t in d['tramos']}


CLAVES = ('nivel', 'pico', 'dur_ms', 'gap_ms', 'centroide', 'planitud', 'pico_pos', 'subida_ms', 'bajada_ms', 'final_vs_pico_db',
          'sobre_piso', 'corr_bat', 'bat_sobre_voz_db')


def _stats(L):
    o = dict(n=len(L))
    for k in CLAVES:
        o[k] = cuartil([r.get(k) for r in L])
    if L:
        o['bandas_db'] = [round(float(v), 1) for v in np.median(np.array([r['bandas_db'] for r in L]), axis=0)]
    return o


def confiable(r):
    """Las tiras que más parecen un soplo: bien arriba del piso, separadas del arranque (una consonante no lo estaría) y sin
    seguir a la batería."""
    return r['sobre_piso'] >= 15 and not r['pegada'] and (r.get('corr_bat') or 0) <= 0.3


def resumir(arranques):
    out = {}
    grupos = dict(coro=lambda r: r['grupo'] == 'coro', solista=lambda r: r['grupo'] == 'solista',
                  una_voz=lambda r: r['grupo'] in ('solista', 'otro'))
    for g, f in grupos.items():
        A = [r for r in arranques if f(r)]
        H = [r for r in A if r['hay']]
        P = [r for r in A if 'ctl' in r]          # población pareada: hueco de 2 s o más, con control
        ph = sum(r['hay'] for r in P) / max(1, len(P)); pc = sum(r['ctl'] for r in P) / max(1, len(P))
        o = dict(arranques=len(A), con_aire=len(H), pct=round(100 * len(H) / max(1, len(A)), 1),
                 pareados=len(P), pct_pareados=round(100 * ph, 1), pct_control=round(100 * pc, 1),
                 pct_corregido=round(100 * max(0, ph - pc) / max(1e-9, 1 - pc), 1),
                 pct_separadas=round(100 * sum(1 for r in H if not r['pegada']) / max(1, len(A)), 1),
                 pct_confiables=round(100 * sum(1 for r in H if confiable(r)) / max(1, len(A)), 1))
        o['todas'] = _stats(H)
        o['separadas'] = _stats([r for r in H if not r['pegada']])
        o['confiables'] = _stats([r for r in H if confiable(r)])
        o['control'] = _stats([dict(r['ctl_medida']) for r in A if 'ctl_medida' in r])
        out[g] = o
    return out


def clips(ruta, cuantos):
    """Para escuchar: un trozo de la voz (1,2 s antes del arranque y 0,6 s después) de respiraciones detectadas, repartidas
    en el coro y los solistas, y lo mismo de controles (ventana sin respiración en un hueco largo)."""
    import wave
    d = json.load(open(ruta, encoding='utf8'))
    os.makedirs(os.path.join(SALIDA, 'clips'), exist_ok=True)
    rng = np.random.RandomState(7)
    def escribir(nom, t):
        x = decodificar(os.path.join(VOCES, nom['tramo'] + '.flac'))
        a0 = max(0, int((t - 1.2) * FS)); a1 = min(len(x), int((t + 0.6) * FS))
        y = x[a0:a1]; y = y / max(1e-9, np.abs(y).max()) * 0.6
        # las respiraciones son flojas: se sube el trozo entero 12 dB sobre lo normalizado para oírlas, sin pasar de 1
        y = np.clip(y * 4, -1, 1)
        arch = os.path.join(SALIDA, 'clips', '%s_%s_%.0fs.wav' % (nom['grupo'], nom['tramo'], t))
        with wave.open(arch, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(FS); w.writeframes((y * 32767).astype('<i2').tobytes())
        print(arch)
    for g in ('coro', 'solista'):
        H = [r for r in d['arranques'] if r['grupo'] == g and r['hay'] and not r.get('pegada')]
        for i in rng.permutation(len(H))[:cuantos]:
            escribir(H[i], H[i]['t'])
        N0 = [r for r in d['arranques'] if r['grupo'] == g and not r['hay'] and r['hueco'] >= 1.0]
        for i in rng.permutation(len(N0))[:max(1, cuantos // 2)]:
            escribir(dict(N0[i], grupo=g + '_sin'), N0[i]['t'])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tramo'); ap.add_argument('--proc', type=int, default=2)
    ap.add_argument('--sobre', type=float, default=SOBRE, help='dB del aire sobre el piso')
    ap.add_argument('--salida', default=os.path.join(SALIDA, 'medidas.json'))
    ap.add_argument('--clips', type=int, default=0, help='escribe N ejemplos (wav, para escuchar) de medidas.json en respiraciones/clips/')
    a = ap.parse_args()
    os.environ['RESP_SOBRE'] = str(a.sobre)      # los procesos hijos lo leen al importar
    globals()['SOBRE'] = a.sobre
    if a.clips:
        return clips(a.salida, a.clips)
    os.makedirs(SALIDA, exist_ok=True)
    sol = cargar_solistas()
    nombres = sorted(f[:-5] for f in os.listdir(VOCES) if f.endswith('.flac'))
    if a.tramo: nombres = [a.tramo]
    trabajos = [(n, sol) for n in nombres]
    if a.proc > 1 and len(trabajos) > 1:
        from multiprocessing import Pool
        with Pool(a.proc) as p:
            res = []
            for r in p.imap(_job, trabajos):
                print(r['nombre'], len(r['arranques']), r.get('error', '')[:200], flush=True)
                res.append(r)
    else:
        res = []
        for t in trabajos:
            r = _job(t); print(r['nombre'], len(r['arranques']), r.get('error', '')[:300], flush=True); res.append(r)
    todos = [dict(r, tramo=t['nombre']) for t in res for r in t['arranques']]
    out = dict(parametros=dict(FS=FS, ventana_ms=40, hop_ms=10, sobre_piso_db=SOBRE, sin_canto_s=SIN_CANTO, ventana_busqueda_s=VENT,
                               respiracion_min_ms=RESP_MIN * 1000, respiracion_max_ms=RESP_MAX * 1000, voz_bajo_db=VOZ_BAJO,
                               bandas_hz=CENTROS),
               resumen=resumir(todos), tramos=[{k: v for k, v in t.items() if k != 'arranques'} for t in res], arranques=todos)
    json.dump(out, open(a.salida, 'w', encoding='utf8'), ensure_ascii=False)
    print(json.dumps(out['resumen'], ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
