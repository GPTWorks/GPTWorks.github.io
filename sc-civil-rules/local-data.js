/* Lets the site work when opened straight from disk (file://), where browsers block fetch() of local JSON.
   On a normal web server this does nothing and the .json files load as usual. */
(() => {
  if (!crypto.randomUUID) crypto.randomUUID = () => '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
  if (location.protocol !== 'file:') return;
  const native = window.fetch.bind(window), pending = {};
  window.SC_DATA = window.SC_DATA || {};
  function bundle(name) {
    if (window.SC_DATA[name]) return Promise.resolve(window.SC_DATA[name]);
    return pending[name] ||= new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'data/' + name.replace(/\.json$/, '.js');
      s.onload = () => window.SC_DATA[name] ? resolve(window.SC_DATA[name]) : reject(Error('Missing data'));
      s.onerror = () => { delete pending[name]; reject(Error('Could not load ' + name)); };
      document.head.append(s);
    });
  }
  window.fetch = (input, init) => {
    const url = String(input && input.url || input), m = url.match(/(?:^|\/)([a-z-]+\.json)(?:[?#].*)?$/);
    if (!m) return native(input, init);
    return bundle(m[1]).then(data => new Response(JSON.stringify(data), {status: 200, headers: {'Content-Type': 'application/json'}}));
  };
})();
