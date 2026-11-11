const $ = s => document.querySelector(s);
const meetingList = $('#meetings');
const passwordDialog = $('#passwordDialog');
let password = localStorage.getItem('meeting-app-password') || '';
let passwordRequired = false;
const stages = { queued:'В очереди', downloading:'Получение файла', transcribing:'Распознавание речи', summarizing:'AI-анализ', done:'Готово', error:'Ошибка' };
function headers(extra={}) { return { ...(password ? {'x-app-password': password} : {}), ...extra }; }
async function api(url, options={}) {
  const res = await fetch(url, { ...options, headers: headers(options.headers || {}) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { askPassword(); throw new Error('Требуется пароль приложения.'); }
  if (!res.ok) throw new Error(data.error || `Ошибка запроса (${res.status}).`);
  return data;
}
function askPassword(message='') { $('#passwordError').textContent=message; $('#passwordInput').value=''; if (!passwordDialog.open) passwordDialog.showModal(); }
function notice(message, kind='info') { const el=$('#notice'); el.className=`notice ${kind}`; el.textContent=message; }
function clearNotice(){ $('#notice').className='notice hidden'; }
function dateLabel(value){return new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
function status(m){ const names={queued:'В очереди',downloading:'Получение файла',transcribing:'Распознавание речи',summarizing:'AI-анализ',done:'Готово',error:'Ошибка'}; return `<span class="status ${m.status==='done'?'done':m.status==='error'?'error':'active'}"><i></i>${names[m.stage]||names[m.status]||'Обрабатывается'}</span>`; }
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function listBlock(items, render=x=>esc(x)) { return items?.length ? `<ul>${items.map(x=>`<li>${render(x)}</li>`).join('')}</ul>` : '<p>Не выявлено</p>'; }
function card(m){
  const summary=m.summary;
  const summaryHtml=summary?`<div class="summary-grid"><div class="summary-block"><h3>Краткое содержание</h3><p>${esc(summary.summary)}</p></div><div class="summary-block"><h3>Решения</h3>${listBlock(summary.decisions)}</div><div class="summary-block"><h3>Задачи</h3>${listBlock(summary.tasks,t=>`${esc(t.text)}${t.owner?` · ${esc(t.owner)}`:''}${t.due?` · ${esc(t.due)}`:''}`)}</div><div class="summary-block"><h3>Открытые вопросы</h3>${listBlock(summary.questions)}</div></div><details class="transcript"><summary>Полная расшифровка</summary><p>${esc(m.transcript)}</p></details>`:'';
  return `<article class="meeting" data-id="${esc(m.id)}"><div class="meeting-head"><div class="meeting-name">${esc(m.name)} <span class="source">${m.source==='cloud'?'Из облака':'Загружено вручную'}</span></div><span class="meeting-date">${dateLabel(m.createdAt)}</span>${status(m)}<span class="chevron">⌄</span></div><div class="meeting-detail">${m.error?`<div class="meeting-error">${esc(m.error)}<br><br>Исправьте причину и загрузите эту запись ещё раз.</div>`:''}${summaryHtml||''}${!summary&&!m.error?'<p class="source-line">Задача сохранена. Этап обновится автоматически.</p>':''}</div></article>`;
}
async function refresh(manual=false){
  const button=$('#refresh');
  if(manual){button.disabled=true;button.innerHTML='Обновляем… <span>↻</span>';clearNotice();}
  try {
    const list=await api('/api/meetings',{cache:'no-store'});
    $('#count').textContent=list.length;
    $('#empty').classList.toggle('hidden',list.length>0);
    meetingList.innerHTML=list.map(card).join('');
    if(manual)notice(`Список обновлён. Встреч: ${list.length}.`,'info');
    return true;
  } catch(e) {
    if(manual||!passwordRequired)notice(e.message,'error');
    return false;
  } finally {
    if(manual){button.disabled=false;button.innerHTML='Обновить <span>↻</span>';}
  }
}
meetingList.addEventListener('click',e=>{const head=e.target.closest('.meeting-head');if(head)head.closest('.meeting').classList.toggle('open');});
$('#refresh').addEventListener('click',()=>refresh(true));
const drop=$('#dropzone'), fileInput=$('#video');
drop.addEventListener('click',()=>fileInput.click());
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag');});
drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag');if(e.dataTransfer.files[0]){fileInput.files=e.dataTransfer.files;updateFile();}});
fileInput.addEventListener('change',updateFile);
function updateFile(){const f=fileInput.files[0];const start=$('#localStart');if(f){drop.querySelector('strong').textContent=f.name;start.disabled=false;}else{drop.querySelector('strong').textContent='Перетащите файл сюда';start.disabled=true;}}
$('#uploadForm').addEventListener('submit',async e=>{
  e.preventDefault(); const file=fileInput.files[0]; if(!file)return notice('Сначала выберите видеофайл.','error');
  if(!/\.(mp4|webm)$/i.test(file.name))return notice('Поддерживаются только файлы MP4 и WebM.','error');
  const button=e.submitter;button.disabled=true;button.firstChild.textContent='Загружаем…';clearNotice();
  try{const form=new FormData();form.append('video',file);const m=await api('/api/upload',{method:'POST',body:form});fileInput.value='';updateFile();await refresh();document.querySelector(`[data-id="${m.id}"]`)?.classList.add('open');notice('Файл принят. Обработка началась автоматически.','info');}
  catch(err){notice(err.message,'error');}finally{button.disabled=!fileInput.files[0];button.innerHTML='Запустить анализ <span aria-hidden="true">▶</span>'; }
});
$('#cloudForm').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;button.firstChild.textContent='Получаем файл…';clearNotice();
  try{const m=await api('/api/cloud',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:$('#cloudUrl').value})});$('#cloudUrl').value='';await refresh();document.querySelector(`[data-id="${m.id}"]`)?.classList.add('open');notice(m.duplicate?'Такая ссылка уже добавлена. Открыта существующая встреча.':'Ссылка принята. Файл будет загружен и обработан автоматически.','info');}
  catch(err){notice(err.message,'error');}finally{button.disabled=false;button.innerHTML='Запустить анализ <span aria-hidden="true">▶</span>'; }
});
$('#settings').addEventListener('click',()=>askPassword());
$('#passwordForm').addEventListener('submit',async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();password=$('#passwordInput').value;localStorage.setItem('meeting-app-password',password);clearNotice();$('#passwordError').textContent='';const accepted=await refresh();if(accepted)passwordDialog.close();else{password='';localStorage.removeItem('meeting-app-password');$('#passwordError').textContent='Пароль не принят или сервер временно недоступен.';}});
async function init(){try{const cfg=await fetch('/api/config').then(r=>r.json());passwordRequired=cfg.passwordRequired;$('#fileLimit').textContent=`${Math.round(cfg.maxVideoBytes/1024/1024)} МБ`;if(!cfg.proEnabled)$('#cloudForm').hidden=true;$('#serviceStatus').textContent=cfg.passwordRequired?'Доступ защищён паролем':'Серверная настройка проверяется при обработке';if(passwordRequired&&!password)askPassword();await refresh();}catch{$('#serviceStatus').textContent='Сервер не отвечает';}}
init();setInterval(refresh,2500);
