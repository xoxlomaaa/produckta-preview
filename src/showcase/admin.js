import {bikes, storageKey, statusLabels, sourceLabels, demoClock} from './admin-data.js';
import {minutes, money, bikeById, freshBookings, totalOf, validateBooking, validateIssue, restoreBookings} from './rental-model.js';
import {initRentalPickers} from './rental-pickers.js';
import {controlIcon} from '../js/control-icon.js';

export function initAdmin(root) {
  if (root.dataset.initialized) return () => {};
  root.dataset.initialized = 'true';
  const life = new AbortController();
  const $ = hook => root.querySelector(`[data-rental-${hook}]`);
  const rows = root.querySelector('[data-admin-rows]');
  const dialog = $('dialog'), form = $('form');
  const workspace=$('workspace'), overlay=$('overlay');
  const rental=root.querySelector('.rental');
  const field = name => form.elements.namedItem(name);
  let records = freshBookings();
  try { records = restoreBookings(JSON.parse(sessionStorage.getItem(storageKey))); } catch { /* In-memory fallback. */ }
  let filter='all', source='all', query='', currentId=null, action='view', opener=null;
  const listen = (target, event, handler) => target.addEventListener(event,handler,{signal:life.signal});
  const node = (tag, className, text) => {
    const element=document.createElement(tag);
    if(className)element.className=className;
    if(text!==undefined)element.textContent=String(text);
    return element;
  };
  const save = () => { try {sessionStorage.setItem(storageKey,JSON.stringify(records));} catch { /* Current page retains state. */ } };
  const announce = text => {$('announcement').textContent=text;};
  const summary = () => records.filter(item=>(filter==='all'||item.status===filter)&&(source==='all'||item.source===source)&&`${item.id} ${item.guest} ${item.phone} ${item.bike}`.toLocaleLowerCase('ru').includes(query));
  field('bike').replaceChildren();
  for (const bike of bikes) {
    const option=node('option','',`${bike.name} · ${bike.id} · ${money(bike.rate)}/час`);
    option.value=bike.id;field('bike').append(option);
  }
  const pickers=initRentalPickers(dialog);
  function measurePopup() {
    if(!dialog.open)return;
    const scale=Number.parseFloat(getComputedStyle(dialog).zoom)||1;
    rental.style.setProperty('--rental-popup-space',`${Math.ceil(dialog.offsetHeight*scale+32)}px`);
  }
  const popupSize=new ResizeObserver(measurePopup);
  popupSize.observe(dialog);

  function render() {
    const items=summary(), fragment=document.createDocumentFragment();
    for(const record of items) {
      const bike=bikeById(record.bike), row=node('li','rental-row');
      row.dataset.recordId=record.id;
      const guest=node('div','rental-guest'), identity=node('div','rental-row-identity');
      identity.append(node('strong','',record.guest),node('small','',record.id));
      const channel=node('span','rental-source',sourceLabels[record.source]);channel.dataset.source=record.source;
      const icon=node('i','rental-source-icon');icon.dataset.sourceIcon=record.source;channel.prepend(icon);
      guest.append(identity,channel);
      const bicycle=node('div','rental-bicycle');bicycle.append(node('strong','',`${bike.name} · ${bike.id}`),node('small','',`${record.start} — ${record.end}`));
      const payment=node('div','rental-row-payment');
      const state=node('span','rental-state',statusLabels[record.status]);state.dataset.status=record.status;
      const due=Math.max(0,totalOf(record)-record.paid);
      payment.append(state,node('small','',due?`К оплате ${money(due)}`:`Оплачено ${money(record.paid)}`));
      if(record.status==='rented'&&minutes(record.end)<demoClock) payment.append(node('span','rental-overdue',`Возврат задержан на ${demoClock-minutes(record.end)} мин`));
      const actions=node('div','rental-row-actions');
      const detail=node('button','rental-open','Открыть');detail.type='button';detail.dataset.rentalOpen=record.id;detail.setAttribute('aria-label',`Открыть бронь ${record.id}`);
      actions.append(detail);
      if(record.status!=='returned') {
        const cta=node('button','rental-row-cta');
        const arrow=controlIcon('arrow','rental-action-arrow');
        cta.append(node('span','',record.status==='reserved'?'Выдать':'Возврат'),arrow);
        cta.type='button';cta.dataset.rentalAction=record.id;
        cta.setAttribute('aria-label',`${record.status==='reserved'?'Выдать велосипед по брони':'Принять возврат по брони'} ${record.id}`);
        actions.append(cta);
      }
      row.append(guest,bicycle,payment,actions);fragment.append(row);
    }
    rows.replaceChildren(fragment);
    root.querySelector('[data-admin-empty]').hidden=items.length>0;
    root.querySelector('[data-admin-counter]').textContent=`Показано ${items.length} из ${records.length} броней`;
    root.querySelectorAll('[data-rental-stat]').forEach(element=>{element.textContent=records.filter(record=>record.status===element.dataset.rentalStat).length;});
    const overdue=records.filter(record=>record.status==='rented'&&minutes(record.end)<demoClock).length;
    $('overdue').textContent=overdue?`${overdue} ожидает возврата после срока`:'Все возвращаются по плану';
    root.querySelectorAll('[data-source-count]').forEach(element=>{element.textContent=element.dataset.sourceCount==='all'?records.length:records.filter(record=>record.source===element.dataset.sourceCount).length;});
    root.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===filter)));
    root.querySelectorAll('button[data-source]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.source===source)));
  }

  function draft() {
    return {id:currentId,guest:field('guest').value.trim(),phone:field('phone').value.trim(),bike:field('bike').value,start:field('start').value,end:field('end').value,source:field('source').value,paid:Number(field('payment').value)};
  }
  function quote() {
    const record=draft(), total=totalOf(record), valid=Number.isFinite(total)&&total>0;
    $('quote').textContent=valid?money(total):'Выберите срок';
    const previous=records.find(item=>item.id===currentId), paid=action==='return'?(previous?.paid||0)+record.paid:record.paid;
    const due=valid?Math.max(0,total-paid):0;
    $('balance').textContent=valid?(due?`Останется к оплате ${money(due)}`:'Стоимость проката оплачена'):'Прокат — от 200 ₽/час, округление до полного часа.';
  }
  function show(id, trigger) {
    const record=records.find(item=>item.id===id);
    if(!record)return;
    pickers.close();
    opener=trigger||document.activeElement;
    currentId=record.id;
    action=record.status==='reserved'?'issue':record.status==='rented'?'return':'view';
    form.reset();
    for(const element of form.elements)element.disabled=false;
    const values=record;
    for(const key of ['guest','phone','bike','start','end','source'])field(key).value=values[key];
    field('payment').value=action==='return'?Math.max(0,totalOf(record)-record.paid):values.paid;
    const locked=action==='return'||action==='view';
    for(const key of ['guest','phone','bike','start','end','source'])field(key).disabled=locked;
    field('source').disabled=Boolean(record);
    field('payment').disabled=action==='view';
    $('dialog-title').textContent={issue:'Выдать велосипед',return:'Принять возврат',view:'Прокат завершён'}[action];
    $('dialog-kicker').textContent='Карточка бронирования';
    $('payment-label').textContent=action==='return'?'Доплата при возврате, ₽':action==='issue'?'Всего оплачено, ₽':'Предоплата, ₽';
    $('record-strip').hidden=!record;
    if(record){$('record-id').textContent=record.id;$('record-source').textContent=`Источник: ${sourceLabels[record.source]}`;$('record-status').textContent=statusLabels[record.status];}
    $('history').hidden=!record;
    $('history-list').replaceChildren(...(record?.history||[]).map(text=>node('li','',text)));
    $('error').hidden=true;
    $('submit').hidden=action==='view';
    const submitIcon=node('span','rental-button-icon');submitIcon.setAttribute('aria-hidden','true');submitIcon.append(controlIcon());
    $('submit').replaceChildren(node('span','',{issue:'Подтвердить выдачу',return:'Подтвердить возврат'}[action]||''),submitIcon);
    quote();pickers.sync();
    workspace.inert=true;overlay.hidden=false;dialog.show();measurePopup();
    const box=dialog.getBoundingClientRect();
    if(box.top<24||box.bottom>innerHeight-24)dialog.scrollIntoView({block:box.height>innerHeight-48?'start':'nearest',behavior:'instant'});
    root.querySelector('[data-rental-close]').focus({preventScroll:true});
  }
  function close() {pickers.close();dialog.close();overlay.hidden=true;workspace.inert=false;rental.style.removeProperty('--rental-popup-space');if(opener?.isConnected)opener.focus({preventScroll:true});}
  listen(root,'click',event=>{
    const open=event.target.closest('[data-rental-open], [data-rental-action]');
    if(open)show(open.dataset.rentalOpen||open.dataset.rentalAction,open);
    const status=event.target.closest('[data-filter]');if(status){filter=status.dataset.filter;render();}
    const channel=event.target.closest('button[data-source]');if(channel){source=channel.dataset.source;render();}
    if(event.target.closest('[data-rental-close]'))close();
  });
  listen(root.querySelector('[data-admin-search]'),'input',event=>{query=event.target.value.trim().toLocaleLowerCase('ru');render();});
  listen(form,'input',quote);listen(form,'change',quote);
  listen(form,'submit',event=>{
    event.preventDefault();
    if(action==='view')return;
    const record=draft(), old=records.find(item=>item.id===currentId);
    if(action==='return')record.paid+=old.paid;
    let error=validateBooking(record,action==='return'?[]:records,currentId);
    if(!field('payment').value.trim()||!Number.isInteger(record.paid))error='Укажите сумму оплаты в целых рублях. Если оплаты пока нет — введите 0.';
    if(!error&&action==='issue'&&record.paid<old.paid)error='В броне уже отмечена предоплата. Итоговая оплата не может быть меньше неё.';
    if(!error&&action==='issue')error=validateIssue(record,records);
    if(!error&&action==='return'&&record.paid<totalOf(old))error='Перед возвратом отметьте полную оплату проката.';
    if(error){
      $('error').textContent=error;$('error').hidden=false;
      $('error').focus({preventScroll:true});
      $('error').scrollIntoView({block:'nearest',behavior:'instant'});
      return;
    }
    const time='12:15', history=old?[...old.history]:[];
    if(action==='issue')history.push(`${time} · Велосипед ${record.bike} выдан`);
    if(action==='return')history.push(`${time} · Возврат принят`);
    const addedPayment=record.paid-(old?.paid||0);
    if(addedPayment>0)history.push(`${time} · Оплата ${money(addedPayment)} отмечена администратором`);
    const updated={...record,status:action==='issue'?'rented':'returned',history};
    records=records.map(item=>item.id===old.id?updated:item);
    save();close();render();
    const replacement=[...rows.querySelectorAll('[data-rental-open]')].find(button=>button.dataset.rentalOpen===record.id);
    (replacement||root.querySelector('[data-admin-reset]')).focus({preventScroll:true});
    announce(`${record.id}: ${statusLabels[updated.status]}. Источник ${sourceLabels[record.source]}.`);
  });
  listen(dialog,'keydown',event=>{
    if(event.key!=='Escape')return;
    event.preventDefault();event.stopPropagation();
    if(!pickers.close(true))close();
  });
  listen(overlay,'click',event=>{if(event.target===overlay)close();});
  listen(root.querySelector('[data-admin-reset]'),'click',()=>{records=freshBookings();filter='all';source='all';query='';root.querySelector('[data-admin-search]').value='';save();render();announce('Журнал бронирований восстановлен.');});
  render();
  return ()=>{life.abort();popupSize.disconnect();pickers.destroy();if(dialog.open)dialog.close();overlay.hidden=true;workspace.inert=false;rental.style.removeProperty('--rental-popup-space');delete root.dataset.initialized;};
}
