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
    async createCharge({registrationId, amountSen}) {
      const by = await staff(true);
      const id = identifier(registrationId);
      money(amountSen);
      const ref = doc(db, 'parkingCharges', id);
      return runTransaction(db, async tx => {
        const existing = await tx.get(ref);
        if (existing.exists()) {
          if (existing.data().amountSen !== amountSen) throw new Error('Caj sudah wujud dengan amaun berbeza.');
          return id;
        }
        tx.set(ref, {registrationId:id, amountSen, paidSen:0, paymentStatus:amountSen?'unconfirmed':'no_charge', createdBy:by, createdAt:serverTimestamp()});
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
    async adjustCharge({registrationId, amountSen, expectedAmountSen, reason}) {
      const by = await staff(true);
      const ref = doc(db, 'parkingCharges', identifier(registrationId));
      money(amountSen);
      if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) throw new Error('Isi sebab pelarasan (maksimum 500 aksara).');
      const event = doc(collection(ref, 'changes'));
      return runTransaction(db, async tx => {
        const old = await tx.get(ref);
        if (!old.exists() || old.data().amountSen !== expectedAmountSen) throw new Error('Caj telah berubah. Muat semula sebelum pelarasan.');
        tx.set(event, {beforeSen:old.data().amountSen, afterSen:amountSen, reason:reason.trim(), by, at:serverTimestamp()});
        tx.update(ref, {amountSen, lastChangeId:event.id});
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
    async readRegistration(registrationId) {
      await staff();
      const id = identifier(registrationId);
      const charge = await getDoc(doc(db, 'parkingCharges', id));
      if (!charge.exists()) return null;
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
      return {charge:charge.data(), receipts:records, paidSen,
        balanceSen:Math.max(0, amountSen-paidSen), overpaidSen:Math.max(0, paidSen-amountSen),
        status:paidSen>amountSen?'overpaid':amountSen===0?'no_charge':paidSen===amountSen?'paid':paidSen>0?'partial':'unconfirmed'};
    }
  };
}
