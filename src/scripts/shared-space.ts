import QRCode from 'qrcode';
import { getSchool } from '../lib/catalog-client';
import { FAMILY_STATUSES, localFamilyCopy, mergeFamilyImport, parseFamilyImport } from '../lib/family';
import { ready, sharedInfo, createShared, sharedLink, previewIncoming, acceptIncoming, dismissIncoming, leaveShared, deleteShared, recoverDrafts, recoverDraft } from '../lib/shared/controller';
const page = document.querySelector<HTMLElement>('[data-family-page]');
if (page) {
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => page.querySelector<T>(selector)!;
  const dialog = $<HTMLDialogElement>('[data-shared-dialog]');
  const content = $('[data-shared-content]');
  const confirm = $<HTMLButtonElement>('[data-shared-confirm]');
  const dialogError = $('[data-shared-dialog-error]');
  let action: (() => Promise<void> | void) | null = null;
  let busy = false;
  function text(value: string) { const p = document.createElement('p'); p.textContent = value; content.append(p); }
  function open(title: string, label?: string, callback?: () => Promise<void> | void) {
    content.replaceChildren(); dialogError.textContent = '';
    $('#shared-dialog-title').textContent = title;
    confirm.hidden = !label; confirm.textContent = label || ''; action = callback || null;
    if (!dialog.open) dialog.showModal();
  }
  function update() {
    const { client, incoming, error } = sharedInfo();
    const status = client ? ({ saved: 'Le modifiche sono salvate e sincronizzate.', saving: 'Salvataggio…', offline: 'La connessione o il servizio non è disponibile. Le modifiche sono conservate su questo dispositivo in una bozza protetta con cifratura.', conflict: 'Ci sono modifiche diverse allo stesso campo. Confrontale e scegli quale versione conservare: non verranno sovrascritte automaticamente.', unavailable: 'Lo spazio è stato eliminato, è scaduto oppure non è accessibile. La bozza cifrata rimane su questo dispositivo: puoi esportarne una copia per conservarla.', 'storage-error': 'Non siamo riusciti a salvare la bozza su questo dispositivo. Tieni aperta la pagina ed esporta una copia degli appunti.' }[client.status]) : 'Le scuole salvate e gli appunti restano su questo dispositivo.';
    $('[data-shared-status]').textContent = status;
    $('[data-family-device]').textContent = client ? 'Spazio condiviso · appunti cifrati' : 'Su questo dispositivo';
    $('[data-shared-error]').textContent = error;
    $('[data-shared-error]').hidden = !error;
    $('[data-shared-expiry]').textContent = client ? `Scade il ${new Date(client.state.expiresAt * 1000).toLocaleDateString('it-IT')}. Ogni modifica rinnova la durata di 12 mesi.` : '';
    $('[data-shared-create]').hidden = !!client;
    $('[data-shared-incoming]').hidden = !incoming;
    $('[data-shared-entry]').hidden = !incoming;
    for (const name of ['link', 'sync', 'manage', 'add-local', 'drafts', 'leave', 'delete']) $(`[data-shared-${name}]`).hidden = !client;
    $('[data-shared-conflicts]').hidden = !client?.conflicts.length;
  }
  async function showLink() {
    open('Il tuo link segreto');
    text('Chi possiede il link o il QR può leggere, modificare ed eliminare lo spazio. Condividilo soltanto con persone fidate. Senza link e dispositivi autorizzati non possiamo recuperare gli appunti.');
    const url = sharedLink();
    const label = document.createElement('label'); label.textContent = 'Link da conservare';
    const input = document.createElement('input'); input.type = 'url'; input.readOnly = true; input.value = url; label.append(input); content.append(label);
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'family-primary'; copy.textContent = 'Copia link';
    copy.onclick = async () => { try { await navigator.clipboard.writeText(url); copy.textContent = 'Link copiato'; } catch { input.focus(); input.select(); dialogError.textContent = 'Copia il link selezionato.'; } };
    content.append(copy);
    const canvas = document.createElement('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'QR del link segreto dello spazio');
    content.append(canvas);
    await QRCode.toCanvas(canvas, url, { width: 300, margin: 4, errorCorrectionLevel: 'M' });
    text('Il QR viene generato su questo dispositivo, senza inviare il link a servizi esterni.');
  }
  function showConflicts() {
    const client = sharedInfo().client;
    if (!client?.conflicts.length) return;
    const conflicts = structuredClone(client.conflicts);
    open('Confronta le modifiche', 'Salva le scelte', () => {
      const values = conflicts.map((c, i) => {
        const selection = content.querySelector<HTMLSelectElement>(`[data-choice="${i}"]`)!;
        if (!selection.value) throw new Error('Scegli come risolvere ogni modifica.');
        return selection.value === 'local' ? c.local : selection.value === 'remote' ? c.remote : content.querySelector<HTMLTextAreaElement>(`[data-edit="${i}"]`)!.value;
      });
      client.resolve(values); dialog.close();
    });
    text('Le modifiche a campi diversi sono già state unite. Scegli cosa conservare nei campi in cui sono state scritte versioni diverse.');
    const names = { status: 'Stato visita', note: 'Dopo la visita', questions: 'Domande aperte', parentA: 'Punto di vista A', parentB: 'Punto di vista B' };
    conflicts.forEach((c, i) => {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend'); legend.textContent = `${getSchool(c.school)?.name || c.school} · ${names[c.field]}`; fieldset.append(legend);
      for (const [title, value] of [['La tua modifica', c.local], ['La versione condivisa', c.remote]]) {
        const heading = document.createElement('p'); heading.textContent = title;
        const pre = document.createElement('pre'); pre.textContent = c.field === 'status' ? FAMILY_STATUSES[value as keyof typeof FAMILY_STATUSES] : value || '(vuoto)';
        fieldset.append(heading, pre);
      }
      const label = document.createElement('label'); label.textContent = 'Cosa conservare';
      const select = document.createElement('select'); select.dataset.choice = String(i); select.setAttribute('aria-label', 'Cosa conservare');
      for (const [value, title] of [['', 'Scegli…'], ['local', 'La tua modifica'], ['remote', 'La versione condivisa'], ...(c.field !== 'status' ? [['custom', 'Combina o riscrivi']] : [])]) { const option = document.createElement('option'); option.value = value; option.textContent = title; select.append(option); }
      label.append(select); fieldset.append(label);
      if (c.field !== 'status') {
        const editLabel = document.createElement('label'); editLabel.textContent = 'Testo da salvare'; editLabel.hidden = true;
        const edit = document.createElement('textarea'); edit.dataset.edit = String(i); edit.value = c.local; edit.maxLength = c.field === 'parentA' || c.field === 'parentB' ? 1000 : 10000;
        editLabel.append(edit); fieldset.append(editLabel);
        select.onchange = () => { editLabel.hidden = select.value !== 'custom'; };
      }
      content.append(fieldset);
    });
  }
  page.addEventListener('click', async event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (!button || busy) return;
    try {
      if (button.hasAttribute('data-shared-close')) { dialog.close(); return; }
      if (button.hasAttribute('data-shared-confirm') && action) {
        busy = true; confirm.disabled = true; await action(); return;
      }
      await ready;
      if (button.hasAttribute('data-shared-create')) {
        open('Attiva lo spazio condiviso', 'Crea spazio e link', async () => { await createShared(); await showLink(); });
        text('Selezione, stati e appunti verranno cifrati nel browser e sincronizzati. La copia locale attuale rimane separata. Chi possiede il link può leggere, modificare ed eliminare lo spazio.');
        text('Non chiediamo nome o email. Conserva il link: non possiamo recuperarlo. Il browser ricorderà la chiave su questo dispositivo.');
      } else if (button.hasAttribute('data-shared-link')) await showLink();
      else if (button.hasAttribute('data-shared-sync')) await sharedInfo().client?.sync();
      else if (button.hasAttribute('data-shared-incoming')) {
        open('Anteprima dello spazio ricevuto'); text('Stiamo aprendo lo spazio e rendendo leggibili gli appunti…');
        const document = await previewIncoming();
        open('Uno spazio da condividere', 'Apri spazio condiviso', async () => { await acceptIncoming(); dialog.close(); });
        const notes = Object.values(document.entries).filter(e => e.note || e.questions || e.parentA || e.parentB).length;
        text(`${document.saved.length} ${document.saved.length === 1 ? 'scuola' : 'scuole'} nella selezione · ${notes} ${notes === 1 ? 'scheda' : 'schede'} con appunti.`);
        const list = window.document.createElement('ul');
        document.saved.slice(0, 20).forEach(id => { const li = window.document.createElement('li'); li.textContent = getSchool(id)?.name || id; list.append(li); }); content.append(list);
        text('Gli appunti verranno aperti nello spazio condiviso. Le preferenze locali rimangono separate. Chi possiede il link ha gli stessi permessi.');
        const dismiss = window.document.createElement('button'); dismiss.className = 'family-secondary'; dismiss.textContent = 'Ignora questo link'; dismiss.onclick = () => { dismissIncoming(); dialog.close(); }; content.append(dismiss);
      } else if (button.hasAttribute('data-shared-conflicts')) showConflicts();
      else if (button.hasAttribute('data-shared-leave')) {
        open('Torna alla copia su questo dispositivo', 'Torna alla copia locale', async () => { await leaveShared(); dialog.close(); });
        text('Le bozze cifrate restano su questo dispositivo. Conserva il link per riaprire lo spazio condiviso. Ritroverai le scuole salvate e gli appunti che avevi sul dispositivo prima di aprire lo spazio condiviso.');
      } else if (button.hasAttribute('data-shared-delete')) {
        open('Elimina lo spazio per tutti', 'Elimina definitivamente', async () => { await deleteShared(); dialog.close(); });
        text('Lo spazio sarà eliminato dal database attivo per tutte le persone con il link. Esporta prima una copia se vuoi conservarlo. Le copie su altri dispositivi e gli eventuali backup infrastrutturali non vengono cancellati immediatamente.');
      } else if (button.hasAttribute('data-shared-add-local')) {
        const state = localFamilyCopy();
        const preview = parseFamilyImport(JSON.stringify({ format: 'scuole-milano-family', version: 1, state }));
        open('Aggiungi la copia di questo dispositivo', 'Unisci allo spazio condiviso', () => { mergeFamilyImport(preview); dialog.close(); });
        text(`${preview.schoolCount} scuole e ${preview.noteCount} schede con appunti. Se gli appunti sono diversi, verranno conservati entrambi i testi. Gli stati delle visite già scelti nello spazio condiviso resteranno invariati. La copia locale rimane disponibile.`);
      } else if (button.hasAttribute('data-shared-drafts')) {
        const records = await recoverDrafts();
        open('Le bozze salvate in altre sessioni');
        text(records.length ? 'Puoi recuperare una bozza cifrata salvata da un’altra scheda o sessione. Eventuali differenze saranno confrontate.' : 'Non ci sono altre bozze su questo dispositivo.');
        for (const record of records) {
          const recover = document.createElement('button'); recover.className = 'family-secondary'; recover.textContent = `Recupera bozza del ${new Date(record.updated).toLocaleString('it-IT')}`;
          recover.onclick = async () => { try { await recoverDraft(record.id); dialog.close(); if (sharedInfo().client?.conflicts.length) showConflicts(); } catch (error) { dialogError.textContent = error instanceof Error ? error.message : 'Non siamo riusciti a recuperare questa bozza. Prova a riaprire l’elenco delle bozze.'; } }; content.append(recover);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Non siamo riusciti a completare l’operazione. Le modifiche locali sono conservate: puoi riprovare.';
      if (dialog.open) dialogError.textContent = message;
      else { $('[data-shared-error]').hidden = false; $('[data-shared-error]').textContent = message; }
    } finally { busy = false; confirm.disabled = false; }
  });
  window.addEventListener('shared:change', update);
  void ready.then(update);
}
