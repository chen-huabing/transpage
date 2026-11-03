(()=>{
const button=document.createElement('button');button.type='button';button.id='sync-payments';document.getElementById('ordersTitle').after(button);
const text=(zh,en)=>document.documentElement.lang==='en'?en:zh;
function label(){button.textContent=text('同步付款状态','Sync payment status')}
let busy=false;
async function sync(){if(busy)return;const client=window.transpageSupabase;if(!client)return;const {data}=await client.auth.getSession();if(!data.session)return;busy=true;button.disabled=true;button.textContent=text('正在核对 PayPal…','Checking PayPal…');try{const r=await fetch('/api/paypal/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:'{}'});const result=await r.json();if(!r.ok)throw Error(result.error);await refresh();window.dispatchEvent(new Event('credits-updated'));document.getElementById('status').textContent=result.updated?text('付款已同步，额度已入账。','Payments synced and credits granted.'):text('付款状态已核对。','Payment statuses checked.')}catch(e){document.getElementById('status').textContent=e.message}finally{busy=false;button.disabled=false;label()}}
button.onclick=sync;label();new MutationObserver(label).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});sync();
})();
