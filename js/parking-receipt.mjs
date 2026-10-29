const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>`RM ${Number(value).toFixed(2)}`;
const date=value=>new Intl.DateTimeFormat('ms-MY',{day:'2-digit',month:'short',year:'numeric'}).format(value instanceof Date?value:new Date(value+'T00:00:00'));
function dateRange(start,end){
 if(!start)return '';
 const a=start instanceof Date?start:new Date(start+'T00:00:00'),b=end instanceof Date?end:end?new Date(end+'T00:00:00'):a;
 if(a.getTime()===b.getTime())return date(a);
 if(a.getMonth()===b.getMonth()&&a.getFullYear()===b.getFullYear())return `${a.getDate()}–${date(b)}`;
 return `${date(a)} – ${date(b)}`;
}
export function renderParkingReceipt({unit,category,arrearsText,mainPlate,quote,extras,total,eligibilityHtml='',paymentHtml='',updateHtml='',reviewHtml=''}){
 const lines=quote.lines||[],groups=new Map();for(const line of lines)groups.set(line.amountSen,(groups.get(line.amountSen)||0)+1);
 const mainCalculation=[...groups].map(([rate,days])=>rate===0?`${days} hari percuma`:`${days} hari × ${money(rate/100)} sehari`).join(' + ');
 const vehicles=[{number:1,plate:mainPlate||'Nombor plat belum diisi',start:lines[0]?.date,end:lines.at(-1)?.date,calculation:mainCalculation,amount:quote.totalSen/100,days:lines},...extras.map(item=>{const days=[];for(let i=0;i<item.days;i++){const d=new Date(item.start);d.setDate(d.getDate()+i);days.push({date:d,day:i+1,amountSen:Math.round(item.amount/item.days*100)})}return {...item,calculation:`${item.days} hari × ${money(item.amount/item.days)} sehari`,days};})];
 const rows=vehicles.map(v=>`<tr><td><span>Kereta ${v.number}</span><strong>${escape(v.plate)}</strong><small>${escape(dateRange(v.start,v.end))}</small></td><td>${escape(v.calculation.replaceAll(' sehari',''))}</td><td><strong>${money(v.amount)}</strong></td></tr>`).join('');
 const details=vehicles.map(v=>`<div class="receipt-day-group"><strong>${escape(v.plate)} · Kereta ${v.number}</strong><ul>${v.days.map(d=>`<li><span>${escape(date(d.date))} · Hari ${d.day}</span><strong>${d.amountSen?money(d.amountSen/100):'Percuma'}</strong></li>`).join('')}</ul></div>`).join('');
 return `<div class="parking-receipt"><div class="receipt-total"><span>Jumlah caj parkir pelawat</span><strong>${money(total)}</strong></div>${reviewHtml}<div class="receipt-charge-section"><dl class="receipt-unit"><div><dt>Unit</dt><dd>${escape(unit)}</dd></div><div><dt>Kategori</dt><dd>${escape(category)}</dd></div><div><dt>Tunggakan unit</dt><dd aria-label="${escape(arrearsText)}">${escape(arrearsText.replace(/\s*\(Tiada tunggakan\)/,''))}</dd></div></dl><table class="receipt-table" aria-label="Pecahan caj setiap kenderaan"><thead><tr><th scope="col">Kenderaan</th><th scope="col">Kiraan</th><th scope="col">Caj</th></tr></thead><tbody>${rows}</tbody></table><details class="receipt-daily"><summary>Lihat pecahan harian</summary>${details}</details></div><div class="receipt-secondary">${eligibilityHtml}${paymentHtml}${updateHtml}</div><p class="receipt-caution">Caj parkir di atas berasingan daripada tunggakan unit. Anggaran diselaraskan selepas pendaftaran dan sejarah unit digabungkan.</p></div>`;
}
