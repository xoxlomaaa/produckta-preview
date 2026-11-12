export const storageKey = 'producta-rental-preview-v3';
export const demoClock = 12 * 60 + 15;
export const statusLabels = {reserved:'Ожидает выдачи', rented:'В прокате', returned:'Возвращён'};
export const sourceLabels = {website:'Сайт', telegram:'Telegram', desk:'На месте'};
export const bikes = [
  {id:'C-01',name:'Городской',rate:300}, {id:'C-02',name:'Городской',rate:300},
  {id:'C-03',name:'Городской',rate:300}, {id:'C-04',name:'Городской',rate:300},
  {id:'M-01',name:'Горный',rate:400}, {id:'M-02',name:'Горный',rate:400},
  {id:'M-03',name:'Горный',rate:400}, {id:'K-01',name:'Детский',rate:200},
];
export const initialBookings = [
  {id:'B-1042',guest:'Михаил Волков',phone:'+7 900 000-00-42',bike:'M-02',start:'13:00',end:'16:00',source:'telegram',status:'reserved',paid:400,history:['11:20 · Бронь поступила из Telegram','11:22 · Предоплата 400 ₽ отмечена администратором']},
  {id:'B-1040',guest:'Ольга Соколова',phone:'+7 900 000-00-40',bike:'C-02',start:'11:00',end:'14:00',source:'desk',status:'rented',paid:900,history:['10:55 · Бронь создана на месте','11:00 · Велосипед C-02 выдан','11:00 · Оплата 900 ₽ отмечена администратором']},
  {id:'B-1038',guest:'Илья Новиков',phone:'+7 900 000-00-38',bike:'C-01',start:'09:00',end:'10:00',source:'website',status:'returned',paid:300,history:['08:55 · Бронь поступила с сайта','09:00 · Велосипед C-01 выдан','10:00 · Возврат принят']},
];
