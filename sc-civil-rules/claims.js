let claims=[],current=null;
const $=s=>document.querySelector(s);
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const search=$('#search'),library=$('.library');
function terms(){return (search.value.trim().match(/"[^"]+"|\S+/g)||[]).map(t=>t.replace(/^"|"$/g,'').toLowerCase())}
function highlight(value){const text=String(value),query=terms();if(!query.length)return escapeHtml(text);const pattern=query.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).sort((a,b)=>b.length-a.length).join('|');return text.split(new RegExp('('+pattern+')','ig')).map((part,i)=>i%2?'<mark>'+escapeHtml(part)+'</mark>':escapeHtml(part)).join('')}
function searchable(claim){return [claim.ordinal,claim.title,...claim.sections.flatMap(s=>[s.title,...(s.paragraphs||[]),...(s.authorities||[]).map(a=>a.label)])].join(' ').toLowerCase()}
function filterClaims(){
 const query=terms(),found=claims.filter(c=>query.every(t=>searchable(c).includes(t)));
 $('#result-count').textContent=query.length?`${found.length} matching claim${found.length===1?'':'s'}`:`${claims.length} claims · Full index`;
 $('#clear').hidden=!query.length;
 $('#rule-list').innerHTML=found.length?found.map(c=>{
  const matching=query.length?c.sections.find(s=>query.some(t=>[s.title,...(s.paragraphs||[]),...(s.authorities||[]).map(a=>a.label)].join(' ').toLowerCase().includes(t))):null;
  const target=matching&&!query.every(t=>c.title.toLowerCase().includes(t))?matching.id:c.number;
  return `<a class="rule-item ${current?.number===c.number?'active':''}" href="#${target}" ${current?.number===c.number?'aria-current="page"':''}><span class="num">${c.ordinal}</span><span class="name">${highlight(c.title)}</span><span class="excerpt">${matching?highlight(matching.title):c.guide?'Research summary available':'Claim topics'}</span></a>`;
 }).join(''):'<p class="empty">No claims match. Try a shorter phrase or another claim topic.</p>';
}
function markText(root){if(!terms().length)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes){const html=highlight(node.textContent);if(html.includes('<mark>')){const t=document.createElement('template');t.innerHTML=html;node.replaceWith(t.content)}}}
function renderClaim(){
 let hash;try{hash=decodeURIComponent(location.hash)}catch{hash=''}
 const match=hash.match(/^#(claim-\d+)(-section-\d+(?:-p\d+|-authorities)?)?$/),id=match?.[1]||claims[0]?.number;
 const claim=claims.find(c=>c.number===id);
 if(!claim){current=null;$('#rule-content').innerHTML='<p class="empty">That claim is not in this index. Choose a claim from the list.</p>';$('#sections').innerHTML='';return}
 const changed=current?.number!==id;current=claim;
 document.title=`${claim.title} · Elements of a Civil Claim`;
 $('#breadcrumb').textContent='ELEMENTS OF A CIVIL CLAIM';
 const index=claims.indexOf(claim);
 const body=claim.sections.map(s=>`<p id="${s.id}" data-pin="${escapeHtml(s.label)}" data-note="${escapeHtml(s.title)}" class="claim-index-row depth-${s.depth}"><span class="claim-topic"><span class="topic-label">${escapeHtml(s.label)}</span> ${escapeHtml(s.title)}</span></p>${(s.paragraphs||[]).map((p,i)=>`<p id="${s.id}-p${i+1}" data-pin="${escapeHtml(s.label)}" data-note="Research summary" class="claim-guide-paragraph">${escapeHtml(p)}</p>`).join('')}${s.authorities?.length?`<p id="${s.id}-authorities" data-pin="${escapeHtml(s.label)}" data-note="Research authorities" class="claim-authorities"><strong>Authorities</strong>${s.authorities.map(a=>`<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.label)} ↗</a>`).join('')}</p>`:''}`).join('\n');
 $('#rule-content').innerHTML=`<div class="rule-head"><div class="eyebrow">CLAIM ${claim.ordinal} · ${claim.guide?'RESEARCH SUMMARY':'CLAIM TOPICS'}</div><h1>${escapeHtml(claim.title)}</h1><div class="rule-tools"><button id="copy-text">${claim.guide?'Copy summary with source':'Copy index with source'}</button><button id="save-rule">Save claim</button><button id="copy-link">Copy link</button><button id="print">Print</button><span id="copy-status" role="status"></span></div><p class="muted">${claim.guide?escapeHtml(claim.guide.provenance):'Topics only. A research summary has not been added for this claim.'}</p>${claim.guide?'<p class="claim-guide-label">SUMMARY · NOT AUTHORITATIVE TEXT · Updated '+escapeHtml(claim.guide.updated)+'<br>Read the linked opinions and statutes for their full context. This overview does not determine how the law applies to a particular case.</p>':''}</div><article class="rule-text claim-index ${claim.guide?'claim-guide':''}" aria-label="${claim.guide?'Claim research summary and index':'Claim topics'}"><p id="${claim.number}" data-pin="" data-note="${escapeHtml(claim.title)}" class="claim-reference">${escapeHtml(claim.title)}</p>\n${body}</article>${!claim.sections.length?'<p class="muted">No subtopics are listed for this claim.</p>':''}<nav class="page-nav" aria-label="Previous and next claim">${index?`<a href="#${claims[index-1].number}"><small>← Previous claim</small>${escapeHtml(claims[index-1].title)}</a>`:'<span></span>'}${index<claims.length-1?`<a href="#${claims[index+1].number}"><small>Next claim →</small>${escapeHtml(claims[index+1].title)}</a>`:''}</nav>`;
 $('#sections').innerHTML=claim.sections.length?claim.sections.map(s=>`<a href="#${s.id}" class="depth-${s.depth}">${escapeHtml(s.label)} ${escapeHtml(s.title)}</a>`).join(''):'<p class="muted">No subtopics listed.</p>';
 $('#copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('#copy-status').textContent='Link copied'}catch{$('#copy-status').textContent='Copy unavailable. Copy the address from your browser.'}};
 $('#print').onclick=()=>window.print();
 markText($('.claim-index'));filterClaims();
 if(match?.[2])document.getElementById(match[1]+match[2])?.scrollIntoView({block:'start'});else if(changed)window.scrollTo({top:0});
 window.dispatchEvent(new Event('rule-rendered'));
}
search.addEventListener('input',()=>{library.classList.add('expanded');filterClaims()});
search.addEventListener('keydown',e=>{if(e.key==='Enter'){const first=$('#rule-list a');if(first){location.hash=first.hash;library.classList.remove('expanded');renderClaim()}}if(e.key==='Escape'){search.value='';filterClaims();search.blur()}});
$('#clear').onclick=()=>{search.value='';filterClaims();renderClaim();search.focus()};
$('#browse').onclick=()=>{library.classList.toggle('expanded');if(library.classList.contains('expanded')){search.focus();window.scrollTo({top:0})}};
$('#rule-list').addEventListener('click',e=>{const a=e.target.closest('a');if(a){library.classList.remove('expanded');if(a.hash===location.hash)renderClaim()}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();search.focus();library.classList.add('expanded')}});
window.addEventListener('hashchange',renderClaim);
window.ruleReader={get current(){return current},get rules(){return claims},itemLabel:'claim',collection:'claims',renderRule:renderClaim};
fetch('claims.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{claims=data.claims;renderClaim();filterClaims()}).catch(()=>{$('#result-count').textContent='Claims could not load';$('#rule-content').innerHTML='<p class="empty">The claim index could not load. Please reload this page.</p>'});
