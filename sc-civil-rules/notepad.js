(() => {
  const $=s=>document.querySelector(s);
  let ready=false,revision=0,scope='',dirty=false,busy=false,conflict=null,timer,loading=null,pending=[],lastFocus;
  const panel=document.createElement('aside');panel.id='argument-notepad';panel.hidden=true;panel.setAttribute('aria-labelledby','notepad-title');
  panel.innerHTML=`<div class="notepad-heading"><div><span class="eyebrow">YOUR WORKSPACE</span><h2 id="notepad-title">Argument notepad</h2></div><button id="notepad-close" aria-label="Close argument notepad">×</button></div><p class="notepad-help">Collect passages with citations, then write your argument around them. Your draft saves automatically.</p><div id="notepad-conflict" hidden><p>This draft changed in another tab. Your edits are still below.</p><details><summary>View the saved version</summary><textarea id="notepad-remote" readonly aria-label="Saved version"></textarea></details><div class="notepad-actions"><button id="notepad-use-saved">Use saved version</button><button id="notepad-keep-mine">Save my version instead</button></div></div><label class="visually-hidden" for="notepad-text">Your argument draft</label><textarea id="notepad-text" disabled spellcheck="true" placeholder="Write your argument here…\n\nHighlight a passage and choose Add to notepad, or copy with citation and paste here."></textarea><div class="notepad-footer"><p id="notepad-status" role="status" aria-live="polite">Loading your draft…</p><span id="notepad-count"></span><div class="notepad-actions"><button id="notepad-save" disabled>Save now</button><button id="notepad-copy">Copy draft</button><button id="notepad-download">Download .txt</button></div></div>`;
  document.body.append(panel);
  const editor=$('#notepad-text'),status=$('#notepad-status');
  const openButton=document.createElement('button');openButton.id='open-notepad';openButton.textContent='Argument notepad';openButton.setAttribute('aria-controls',panel.id);openButton.setAttribute('aria-expanded','false');
  let actions=$('.header-actions');if(!actions){actions=document.createElement('div');actions.className='header-actions';$('header').append(actions)}actions.append(openButton);
  const floating=openButton.cloneNode(true);floating.id='notepad-floating';floating.textContent='✎ Argument notepad';document.body.append(floating);
  const say=text=>{status.textContent=text};
  function count(){$('#notepad-count').textContent=editor.value.length.toLocaleString()+' characters'}
  function preference(value){try{localStorage.setItem('sc-argument-notepad-open',value?'1':'0')}catch{}}
  function open(focus=true){lastFocus=document.activeElement;panel.hidden=false;floating.hidden=true;document.body.classList.add('notepad-open');openButton.setAttribute('aria-expanded','true');preference(true);if(!ready)load();if(focus)editor.focus()}
  function close(){panel.hidden=true;floating.hidden=false;document.body.classList.remove('notepad-open');openButton.setAttribute('aria-expanded','false');preference(false);if(dirty&&!conflict)save();(lastFocus?.isConnected?lastFocus:openButton).focus()}
  openButton.onclick=()=>panel.hidden?open():close();floating.onclick=()=>open();$('#notepad-close').onclick=close;
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close()}});
  const key=()=>scope?'sc-argument-notepad-draft:'+scope:null;
  function cache(){if(!key())return false;try{localStorage.setItem(key(),JSON.stringify({text:editor.value,revision}));return true}catch{return false}}
  function clearCache(text){if(!key())return;try{const old=JSON.parse(localStorage.getItem(key())||'null');if(old?.text===text)localStorage.removeItem(key())}catch{}}
  function showConflict(saved){conflict=saved;$('#notepad-conflict').hidden=false;$('#notepad-remote').value=saved.text;say('Choose which version to save. Your edits have not been overwritten.');$('#notepad-save').disabled=true}
  function changed(){dirty=true;cache();count();if(conflict)return;say('Unsaved changes…');clearTimeout(timer);timer=setTimeout(save,600)}
  editor.addEventListener('input',changed);
  // Local-only draft: saved in this browser. Revisions detect edits made in another tab.
  const DRAFT='sc-argument-notepad-v1';
  function readSaved(){try{const v=JSON.parse(localStorage.getItem(DRAFT)||'null');if(v&&typeof v.text==='string'&&Number.isSafeInteger(v.revision))return v}catch{}return {text:'',revision:0}}
  async function load(){
    scope='local';const data=readSaved();revision=data.revision;editor.value=data.text;ready=true;editor.disabled=false;
    $('#notepad-save').disabled=false;$('#notepad-save').textContent='Save now';say(data.revision?'Saved in this browser.':'New draft · saves automatically in this browser.');
    let local;try{local=JSON.parse(localStorage.getItem(key())||'null')}catch{}
    if(local&&typeof local.text==='string'&&Number.isSafeInteger(local.revision)&&local.text!==data.text){
      editor.value=local.text;dirty=true;if(local.revision!==data.revision)showConflict(data);else{say('Recovered unsaved draft. Saving…');save()}
    }else clearCache(data.text);
    count();for(const quote of pending.splice(0))insert(quote);
  }
  async function save(){
    clearTimeout(timer);if(!ready)return load();if(busy||!dirty||conflict)return;
    if(editor.value.length>200000){say('Draft exceeds 200,000 characters. Download it before shortening it.');return}
    busy=true;const text=editor.value;
    try{
      const saved=readSaved();
      if(saved.revision!==revision&&saved.text!==text){showConflict(saved);return}
      const next={text,revision:saved.revision+1,updated:new Date().toISOString()};
      localStorage.setItem(DRAFT,JSON.stringify(next));revision=next.revision;dirty=editor.value!==text;
      if(dirty){cache();timer=setTimeout(save,0)}else{clearCache(text);say('Saved in this browser · '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}));$('#notepad-save').textContent='Save now'}
    }catch(error){say('Could not save in this browser (storage may be full or blocked). Your text is still here — use Download .txt.');cache()}
    finally{busy=false}
  }
  window.addEventListener('storage',e=>{
    if(e.key!==DRAFT||!ready)return;const saved=readSaved();if(saved.revision===revision)return;
    if(!dirty){editor.value=saved.text;revision=saved.revision;count();say('Updated from another tab.')}
    else if(saved.text!==editor.value)showConflict(saved);
  });
  $('#notepad-save').onclick=()=>ready?save():load();
  $('#notepad-use-saved').onclick=()=>{const discarded=editor.value;editor.value=conflict.text;revision=conflict.revision;dirty=false;conflict=null;$('#notepad-conflict').hidden=true;$('#notepad-save').disabled=false;clearCache(discarded);count();say('Saved version restored.')};
  $('#notepad-keep-mine').onclick=()=>{revision=conflict.revision;conflict=null;$('#notepad-conflict').hidden=true;$('#notepad-save').disabled=false;dirty=true;cache();save()};
  function insert(value){
    if(!value?.passage||!value?.citation)return;
    if(!ready){pending.push(value);return}
    const collection=value.rule.startsWith('claim-')?'elements':value.rule.startsWith('local-')?'greenville':value.rule.startsWith('act-')?'landlord-tenant-act':'';
    const anchor=value.anchor||(collection?value.rule:'rule-'+value.rule);
    const block=value.passage+'\n\n'+value.citation+'\nSource: '+new URL((collection?collection+'.html':'index.html'),location.href).href.split('#')[0]+'#'+anchor;
    // Adding a passage appends it, so no selected draft text is accidentally replaced.
    editor.value+=(editor.value.trim()?'\n\n':'')+block+'\n\n';changed();editor.focus();editor.setSelectionRange(editor.value.length,editor.value.length);editor.scrollTop=editor.scrollHeight;
  }
  window.addEventListener('notepad-add',e=>{open(false);insert(e.detail)});
  $('#notepad-copy').onclick=async()=>{try{await navigator.clipboard.writeText(editor.value);say(dirty?'Draft copied. Changes still need to save.':'Draft copied.')}catch{editor.focus();editor.select();say('Draft selected. Press Ctrl+C or use your device’s Copy command.')}};
  $('#notepad-download').onclick=()=>{const url=URL.createObjectURL(new Blob([editor.value],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='legal-argument.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  window.addEventListener('pagehide',()=>{if(dirty){cache();save()}});
  window.addEventListener('beforeunload',e=>{if(dirty&&!cache()){e.preventDefault();e.returnValue=''}});
  window.addEventListener('online',()=>{if(dirty&&!conflict)save()});
  load();try{if(localStorage.getItem('sc-argument-notepad-open')==='1')open(false)}catch{}
})();
