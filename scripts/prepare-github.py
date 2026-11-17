#!/usr/bin/env python3
"""Prepare an ignored-file-aware public copy without changing the checkout or publishing."""
import argparse
import hashlib
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Original social card and official SIL OFL fonts reviewed for public distribution; changed bytes require review.
PUBLIC_BINARY_SHA256 = {'public/social/scuole-vicine.png': 'f4d3dd246ae2bfab8b71195b9b4ba0950f6f3dfde4e9b595d6233e235367dbf6',
    'public/fonts/font-0.ttf': 'e1b454f5469f3d0d98c117651a4d15a8345ad77b50f09540b5cf61e82511b563',
    'public/fonts/font-1.ttf': '284891c74c258cff7233962e048d9470bfb9fc326b53dd0bca408789297c3409',
    'public/fonts/font-2.ttf': '913ee3631949ee1b4fb2601269412fca5775eb994d4f87be2c366c94ac123dc5',
    'public/fonts/font-3.ttf': '50fe1039eb3ff208d027a4867d3f53bd288bba76273a718578f7b3ec0feec388',
    'public/fonts/font-4.ttf': 'b0ae3e89a7d3ef2b1838bb4b1ceb0b17cc3435af061eee809d76aa623ff116e9',
    'public/fonts/font-5.ttf': '376427b5322148d8de1e03f263bcca4935a2d60ba71d9f94f4947ab664c711ae',
    'public/fonts/font-6.ttf': 'b79a2ea7a38f33fd96a282fadb9ce97626bb0724a44d21075859f0e50239993a',
    'public/fonts/font-7.ttf': '2a8e7f713ee79fbccdef3cef5c787aff47580299f7da60144961e7db2ec08211'
}
PATTERNS = {
    'chiave privata': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'token GitHub': r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b',
    'chiave API': r'\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b',
    'chiave AWS': r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
    'percorso personale': r'/Users/[^/\s]+/',
    'riferimento familiare originario': r'(?i)la scuola di paolo|infanzia-milano-ovest\.|bambino che compie tre anni nel 2027',
    'link di spazio condiviso completo': r'#spazio=[A-Za-z0-9_-]{16,}&accesso=[A-Za-z0-9_-]{24,}&chiave=[A-Za-z0-9_-]{24,}',
}

def selected_files():
    # A separate empty repository makes the selection independent of tracked files,
    # the real index and global ignore settings. Only checkout .gitignore files apply.
    with tempfile.TemporaryDirectory(prefix='scuole-github-metadata-') as metadata:
        subprocess.run(['git', 'init', '--bare', '--quiet', metadata], check=True)
        result = subprocess.run(['git', '-c', 'core.excludesFile=/dev/null',
                                 f'--git-dir={metadata}', f'--work-tree={ROOT}',
                                 'ls-files', '--others', '--exclude-standard', '-z'],
                                cwd=ROOT, check=True, capture_output=True)
    return sorted(Path(name.decode()) for name in result.stdout.split(b'\0') if name)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path, help='Nuova directory esterna alla checkout')
    args = parser.parse_args()
    destination = args.output.expanduser().absolute()
    resolved = destination.resolve()
    if destination.exists() or destination.is_symlink():
        parser.error('La destinazione deve essere nuova: nessun file verrà sovrascritto.')
    if resolved == ROOT or ROOT in resolved.parents or resolved in ROOT.parents:
        parser.error('Scegli una destinazione esterna alla checkout e ai suoi genitori.')
    files = selected_files()
    problems = []
    for relative in files:
        source = ROOT / relative
        if '.git' in relative.parts or source.is_symlink() or any(parent.is_symlink() for parent in source.parents if parent != ROOT):
            problems.append((relative, 'metadati Git o link simbolico non ammesso'))
            continue
        if relative.as_posix() in PUBLIC_BINARY_SHA256:
            if hashlib.sha256(source.read_bytes()).hexdigest() != PUBLIC_BINARY_SHA256[relative.as_posix()]:
                problems.append((relative, 'asset pubblico modificato: verificare e aggiornare hash'))
            continue
        if source.suffix.lower() in {'.sqlite', '.db', '.pem', '.key', '.pdf', '.png', '.jpg', '.jpeg', '.webp'}:
            problems.append((relative, 'file binario da verificare prima di includerlo'))
            continue
        data = source.read_bytes()
        if b'\0' in data:
            problems.append((relative, 'file binario non verificato'))
            continue
        content = data.decode('utf-8', errors='replace')
        for label, pattern in PATTERNS.items():
            if relative == Path('scripts/prepare-github.py') and label in {'percorso personale', 'riferimento familiare originario'}:
                continue  # Le espressioni della scansione non sono dati dell’utente.
            if re.search(pattern, content):
                problems.append((relative, label))
    if problems:
        for relative, label in problems:
            print(f'ESCLUSIONE DA RIVEDERE: {relative} — {label}')
        raise SystemExit('Copia non creata. Correggi o escludi i file segnalati e ripeti.')
    destination.mkdir(parents=True)
    for relative in files:
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / relative, target)
    print(f'Copia locale preparata: {destination} ({len(files)} file). Nessuna pubblicazione eseguita.')

if __name__ == '__main__':
    main()
