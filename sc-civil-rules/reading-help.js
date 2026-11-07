(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const link = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>`;
  let guidesPromise, actPromise, renderVersion = 0, lookupVersion = 0;
  function getJSON(url) { return fetch(url).then(r => {if (!r.ok) throw Error('Unavailable'); return r.json()}); }
  function getAct() { return actPromise ||= getJSON('act.json').catch(e => {actPromise=null;throw e}); }
  async function fingerprint(item) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(item)));
    return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2,'0')).join('');
  }
  async function addGuide() {
    const version=++renderVersion, reader=window.ruleReader, item=reader?.current;
    const collection=reader?.collection || 'rules';
    if (!item || !['rules','act'].includes(collection) || !$('.rule-text')) return;
    $('#plain-language')?.remove();
    const panel=document.createElement('details');panel.id='plain-language';panel.className='reading-guide';
    panel.innerHTML='<summary>Plain-language guide <span>Read alongside the original</span></summary><div class="guide-body" aria-live="polite"><p>Loading the guide…</p></div>';
    $('.rule-text').before(panel);
    const original=$('.rule-text');original.id='original-text';original.tabIndex=-1;
    const label=document.createElement('p');label.className='original-label';label.textContent='ORIGINAL TEXT · DATED OFFICIAL COPY';original.before(label);
    try {
      const data=await (guidesPromise ||= getJSON('reading-guides.json').catch(e=>{guidesPromise=null;throw e}));
      const guide=data[collection]?.[item.number];
      if (!guide || await fingerprint(item)!==guide.sourceHash) throw Error('Changed');
      if(version!==renderVersion || !panel.isConnected)return;
      const citation=collection==='act'?`S.C. Code Ann. § ${item.code}`:`Rule ${item.number}, SCRCP`;
      const source=collection==='act'?'https://www.scstatehouse.gov/code/t27c040.php':item.url;
      const edition=collection==='act'?'September 13, 2026':'September 8–9, 2026';
      panel.querySelector('.guide-body').innerHTML=`<p class="guide-status">READING AID · NOT THE LAW</p><h2>${esc(citation)} in plain language</h2><p>${esc(guide.meaning)}</p><h3>Conditions to check</h3><p>${esc(guide.conditions)}</p><div class="guide-boundary"><p>This is a short, AI-assisted overview, not a complete restatement or a court’s interpretation. It does not decide how the law applies to your facts. The original wording, applicable law, and controlling court decisions govern; this guide can contain errors or omit details.</p><p>Based on this site’s text retrieved ${edition}. Prepared October 7, 2026. Check the current official source before relying on a requirement or deadline.</p></div><div class="guide-actions"><a href="#original-text" id="read-original">Read original text below ↓</a>${link(source,'Check official source')}</div>`;
      $('#read-original').onclick=e=>{e.preventDefault();original.scrollIntoView({block:'start'});original.focus({preventScroll:true})};
    } catch (e) {
      if(version!==renderVersion || !panel.isConnected)return;
      panel.querySelector('.guide-body').innerHTML=`<p>${e.message==='Changed'?'This guide is unavailable because it has not been matched to this version of the text.':'The guide could not load. Reload to try again.'} Read the original text below and check the official source.</p>`;
    }
  }
  // A separate dialog keeps dictionary material outside the verbatim text and citation tools.
  const dialog=document.createElement('dialog');dialog.id='dictionary-dialog';dialog.setAttribute('aria-labelledby','dictionary-title');
  dialog.innerHTML=`<div class="dialog-heading"><h2 id="dictionary-title">Legal dictionary</h2><button id="close-dictionary" aria-label="Close legal dictionary">×</button></div><p class="muted">Look up the exact word or phrase you are reading. A definition is context dependent; a statute’s own definition may differ from a general dictionary.</p><form id="dictionary-form"><label for="dictionary-term">Exact word or phrase</label><div class="dictionary-input"><input id="dictionary-term" maxlength="120" required autocomplete="off" placeholder="e.g., good faith, rent, estoppel"><button type="submit" class="primary">Look up</button></div></form><div id="dictionary-results" aria-live="polite"></div><section class="dictionary-source"><span class="eyebrow">RECOGNIZED LEGAL REFERENCE</span><h3>Black’s Law Dictionary</h3><p>The publisher describes Black’s as the most cited legal dictionary. The current print edition is the 12th. Online definitions are available through licensed Westlaw access; they are not reproduced here.</p><p>Copy your term, then in Westlaw choose <strong>Secondary Sources → Tools &amp; Resources → Black’s Law Dictionary</strong> and paste it into the <strong>Dictionary Term</strong> field. Check the entry’s sense, edition, and cited authority.</p><div class="dictionary-actions">${link('https://legal.thomsonreuters.com/en/products/law-books/blacks-law-dictionary','Black’s official access')}${link('https://www.thomsonreuters.com/en-us/help/westlaw-edge/secondary-sources/search-blacks-law-dictionary','Westlaw lookup instructions')}</div></section><section class="dictionary-source"><span class="eyebrow">FREE ALTERNATIVE</span><h3>Cornell Wex</h3><p>Cornell Law School’s Legal Information Institute offers this free legal dictionary and encyclopedia. Copy your term, open Wex search, and paste it into the Title field. Wex is a separate reference, not Black’s, and its general entries may discuss other jurisdictions.</p>${link('https://www.law.cornell.edu/search/wex','Open Wex search')}</section><p class="dictionary-context">Use a dictionary to understand terminology. It does not override statutory definitions, the full rule, or controlling South Carolina decisions.</p>`;
  if(window.ruleReader?.collection==='claims') {
    dialog.querySelector('.dictionary-source').remove();
    const free=dialog.querySelector('.dictionary-source');
    free.querySelector('.eyebrow').textContent='FREE LEGAL DEFINITIONS';
    free.querySelector('p').textContent='Cornell Law School’s Legal Information Institute offers free legal definitions. Copy your term, open Wex search, and paste it into the Title field. General entries may discuss other jurisdictions.';
  }
  document.body.append(dialog);
  const openButton=document.createElement('button');openButton.id='open-dictionary';openButton.textContent='Legal dictionary';
  ($('.header-actions') || $('header')).append(openButton);
  function openDictionary(term='') {
    ++lookupVersion;
    $('#dictionary-term').value=term;$('#dictionary-results').replaceChildren();
    dialog.showModal();$('#dictionary-term').focus();if(term) lookup();
  }
  openButton.onclick=()=>openDictionary();$('#close-dictionary').onclick=()=>dialog.close();
  const normalize=s=>s.trim().toLowerCase().replace(/[“”"‘’]/g,'').replace(/\s+/g,' ');
  async function lookup() {
    const version=++lookupVersion,term=$('#dictionary-term').value.trim();
    if(!term)return;
    const results=$('#dictionary-results');results.innerHTML=`<div class="lookup-term"><strong>${esc(term)}</strong><button id="copy-term" type="button">Copy exact term</button><span id="term-status" role="status"></span></div><div id="statutory-definition"><p>Checking the Act’s defined terms…</p></div>`;
    $('#copy-term').onclick=async()=>{try{await navigator.clipboard.writeText(term);$('#term-status').textContent='Copied — paste into your dictionary search.'}catch{$('#term-status').textContent='Select the term above and copy it manually.'}};
    try {
      const act=await getAct();if(version!==lookupVersion)return;
      const defs=act.sections.find(s=>s.code==='27-40-210');
      const match=defs.paragraphs.find(p=>normalize(p.text.match(/^\(\d+\)\s*"([^"]+)"/)?.[1]||'')===normalize(term));
      const notice=['notice','notifies','gives','receives','knows','has knowledge'].includes(normalize(term));
      const target=$('#statutory-definition');
      if(match)target.innerHTML=`<h3>Exact defined term in the SC Act</h3><p class="muted">Verbatim statutory definition · not a dictionary paraphrase</p><p>${esc(defs.paragraphs[0].text)}</p><blockquote>${esc(match.text)}</blockquote><a href="landlord-tenant-act.html#${esc(match.id)}">S.C. Code Ann. § 27-40-210${esc(match.pin)} →</a><p class="muted">Applies within this Act, subject to its context and additional definitions. Retrieved September 13, 2026; ${link(act.source.url,'check current official text')}.</p>`;
      else target.innerHTML=`<p>No exact defined-term match in § 27-40-210 for <strong>${esc(term)}</strong>. This does not mean the term has no legal definition.</p>${notice?'<p>Notice-related meanings appear in <a href="landlord-tenant-act.html#act-27-40-240">§ 27-40-240 →</a>.</p>':''}<p>Use Black’s or Cornell Wex below. Multiword definitions are not inferred from individual words.</p>`;
      target.querySelectorAll('a[href^="landlord-tenant-act.html"]').forEach(a=>a.addEventListener('click',()=>dialog.close()));
    } catch {if(version===lookupVersion)$('#statutory-definition').innerHTML='<p>The statutory definitions could not load. Check <a href="landlord-tenant-act.html#act-27-40-210">§ 27-40-210</a> or use the dictionary links below.</p>'}
  }
  $('#dictionary-form').onsubmit=e=>{e.preventDefault();lookup()};
  const tools=$('#selection-tools');
  if(tools){
    const button=document.createElement('button');button.id='define-selection';button.textContent='Define word / phrase';tools.insertBefore(button,$('#dismiss-selection'));
    button.onclick=()=>{const term=window.getSelection()?.toString().trim()||'';if(term.length>120){openDictionary();$('#dictionary-results').textContent='Choose a word or short phrase (up to 120 characters), rather than an entire passage.'}else openDictionary(term)};
  }
  window.addEventListener('rule-rendered',addGuide);if(window.ruleReader?.current)addGuide();
})();
