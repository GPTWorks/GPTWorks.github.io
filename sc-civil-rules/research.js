(() => {
  const $ = s => document.querySelector(s);
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let items=[], loaded=false, loadError='', selected=null, draft=null, deleting=null, timer;
  const root = () => $('.rule-text');
  const current = () => window.ruleReader.current;
  const itemLabel = () => window.ruleReader.itemLabel || 'rule';
  const collectionFor = item => item.rule.startsWith('claim-')?'claims':item.rule.startsWith('local-')?'local':item.rule.startsWith('act-')?'act':'rules';
  const routeFor = collection => collection==='claims'?'elements.html':collection==='local'?'greenville.html':collection==='act'?'landlord-tenant-act.html':'index.html';
  const itemHash = item => item.anchor || (collectionFor(item)==='rules'?'rule-':'')+item.rule;
  function notify(message) { $('#notice').textContent=message; clearTimeout(timer);timer=setTimeout(()=>$('#notice').textContent='',5500); }
  function citationFor(parts, full=false) {
    const rule=current().number;
    if(window.ruleReader.collection==='act') {
      const base=`S.C. Code Ann. § ${current().code}`;
      if(full)return base+(parts.some(p=>p.note)?' (including published history and notes)':'')+'.';
      const citations=[...new Set(parts.map(p=>p.note?`${base}, ${p.note}`:base+(p.pin||'')))];
      return (citations.length?citations.join('; '):base)+'.';
    }
    if(window.ruleReader.collection==='local') {
      const pages=[...new Set(parts.flatMap(p=>[p.pin,p.note]).filter(Boolean).map(Number))].sort((a,b)=>a-b);
      if(current().kind==='order')return 'S.C. Supreme Court, Re: Local Rules for Thirteenth Judicial Circuit Courts of Common Pleas, Order (Feb. 13, 2026), PDF p. 1.';
      const memoPages=pages.map(p=>p-1);
      return `Memorandum for Common Pleas Cases, Thirteenth Judicial Circuit, “${current().title},” ${memoPages.length===1?'p.':'pp.'} ${memoPages.join(', ')||current().pdfPage-1} (approved by S.C. Supreme Court order, Feb. 13, 2026).`;
    }
    if(window.ruleReader.collection==='claims') {
      return `Elements of a Civil Claim, “${current().title},” South Carolina Civil Rules site.${current().guide?` Research summary (updated ${current().guide.updated}); see the linked authorities.`:' Claim topics.'} ${new URL('elements.html',location.href).href.split('#')[0]}#${current().number}`;
    }
    if(full) return `Rule ${rule}, SCRCP${parts.some(p=>p.note)?' (including published notes)':''}.`;
    const citations=[];
    for(const part of parts) {
      const value=part.note?`Rule ${rule}, SCRCP, ${part.note}`:`Rule ${rule}${part.pin||''}, SCRCP`;
      if(!citations.includes(value)) citations.push(value);
    }
    return (citations.length?citations.join('; '):`Rule ${rule}, SCRCP`)+'.';
  }
  function cleanFragment(fragment) {
    const wrapper=document.createElement('div');wrapper.append(fragment.cloneNode(true));
    for(const node of wrapper.querySelectorAll('*')) {
      for(const attr of [...node.attributes]) if(!['href','colspan','rowspan'].includes(attr.name)) node.removeAttribute(attr.name);
      if(['A','MARK'].includes(node.tagName)) node.replaceWith(...node.childNodes);
    }
    return wrapper;
  }
  function capture(range,full=false) {
    const article=root();
    if(!article || !article.contains(range.startContainer) || !article.contains(range.endContainer)) return null;
    const before=range.cloneRange();before.selectNodeContents(article);before.setEnd(range.startContainer,range.startOffset);
    const start=before.toString().length,end=start+range.toString().length;
    const walker=document.createTreeWalker(article,NodeFilter.SHOW_TEXT);const parts=[];let offset=0,anchor=window.ruleReader.collection?current().number:'rule-'+current().number;
    while(walker.nextNode()) {
      const node=walker.currentNode,next=offset+node.textContent.length;
      if(next>start && offset<end && node.textContent.slice(Math.max(0,start-offset),Math.min(node.textContent.length,end-offset)).trim()) {
        const p=node.parentElement.closest('[data-pin]');
        if(p) { if(!parts.length) anchor=p.id;parts.push({pin:p.dataset.pin,note:p.dataset.note}); }
      }
      offset=next;
    }
    const fragment=cleanFragment(range.cloneContents());
    const text=range.toString().trim();if(!text) return null;
    return {rule:current().number,passage:text,citation:citationFor(parts,full),anchor,start,end,html:fragment.innerHTML};
  }
  function captureSelection() {
    const selection=window.getSelection();
    if(!selection?.rangeCount || selection.isCollapsed) return null;
    return capture(selection.getRangeAt(0));
  }
  function captureRule() { if(!root()) return null;const range=document.createRange();range.selectNodeContents(root());return capture(range,true); }
  function htmlFor(value) { return `<div style="font-family:Verdana,Arial,sans-serif;font-size:12pt">${value.html||`<p>${escape(value.passage).replace(/\n/g,'<br>')}</p>`}<p>${escape(value.citation)}</p></div>`; }
  function textFor(value) { return value.passage+'\n\n'+value.citation; }
  async function copyValue(value) {
    if(!value) return;
    try {
      if(window.ClipboardItem && navigator.clipboard?.write) await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([textFor(value)],{type:'text/plain'}),'text/html':new Blob([htmlFor(value)],{type:'text/html'})})]);
      else await navigator.clipboard.writeText(textFor(value));
      notify('Copied with citation.');
    } catch { notify('Copy was blocked. Select the passage and use Ctrl+C or your device’s Copy command.'); }
  }
  document.addEventListener('copy',event=> {
    if(event.target.closest?.('input,textarea,[contenteditable="true"]')) return;
    const value=captureSelection();
    if(!value || !event.clipboardData) return;
    event.preventDefault();event.clipboardData.setData('text/plain',textFor(value));event.clipboardData.setData('text/html',htmlFor(value));notify('Copied with citation.');
  });
  document.addEventListener('selectionchange',()=> {
    if(document.querySelector('dialog[open]')) return;
    selected=captureSelection();$('#selection-tools').hidden=!selected;
    if(selected) $('#selection-citation').textContent=selected.citation;
  });
  $('#selection-tools').addEventListener('pointerdown',e=> {if(e.target.closest('button'))e.preventDefault()});
  $('#copy-selection').onclick=()=>copyValue(selected);
  $('#save-selection').onclick=()=>openEditor(selected);
  const addSelected=document.createElement('button');addSelected.id='notepad-selection';addSelected.textContent='Add to notepad';
  addSelected.onclick=()=>{if(selected)window.dispatchEvent(new CustomEvent('notepad-add',{detail:selected}))};
  $('#save-selection').after(addSelected);
  $('#dismiss-selection').onclick=()=>{$('#selection-tools').hidden=true;window.getSelection()?.removeAllRanges();selected=null};
  function onRule() {
    selected=null;$('#selection-tools').hidden=true;
    $('#copy-text').onclick=()=>copyValue(captureRule());
    $('#save-rule').onclick=()=>openEditor(captureRule());
    const add=document.createElement('button');add.id='notepad-section';add.textContent=`Add ${itemLabel()} to notepad`;
    add.onclick=()=>window.dispatchEvent(new CustomEvent('notepad-add',{detail:captureRule()}));
    $('#save-rule').after(add);
    markers();restoreRequested();
  }
  window.addEventListener('rule-rendered',onRule);
  // Saved research lives in this browser (localStorage) so the site needs no account or server.
  const STORE='sc-research-items-v1';
  function readStore(){try{const v=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(v)?v:[]}catch{return []}}
  function writeStore(list){try{localStorage.setItem(STORE,JSON.stringify(list))}catch{throw Error('Your browser blocked saving (storage full or private mode). Download or copy your notes instead.')}}
  async function api(method='GET',value) {
    const list=readStore();
    if(method==='GET') return {items:list};
    if(method==='POST') {
      const now=new Date().toISOString(),old=list.find(i=>i.id===value.id);
      const item={...old,...value,id:value.id||crypto.randomUUID(),tags:value.tags||[],note:value.note||'',created:old?.created||now,updated:now};
      writeStore([item,...list.filter(i=>i.id!==item.id)]);return {item};
    }
    if(method==='DELETE'){writeStore(list.filter(i=>i.id!==value.id));return {ok:true}}
    throw Error('Unsupported action.');
  }
  window.addEventListener('storage',e=>{if(e.key===STORE)loadItems()});
  async function loadItems() {
    try { const result=await api();items=result.items;loaded=true;loadError='';markers(); }
    catch(error) { loadError=error.message; }
    renderSaved();restoreRequested();
  }
  const tags = () => [...new Set(items.flatMap(item=>item.tags))].sort();
  function markers() {
    if(!root() || !current()) return;
    for(const el of root().querySelectorAll('.saved-marker')){el.classList.remove('saved-marker');el.removeAttribute('title')}
    const matches=items.filter(item=>item.rule===current().number);
    for(const item of matches) {
      const el=document.getElementById(item.anchor)||root();el.classList.add('saved-marker');el.title='Saved to research'+(item.tags.length?': '+item.tags.join(', '):'');
    }
    $('#saved-count').textContent=loaded?String(items.length):'';
    const save=$('#save-rule');if(save)save.textContent=matches.length?`Save ${itemLabel()} · ${matches.length} saved`:`Save ${itemLabel()}`;
  }
  function renderSaved() {
    const filter=$('#saved-tag'),previous=filter.value;
    filter.innerHTML='<option value="">All tags</option>'+tags().map(tag=>`<option value="${escape(tag)}">${escape(tag)}</option>`).join('');
    filter.value=tags().includes(previous)?previous:'';
    if(loadError) {$('#research-list').innerHTML=`<p role="alert">${escape(loadError)}</p><button id="retry-research">Try again</button>`;$('#retry-research').onclick=loadItems;return}
    if(!loaded){$('#research-list').innerHTML='<p>Loading your saved research…</p>';return}
    const query=$('#saved-search').value.trim().toLowerCase();
    const found=items.filter(item=>(!filter.value||item.tags.includes(filter.value))&&(!query||[item.rule,item.citation,item.passage,item.note,...item.tags].join(' ').toLowerCase().includes(query)));
    $('#research-list').innerHTML=found.length?`<p class="muted">${found.length} saved item${found.length===1?'':'s'}</p>`+found.map(item=>`<article class="saved-card"><h3>${escape(item.citation)}</h3><p class="saved-excerpt">${escape(item.passage.length>550?item.passage.slice(0,550)+'…':item.passage)}</p><div class="tags">${item.tags.map(tag=>`<button class="tag" data-filter-tag="${escape(tag)}">${escape(tag)}</button>`).join('')}</div>${item.note?`<p class="saved-note"><strong>Your note</strong><br>${escape(item.note)}</p>`:''}<div class="card-actions"><button data-action="open" data-id="${escape(item.id)}">Open passage</button><button data-action="copy" data-id="${escape(item.id)}">Copy with citation</button><button data-action="notepad" data-id="${escape(item.id)}">Add to notepad</button><button data-action="edit" data-id="${escape(item.id)}">Edit tags & note</button><button data-action="delete" data-id="${escape(item.id)}">Remove</button></div></article>`).join(''):`<p class="empty">${items.length?'No saved items match. Try another tag or search.':'Save a rule, claim, local topic, or selected passage to start your collection.'}</p>`;
  }
  $('#open-research').onclick=()=>{$('#research-dialog').showModal();renderSaved();loadItems()};
  $('#saved-search').oninput=renderSaved;$('#saved-tag').onchange=renderSaved;
  function openEditor(value) {
    if(!value)return;
    draft={...value,id:value.id||crypto.randomUUID(),tags:[...(value.tags||[])],note:value.note||''};
    $('#bookmark-title').textContent=value.id?'Edit saved item':'Save to research';
    $('#bookmark-citation').textContent=draft.citation;$('#bookmark-passage').textContent=draft.passage;
    $('#bookmark-tags').value=draft.tags.join(', ');$('#bookmark-note').value=draft.note;$('#bookmark-error').textContent='';
    $('#tag-suggestions').innerHTML=tags().map(tag=>`<button type="button" class="tag" data-suggest-tag="${escape(tag)}">${escape(tag)}</button>`).join('');
    $('#selection-tools').hidden=true;$('#bookmark-dialog').showModal();$('#bookmark-tags').focus();
  }
  $('#tag-suggestions').onclick=e=> { const tag=e.target.closest('[data-suggest-tag]')?.dataset.suggestTag;if(!tag)return;const list=$('#bookmark-tags').value.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean);if(!list.includes(tag))list.push(tag);$('#bookmark-tags').value=list.join(', '); };
  $('#bookmark-form').onsubmit=async event=> {
    event.preventDefault();const button=$('#bookmark-submit');button.disabled=true;$('#bookmark-error').textContent='';
    draft.tags=[...new Set($('#bookmark-tags').value.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean))];draft.note=$('#bookmark-note').value;
    try {
      const {html,...payload}=draft;const result=await api('POST',payload);
      items=[result.item,...items.filter(item=>item.id!==result.item.id)];
      $('#bookmark-dialog').close();notify('Saved to your research.');markers();renderSaved();loadItems();
    } catch(error) {$('#bookmark-error').textContent=error.message} finally {button.disabled=false}
  };
  function restore(item) {
    $('#research-dialog').close();
    const targetCollection=collectionFor(item);
    if(targetCollection!==(window.ruleReader.collection||'rules')) {
      location.href=routeFor(targetCollection)+'?saved='+encodeURIComponent(item.id)+'#'+itemHash(item);
      return;
    }
    if(current()?.number!==item.rule) {
      window.addEventListener('rule-rendered',()=>restoreRange(item),{once:true});location.hash=targetCollection==='rules'?'rule-'+item.rule:item.rule;
    } else restoreRange(item);
  }
  function restoreRequested() {
    const id=new URL(location.href).searchParams.get('saved');
    if(!id || !loaded || !current())return;
    const item=items.find(item=>item.id===id);if(!item)return;
    const url=new URL(location.href);url.searchParams.delete('saved');history.replaceState(null,'',url);
    restore(item);
  }
  function restoreRange(item) {
    const article=root();if(!article)return;
    const walker=document.createTreeWalker(article,NodeFilter.SHOW_TEXT);let offset=0,startNode=null,endNode=null,startOffset=0,endOffset=0;
    while(walker.nextNode()) {
      const node=walker.currentNode,length=node.textContent.length;
      if(startNode===null && item.start<offset+length){startNode=node;startOffset=Math.max(0,item.start-offset)}
      if(item.end<=offset+length){endNode=node;endOffset=Math.max(0,item.end-offset);break}
      offset+=length;
    }
    const anchor=document.getElementById(item.anchor)||article;
    if(startNode&&endNode) {
      const range=document.createRange();range.setStart(startNode,startOffset);range.setEnd(endNode,endOffset);
      if(range.toString().trim()===item.passage.trim()) {const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}
      else notify('Showing the saved location. The saved passage is kept in your research.');
    } else notify('Showing the saved location. The saved passage is kept in your research.');
    anchor.scrollIntoView({block:'center',behavior:'smooth'});
  }
  $('#research-list').onclick=e=> {
    const tag=e.target.closest('[data-filter-tag]');if(tag){$('#saved-tag').value=tag.dataset.filterTag;renderSaved();return}
    const button=e.target.closest('[data-action]');if(!button)return;
    const item=items.find(item=>item.id===button.dataset.id);if(!item)return;
    if(button.dataset.action==='open')restore(item);
    if(button.dataset.action==='copy')copyValue(item);
    if(button.dataset.action==='notepad'){$('#research-dialog').close();window.dispatchEvent(new CustomEvent('notepad-add',{detail:item}));}
    if(button.dataset.action==='edit')openEditor(item);
    if(button.dataset.action==='delete'){deleting=item;$('#delete-error').textContent='';$('#delete-dialog').showModal()}
  };
  $('#confirm-delete').onclick=async()=> {
    const button=$('#confirm-delete');button.disabled=true;
    try {await api('DELETE',{id:deleting.id});items=items.filter(item=>item.id!==deleting.id);$('#delete-dialog').close();renderSaved();markers();notify('Saved item removed.')}catch(error){$('#delete-error').textContent=error.message}finally{button.disabled=false}
  };
  document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>document.getElementById(button.dataset.close).close());
  loadItems();if(root())onRule();
})();
