import {bikes, initialBookings, statusLabels, sourceLabels} from './admin-data.js';
export const minutes = value => /^\d{2}:\d{2}$/.test(value || '') && Number(value.slice(0,2)) < 24 && Number(value.slice(3)) < 60 ? Number(value.slice(0,2))*60+Number(value.slice(3)) : NaN;
export const money = amount => new Intl.NumberFormat('ru-RU').format(amount)+' ₽';
export const bikeById = id => bikes.find(bike=>bike.id===id);
export const freshBookings = () => structuredClone(initialBookings);
export function totalOf(record) {return Math.ceil((minutes(record.end)-minutes(record.start))/60)*(bikeById(record.bike)?.rate||0);}
export function validateBooking(record, bookings, currentId) {
  if(typeof record.guest!=='string'||!record.guest.trim()||record.guest.length>60)return 'Укажите имя гостя.';
  if(typeof record.phone!=='string'||!/^[+\d ()-]+$/.test(record.phone)||!/^\d{10,15}$/.test(record.phone.replace(/\D/g,'')))return 'Укажите телефон: от 10 до 15 цифр.';
  if(!bikeById(record.bike)||!Object.hasOwn(sourceLabels,record.source))return 'Выберите велосипед и источник заявки.';
  const start=minutes(record.start),end=minutes(record.end);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>720)return 'Возврат должен быть позже начала. Доступен прокат до 12 часов в пределах дня.';
  if(!Number.isFinite(record.paid)||record.paid<0||record.paid>totalOf(record))return 'Оплата должна быть от 0 до стоимости проката.';
  const conflict=bookings.find(item=>item.id!==currentId&&item.bike===record.bike&&item.status!=='returned'&&start<minutes(item.end)&&end>minutes(item.start));
  if(conflict)return `Велосипед ${record.bike} уже занят с ${conflict.start} до ${conflict.end}. Выберите другой велосипед или время.`;
  return '';
}
export function validateIssue(record,bookings) {return bookings.some(item=>item.id!==record.id&&item.bike===record.bike&&item.status==='rented')?'Этот велосипед ещё не вернули. Выберите другой в карточке бронирования.':'';}
export function restoreBookings(raw) {
  if(!Array.isArray(raw)||raw.length!==initialBookings.length)return freshBookings();
  const allowed=new Set(initialBookings.map(item=>item.id));
  const ids=new Set();
  for(const item of raw) {
    if(!item||!allowed.has(item.id)||ids.has(item.id)||!Object.hasOwn(statusLabels,item.status)||!Array.isArray(item.history)||item.history.length>30||item.history.some(line=>typeof line!=='string'||line.length>180)||validateBooking(item,[],item.id))return freshBookings();
    ids.add(item.id);
  }
  return raw;
}
