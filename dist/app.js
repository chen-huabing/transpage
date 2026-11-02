const $=id=>document.getElementById(id),file=$('file');let chosen,job,url;
const codes={'英语':'EN-US','简体中文':'ZH','日语':'JA','韩语':'KO','法语':'FR','德语':'DE','西班牙语':'ES'};
async function loadLanguages(){
  $('start').disabled=true;
  const display=new Intl.DisplayNames(['zh-CN'],{type:'language'});
  try{
    const response=await fetch('/api/languages');if(!response.ok)throw Error();
    const lists=await response.json();
    for(const kind of ['source','target']){
      const select=$(kind);select.replaceChildren();
      if(kind==='source')select.add(new Option('自动识别',''));
      for(const item of lists[kind]){
        let label=item.name;try{label=display.of(item.language.toLowerCase())||label}catch{}
        select.add(new Option(label+' · '+item.language,item.language));
      }
      select.value=kind==='source'?'':'EN-US';
      if(select.selectedIndex<0)select.selectedIndex=0;
      select.onchange=()=>{job=null;$('download').style.display='none'};
    }
    $('start').disabled=false;
  }catch{$('status').textContent='语言列表加载失败，请刷新页面重试。'}
}
loadLanguages();
function choose(f){if($('start').disabled)return;if(!f)return;if(!/\.(docx|pptx|pdf)$/i.test(f.name)||f.size>10485760){$('status').textContent='请选择不超过 10 MB 的 DOCX、PPTX 或 PDF';return}chosen=f;job=null;$('filename').textContent=f.name;$('download').style.display='none';$('status').textContent='文件已就绪'}
file.onchange=()=>choose(file.files[0]);$('drop').onclick=()=>file.click();$('drop').onkeydown=e=>{if(e.key==='Enter')file.click()};$('drop').ondragover=e=>e.preventDefault();$('drop').ondrop=e=>{e.preventDefault();choose(e.dataTransfer.files[0])};
async function call(path,body){const r=await fetch('/api/'+path,{method:'POST',body:body instanceof FormData?body:JSON.stringify(body)});if(!r.ok)throw Error(await r.text());return r}
$('start').onclick=async()=>{if(!chosen){$('status').textContent='请先选择文件';return}$('start').disabled=true;$('progress').hidden=false;$('progress').removeAttribute('value');try{if(!job){$('status').textContent='正在上传至 DeepL…';const data=new FormData();data.append('file',chosen);data.append('target_lang',$('target').value);if($('source').value!=='')data.append('source_lang',$('source').value);job=await(await call('upload',data)).json()}let done=false;for(let i=0;i<600;i++){const s=await(await call('status',job)).json();if(s.status==='error')throw Error(s.message||'翻译失败');if(s.status==='done'){done=true;break}$('status').textContent=s.status==='queued'?'DeepL 正在排队…':'DeepL 正在翻译…';await new Promise(r=>setTimeout(r,2000))}if(!done)throw Error('仍在处理，点击开始翻译可继续查询');const blob=await(await call('result',job)).blob();job=null;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);$('download').href=url;$('download').download=chosen.name.replace(/(\.[^.]+)$/,'_translated$1');$('download').style.display='block';$('status').textContent='翻译完成，请下载文档。'}catch(e){$('status').textContent='未完成：'+e.message}finally{$('start').disabled=false;$('progress').hidden=true}};

