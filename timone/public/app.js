/* Timone's guide: a daily checklist, the optional real photo, and the
   service worker that makes the whole thing work with no signal. */

(function () {
  'use strict';

  /* --------------------------------------------------------------- tabs --
     Three short pages instead of one long scroll. The hash keeps the tab
     across a reload, and with no JS at all every panel is simply visible. */

  var TABS = ['routine', 'food', 'contacts'];
  var links = Array.prototype.slice.call(document.querySelectorAll('.tabbar a'));

  function show(name, scroll) {
    if (TABS.indexOf(name) === -1) name = TABS[0];
    TABS.forEach(function (id) {
      var panel = document.getElementById(id);
      if (panel) panel.hidden = id !== name;
    });
    links.forEach(function (link) {
      link.setAttribute('aria-selected', String(link.hash === '#' + name));
    });
    if (scroll) window.scrollTo(0, 0);
  }

  links.forEach(function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      var name = link.hash.slice(1);
      if (history.replaceState) history.replaceState(null, '', link.hash);
      else location.hash = link.hash;
      show(name, true);
    });
  });

  window.addEventListener('hashchange', function () {
    show(location.hash.slice(1), true);
  });

  show(location.hash.slice(1) || TABS[0], false);

  /* ------------------------------------------------- today's checklist --
     Saved on this phone only, and keyed by the date so it starts empty
     every morning. */

  var KEY = 'timone:checklist';
  var boxes = Array.prototype.slice.call(
    document.querySelectorAll('.check input[type=checkbox]'),
  );

  function today() {
    var d = new Date();
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function read() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      return saved.date === today() && saved.tasks ? saved.tasks : {};
    } catch (e) {
      return {};
    }
  }

  function write(tasks) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ date: today(), tasks: tasks }));
    } catch (e) {
      /* private mode, a full disk — the guide still reads fine without it */
    }
  }

  function paint() {
    var tasks = read();
    boxes.forEach(function (box) {
      box.checked = !!tasks[box.dataset.task];
    });
  }

  boxes.forEach(function (box) {
    box.addEventListener('change', function () {
      var tasks = read();
      tasks[box.dataset.task] = box.checked;
      write(tasks);
    });
  });

  var reset = document.getElementById('reset');
  if (reset) {
    reset.addEventListener('click', function () {
      write({});
      paint();
    });
  }

  paint();
  // A phone that sat in a pocket overnight should come back to a clean list.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) paint();
  });

  /* -------------------------------------------------------------- offline */

  var state = document.getElementById('offline-state');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker
        .register('sw.js')
        .then(function () {
          return navigator.serviceWorker.ready;
        })
        .then(function () {
          if (state) state.textContent = 'Saved to this phone — the whole guide works with no signal.';
        })
        .catch(function () {
          /* keep the static text */
        });
    });
  }
})();
