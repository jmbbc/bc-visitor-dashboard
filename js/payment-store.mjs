// Firestore adapter, intentionally not enabled by the production dashboard yet.
// SDK injection allows emulator use without importing production configuration.
export function createPaymentStore({db, auth, sdk}) {
  const {doc, collection, query, where, limit, getDocs, getDoc, runTransaction, serverTimestamp} = sdk;
  const identifier = value => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error('Rujukan tidak sah.');
    return value;
  };
  const money = value => {
    if (!Number.isSafeInteger(value) || value < 0 || value > 100000000) throw new Error('Amaun sen tidak sah.');
    return value;
  };
  async function staff(adminOnly = false) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) throw new Error('Log masuk dengan akaun staf.');
    const {claims} = await user.getIdTokenResult();
    if (claims.admin !== true && (adminOnly || claims.guard !== true)) throw new Error('Tiada kebenaran pembayaran.');
    return user.uid;
  }
  return {
    async createCharge({registrationId, amountSen, finalCategory = null, reason = ''}) {
      const by = await staff(true);
      const id = identifier(registrationId);
      money(amountSen);
      if(finalCategory!==null&&![1,2,3].includes(Number(finalCategory)))throw new Error('Kategori akhir tidak sah.');
      if(typeof reason!=='string'||reason.trim().length<3||reason.trim().length>500)throw new Error('Isi sebab keputusan admin (3–500 aksara).');
      const ref = doc(db, 'parkingCharges', id);
      return runTransaction(db, async tx => {
        const responseRef=doc(db,'responses',id);
        const response=await tx.get(responseRef);
        if(!response.exists())throw new Error('Pendaftaran tidak dijumpai.');
        const existing = await tx.get(ref);
        const old=response.data(),lockRef=doc(db,'overnightLocks',`unit-${old.hostUnit}`),lock=await tx.get(lockRef);
        if (existing.exists()) {
          if (existing.data().amountSen !== amountSen) throw new Error('Caj sudah wujud dengan amaun berbeza.');
          return id;
        }
        tx.set(ref, {registrationId:id, amountSen, paidSen:0, paymentStatus:amountSen?'unconfirmed':'no_charge', createdBy:by, createdAt:serverTimestamp()});
        const quote=old.parkingQuote||null;
        const responseUpdate={status:amountSen?'Pending Payment':'Approved',parkingReviewRequired:false,updatedAt:serverTimestamp()};
        if(quote)responseUpdate.parkingQuote={...quote,mainTotalSen:amountSen,calculatedAt:serverTimestamp()};
        tx.update(responseRef,responseUpdate);
        if(lock.exists()&&lock.data().responseId===id)tx.update(lockRef,{parkingReviewRequired:false,parkingReviewedAt:serverTimestamp(),parkingReviewedBy:by});
        const auditRef=doc(collection(db,'audit'));
        tx.set(auditRef,{ts:serverTimestamp(),userId:by,rowId:id,field:'parking_charge_review',old:JSON.stringify({status:old.status,parkingReviewRequired:old.parkingReviewRequired,amountSen:quote?.mainTotalSen??null}),new:JSON.stringify({status:responseUpdate.status,finalCategory:Number(finalCategory)||null,amountSen}),actionId:auditRef.id,notes:reason.trim()});
        return id;
      });
    },
    async recordReceipt({registrationId, reference, amountSen}) {
      const by = await staff();
      const chargeId = identifier(registrationId);
      const id = String(reference || '').trim().toUpperCase();
      if (!/^[A-Z0-9_-]{4,80}$/.test(id)) throw new Error('Rujukan bank mesti 4–80 aksara: huruf, nombor, - atau _.');
      money(amountSen);
      if (!amountSen) throw new Error('Amaun bayaran mesti melebihi RM0.');
      const ref = doc(db, 'parkingReceipts', id);
      return runTransaction(db, async tx => {
        const existing = await tx.get(ref);
        const charge = await tx.get(doc(db, 'parkingCharges', chargeId));
        if (!charge.exists()) throw new Error('Caj pendaftaran belum disediakan oleh admin.');
        if (existing.exists()) {
          const old = existing.data();
          if (old.state === 'active' && old.chargeId === chargeId && old.amountSen === amountSen && old.createdBy === by) return id;
          throw new Error('Rujukan bank sudah digunakan. Semak rekod asal.');
        }
        const chargeData=charge.data(),paidSen=Number(chargeData.paidSen||0)+amountSen;
        const paymentStatus=paidSen>chargeData.amountSen?'overpaid':paidSen===chargeData.amountSen?'paid':'partial';
        tx.set(ref, {chargeId, reference:id, amountSen, state:'active', createdBy:by, createdAt:serverTimestamp()});
        tx.update(doc(db,'parkingCharges',chargeId),{paidSen,paymentStatus,lastReceiptId:id});
        if(paidSen>=chargeData.amountSen)tx.update(doc(db,'responses',chargeId),{status:'Approved',updatedAt:serverTimestamp()});
        return id;
      });
    },
    async adjustCharge({registrationId, amountSen, expectedAmountSen, finalCategory = null, reason}) {
      const by = await staff(true);
      const id=identifier(registrationId),ref = doc(db, 'parkingCharges', id);
      money(amountSen);
      if(finalCategory!==null&&![1,2,3].includes(Number(finalCategory)))throw new Error('Kategori akhir tidak sah.');
      if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) throw new Error('Isi sebab pelarasan (maksimum 500 aksara).');
      const event = doc(collection(ref, 'changes'));
      return runTransaction(db, async tx => {
        const old = await tx.get(ref);
        const responseRef=doc(db,'responses',id),response=await tx.get(responseRef);
        const responseData=response.exists()?response.data():{},lockRef=doc(db,'overnightLocks',`unit-${responseData.hostUnit||''}`),lock=await tx.get(lockRef);
        if (!old.exists() || old.data().amountSen !== expectedAmountSen) throw new Error('Caj telah berubah. Muat semula sebelum pelarasan.');
        if(!response.exists())throw new Error('Pendaftaran tidak dijumpai.');
        tx.set(event, {beforeSen:old.data().amountSen, afterSen:amountSen, reason:reason.trim(), by, at:serverTimestamp()});
        tx.update(ref, {amountSen, lastChangeId:event.id});
        const responseUpdate={parkingReviewRequired:false,updatedAt:serverTimestamp()};
        if(responseData.parkingQuote)responseUpdate.parkingQuote={...responseData.parkingQuote,mainTotalSen:amountSen,calculatedAt:serverTimestamp()};
        tx.update(responseRef,responseUpdate);
        if(lock.exists()&&lock.data().responseId===id)tx.update(lockRef,{parkingReviewRequired:false,parkingReviewedAt:serverTimestamp(),parkingReviewedBy:by});
        const auditRef=doc(collection(db,'audit'));
        tx.set(auditRef,{ts:serverTimestamp(),userId:by,rowId:id,field:'parking_category_charge_adjustment',old:JSON.stringify({category:null,amountSen:old.data().amountSen}),new:JSON.stringify({category:Number(finalCategory)||null,amountSen}),actionId:auditRef.id,notes:reason.trim()});
      });
    },
    async allocateReceipt({reference, allocations, reason, expectedAllocations}) {
      const by = await staff(true);
      const ref = doc(db, 'parkingReceipts', identifier(reference));
      if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) throw new Error('Isi sebab pembahagian (maksimum 500 aksara).');
      if (!Array.isArray(allocations) || !allocations.length || allocations.length > 8) throw new Error('Isi 1 hingga 8 pendaftaran bagi satu resit.');
      const normalized = allocations.map(a => ({chargeId:identifier(a.chargeId), amountSen:money(a.amountSen)}));
      if (normalized.some(a => !a.amountSen) || new Set(normalized.map(a => a.chargeId)).size !== normalized.length) throw new Error('Amaun mesti positif dan pendaftaran tidak boleh berulang.');
      const event = doc(collection(ref, 'changes'));
      return runTransaction(db, async tx => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists() || snapshot.data().state !== 'active') throw new Error('Resit tidak aktif.');
        const old = snapshot.data();
        const previous = old.allocations || [{chargeId:old.chargeId, amountSen:old.amountSen}];
        if (JSON.stringify(previous) !== JSON.stringify(expectedAllocations)) throw new Error('Pembahagian telah berubah. Muat semula resit.');
        if (normalized.reduce((sum,a) => sum+a.amountSen,0) > old.amountSen) throw new Error('Pembahagian melebihi amaun resit.');
        for (const allocation of normalized) {
          if (!(await tx.get(doc(db,'parkingCharges',allocation.chargeId))).exists()) throw new Error('Caj pendaftaran tidak dijumpai.');
        }
        tx.set(event, {before:previous, after:normalized, reason:reason.trim(), by, at:serverTimestamp()});
        tx.update(ref, {allocations:normalized, relatedChargeIds:normalized.map(a => a.chargeId), lastChangeId:event.id});
      });
    },
    async voidReceipt({reference, reason}) {
      const by = await staff(true);
      const ref = doc(db, 'parkingReceipts', identifier(reference));
      if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) throw new Error('Isi sebab pembatalan (maksimum 500 aksara).');
      return runTransaction(db, async tx => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists() || snapshot.data().state !== 'active') throw new Error('Resit tidak aktif.');
        tx.update(ref, {state:'voided', voidReason:reason.trim(), voidBy:by, voidAt:serverTimestamp()});
      });
    },
    async cancelBeforeEntry({registrationId, reason}) {
      const by=await staff(true),id=identifier(registrationId);
      if(typeof reason!=='string'||reason.trim().length<3||reason.trim().length>500)throw new Error('Isi sebab pembatalan (3–500 aksara).');
      const responseRef=doc(db,'responses',id);
      return runTransaction(db,async tx=>{
        const response=await tx.get(responseRef);
        if(!response.exists())throw new Error('Pendaftaran tidak dijumpai.');
        const old=response.data(),eta=old.eta?.toDate?old.eta.toDate():null;
        if(!eta||eta.getTime()<=Date.now())throw new Error('Pembatalan ini hanya untuk pendaftaran yang belum bermula.');
        if(['Checked In','Checked Out','Cancelled Before Entry'].includes(old.status))throw new Error('Status pendaftaran tidak membenarkan pembatalan awal.');
        const lockRef=doc(db,'overnightLocks',`unit-${old.hostUnit}`),lock=await tx.get(lockRef);
        const chargeRef=doc(db,'parkingCharges',id),charge=await tx.get(chargeRef);
        if(charge.exists()&&Number(charge.data().paidSen||0)>0)throw new Error('Bayaran sudah diterima. Selesaikan pelarasan atau pemulangan bayaran sebelum membatalkan pendaftaran.');
        if(lock.exists()&&lock.data().responseId===id){
          const prior=old.parkingPriorState;
          const restored={unit:old.hostUnit,startDate:serverTimestamp(),endDate:serverTimestamp(),category:'Pelawat',stayOver:'No',responseId:id,updatedAt:serverTimestamp(),amendToken:old.amendToken||''};
          if(prior?.exists===true)Object.assign(restored,{parkingCategory:prior.category,cycleStart:prior.cycleStart,mainUsageDays:prior.mainUsageDays,lastMainEnd:prior.lastMainEnd,lastAnyEnd:prior.lastAnyEnd,parkingPolicyVersion:prior.policyVersion,parkingReviewRequired:false});
          else if(!prior)restored.parkingReviewRequired=true;
          tx.set(lockRef,restored);
        }
        tx.update(responseRef,{status:'Cancelled Before Entry',parkingReviewRequired:old.parkingPriorState?false:true,updatedAt:serverTimestamp()});
        if(charge.exists()&&charge.data().amountSen!==0){
          const changeRef=doc(collection(chargeRef,'changes'));
          tx.set(changeRef,{beforeSen:charge.data().amountSen,afterSen:0,reason:`Pembatalan sebelum masuk: ${reason.trim()}`,by,at:serverTimestamp()});
          tx.update(chargeRef,{amountSen:0,lastChangeId:changeRef.id});
        }
        const auditRef=doc(collection(db,'audit'));
        tx.set(auditRef,{ts:serverTimestamp(),userId:by,rowId:id,field:'cancel_before_entry',old:String(old.status||''),new:'Cancelled Before Entry',actionId:auditRef.id,notes:reason.trim()});
        return id;
      });
    },
    async readRegistration(registrationId) {
      await staff();
      const id = identifier(registrationId);
      const [charge,response]=await Promise.all([getDoc(doc(db,'parkingCharges',id)),getDoc(doc(db,'responses',id))]);
      if(!response.exists())throw new Error('Pendaftaran tidak dijumpai.');
      const responseData=response.data();
      const unit=responseData.hostUnit?await getDoc(doc(db,'units',responseData.hostUnit)):null;
      const arrears=unit?.exists()?Number(unit.data().arrearsAmount):null;
      const currentCategory=Number.isFinite(arrears)?(arrears<=1?1:arrears<=400?2:3):null;
      if (!charge.exists()) return {charge:null,response:responseData,currentCategory,receipts:[],paidSen:0,balanceSen:0,overpaidSen:0,status:'no_charge_record'};
      const results = await Promise.all([
        getDocs(query(collection(db, 'parkingReceipts'), where('chargeId','==',id), limit(2001))),
        getDocs(query(collection(db, 'parkingReceipts'), where('relatedChargeIds','array-contains',id), limit(2001)))
      ]);
      if (results.some(r => r.size > 2000)) throw new Error('Terlalu banyak resit; semakan admin diperlukan.');
      const unique = new Map();
      results.forEach(result => result.docs.forEach(d => unique.set(d.id,{id:d.id,...d.data()})));
      const records = Array.from(unique.values());
      const paidSen = records.filter(r => r.state === 'active').reduce((sum,r) => sum +
        (r.allocations || [{chargeId:r.chargeId,amountSen:r.amountSen}]).filter(a => a.chargeId === id).reduce((n,a) => n+a.amountSen,0), 0);
      const amountSen = charge.data().amountSen;
      return {charge:charge.data(),response:responseData,currentCategory,receipts:records, paidSen,
        balanceSen:Math.max(0, amountSen-paidSen), overpaidSen:Math.max(0, paidSen-amountSen),
        status:paidSen>amountSen?'overpaid':amountSen===0?'no_charge':paidSen===amountSen?'paid':paidSen>0?'partial':'unconfirmed'};
    }
  };
}
