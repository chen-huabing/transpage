function renderOrderRecord(order){
const li=document.createElement('li');li.style.cssText='list-style:none;padding:0;margin:12px 0;border:1px solid #e3e8ef;border-radius:12px;overflow:hidden';
const names=lang==='en'?['Light pack','Everyday pack','Plus pack']:['轻量翻译包','常用翻译包','进阶翻译包'];
const name=names[Number(order.plan)]||t('翻译额度包','Translation credit pack');
const statuses={pending:t('待支付','Awaiting payment'),paid:t('已支付','Paid'),cancelled:t('已取消','Cancelled'),refunded:t('已退款','Refunded'),failed:t('支付失败','Payment failed')};
const status=statuses[order.status]||t('处理中','Processing');
const money=new Intl.NumberFormat(lang==='en'?'en-US':'zh-CN',{style:'currency',currency:order.currency}).format(order.amount_minor/100)+' '+order.currency;
const date=new Date(order.created_at*1000).toLocaleString(lang==='en'?'en-US':'zh-CN');
const details=document.createElement('details'),summary=document.createElement('summary');summary.style.cssText='cursor:pointer;padding:18px;background:#f8faff;line-height:1.9';
const heading=document.createElement('strong');heading.textContent=name+' · '+status;summary.append(heading);
const info=document.createElement('div');info.style.cssText='color:#64748b;font-size:13px';info.textContent=money+' · '+date;summary.append(info);
const hint=document.createElement('span');hint.style.cssText='color:#2863e5;font-size:13px';hint.textContent=t('点击查看订单详情','View order details');summary.append(hint);details.append(summary);
const body=document.createElement('dl');body.style.cssText='margin:0;padding:8px 18px 18px';
const entries=[
[t('套餐名称','Pack'),name],
[t('订单状态','Status'),status],
[t('购买金额','Amount'),money],
[t('翻译额度','Translation credits'),Number(order.credits||0).toLocaleString()+' '+t('计费字符','billable characters')],
[t('短文档数量上限','Maximum short documents'),t('最多 ','Up to ')+Math.floor(Number(order.credits||0)/50000)+t(' 份',' documents')],
[t('购买时间','Created'),date],
[t('支付时间','Paid at'),order.paid_at?new Date(order.paid_at).toLocaleString(lang==='en'?'en-US':'zh-CN'):t('尚未支付','Not paid')],
[t('交易类型','Environment'),order.environment==='sandbox'?t('沙箱测试（非真实付款）','Sandbox test (no real payment)'):t('正式购买','Live purchase')]
];
for(const [label,value] of entries){const row=document.createElement('div');row.style.cssText='display:flex;justify-content:space-between;gap:20px;padding:10px 0;border-bottom:1px solid #eef0f4';const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dt.style.color='#64748b';dd.textContent=value;dd.style.cssText='margin:0;text-align:right';row.append(dt,dd);body.append(row)}
const note=document.createElement('p');note.style.cssText='font-size:12px;color:#748094';note.textContent=t('每份文档最低按50,000计费字符计算，长文档消耗更多。这里是本单购买额度，不是剩余额度。','Each document uses at least 50,000 billable characters. Longer documents use more. These are purchased credits, not a remaining balance.');body.append(note);details.append(body);li.append(details);return li;
}
