#!/usr/bin/env python3
# Découpe une prise ElevenLabs (toutes les répliques d'un personnage séparées par [long pause]) en un fichier par
# réplique : on cherche les silences, on garde les N-1 plus longs comme coupures, on vérifie que la durée de chaque
# morceau suit à peu près la longueur du texte, puis on encode chaque réplique en mp3 mono léger.
# Usage : python3 tools/voices/split.py <groupe> <prise.mp3>   (groupe : narr, pomponA, heroM… de tools/voices/scripts.json)
# Les fichiers vont dans voices/ (champion : suffixe -m ou -f) et js/voices-list.js est remis à jour.
import json, re, subprocess, sys, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
group, src = sys.argv[1], sys.argv[2]
outdir = os.path.join(ROOT, 'voices')
suffix = {'heroM': '-m', 'heroF': '-f'}.get(group, '')
S = json.load(open(os.path.join(os.path.dirname(__file__), 'scripts.json')))[group]
ids, texts = S['ids'], S['texts']
N = len(ids)

def probe_dur(f):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip())

def silences(f, noise='-38dB', d='0.25'):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', f'silencedetect=noise={noise}:d={d}', '-f', 'null', '-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', r)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r)]
    return list(zip(st, en))

dur = probe_dur(src)
sil = [s for s in silences(src) if s[0] > 0.05 and s[1] < dur - 0.05]
if len(sil) < N - 1:
    sil = [s for s in silences(src, '-34dB', '0.18') if s[0] > 0.05 and s[1] < dur - 0.05]
if len(sil) < N - 1:
    print(json.dumps({'group': group, 'ok': False, 'why': f'{len(sil)} silences pour {N} répliques', 'dur': dur})); sys.exit(1)
cuts = sorted(sorted(sil, key=lambda s: s[1] - s[0], reverse=True)[:N - 1])
bounds, prev = [], 0.0
for a, b in cuts:
    bounds.append((prev, a)); prev = b
bounds.append((prev, dur))
# contrôle : secondes par caractère de chaque morceau comparées à la médiane
rates = [(e - s) / max(8, len(t)) for (s, e), t in zip(bounds, texts)]
med = sorted(rates)[len(rates) // 2]
bad = [i for i, r in enumerate(rates) if r < med * 0.45 or r > med * 2.2]
os.makedirs(outdir, exist_ok=True)
for i, ((s, e), vid) in enumerate(zip(bounds, ids)):
    s = max(0, s - 0.06); e = min(dur, e + 0.12)
    out = os.path.join(outdir, f'{vid}{suffix}.mp3')
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', f'{s:.3f}', '-to', f'{e:.3f}', '-i', src,
                    '-af', 'afade=t=in:d=0.03,areverse,afade=t=in:d=0.06,areverse,loudnorm=I=-16:TP=-1.5:LRA=11',
                    '-ac', '1', '-ar', '44100', '-b:a', '56k', out], check=True)
# liste des répliques qui ont une voix (lue par js/voice.js)
ids_all = sorted(f[:-4] for f in os.listdir(outdir) if f.endswith('.mp3'))
with open(os.path.join(ROOT, 'js', 'voices-list.js'), 'w') as fh:
    fh.write("// Répliques qui ont une voix (fichiers voices/<id>.mp3, champion : <id>-m / <id>-f). Généré par tools/voices/split.py.\n")
    fh.write('export const VOICES = new Set([\n' + ''.join(f"  '{i}',\n" for i in ids_all) + ']);\n')
print(json.dumps({'group': group, 'ok': not bad, 'n': N, 'dur': round(dur, 1), 'suspects': [(ids[i], round(bounds[i][1] - bounds[i][0], 2), texts[i][:40]) for i in bad],
                  'durs': [round(e - s, 2) for s, e in bounds]}, ensure_ascii=False))
