const text=value=>typeof value==='string'?value.normalize('NFKC').replace(/\s+/g,' ').trim():'';
export function normalizeContactPhone(value){let phone=text(value).replace(/\D/g,'');if(phone.startsWith('0060'))phone=phone.slice(2);if(phone.startsWith('60'))phone='0'+phone.slice(2);return phone;}
export function residentRecordMillis(value){
 if(value==null||value==='')return null;
 try{const n=typeof value.toMillis==='function'?value.toMillis():typeof value==='object'&&Number.isFinite(value.seconds)?value.seconds*1000+Math.floor((value.nanoseconds||0)/1e6):value instanceof Date?value.getTime():typeof value==='number'?value:Date.parse(value);return Number.isFinite(n)&&n>0?n:null;}catch{return null;}
}
export function formatResidentRecordDate(value){const n=residentRecordMillis(value);return n===null?'Tiada tarikh rekod':new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(n));}
export function uniqueResidentContacts(unitData={},responses=[]){
 const contacts=new Map();
 function add(name,phone,createdAt){name=text(name);phone=text(phone);if(!name&&!phone)return;const key=JSON.stringify([name.toLocaleLowerCase('ms'),normalizeContactPhone(phone)]);const latestAt=residentRecordMillis(createdAt);if(!contacts.has(key))contacts.set(key,{name,phone,latestAt});else if(latestAt!==null&&(contacts.get(key).latestAt===null||latestAt>contacts.get(key).latestAt))contacts.get(key).latestAt=latestAt;}
 for(const [name,phone]of [['ownerName','ownerPhone'],['name','phone'],['hostName','hostPhone'],['contactName','contactPhone'],['tenantName','tenantPhone']])add(unitData?.[name],unitData?.[phone]);
 for(const response of responses)add(response?.hostName,response?.hostPhone,response?.createdAt);
 return [...contacts.values()].sort((a,b)=>a.name.localeCompare(b.name,'ms',{sensitivity:'base'})||normalizeContactPhone(a.phone).localeCompare(normalizeContactPhone(b.phone)));
}
