# murga_lote.py — transcribir las murgas en tu compu

Hace todo de una:

1. Busca en YouTube la presentación, la canción final y la retirada de cada espectáculo.
2. Baja los videos y corta los tramos. Si sólo encuentra el show completo, usa los primeros 14 min y los últimos 20.
3. Transcribe cada tramo con MuScriptor, sólo voces + batería. La detección de pulsos y compases la hace Beat This!.
4. Arma `murgas_para_claude.zip`, con los MIDI, un mp3 liviano de cada tramo y `plan.csv`.

## Una sola vez

1. Instalá **uv**:
   - Mac/Linux: `curl -LsSf https://astral.sh/uv/install.sh | sh`
   - Windows: `powershell -c "irm https://astral.sh/uv/install.ps1 | iex"`
2. Entrá a https://huggingface.co/MuScriptor/muscriptor-medium con tu cuenta y tocá **Agree and access**. Es la licencia no comercial de los pesos.
3. Iniciá sesión con `uvx hf auth login` y pegá un token de https://huggingface.co/settings/tokens. Alcanza con uno de lectura.

No hace falta instalar Python, ffmpeg ni nada más: uv baja todo la primera vez (PyTorch pesa ~1-2 GB).

## Correr

```bash
uv run murga_lote.py                    # todo
uv run murga_lote.py --solo-buscar      # sólo arma plan.csv para revisar qué videos eligió
uv run murga_lote.py --modelo small     # si no tenés GPU ni Mac M1/M2/M3/M4, es bastante más rápido
uv run murga_lote.py --cookies chrome   # si YouTube dice "Sign in to confirm you're not a bot"
```

En Windows, uv instala PyTorch para CPU, así que conviene `--modelo small`.

Si un video quedó mal elegido en `plan.csv`, cambiá la url o los tiempos y volvé a correr. Los tiempos van en `desde`/`hasta`, en segundos o mm:ss; un `desde` negativo cuenta desde el final. Lo que ya bajó o transcribió no se repite. Si encontrás el video de una parte que falta, agregá la fila.

Al final subí **murgas_para_claude.zip** al chat.
