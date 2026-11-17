import { spaceQrSVG } from '../lib/shared/qr';
import { notify } from './shared';
import { getSchool } from '../lib/catalog-client';
import { FAMILY_STATUSES, loadFamily, isFamilyStorageAvailable, localFamilyCopy, mergeFamilyImport, parseFamilyImport } from '../lib/family';
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
  let noteReminderShown = false;
  let syncing = false;
  let renderedLink = '';
  let preparingPdf = false;
  function updateAccess() {
    const active = !!sharedInfo().client;
    $('[data-shared-panel]').dataset.spaceActive = String(active);
    $('[data-shared-pass]').hidden = !active;
    $('[data-shared-full-link]').hidden = !active;
    $('[data-shared-placeholder]').hidden = active;
    $('[data-shared-pdf-hint]').hidden = active;
    const input = $<HTMLInputElement>('[data-shared-personal-link]');
    const url = active ? sharedLink() : '';
    if (url === renderedLink) return;
    input.value = url;
    $('[data-shared-copy-label]').textContent = 'Copia link';
    $('[data-shared-copy-status]').textContent = '';
    $('[data-shared-pdf-status]').textContent = '';
    $('[data-shared-pdf-label]').textContent = 'Scarica il pass PDF';
    const qr = $('[data-shared-qr]');
    qr.replaceChildren();
    if (url) {
      try { qr.innerHTML = spaceQrSVG(url); }
      catch { $('[data-shared-copy-status]').textContent = 'Il QR non è disponibile. Puoi copiare il link.'; }
    }
    renderedLink = url;
  }
  function text(value: string) { const p = document.createElement('p'); p.textContent = value; content.append(p); }
  function open(title: string, label?: string, callback?: () => Promise<void> | void) {
    content.replaceChildren(); dialogError.textContent = '';
    $('#shared-dialog-title').textContent = title;
    confirm.hidden = !label; confirm.textContent = label || ''; action = callback || null;
    if (!dialog.open) dialog.showModal();
  }
  function update() {
    const { client, incoming, error } = sharedInfo();
    updateAccess();
    const status = client ? ({ saved: 'Le modifiche sono salvate e sincronizzate.', saving: 'Salvataggio…', offline: 'La connessione o il servizio non è disponibile. Le modifiche sono conservate su questo dispositivo in una bozza protetta con cifratura.', conflict: 'Ci sono modifiche diverse allo stesso campo. Confrontale e scegli quale versione conservare: non verranno sovrascritte automaticamente.', unavailable: 'Lo spazio è stato eliminato, è scaduto oppure non è accessibile. La bozza cifrata rimane su questo dispositivo: puoi esportarne una copia per conservarla.', 'storage-error': 'Non siamo riusciti a salvare la bozza su questo dispositivo. Tieni aperta la pagina ed esporta una copia degli appunti.' }[client.status]) : isFamilyStorageAvailable() ? 'Le scuole e gli appunti sono conservati soltanto in questo browser.' : 'Il browser non consente il salvataggio. Scarica una copia prima di chiudere la pagina.';
    $('[data-shared-status]').textContent = status;
    const needsAttention = client ? !['saved', 'saving'].includes(client.status) : !isFamilyStorageAvailable();
    $('[data-shared-attention]').hidden = !needsAttention;
    $('[data-shared-attention]').textContent = needsAttention ? status : '';
    $('.family-space-lead').textContent = client ? 'Con il tuo link ritrovi scuole e appunti, anche se il browser li dimentica.' : 'Crea un link per ritrovare scuole e appunti, anche se il browser li dimentica.';
    const state = loadFamily();
    const count = state.saved.length;
    $('[data-space-summary]').textContent = `${count} ${count === 1 ? 'scuola salvata' : 'scuole salvate'} · ${client ? client.status === 'saving' ? 'Salvataggio…' : client.status === 'saved' ? 'Spazio cifrato · sincronizzato' : 'Spazio cifrato · verifica lo stato qui sotto' : 'Solo in questo browser'}`;
    const hasWork = state.saved.length > 0 || Object.keys(state.entries).length > 0;
    $('[data-family-device]').textContent = client ? 'Spazio personale · contenuti cifrati' : 'Salvate in questo browser';
    $('#shared-title').textContent = client ? 'Le tue scelte, da ritrovare.' : hasWork ? 'Conserva le tue scelte con un link' : 'Hai già un link al tuo spazio?';
    $('[data-shared-intro]').hidden = !!client;
    $('[data-shared-reminder]').hidden = !client;
    $('[data-shared-status]').hidden = !client && !hasWork;
    $('[data-shared-open]').textContent = client ? 'Apri un altro spazio con un link' : 'Apri uno spazio con un link';
    $('[data-shared-error]').textContent = error;
    $('[data-shared-error]').hidden = !error;
    $('[data-shared-expiry]').textContent = client ? `Scade il ${new Date(client.state.expiresAt * 1000).toLocaleDateString('it-IT')}. Ogni modifica salvata rinnova la durata di 365 giorni; aprire lo spazio non la rinnova.` : '';
    page!.querySelectorAll<HTMLElement>('[data-shared-create]').forEach(button => { button.hidden = !!client || !hasWork; });
    $('[data-shared-incoming]').hidden = !incoming;
    $('[data-shared-entry]').hidden = !incoming;
    for (const name of ['link', 'sync', 'manage', 'add-local', 'drafts', 'leave', 'delete']) $(`[data-shared-${name}]`).hidden = !client;
    const sync=$<HTMLButtonElement>('[data-shared-sync]');
    const saving=syncing||client?.status==='saving';
    sync.disabled=!!saving;sync.textContent=saving?'Sincronizzazione…':client?.status==='offline'?'Riprova':'Sincronizza';
    sync.setAttribute('aria-label',client?.status==='offline'?'Riprova la sincronizzazione':'Sincronizza lo spazio');
    $('[data-shared-panel]').setAttribute('aria-busy',String(!!saving));
    $('[data-shared-conflicts]').hidden = !client?.conflicts.length;
  }
  async function copyLink() {
    const input = $<HTMLInputElement>('[data-shared-personal-link]');
    try {
      await navigator.clipboard.writeText(sharedLink());
      $('[data-shared-copy-label]').textContent = 'Copiato';
      $('[data-shared-copy-status]').textContent = 'Link copiato. Conservalo fuori da questo browser.';
    } catch {
      $<HTMLDetailsElement>('[data-shared-expand]').open = true;
      input.focus(); input.select();
      $('[data-shared-copy-status]').textContent = 'Seleziona e copia il link completo nel campo qui sopra.';
    }
  }
  async function showIncoming(value?: string) {
    // Keep the input and confirm action available if validation or loading fails.
    const incomingDocument = await previewIncoming(value);
    open('Apri questo spazio', 'Apri spazio', async () => { await acceptIncoming(); dialog.close(); });
    const notes = Object.values(incomingDocument.entries).filter(e => e.note || e.questions || e.parentA || e.parentB).length;
    text(`${incomingDocument.saved.length} ${incomingDocument.saved.length === 1 ? 'scuola' : 'scuole'} nella selezione · ${notes} ${notes === 1 ? 'scheda' : 'schede'} con appunti.`);
    const list = document.createElement('ul');
    incomingDocument.saved.slice(0, 20).forEach(id => { const li = document.createElement('li'); li.textContent = getSchool(id)?.name || id; list.append(li); }); content.append(list);
    text('Le scuole e gli appunti già presenti in questo browser restano separati. Se hai un altro spazio aperto, passerai a questo: conserva anche il link dello spazio precedente. Chi possiede il link può leggere, modificare ed eliminare lo spazio.');
    const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.className = 'family-secondary'; dismiss.textContent = 'Ignora questo link'; dismiss.onclick = () => { dismissIncoming(); dialog.close(); }; content.append(dismiss);
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
        open('Un link per conservare le tue scelte', 'Crea spazio e link', async () => {
          await createShared(); dialog.close(); update();
          $<HTMLDetailsElement>('[data-shared-expand]').open = true;
          $('[data-shared-pass]').scrollIntoView({ block: 'center' });
          $<HTMLInputElement>('[data-shared-personal-link]').focus({ preventScroll: true });
          notify('Il tuo spazio è pronto. Conserva il link fuori da questo browser.');
        });
        text('Lo spazio conterrà le scuole salvate, gli stati delle visite, le domande e gli appunti presenti in questo browser. Le modifiche successive verranno salvate nello spazio. Le tre scuole scelte per il confronto restano su questo dispositivo.');
        text('Per rispettare la tua privacy, non chiediamo un account, un nome o un indirizzo email. I contenuti sono cifrati nel browser prima di essere inviati al servizio.');
        text('Conserva il link fuori da questo browser: servirà a ritrovare le tue scelte anche se il browser dimentica i dati del sito o quando usi un altro dispositivo. Puoi tenerlo per te oppure condividerlo. Chi possiede il link può leggere, modificare ed eliminare lo spazio.');
        text('Lo spazio scade dopo 365 giorni dalla creazione o dall’ultima modifica salvata. Aprirlo non rinnova la durata. La copia precedente in questo browser resta separata e non si aggiorna con le modifiche nello spazio.');
      } else if (button.hasAttribute('data-shared-enlarge')) {
        open('Il QR del tuo spazio');
        const qr = document.createElement('div'); qr.className = 'space-qr-large'; qr.innerHTML = spaceQrSVG(sharedLink()); content.append(qr);
        text('Inquadra il QR per aprire lo spazio su un altro dispositivo. Chi lo possiede può leggere, modificare ed eliminare lo spazio.');
      } else if (button.hasAttribute('data-shared-pdf')) {
        if (preparingPdf || !sharedInfo().client) return;
        preparingPdf = true;
        button.setAttribute('aria-disabled', 'true');
        button.setAttribute('aria-busy', 'true');
        $('[data-shared-pdf-label]').textContent = 'Preparo il PDF…';
        $('[data-shared-pdf-status]').textContent = 'Sto preparando il pass su questo dispositivo.';
        try {
          const { downloadSpacePass } = await import('../lib/shared/pass-pdf');
          const url = sharedLink();
          await downloadSpacePass(url, () => !!sharedInfo().client && sharedLink() === url);
          $('[data-shared-pdf-label]').textContent = 'Scarica il pass PDF';
          $('[data-shared-pdf-status]').textContent = 'Download avviato. Custodisci il pass: chi lo possiede può accedere allo spazio.';
        } catch {
          $('[data-shared-pdf-label]').textContent = 'Riprova il PDF';
          $('[data-shared-pdf-status]').textContent = 'Non siamo riusciti a preparare il PDF. Controlla la connessione e riprova: il tuo spazio e gli appunti sono conservati.';
        } finally { preparingPdf = false; button.removeAttribute('aria-disabled'); button.removeAttribute('aria-busy'); }
      } else if (button.hasAttribute('data-shared-link')) await copyLink();
      else if (button.hasAttribute('data-shared-sync')) {
        if (syncing) return;
        syncing = true; update();
        try { await sharedInfo().client?.sync(); } finally { syncing = false; update(); }
      }
      else if (button.hasAttribute('data-shared-open')) {
        open('Riapri il tuo spazio con il link', 'Apri anteprima', async () => {
          const input = content.querySelector<HTMLInputElement>('[data-shared-pasted-link]')!;
          await showIncoming(input.value);
        });
        text('Incolla il link completo che hai conservato o che una persona ha condiviso con te. Potrai controllare scuole e appunti prima di aprire lo spazio.');
        const label = document.createElement('label'); label.textContent = 'Link del tuo spazio';
        const input = document.createElement('input'); input.type = 'url'; input.dataset.sharedPastedLink = ''; input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('autocapitalize', 'none');
        label.append(input); content.append(label); input.focus();
      } else if (button.hasAttribute('data-shared-incoming')) {
        busy = true;
        await showIncoming();
      } else if (button.hasAttribute('data-shared-conflicts')) showConflicts();
      else if (button.hasAttribute('data-shared-leave')) {
        open('Torna alla copia su questo dispositivo', 'Torna alla copia locale', async () => { await leaveShared(); dialog.close(); });
        text('Le bozze cifrate restano su questo dispositivo. Conserva il link per riaprire lo spazio. Ritroverai le scuole salvate e gli appunti che avevi sul dispositivo prima di aprire lo spazio.');
      } else if (button.hasAttribute('data-shared-delete')) {
        open('Elimina lo spazio per tutti', 'Elimina definitivamente', async () => { await deleteShared(); dialog.close(); });
        text('Lo spazio sarà eliminato dal database attivo per tutte le persone con il link. Esporta prima una copia se vuoi conservarlo. Le copie su altri dispositivi e gli eventuali backup infrastrutturali non vengono cancellati immediatamente.');
      } else if (button.hasAttribute('data-shared-add-local')) {
        const state = localFamilyCopy();
        const preview = parseFamilyImport(JSON.stringify({ format: 'scuole-milano-family', version: 1, state }));
        open('Aggiungi la copia di questo dispositivo', 'Unisci allo spazio', () => { mergeFamilyImport(preview); dialog.close(); });
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
      if(button.hasAttribute('data-shared-incoming'))button.textContent='Riprova ad aprire lo spazio';
      const message = error instanceof Error ? error.message : 'Non siamo riusciti a completare l’operazione. Le modifiche locali sono conservate: puoi riprovare.';
      if (dialog.open) dialogError.textContent = message;
      else { $('[data-shared-error]').hidden = false; $('[data-shared-error]').textContent = message; }
    } finally { busy = false; confirm.disabled = false;if(button.hasAttribute('data-shared-incoming'))button.disabled=false; }
  });
  page.addEventListener('focusout', event => {
    if (!(event.target instanceof HTMLTextAreaElement) || !event.target.hasAttribute('data-family-field') || !event.target.value.trim()) return;
    if (noteReminderShown || sharedInfo().client || !isFamilyStorageAvailable()) return;
    noteReminderShown = true;
    notify('Gli appunti sono salvati in questo browser. Con un link puoi ritrovarli anche se il browser li dimentica.', {
      label: 'Crea il tuo link', run: () => { page!.querySelector<HTMLButtonElement>('[data-shared-create]')!.click(); },
    });
  });
  // Remove secret link fields and generated QR data when the dialog closes.
  dialog.addEventListener('close', () => { content.replaceChildren(); action = null; });
  window.addEventListener('family:change', update);
  window.addEventListener('shared:change', update);
  void ready.then(update);
}
