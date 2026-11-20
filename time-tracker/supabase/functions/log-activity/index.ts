import {createClient} from 'npm:@supabase/supabase-js@2';
const ok=new Set(['Meditation','Gym','Reading']);
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'',allowed=Deno.env.get('ALLOWED_ORIGIN')||'';
 const cors={'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(!allowed||origin!==allowed)return new Response('Forbidden',{status:403});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const bearer=req.headers.get('authorization')||'',token=bearer.startsWith('Bearer ')?bearer.slice(7):'';
 if(!token)return reply({error:'Login required'},401);
 const url=Deno.env.get('PROJECT_URL'),key=Deno.env.get('PUBLIC_API_KEY'),owner=Deno.env.get('OWNER_USER_ID');
 const ghToken=Deno.env.get('GITHUB_ACTIONS_TOKEN'),repo=Deno.env.get('DATA_REPO');
 if(!url||!key||!owner||!ghToken||!repo||!/^[\w.-]+\/[\w.-]+$/.test(repo))return reply({error:'Backend not configured'},500);
 const db=createClient(url,key,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authErr}=await db.auth.getUser(token);
 if(authErr||!auth.user||auth.user.id!==owner)return reply({error:'Not authorized'},403);
 let input;try{input=await req.json();}catch{return reply({error:'Invalid JSON'},400);}
 const {activity_name,activity_date,minutes}=input;
 if(!ok.has(activity_name)||typeof activity_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(activity_date)||!Number.isInteger(minutes)||minutes<1||minutes>1440||Number.isNaN(Date.parse(activity_date))||new Date(activity_date+'T00:00:00Z').toISOString().slice(0,10)!==activity_date||activity_date<'2000-01-01'||activity_date>'2100-12-31')return reply({error:'Invalid activity'},400);
 const {data:saved,error}=await db.from('activities').insert({user_id:owner,activity_name,activity_date,minutes}).select('id').single();
 if(error)return reply({error:'Save failed'},500);
 let sync_queued=false;
 try{const response=await fetch('https://api.github.com/repos/'+repo+'/actions/workflows/sync-excel.yml/dispatches',{method:'POST',headers:{Authorization:'Bearer '+ghToken,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:JSON.stringify({ref:'main'})});sync_queued=response.status===204;if(!sync_queued)console.error('Workflow dispatch failed',response.status);}catch(e){console.error(e);}
 return reply({saved:true,id:saved.id,sync_queued});
});
