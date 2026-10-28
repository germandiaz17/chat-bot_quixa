const fs=require('fs');
const KEY=fs.readFileSync('.env','utf8').match(/GEMINI_API_KEY=(.+)/)[1].trim();
const body={contents:[{parts:[{text:"Responde solo con la palabra: listo"}]}],
  generationConfig:{maxOutputTokens:20}};
async function hit(m){
  const t0=Date.now();
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEY}`,
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  const lim=j.error?.message?.match(/limit: (\d+)/)?.[1];
  return {ok:r.ok,ms:Date.now()-t0,lim,err:j.error?.status};
}
(async()=>{
  for(const m of (process.argv[2]||'gemini-2.5-flash-lite').split(',')){
    const res=[];
    for(let i=0;i<8;i++) res.push(await hit(m));
    const ok=res.filter(r=>r.ok).length;
    const lim=res.find(r=>r.lim)?.lim;
    const avg=Math.round(res.filter(r=>r.ok).reduce((a,r)=>a+r.ms,0)/(ok||1));
    console.log(`${m.padEnd(26)} ${ok}/8 ok  lat~${avg}ms  ${lim?`cuota=${lim} RPM`:'sin tope alcanzado'}`);
  }
})();
