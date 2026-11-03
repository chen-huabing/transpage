let uiLanguage='zh';try{uiLanguage=localStorage.getItem('uiLanguage')||'zh'}catch{}
const phrases={
'文档由 DeepL 整体翻译，尽可能保留原有格式。':'DeepL translates the entire document while preserving its formatting where possible.',
'尽可能保留原文档的版式和图形元素。':'Keep the original layout and graphics wherever possible.',
'下载翻译后的文档，检查并完善内容。':'Download your translated document to review and refine it.',
'提示：翻译效果取决于文档内容与格式，下载后请检查排版和准确性。':'Note: Results depend on document content and format. Review layout and accuracy after downloading.',
'译':'译','译页':'SlideBridge','文档翻译工作台　 /　 为每一场表达，消除语言边界':'Document translation · Go beyond language barriers',
'好想法，':'Great ideas,','不止一种语言。':'in every language.',
'将你的文档翻译成另一种语言。':'Translate your documents into another language.',
'保留原有版式，让内容走得更远。':'Keep the layout. Take your content further.',
'01　上传文档':'01  Upload a document','拖放文档到这里':'Drop your document here','或点击选择本地文件':'or choose a file from your device','选择文件':'Choose file',
'支持 .docx / .pptx / .pdf · 最大 10 MB':'DOCX / PPTX / PDF · Up to 10 MB','原文语言':'Source language','目标语言':'Target language','开始翻译　→':'Translate document →','下载翻译后的 文档 ↓':'Download translated document ↓',
'让表达，原样出彩。':'Your message. Beautifully preserved.','从这一页，':'From this page,','走向全世界。':'to the world.',
'由 DeepL 文档翻译 API 提供服务。文件会发送至 DeepL。支持 DOCX、PPTX 和 PDF；旧版 PPT 请另存为 PPTX。每份文档最低计费 50,000 字符。':'Powered by the DeepL document translation API. Files are sent to DeepL. Supports DOCX, PPTX and PDF. Save legacy PPT files as PPTX first. A minimum of 50,000 characters is billed per document.',
'保留页面结构':'Preserve document layout','多语言互译':'Multiple languages','从商务提案到课堂分享，自由切换目标语言。':'Choose the right language for business proposals and classroom materials.',
'可继续编辑':'Download your document','译页 SLIDEBRIDGE　·　让每一个想法被更多人看见':'SLIDEBRIDGE · Bring every idea to a wider audience',
'自动识别':'Detect automatically','请选择不超过 10 MB 的 DOCX、PPTX 或 PDF':'Choose a DOCX, PPTX or PDF up to 10 MB','文件已就绪':'File ready','请先选择文件':'Please choose a file first',
'正在上传至 DeepL…':'Uploading to DeepL…','DeepL 正在排队…':'Queued by DeepL…','DeepL 正在翻译…':'DeepL is translating…','翻译完成，请下载文档。':'Translation complete. Download your document.',
'语言列表加载失败，请刷新页面重试。':'Could not load languages. Refresh the page to retry.',
'翻译失败':'Translation failed','仍在处理，点击开始翻译可继续查询':'Still processing. Click Translate to check again.',
'服务端尚未配置 DEEPL_API_KEY':'The server has no DeepL API key configured','连接 DeepL 失败，请稍后重试':'Could not connect to DeepL. Please retry later','翻译任务不存在，请重新上传':'Translation task not found. Upload your file again',
'密钥无效或权限不足':'Invalid API key or insufficient permissions','翻译额度不足':'Translation quota exceeded','文件超出套餐限制':'File exceeds plan limits','请求过于频繁':'Too many requests','请检查文件与套餐限制':'Check your file and plan limits','DeepL 请求失败':'DeepL request failed','未完成：':'Could not complete: '
};
function translateText(text){let result=text;const entries=Object.entries(phrases).filter(([a,b])=>a!==b).sort((a,b)=>Math.max(b[0].length,b[1].length)-Math.max(a[0].length,a[1].length));for(const [zh,en] of entries)result=result.split(uiLanguage==='en'?zh:en).join(uiLanguage==='en'?en:zh);return result}
const toggle=document.createElement('button');toggle.id='ui-language';toggle.type='button';toggle.style.cssText='margin-left:12px;white-space:nowrap;padding:8px 12px;font-size:13px';document.querySelector('header').append(toggle);
function applyLanguage(){const desiredLang=uiLanguage==='en'?'en':'zh-CN';if(document.documentElement.lang!==desiredLang)document.documentElement.lang=desiredLang;document.title=uiLanguage==='en'?'SlideBridge · Document translation':'译页 · 文档翻译';const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes){if(node.parentElement.closest('script,style,#ui-language,#filename'))continue;const next=translateText(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next}if(!window.chosen&&document.getElementById('filename').textContent.match(/^(拖放文档到这里|Drop your document here)$/))document.getElementById('filename').textContent=uiLanguage==='en'?'Drop your document here':'拖放文档到这里';document.getElementById('drop').setAttribute('aria-label',uiLanguage==='en'?'Choose a document':'选择文档');toggle.textContent=uiLanguage==='en'?'中文':'EN';toggle.setAttribute('aria-label',uiLanguage==='en'?'Switch to Chinese':'切换为英文');const display=new Intl.DisplayNames([uiLanguage==='en'?'en':'zh-CN'],{type:'language'});for(const select of document.querySelectorAll('select'))for(const option of select.options){if(!option.value){option.textContent=uiLanguage==='en'?'Detect automatically':'自动识别';continue}if(/^[a-z]{2,3}(-[a-z]+)?$/i.test(option.value)){try{const label=display.of(option.value.toLowerCase())+' · '+option.value;if(option.textContent!==label)option.textContent=label}catch{}}}}
toggle.onclick=()=>{uiLanguage=uiLanguage==='en'?'zh':'en';try{localStorage.setItem('uiLanguage',uiLanguage)}catch{}applyLanguage()};
const observer=new MutationObserver(()=>{observer.disconnect();applyLanguage();observer.observe(document.body,{childList:true,subtree:true,characterData:true})});applyLanguage();observer.observe(document.body,{childList:true,subtree:true,characterData:true});

