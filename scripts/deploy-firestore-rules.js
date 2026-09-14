/* Publish firestore.rules through the official Firebase Rules API.
   Requires GOOGLE_APPLICATION_CREDENTIALS and never embeds credential data. */
const admin=require('firebase-admin');
const fs=require('node:fs');
const path=require('node:path');

const credentialPath=process.env.GOOGLE_APPLICATION_CREDENTIALS;
const credentialProject=credentialPath?JSON.parse(fs.readFileSync(credentialPath,'utf8')).project_id:null;
admin.initializeApp({credential:admin.credential.applicationDefault(),projectId:credentialProject||undefined});
const projectId=admin.app().options.projectId||process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
if(!projectId)throw new Error('Firebase project ID is unavailable.');

async function request(url,options){
  const token=await admin.app().options.credential.getAccessToken();
  const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json',...(options.headers||{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`${response.status} ${JSON.stringify(body)}`);
  return body;
}

(async()=>{
  const content=fs.readFileSync(path.resolve('firestore.rules'),'utf8');
  const ruleset=await request(`https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,{method:'POST',body:JSON.stringify({source:{files:[{name:'firestore.rules',content}]}})});
  if(process.argv.includes('--validate-only')){
    console.log(JSON.stringify({projectId,ruleset:ruleset.name,validated:true},null,2));
    return;
  }
  const releaseName=`projects/${projectId}/releases/cloud.firestore`;
  const release=await request(`https://firebaserules.googleapis.com/v1/${releaseName}`,{method:'PATCH',body:JSON.stringify({release:{name:releaseName,rulesetName:ruleset.name},updateMask:'ruleset_name'})});
  console.log(JSON.stringify({projectId,ruleset:ruleset.name,release:release.name},null,2));
})().catch(error=>{console.error('Rules deployment failed:',error.message);process.exitCode=1;});
