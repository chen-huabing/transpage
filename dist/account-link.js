(()=>{
const link=document.createElement('a');link.href='account.html';link.id='account-link';link.style.cssText='margin-left:12px;color:#2863e5;font-size:14px;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis';
let user=null,loading=true;
function render(){const en=document.documentElement.lang==='en';const name=user&&(user.user_metadata?.display_name||user.user_metadata?.full_name||user.user_metadata?.name||user.email?.split('@')[0]||(en?'My account':'我的账户'));link.textContent=loading?'…':user?String(name):(en?'Sign in':'登录');link.title=user?.email||'';link.setAttribute('aria-label',user?(en?'Open account for ':'打开账户：')+String(name):(en?'Sign in':'登录'))}
document.querySelector('header').append(link);render();new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
const client=window.transpageSupabase;if(!client){loading=false;render();return}
let version=0;client.auth.onAuthStateChange((_event,session)=>{version++;user=session?.user||null;loading=false;render()});
async function refresh(){const current=++version;try{const {data,error}=await client.auth.getUser();if(current!==version)return;user=error?null:data.user}catch{if(current!==version)return;user=null}loading=false;render()}
refresh();window.addEventListener('pageshow',refresh);window.addEventListener('focus',refresh);
})();
