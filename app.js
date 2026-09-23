const $=s=>document.querySelector(s);
const state={generated:{},notes:[],playing:false,timer:null,ctx:null,osc:[],objectUrl:null,reference:null};

const advice={
Rap:[['Drums','808 Kit','Punchy'],['Bass','808 / Sub Bass','Glide'],['Chords','Electric Piano','Warm'],['Melody','Bell / Pluck','Simple']],
Drill:[['Drums','Drill Kit','Tight'],['Bass','808 Slide','Glide'],['Chords','Dark Piano','Sparse'],['Melody','Bell Pluck','Cold']],
Trap:[['Drums','Trap Kit','Sharp'],['Bass','808','Deep'],['Chords','Dark Keys','Wide'],['Melody','Synth Lead','Catchy']],
Hyperpop:[['Drums','Digital Kit','Bright'],['Bass','Distorted Bass','Heavy'],['Chords','Juno Pad','Wide'],['Melody','Supersaw Lead','Glitchy']],
'R&B':[['Drums','Neo Soul Kit','Soft'],['Bass','Moog Bass','Round'],['Chords','Rhodes','Warm'],['Melody','Soft Lead','Smooth']],
Pop:[['Drums','Pop Kit','Clean'],['Bass','Electric Bass','Tight'],['Chords','Piano / Pad','Open'],['Melody','Synth Lead','Catchy']],
Phonk:[['Drums','Memphis Kit','Crunchy'],['Bass','808','Dirty'],['Chords','Cowbell / Keys','Dark'],['Melody','Cowbell Lead','Raw']],
'Hard Techno':[['Drums','909 Kit','Hard'],['Bass','Reese Bass','Driving'],['Chords','Rave Stab','Aggressive'],['Melody','Acid Lead','Repeating']],
'Lo-fi':[['Drums','Dusty Kit','Loose'],['Bass','Upright Bass','Soft'],['Chords','Rhodes','Warm'],['Melody','Tape Piano','Worn']],
Rock:[['Drums','Acoustic Kit','Live'],['Bass','Electric Bass','Punchy'],['Chords','Electric Guitar','Wide'],['Melody','Guitar Lead','Expressive']],
Experimental:[['Drums','Hybrid Percussion','Odd'],['Bass','Modular Bass','Moving'],['Chords','Granular Pad','Abstract'],['Melody','Texture Lead','Unusual']]
};
const tracks=['drums','bass','chords','melody','counter'];
function renderAdvice(){
 const a=advice[$('#style').value]||advice.Rap;
 $('#instrumentAdvice').innerHTML=a.map(x=>`<div class="advice"><b>${x[0]}</b><span>${x[1]} · ${x[2]}</span></div>`).join('');
}
function renderTracks(){
 const a=advice[$('#style').value]||advice.Rap;
 const names=[['Drums','Percussion'],['Bass','Low-end'],['Chords','Harmony'],['Melody','Hook'],['Counter melody','Details']];
 $('#tracks').innerHTML=names.map((t,i)=>`<div class="track"><i class="dot"></i><div class="track-info"><b>${t[0]}</b><small>${a[i]?.[1]||'MIDI'} · ${a[i]?.[2]||t[1]}</small></div><small>MIDI</small><button type="button" data-track="${tracks[i]}">↓</button></div>`).join('');
 document.querySelectorAll('[data-track]').forEach(b=>b.onclick=()=>downloadTrack(b.dataset.track));
}
function renderPreview(){
 const bars=+$('#bars').value,bpm=+$('#bpm').value,total=bars*1920;
 $('#previewMeta').textContent=`${bars} mesures · ${bpm} BPM`;
 const lanes=[['drums','DRUMS'],['bass','BASS'],['chords','CHORDS'],['melody','MELODY'],['counter','COUNTER']];
 $('#timeline').innerHTML=lanes.map(([id,name])=>`<div class="midi-lane"><span>${name}</span><div class="lane-notes" data-lane="${id}"></div></div>`).join('');
 for(const n of state.notes){
   const lane=document.querySelector(`[data-lane="${n.track}"]`); if(!lane) continue;
   const el=document.createElement('i'); el.className='midi-note';
   el.style.left=`${Math.max(0,Math.min(99.8,n.t/total*100))}%`;
   el.style.width=`${Math.max(.35,n.d/total*100)}%`;
   el.style.top=`${Math.max(4,Math.min(88,86-(n.p%48)*1.65))}%`;
   lane.appendChild(el);
 }
}
function hashSeed(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let h=hashSeed(seed);return()=>{h=(Math.imul(h,1664525)+1013904223)>>>0;return h/4294967296}}
function vlq(n){let buffer=n&127,out=[];while((n>>=7)){buffer<<=8;buffer|=(n&127)|128}for(;;){out.push(buffer&255);if(buffer&128)buffer>>=8;else break}return out}
function u32(n){return[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]}
function midiChunk(tag,data){return[...tag].map(c=>c.charCodeAt(0)).concat(u32(data.length),data)}
function makeMidi(notes,bpm,channel=0){
 const ppq=480,tempo=Math.round(60000000/bpm),events=[];
 events.push({t:0,data:[255,81,3,(tempo>>16)&255,(tempo>>8)&255,tempo&255]});
 for(const n of notes){events.push({t:Math.max(0,n.t),data:[144|channel,n.p&127,n.v??80]});events.push({t:Math.max(0,n.t+n.d),data:[128|channel,n.p&127,0]})}
 events.sort((a,b)=>a.t-b.t);
 let bytes=[],last=0;
 for(const e of events){bytes.push(...vlq(Math.max(0,e.t-last)),...e.data);last=e.t}
 bytes.push(0,255,47,0);
 return new Uint8Array([...midiChunk('MThd',[0,0,0,6,0,0,0,1,1,224]),...midiChunk('MTrk',bytes)]);
}
function addNote(arr,t,p,d,v,ch=0){arr.push({t,p,d,v,ch})}
function compose(){
 const bpm=Math.max(60,Math.min(200,+$('#bpm').value||140)),bars=+$('#bars').value,style=$('#style').value,mood=$('#mood').value,complexity=+$('#complexity').value/100;
 const r=rng($('#seed').value+'|'+style+'|'+mood);
 const rootMap={Rap:[48,45,43,50],Drill:[38,41,43,36],Trap:[48,43,45,41],Hyperpop:[57,53,60,55],'R&B':[45,50,52,48],Pop:[48,43,45,50],Phonk:[45,41,43,38],'Hard Techno':[41,43,36,38],'Lo-fi':[48,45,43,50],Rock:[40,43,45,38],Experimental:[50,46,53,48]};
 const roots=rootMap[style]||rootMap.Rap, scale=[0,2,3,5,7,8,10],o={drums:[],bass:[],chords:[],melody:[],counter:[]};
 for(let bar=0;bar<bars;bar++){
   const base=bar*1920,root=roots[bar%roots.length],energy=mood==='Énergique'||style==='Hard Techno'?1.2:mood==='Mélancolique'?.82:1;
   const chord=[root,root+3,root+7];
   chord.forEach((p,j)=>addNote(o.chords,base,p,1800,48+Math.round(r()*15)));
   addNote(o.bass,base,root-12,420,88); if(r()<.8)addNote(o.bass,base+960,root-12+(r()<.3?12:0),360,75);
   for(let step=0;step<16;step++){
     const t=base+step*120;
     if(step%4===0)addNote(o.drums,t,36,70,108,9);
     if((step===4||step===12)||(style==='Hard Techno'&&step%2===0))addNote(o.drums,t,38,55,92,9);
     if(step%2===0||r()<complexity*.35)addNote(o.drums,t+((style==='Drill'&&step%4===2)?30:0),42,42,55,9);
     if(complexity>.65&&r()<complexity*.28)addNote(o.drums,t,46,35,45,9);
   }
   const melodicDensity=Math.max(1,Math.round(2+complexity*4));
   for(let k=0;k<melodicDensity;k++){
     const t=base+Math.floor(r()*16)*120+60,p=root+12+scale[Math.floor(r()*scale.length)];
     addNote(o.melody,t,p,120+r()*240,62+Math.round(r()*25));
     if(r()<complexity*.55)addNote(o.counter,t+60,p+12,100+r()*150,40+Math.round(r()*20));
   }
   if(style==='Phonk'||style==='Hard Techno')for(let k=0;k<4;k++)addNote(o.melody,base+k*480,root+24+scale[(bar+k)%scale.length],180,70);
 }
 state.notes=Object.entries(o).flatMap(([track,notes])=>notes.map(n=>({...n,track})));
 return Object.fromEntries(Object.entries(o).map(([k,v])=>[k,{midi:makeMidi(v,bpm,k==='drums'?9:tracks.indexOf(k)),notes:v}]));
}
function downloadBlob(name,data){const url=URL.createObjectURL(new Blob([data],{type:'audio/midi'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function downloadTrack(track){const d=state.generated[track];if(d)downloadBlob(`melodix-${track}.mid`,d.midi)}
function generate(){
 const btn=$('#generate');btn.disabled=true;$('#statusBadge').textContent='BUILDING';$('#statusBadge').classList.remove('done');$('#statusBadge').style.color='var(--accent)';
 $('#statusBadge').textContent='GENERATING…';$('#emptyOutput').hidden=false;$('#emptyOutput').innerHTML='<div class="spinner">✦</div><b>Construction de la composition…</b><span>Patterns · harmonie · drums · mélodie</span>';$('#result').hidden=true;
 stopPreview();
 setTimeout(()=>{state.generated=compose();renderPreview();renderTracks();$('#result').hidden=false;$('#emptyOutput').hidden=true;$('#all').disabled=false;btn.disabled=false;$('#statusBadge').textContent='GENERATED';$('#statusBadge').classList.add('done');$('#transportTitle').textContent=`${$('#style').value} · ${$('#mood').value}`;},550);
}
function stopPreview(){
 state.playing=false;clearInterval(state.timer);state.timer=null;
 state.osc.forEach(o=>{try{o.stop()}catch{}});state.osc=[];if(state.ctx){try{state.ctx.close()}catch{}state.ctx=null}
 $('#playPreview').textContent='▶';$('#transportFill').style.width='0%';$('#playTime').textContent='00:00';
}
function playPreview(){
 if(!state.notes.length)return;
 stopPreview();state.playing=true;$('#playPreview').textContent='Ⅱ';
 const bpm=+$('#bpm').value,secTick=60/bpm/480,total=+$('#bars').value*1920,start=performance.now();
 const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx){alert('Ton navigateur ne supporte pas Web Audio.');stopPreview();return}
 const ctx=new Ctx();state.ctx=ctx;const now=ctx.currentTime+.04;
 for(const n of state.notes){
   const osc=ctx.createOscillator(),gain=ctx.createGain(),when=now+n.t*secTick,dur=Math.max(.045,n.d*secTick);
   osc.type=n.track==='drums'?'square':n.track==='bass'?'sawtooth':n.track==='chords'?'triangle':'sine';
   osc.frequency.value=n.track==='drums'?(n.p===36?75:n.p===38?180:700):440*Math.pow(2,(n.p-69)/12);
   gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(n.track==='drums'?.09:n.track==='bass'?.055:.035,when+.008);gain.gain.exponentialRampToValueAtTime(.0001,when+dur);
   osc.connect(gain).connect(ctx.destination);osc.start(when);osc.stop(when+dur+.02);state.osc.push(osc);
 }
 state.timer=setInterval(()=>{const elapsed=(performance.now()-start)/1000,tick=elapsed/secTick,p=Math.min(1,tick/total);$('#transportFill').style.width=p*100+'%';const sec=Math.max(0,elapsed);$('#playTime').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(Math.floor(sec%60)).padStart(2,'0')}`;if(p>=1)stopPreview()},50);
}
const file=$('#file'),drop=$('#drop'),player=$('#player');
function loadReference(f){
 if(!f||!f.type.startsWith('audio/')){return}
 if(state.reference?.url)URL.revokeObjectURL(state.reference.url);
 const url=URL.createObjectURL(f);state.reference={url};
 player.src=url;player.hidden=false;$('#fileName').textContent=f.name;$('#format').textContent=(f.name.split('.').pop()||'AUDIO').toUpperCase();$('#refState').textContent='READY';$('#statusBadge').textContent='REF READY';
 player.onloadedmetadata=()=>$('#duration').textContent=Number.isFinite(player.duration)?fmt(player.duration):'—';
}
function fmt(s){return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}
file.onchange=e=>loadReference(e.target.files[0]);
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag')}));
drop.addEventListener('drop',e=>loadReference(e.dataTransfer.files[0]));
$('#clearRef').onclick=()=>{if(state.reference?.url)URL.revokeObjectURL(state.reference.url);state.reference=null;file.value='';player.removeAttribute('src');player.load();player.hidden=true;$('#fileName').textContent='Dépose ton morceau';$('#duration').textContent='—';$('#format').textContent='—';$('#refState').textContent='VIDE'};
$('#complexity').oninput=e=>$('#complexityOut').textContent=e.target.value+'%';
$('#style').onchange=()=>{renderAdvice();if(state.notes.length)renderPreview();if(!state.generated.drums)renderTracks()};
$('#bars').onchange=()=>{if(state.notes.length)renderPreview()};
$('#bpm').oninput=()=>{if(state.notes.length)renderPreview()};
$('#generate').onclick=generate;$('#regen').onclick=generate;$('#playPreview').onclick=()=>state.playing?stopPreview():playPreview();
$('#all').onclick=()=>Object.entries(state.generated).forEach(([n,d],i)=>setTimeout(()=>downloadBlob(`melodix-${n}.mid`,d.midi),i*120));
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='SELECT')generate()});
renderAdvice();renderTracks();