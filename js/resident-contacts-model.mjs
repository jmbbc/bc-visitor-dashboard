const text=value=>typeof value==='string'?value.normalize('NFKC').replace(/\s+/g,' ').trim():'';
export function normalizeContactPhone(value){let phone=text(value).replace(/\D/g,'');if(phone.startsWith('0060'))phone=phone.slice(2);if(phone.startsWith('60'))phone='0'+phone.slice(2);return phone;}
export function uniqueResidentContacts(unitData={},responses=[]){
 const contacts=new Map();
 function add(name,phone){name=text(name);phone=text(phone);if(!name&&!phone)return;const key=JSON.stringify([name.toLocaleLowerCase('ms'),normalizeContactPhone(phone)]);if(!contacts.has(key))contacts.set(key,{name,phone});}
 for(const [name,phone]of [['ownerName','ownerPhone'],['name','phone'],['hostName','hostPhone'],['contactName','contactPhone'],['tenantName','tenantPhone']])add(unitData?.[name],unitData?.[phone]);
 for(const response of responses)add(response?.hostName,response?.hostPhone);
 return [...contacts.values()].sort((a,b)=>a.name.localeCompare(b.name,'ms',{sensitivity:'base'})||normalizeContactPhone(a.phone).localeCompare(normalizeContactPhone(b.phone)));
}
