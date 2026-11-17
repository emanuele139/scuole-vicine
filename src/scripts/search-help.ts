// Native details provide tap/keyboard access even without JavaScript.
document.querySelectorAll<HTMLDetailsElement>('[data-search-help]').forEach(help => {
  const summary = help.querySelector('summary')!;
  help.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') help.open = true;
  });
  help.addEventListener('pointerleave', () => {
    if (!help.contains(document.activeElement)) help.open = false;
  });
  help.addEventListener('focusout', event => {
    if (!(event.relatedTarget instanceof Node && help.contains(event.relatedTarget)) && !help.matches(':hover')) help.open = false;
  });
  help.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !help.open) return;
    event.preventDefault();
    help.open = false;
    summary.focus();
  });
  document.addEventListener('click', event => {
    if (event.target instanceof Node && !help.contains(event.target)) help.open = false;
  });
});
