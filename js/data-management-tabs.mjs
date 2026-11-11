const page = document.getElementById('pageUnitSummary');

if (page) {
  const sections = [
    ['residentContacts', 'Cari Penghuni', '#residentContacts'],
    ['unitChargeCalendar', 'Semakan Caj', '#unitChargeCalendar, .charge-calendar-demo, #chargeExplanationDemo'],
    ['parkingLedgerStatus', 'Penyelarasan Caj', '#parkingLedgerStatus'],
    ['cooldownMaintenancePanel', 'Operasi Cooldown', '#cooldownMaintenancePanel'],
    ['maintenance', 'Penyelenggaraan', '.management-tools'],
    ['danger', 'Padam Data Lama', '.management-danger']
  ];
  const tablist = document.createElement('div');
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Pengurusan Data');
  tablist.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:10px 0';
  page.querySelector('.management-hero').after(tablist);

  const tabs = sections.map(([key, label, selector]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'data-tab-' + key;
    button.textContent = label;
    button.setAttribute('role', 'tab');
    const panel = document.createElement('div');
    panel.id = 'data-panel-' + key;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', button.id);
    button.setAttribute('aria-controls', panel.id);
    const empty = document.createElement('p');
    empty.className = 'small muted';
    empty.textContent = 'Bahagian ini belum tersedia dalam paparan ini.';
    panel.append(empty);
    tablist.append(button);
    page.append(panel);
    return {key, button, panel, selector, empty};
  });

  function select(index, focus = false) {
    tabs.forEach(({button, panel}, position) => {
      const selected = index === position;
      button.setAttribute('aria-selected', String(selected));
      button.className = selected ? 'btn' : 'btn-ghost';
      button.tabIndex = selected ? 0 : -1;
      panel.hidden = !selected;
    });
    if (focus) tabs[index].button.focus();
  }

  tabs.forEach(({button}, index) => {
    button.addEventListener('click', () => select(index));
    button.addEventListener('keydown', event => {
      const destinations = {
        ArrowRight: (index + 1) % tabs.length,
        ArrowLeft: (index + tabs.length - 1) % tabs.length,
        Home: 0,
        End: tabs.length - 1
      };
      if (!Object.hasOwn(destinations, event.key)) return;
      event.preventDefault();
      select(destinations[event.key], true);
    });
  });

  function placeSections() {
    for (const {panel, selector, empty} of tabs) {
      const matches = [...page.querySelectorAll(selector)];
      for (const section of matches) {
        if (section.parentElement !== panel) panel.append(section);
      }
      const hasContent = matches.some(section => !section.hidden);
      if (empty.hidden !== hasContent) empty.hidden = hasContent;
    }
  }

  function selectFromHash() {
    const index = tabs.findIndex(({key}) => location.hash === '#' + key);
    if (index >= 0) select(index);
  }

  select(0);
  selectFromHash();
  placeSections();
  window.addEventListener('hashchange', selectFromHash);
  new MutationObserver(placeSections).observe(page, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['hidden']
  });
}
