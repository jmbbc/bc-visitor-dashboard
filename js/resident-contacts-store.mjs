import {uniqueResidentContacts} from './resident-contacts-model.mjs?v=20261028-1';
export const CONTACT_PAGE_SIZE=50;
export async function loadResidentContactPage({sdk,db,unit,previous=null,onRead=()=>{}}){
 if(previous&&previous.unit!==unit)throw Error('Unit carian berubah.');
 if(previous&&!previous.hasMore)return previous;
 const {collection,doc,getDoc,getDocs,query,where,limit,startAfter}=sdk;
 const constraints=[where('hostUnit','==',unit)];if(previous?.cursor)constraints.push(startAfter(previous.cursor));constraints.push(limit(CONTACT_PAGE_SIZE+1));
 const [master,history]=await Promise.all([previous?Promise.resolve(null):getDoc(doc(db,'units',unit)).then(snapshot=>{onRead(snapshot.metadata?.fromCache?0:1);return snapshot;}),getDocs(query(collection(db,'responses'),...constraints)).then(snapshot=>{onRead(snapshot.metadata?.fromCache?0:Math.max(snapshot.docs.length,1));return snapshot;})]);
 const page=history.docs.slice(0,CONTACT_PAGE_SIZE);
 const records=[...(previous?.records||[]),...page.map(item=>({hostName:item.data().hostName,hostPhone:item.data().hostPhone,createdAt:item.data().createdAt}))];
 const unitData=previous?.unitData||(master?.exists()?master.data():{});
 return {unit,unitData,records,cursor:page.at(-1)||previous?.cursor||null,hasMore:history.docs.length>CONTACT_PAGE_SIZE,scanned:(previous?.scanned||0)+page.length,contacts:uniqueResidentContacts(unitData,records)};
}
