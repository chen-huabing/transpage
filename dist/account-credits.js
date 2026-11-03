(()=>{
const panel=document.createElement('section');panel.id='credits-panel';panel.hidden=true;document.getElementById('profile').after(panel);
const isEnglish=()=>document.documentElement.lang==='en';
async function refresh(){
 const client=window.transpageSupabase;if(!client)return;
 const {data}=await client.auth.getUser();if(!data?.user){panel.hidden=true;return}
 panel.hidden=false;panel.textContent=isEnglish()?'Loading purchased credits…':'正在加载已购额度…';
 const {data:rows,error}=await client.from('credit_ledger').select('amount,environment,order_id').eq('user_id',data.user.id).not('order_id','is',null);
 if(error){panel.textContent=isEnglish()?'Purchased credits unavailable. Please retry later.':'暂时无法加载已购额度，请稍后重试。';return}
 panel.replaceChildren();const title=document.createElement('h2');title.textContent=isEnglish()?'Purchased credits':'已购买额度';panel.append(title);
 for(const env of ['live','sandbox']){
  const entries=rows.filter(r=>r.environment===env),credits=entries.reduce((sum,r)=>sum+Number(r.amount),0),docs=entries.reduce((sum,r)=>sum+Math.floor(Number(r.amount)/50000),0);
  const card=document.createElement('div');card.style.cssText='background:#f4f7fc;padding:18px;border-radius:10px;margin:12px 0';
  const label=document.createElement('h3');label.textContent=env==='sandbox'?(isEnglish()?'Sandbox test purchases':'沙箱测试购买'):(isEnglish()?'Real purchases':'正式购买');card.append(label);
  for(const text of [isEnglish()?`${credits.toLocaleString('en-US')} billable characters purchased`:`已购 ${credits.toLocaleString('zh-CN')} 计费字符`,isEnglish()?`Up to ${docs} short documents · ${entries.length} purchases`:`最多 ${docs} 份短文档 · ${entries.length} 笔购买`]){const p=document.createElement('p');p.textContent=text;card.append(p)}panel.append(card);
 }
 const note=document.createElement('p');note.style.cssText='font-size:13px;color:#748094';note.textContent=isEnglish()?'These are purchased totals, not remaining balances. Each document uses at least 50,000 billable characters; longer documents use more. Document counts are estimates for short files. Translation usage deduction is not enabled. Sandbox credits cannot fund real translation.':'这里显示累计已购额度，并非剩余额度。每份文档最低消耗 50,000 计费字符，长文档消耗更多；文档数量是短文档上限估算。翻译用量扣减尚未启用，沙箱额度不能用于真实翻译。';panel.append(note);
}
let timer;function schedule(){clearTimeout(timer);timer=setTimeout(()=>refresh().catch(()=>{panel.textContent=isEnglish()?'Could not load credits.':'额度加载失败，请刷新重试。'}),100)}
window.transpageSupabase?.auth.onAuthStateChange(schedule);new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});window.addEventListener('focus',schedule);window.addEventListener('credits-updated',schedule);schedule();
})();
