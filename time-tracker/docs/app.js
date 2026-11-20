import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const $=id=>document.getElementById(id);
const cfg=window.TRACKER_CONFIG;
const activities=['Meditation','Gym','Reading'];
const today=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const monday=()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return today(d);};
let db=null,session=null,entries=[],started=null,ticker=null,busy=false;
function message(s,error=false){$('status').textContent=s;$('status').className=error?'error':'ok';}
function controls(){ $('start-timer').disabled=busy||started!==null;$('stop-timer').disabled=busy||started===null;$('manual-form').querySelector('button').disabled=busy;}
function clock(){const sec=started===null?0:Math.floor((Date.now()-started)/1000);$('clock').textContent=[Math.floor(sec/3600),Math.floor(sec/60)%60,sec%60].map(x=>String(x).padStart(2,'0')).join(':');}
function render(){
  const day=today(),week=monday();const daily=entries.filter(x=>x.activity_date===day),weekly=entries.filter(x=>x.activity_date>=week&&x.activity_date<=day);
  const sum=(rows,name)=>rows.filter(x=>!name||x.activity_name===name).reduce((a,x)=>a+x.minutes,0);
  $('today-label').textContent=day;$('week-label').textContent='Week beginning '+week;
  $('daily-totals').replaceChildren();
  for(const name of ['Total',...activities]){const box=document.createElement('div');box.className='metric';const strong=document.createElement('strong');strong.textContent=sum(daily,name==='Total'?null:name)+' min';const small=document.createElement('small');small.textContent=name;box.append(strong,small);$('daily-totals').append(box);}
  $('weekly-progress').replaceChildren();const max=Math.max(1,...activities.map(x=>sum(weekly,x)));
  for(const name of activities){const wrap=document.createElement('div');wrap.className='progress-item';const label=document.createElement('div');label.className='progress-label';const title=document.createElement('span');title.textContent=name;const count=document.createElement('strong');count.textContent=sum(weekly,name)+' min';label.append(title,count);const bar=document.createElement('div');bar.className='bar';const fill=document.createElement('div');fill.className='fill';fill.style.width=100*sum(weekly,name)/max+'%';bar.append(fill);wrap.append(label,bar);$('weekly-progress').append(wrap);}
  $('history-body').replaceChildren();for(const entry of entries.slice(0,200)){const tr=document.createElement('tr');for(const text of [entry.activity_date,entry.activity_name,entry.minutes]){const cell=document.createElement('td');cell.textContent=text;tr.append(cell);}$('history-body').append(tr);}
}
async function refresh(){const {data,error}=await db.from('activities').select('id,activity_name,activity_date,minutes,created_at').order('activity_date',{ascending:false}).order('created_at',{ascending:false}).limit(2000);if(error)throw error;entries=data||[];render();}
async function show(user){session=user;$('login-section').hidden=!!user;$('private-content').hidden=!user;$('signed-in-as').textContent=user?.email||'';if(!user){entries=[];started=null;clearInterval(ticker);ticker=null;clock();controls();return;}try{await refresh();}catch(e){message('Could not load activities: '+e.message,true);}}
async function save(activity,date,minutes){
  if(busy)return;minutes=Number(minutes);
  if(!activities.includes(activity)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isSafeInteger(minutes)||minutes<1||minutes>1440){message('Enter an activity, valid date and 1–1440 whole minutes.',true);return;}
  busy=true;controls();message('Saving…');
  try{const {data,error}=await db.functions.invoke('log-activity',{body:{activity_name:activity,activity_date:date,minutes}});if(error)throw error;if(!data?.saved)throw Error(data?.error||'Save not confirmed');await refresh();message(data.sync_queued?'Saved. Encrypted Excel export queued.':'Saved in database; Excel export not queued. Automatic daily retry is available.',!data.sync_queued);}
  catch(e){message('Save failed: '+e.message,true);}finally{busy=false;controls();}
}
if(!cfg?.supabaseUrl||cfg.supabaseUrl.includes('YOUR_PROJECT_REF')||!cfg.supabasePublishableKey||cfg.supabasePublishableKey.includes('YOUR_'))message('Configure docs/config.js with Supabase project URL and publishable key.',true);
else{db=createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);const {data}=await db.auth.getSession();await show(data.session?.user||null);db.auth.onAuthStateChange((_,newSession)=>{if(newSession?.user?.id!==session?.id)queueMicrotask(()=>show(newSession?.user||null));});}
$('manual-date').value=today();
$('login-form').onsubmit=async e=>{e.preventDefault();if(!db)return;const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('password').value='';if(error)message(error.message,true);else message('Logged in.');};
$('logout').onclick=async()=>{if(db)await db.auth.signOut();message('Logged out.');};
$('start-timer').onclick=()=>{if(started!==null)return;started=Date.now();$('timer-activity').disabled=true;ticker=setInterval(clock,250);clock();controls();message('Timer running.');};
$('stop-timer').onclick=async()=>{if(started===null)return;const mins=Math.max(1,Math.ceil((Date.now()-started)/60000));started=null;clearInterval(ticker);ticker=null;$('timer-activity').disabled=false;clock();controls();await save($('timer-activity').value,today(),mins);};
$('manual-form').onsubmit=async e=>{e.preventDefault();await save($('manual-activity').value,$('manual-date').value,Number($('manual-minutes').value));};
setInterval(()=>{if(session)render();},60000);
