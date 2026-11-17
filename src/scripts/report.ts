export {};
const dialog = document.querySelector<HTMLDialogElement>('#school-report-dialog')!;
const form = dialog.querySelector<HTMLFormElement>('[data-report-form]')!;
const category = form.elements.namedItem('category') as HTMLSelectElement;
const details = form.elements.namedItem('details') as HTMLTextAreaElement;
const email = form.elements.namedItem('email') as HTMLInputElement;
const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
const status = form.querySelector<HTMLElement>('[data-report-status]')!;
const success = dialog.querySelector<HTMLElement>('[data-report-success]')!;
let schoolId = '', sending = false;
let opener: HTMLButtonElement | null = null;
function updateDetails() {
  details.setCustomValidity('');
  details.required = category.value === 'other';
  form.querySelector('[data-report-details-label]')!.textContent = details.required ? 'Dettagli (obbligatori)' : 'Dettagli (facoltativi)';
}
category.addEventListener('change', updateDetails);
document.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-report-school]');
  if (!button || sending) return;
  opener = button;
  schoolId = button.dataset.reportSchool!;
  dialog.querySelector('#report-school-name')!.textContent = button.dataset.reportName || '';
  form.reset(); updateDetails(); form.hidden = false; success.hidden = true; status.hidden = true;
  dialog.showModal(); category.focus();
});
dialog.querySelectorAll('[data-report-close]').forEach(button => button.addEventListener('click', () => { if (!sending) dialog.close(); }));
dialog.addEventListener('cancel', event => { if (sending) event.preventDefault(); });
dialog.addEventListener('close', () => opener?.focus());
dialog.addEventListener('click', event => { if (event.target === dialog && !sending) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending || !form.reportValidity()) return;
  if (details.required && !details.value.trim()) { details.setCustomValidity('Descrivi cosa vuoi segnalare.'); details.reportValidity(); return; }
  sending = true; submit.disabled = true; submit.textContent = 'Invio in corso…'; status.hidden = true;
  form.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schoolId, category: category.value, details: details.value.trim(), email: email.value.trim() }), signal: AbortSignal.timeout(15000) });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.received !== true) throw new Error(result?.error || 'Il servizio di invio non è disponibile. Riprova più tardi.');
    form.hidden = true; success.hidden = false;
    form.reset(); success.querySelector<HTMLButtonElement>('button')!.focus();
  } catch (error) {
    status.textContent = error instanceof Error && error.name === 'Error' ? error.message : 'Non siamo riusciti a confermare l’invio. Controlla la connessione e riprova.';
    status.hidden = false;
  } finally { sending = false; submit.disabled = false; submit.textContent = 'Invia segnalazione'; form.removeAttribute('aria-busy'); }
});
details.addEventListener('input', () => details.setCustomValidity(''));
