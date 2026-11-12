import {controlIcon} from '../js/control-icon.js';

// Presentation controls stay inside the rental window; native values remain
// the only form data source. No browser/OS popup or document-level portal.
export function initRentalPickers(dialog) {
  const life = new AbortController();
  const adapters = [];
  let active = null;
  let typeTimer;
  const listen = (target,type,handler) => target.addEventListener(type,handler,{signal:life.signal});
  const make = (tag,className,text) => {
    const node=document.createElement(tag);node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  };
  function close(restore=false) {
    if(!active)return false;
    const current=active;active=null;
    current.popup.hidden=true;current.trigger.setAttribute('aria-expanded','false');
    current.trigger.removeAttribute('aria-activedescendant');
    if(restore)current.trigger.focus({preventScroll:true});
    return true;
  }
  function position(adapter) {
    const box=adapter.trigger.getBoundingClientRect(),bounds=dialog.getBoundingClientRect();
    const heading=dialog.querySelector('.rental-dialog-header').getBoundingClientRect();
    // Rects use physical pixels; popup sizing uses the window's logical pixels.
    const scale=box.width/adapter.trigger.offsetWidth||1;
    const below=(bounds.bottom-box.bottom)/scale-18,above=(box.top-Math.max(bounds.top+18*scale,heading.bottom+8*scale))/scale;
    const natural=adapter.popup.scrollHeight;
    const upward=below<Math.min(natural,230)&&above>below;
    adapter.popup.dataset.direction=upward?'up':'down';
    adapter.popup.style.maxBlockSize=`${Math.max(80,Math.min(natural,upward?above:below))}px`;
  }
  function open(adapter) {
    if(adapter.control.disabled)return;
    if(active===adapter){close(true);return;}
    close();active=adapter;adapter.prepare();
    adapter.popup.hidden=false;adapter.trigger.setAttribute('aria-expanded','true');
    position(adapter);adapter.present?.();
  }
  function commit(adapter,value) {
    adapter.control.value=value;
    adapter.control.dispatchEvent(new Event('input',{bubbles:true}));
    adapter.control.dispatchEvent(new Event('change',{bubbles:true}));
    adapter.sync();close(true);
  }
  function base(control,kind) {
    const host=make('div','rental-picker');
    const trigger=make('button','rental-picker-trigger');trigger.type='button';
    trigger.dataset.picker=control.name;trigger.id=control.id+'-trigger';
    const value=make('span','rental-picker-value');value.id=control.id+'-value';
    const icon=kind==='time'?make('span','rental-picker-clock'):controlIcon('arrow','rental-picker-chevron');icon.setAttribute('aria-hidden','true');
    trigger.append(value,icon);
    trigger.setAttribute('aria-labelledby',`${control.id}-label ${value.id}`);
    trigger.setAttribute('aria-expanded','false');
    const popup=make('div',`rental-picker-popup rental-picker-popup--${kind}`);
    popup.id=control.id+'-popup';popup.dataset.pickerPopup=control.name;popup.hidden=true;
    trigger.setAttribute('aria-controls',popup.id);
    host.append(trigger,popup);control.after(host);control.hidden=true;
    const adapter={control,host,trigger,popup,value,kind};
    listen(trigger,'click',()=>open(adapter));
    adapters.push(adapter);return adapter;
  }

  for(const control of dialog.querySelectorAll('[data-rental-select]')) {
    const adapter=base(control,'select');let index=0,typed='';
    const {trigger,popup,value}=adapter;
    trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');
    popup.setAttribute('role','listbox');popup.setAttribute('aria-labelledby',control.id+'-label');
    const options=[...control.options].map((option,i)=>{
      const row=make('div','rental-picker-option');row.id=`${control.id}-option-${i}`;
      row.setAttribute('role','option');row.dataset.value=option.value;
      const parts=option.textContent.split(' · ');
      const name=make('span','rental-option-name',parts[0]);
      const caption=parts.length>1?make('small','rental-option-caption',parts.slice(1).join(' · ')):null;
      const text=make('span','rental-option-text');text.append(name);if(caption)text.append(caption);
      row.append(text,make('span','rental-option-check','✓'));popup.append(row);
      listen(row,'pointerdown',event=>event.preventDefault());
      listen(row,'pointermove',()=>{index=i;adapter.present();});
      listen(row,'click',()=>commit(adapter,option.value));
      return row;
    });
    adapter.sync=()=>{
      trigger.disabled=control.disabled;
      value.textContent=control.selectedOptions[0]?.textContent||'Выберите';
      options.forEach((row,i)=>row.setAttribute('aria-selected',String(control.options[i].selected)));
    };
    adapter.prepare=()=>{index=Math.max(0,control.selectedIndex);adapter.sync();};
    adapter.present=()=>{
      options.forEach((row,i)=>row.toggleAttribute('data-active',i===index));
      const selected=options[index];trigger.setAttribute('aria-activedescendant',selected.id);
      const top=selected.offsetTop,bottom=top+selected.offsetHeight;
      if(top<popup.scrollTop)popup.scrollTop=top;
      else if(bottom>popup.scrollTop+popup.clientHeight)popup.scrollTop=bottom-popup.clientHeight;
    };
    listen(trigger,'keydown',event=>{
      if(event.key==='Tab'){close();return;}
      if(event.key==='Escape'){if(close(true)){event.preventDefault();event.stopPropagation();}return;}
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();const wasOpen=active===adapter;
        if(!wasOpen)open(adapter);
        else index=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowUp'?-1:1)+options.length)%options.length;
        adapter.present();return;
      }
      if((event.key==='Enter'||event.key===' ')&&active===adapter){event.preventDefault();commit(adapter,control.options[index].value);return;}
      if(event.key.length===1&&event.key!==' '){
        typed+=event.key.toLocaleLowerCase('ru');clearTimeout(typeTimer);typeTimer=setTimeout(()=>{typed='';},650);
        const found=[...control.options].findIndex(option=>option.textContent.toLocaleLowerCase('ru').startsWith(typed));
        if(found>=0){event.preventDefault();if(active!==adapter)open(adapter);index=found;adapter.present();}
      }
    });
    adapter.sync();
  }

  for(const control of dialog.querySelectorAll('[data-rental-time]')) {
    const adapter=base(control,'time');const {trigger,popup,value}=adapter;
    trigger.setAttribute('aria-haspopup','dialog');popup.setAttribute('role','dialog');popup.setAttribute('aria-label',control.labels[0].textContent+' — выбор времени');
    let hour='13',minute='00';const timeButtons=[];
    const header=make('div','rental-time-heading');const title=make('span','',control.labels[0].textContent);const preview=make('strong','');header.append(title,preview);popup.append(header);
    function renderTime(){
      preview.textContent=`${hour}:${minute}`;
      timeButtons.forEach(button=>{
        const selected=button.dataset.unit==='hour'?button.dataset.timeValue===hour:button.dataset.timeValue===minute;
        button.setAttribute('aria-pressed',String(selected));button.tabIndex=selected?0:-1;
      });
    }
    for(const [unit,label,values] of [['hour','Часы',Array.from({length:24},(_,i)=>String(i).padStart(2,'0'))],['minute','Минуты',['00','15','30','45']]]) {
      popup.append(make('span','rental-time-label',label));
      const group=make('div',`rental-time-grid rental-time-grid--${unit}`);group.setAttribute('role','group');group.setAttribute('aria-label',label);
      values.forEach((item,index)=>{
        const button=make('button','rental-time-option',item);button.type='button';button.dataset.unit=unit;button.dataset.timeValue=item;
        button.setAttribute('aria-label',`${label}: ${item}`);timeButtons.push(button);group.append(button);
        listen(button,'click',()=>{if(unit==='hour')hour=item;else minute=item;renderTime();});
        listen(button,'keydown',event=>{
          const step=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:event.key==='ArrowUp'?(unit==='hour'?-6:-1):event.key==='ArrowDown'?(unit==='hour'?6:1):0;
          if(!step&&event.key!=='Home'&&event.key!=='End')return;
          event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?values.length-1:(index+step+values.length)%values.length;
          if(unit==='hour')hour=values[next];else minute=values[next];renderTime();
          group.children[next].focus({preventScroll:true});
        });
      });popup.append(group);
    }
    const apply=make('button','rental-time-apply','Выбрать время');apply.append(controlIcon());apply.type='button';apply.dataset.timeApply=control.name;popup.append(apply);
    listen(apply,'click',()=>commit(adapter,`${hour}:${minute}`));
    adapter.sync=()=>{trigger.disabled=control.disabled;value.textContent=control.value||'Выберите время';};
    adapter.prepare=()=>{[hour,minute]=(control.value||'13:00').split(':');renderTime();};
    listen(trigger,'keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();open(adapter);}});
    adapter.sync();
  }

  listen(document,'pointerdown',event=>{if(active&&!active.host.contains(event.target))close();});
  listen(document,'focusin',event=>{if(active&&!active.host.contains(event.target))close();});
  listen(window,'resize',()=>close());
  listen(dialog,'scroll',()=>{
    if(!active)return;
    const box=active.trigger.getBoundingClientRect(),bounds=dialog.getBoundingClientRect();
    if(box.bottom<bounds.top||box.top>bounds.bottom)close();
    else position(active);
  });
  return {
    sync(){adapters.forEach(adapter=>adapter.sync());},
    close,
    destroy(){close();clearTimeout(typeTimer);life.abort();adapters.forEach(({host,control})=>{host.remove();control.hidden=false;});},
  };
}
