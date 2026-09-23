const $=s=>document.querySelector(s);
const state={generated:{},notes:[],playing:false,timer:null,ctx:null,osc:[],reference:null};

const palette={
Rap:[['Drums','808 / Trap Kit','Punchy'],['Bass','808 Sub','Glide'],['Chords','Electric Piano','Warm'],['Melody','Bell / Pluck','Hook'],['Counter melody','Soft Pad','Air']],
Drill:[['Drums','Drill Kit','Tight'],['Bass','808 Slide','Glide'],['Chords','Dark Piano','Sparse'],['Melody','Bell Pluck','Cold'],['Counter melody','Choir Pad','Dark']],
Trap:[['Drums','Trap Kit','Sharp'],['Bass','808','Deep'],['Chords','Dark Keys','Wide'],['Melody','Synth Lead','Catchy'],['Counter melody','Pluck','Detail']],
Hyperpop:[['Drums','Digital Kit','Bright'],['Bass','Distorted Bass','Heavy'],['Chords','Juno Pad','Wide'],['Melody','Supersaw','Huge'],['Counter melody','Digital Pluck','Glitchy']],
'R&B':[['Drums','Neo Soul Kit','Soft'],['Bass','Moog Bass','Round'],['Chords','Rhodes','Warm'],['Melody','Soft Lead','Smooth'],['Counter melody','Vocal Pad','Airy']],
Pop:[['Drums','Pop Kit','Clean'],['Bass','Electric Bass','Tight'],['Chords','Piano / Pad','Open'],['Melody','Synth Lead','Catchy'],['Counter melody','Bell','Bright']],
Phonk:[['Drums','Memphis Kit','Crunchy'],['Bass','Dirty 808','Heavy'],['Chords','Cowbell / Keys','Dark'],['Melody','Cowbell Lead','Raw'],['Counter melody','Choir','Haunted']],
'Hard Techno':[['Drums','909 Kit','Hard'],['Bass','Reese Bass','Driving'],['Chords','Rave Stab','Aggressive'],['Melody','Acid Lead','Repeating'],['Counter melody','Noise FX','Texture']],
'Lo-fi':[['Drums','Dusty Kit','Loose'],['Bass','Upright Bass','Soft'],['Chords','Rhodes','Warm'],['Melody','Tape Piano','Worn'],['Counter melody','Vinyl Pad','Dust']],
Rock:[['Drums','Acoustic Kit','Live'],['Bass','Electric Bass','Punchy'],['Chords','Electric Guitar','Wide'],['Melody','Guitar Lead','Expressive'],['Counter melody','Guitar Texture','Wide']],
Experimental:[['Drums','Hybrid Percussion','Odd'],['Bass','Modular Bass','Moving'],['Chords','Granular Pad','Abstract'],['Melody','Texture Lead','Unusual'],['Counter melody','FX Pluck','Random']]
};
const trackIds=['drums','bass','chords','melody','counter','arp'];
const trackNames={drums:'Drums',bass:'Bass',chords:'Chords',melody:'Melody','counter':'Counter melody',arp:'Arp / Texture'};
const gm={drums:0,bass:38,chords:4,melody:81,counter:89,arp:88};

function renderAdvice(){
 const a=palette[$('#style').value]||palette.Rap;
 $('#instrumentAdvice').innerHTML=a.map(x=>`<div class="advice"><b>${x[0]}</b><span>${x[1]} · ${x[2]}</span></div>`).join('');
}
function renderTracks(){
 const a=palette[$('#style').value]||palette.Rap;
 $('#tracks').innerHTML=['drums','bass','chords','melody','counter','arp'].map((id,i)=>{
   const p=a[i]||['Arp / Texture','Synth Pluck','Motion'];
   return `<div class="track"><i class="dot"></i><div class="track-info"><b>${trackNames[id]}</b><small>${p[1]} · ${p[2]}</small></div><small>MIDI</small><button type="button" data-track="${id}">↓</button></div>`;
 }).join('');
 document.querySelectorAll('[data-track]').forEach(b=>b.onclick=()=>downloadTrack(b.dataset.track));
}
function renderTrackDownloads(){
 const ids=Object.keys(state.generated).filter(x=>x!=='full');
 $('#trackDownloads').innerHTML=ids.map(id=>`<button class="track-download" data-track="${id}" type="button">${trackNames[id]||id}</button>`).join('');
 document.querySelectorAll('.track-download').forEach(b=>b.onclick=()=>downloadTrack(b.dataset.track));
}
function renderPreview(){
 const bars=+$('#bars').value,total=bars*1920;
 $('#previewMeta').textContent=`${bars} mesures · ${+$('#bpm').value} BPM`;
 const lanes=[['drums','DRUMS'],['bass','BASS'],['chords','CHORDS'],['melody','MELODY'],['counter','COUNTER'],['arp','ARP']];
 $('#timeline').innerHTML=lanes.map(([id,name])=>`<div class="midi-lane"><span>${name}</span><div class="lane-notes" data-lane="${id}"></div></div>`).join('');
 for(const n of state.notes){
   const lane=document.querySelector(`[data-lane="${n.track}"]`);if(!lane)continue;
   const el=document.createElement('i');el.className='midi-note';
   el.style.left=Math.min(99.8,n.t/total*100)+'%';el.style.width=Math.max(.25,n.d/total*100)+'%';
   el.style.top=Math.max(3,Math.min(91,88-(n.p%48)*1.6))+'%';lane.appendChild(el);
 }
}
function hashSeed(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let h=hashSeed(seed);return()=>{h=(Math.imul(h,1664525)+1013904223)>>>0;return h/4294967296}}
function vlq(n){let b=n&127,out=[];while((n>>=7)){b<<=8;b|=(n&127)|128}for(;;){out.push(b&255);if(b&128)b>>=8;else break}return out}
function u32(n){return[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]}
function chunk(tag,data){return[...tag].map(c=>c.charCodeAt(0)).concat(u32(data.length),data)}
function makeTrack(notes,bpm,channel,program,name){
 const tempo=Math.round(60000000/bpm),events=[{t:0,data:[255,3,name.length,...name.split('').map(c=>c.charCodeAt(0))]},{t:0,data:[192|channel,program&127]},{t:0,data:[255,81,3,(tempo>>16)&255,(tempo>>8)&255,tempo&255]}];
 for(const n of notes){events.push({t:n.t,data:[144|channel,n.p&127,n.v&127]});events.push({t:n.t+n.d,data:[128|channel,n.p&127,0]})}
 events.sort((a,b)=>a.t-b.t);
 let data=[],last=0;for(const e of events){data.push(...vlq(Math.max(0,e.t-last)),...e.data);last=e.t}data.push(0,255,47,0);
 return data;
}
function makeMidi(notes,bpm,channel,program,name){
 const tr=makeTrack(notes,bpm,channel,program,name);
 return new Uint8Array([...chunk('MThd',[0,0,0,6,0,1,0,1,1,224]),...chunk('MTrk',tr)]);
}
function makeFullMidi(all,bpm){
 const tracks=Object.entries(all).filter(([k])=>k!=='full');
 const chunks=[];
 for(const [id,notes] of tracks)chunks.push(chunk('MTrk',makeTrack(notes,bpm,id==='drums'?9:tracks.indexOf(id),gm[id]||0,trackNames[id])));
 return new Uint8Array([...chunk('MThd',[0,0,0,6,0,1,(chunks.length>>8)&255,chunks.length&255,1,224]),...chunks.flat()]);
}
function add(a,t,p,d,v,ch=0){a.push({t:Math.round(t),p:Math.max(0,Math.min(127,Math.round(p))),d:Math.max(20,Math.round(d)),v:Math.max(1,Math.min(127,Math.round(v))),ch})}
function chooseScale(style){return style==='Hard Techno'?[0,1,3,4,7,8,10]:style==='R&B'||style==='Pop'?[0,2,4,5,7,9,11]:[0,2,3,5,7,8,10]}
function sectionFor(bar,bars){
 const x=bar/bars;
 if(x<.125)return'intro';
 if(x<.375)return'verse';
 if(x<.625)return'hook';
 if(x<.875)return'verse2';
 return'outro';
}
function compose(){
 const bpm=Math.max(60,Math.min(200,+$('#bpm').value||140)),bars=+$('#bars').value,style=$('#style').value,mood=$('#mood').value;
 const complexity=+$('#complexity').value/100,energy=+$('#energy').value/100,r=rng($('#seed').value+'|'+style+'|'+mood+'|'+$('#substyle').value);
 const rootMap={Rap:[48,45,43,50],Drill:[38,41,43,36],Trap:[48,43,45,41],Hyperpop:[57,53,60,55],'R&B':[45,50,52,48],Pop:[48,43,45,50],Phonk:[45,41,43,38],'Hard Techno':[41,43,36,38],'Lo-fi':[48,45,43,50],Rock:[40,43,45,38],Experimental:[50,46,53,48]};
 const roots=rootMap[style]||rootMap.Rap,scale=chooseScale(style),o={drums:[],bass:[],chords:[],melody:[],counter:[],arp:[]};
 const addChord=(base,root,section)=>{
   const voicing=[root,root+3,root+7,root+10];
   const len=section==='hook'?1860:section==='intro'?1800:1750;
   voicing.slice(0,section==='intro'?3:4).forEach((p,j)=>add(o.chords,base,p,len,42+energy*20));
 };
 for(let bar=0;bar<bars;bar++){
   const base=bar*1920,root=roots[bar%roots.length],section=sectionFor(bar,bars),intro=section==='intro',outro=section==='outro',hook=section==='hook';
   const activeEnergy=(intro?.45:outro?.55:hook?1.15:1)*energy;
   addChord(base,root,section);
   if(!intro||r()<.55)add(o.bass,base,root-12,420,72+activeEnergy*30);
   if(!intro&&r()<.8)add(o.bass,base+720,root-12+(r()<.3?12:0),300,65+activeEnergy*25);
   if(hook&&r()<.75)add(o.bass,base+1200,root-12,420,70+activeEnergy*25);
   const density=Math.max(3,Math.round(5+complexity*10));
   for(let s=0;s<16;s++){
     const t=base+s*120;
     const kick=(style==='Hard Techno')?(s%2===0):(s%8===0||s===6||s===12);
     if((!intro||s%4===0)&&kick)add(o.drums,t,36,65,88+activeEnergy*30,9);
     if(!intro&&(s===4||s===12||style==='Rock'&&s%8===4))add(o.drums,t,38,55,80+activeEnergy*25,9);
     if(!intro&&(s%2===0||r()<complexity*.3))add(o.drums,t,42,38,48+activeEnergy*25,9);
     if(!intro&&$('#fills').checked&&s>13&&r()<complexity*.35)add(o.drums,t,45,35,45,9);
   }
   const melodicCount=hook?density+3:density-1;
   for(let n=0;n<melodicCount;n++){
     const step=Math.floor(r()*16),t=base+step*120+30,p=root+12+scale[Math.floor(r()*scale.length)]+(r()<.18?12:0);
     add(o.melody,t,p,90+r()*260,50+activeEnergy*45);
     if($('#counter').checked&&hook&&r()<complexity*.55)add(o.counter,t+60,p+7,100+r()*180,35+activeEnergy*25);
   }
   if($('#arp').checked&&(!intro||r()<.6)){
     const chord=[root,root+3,root+7,root+10];
     for(let s=0;s<8;s++)if(r()<.55+complexity*.4)add(o.arp,base+s*240,chord[s%4]+12,120,28+activeEnergy*22);
   }
   if($('#variations').checked&&bar%4===3&&!intro){
     add(o.melody,base+1680,root+24+scale[(bar+2)%scale.length],180,65+activeEnergy*25);
     if($('#counter').checked)add(o.counter,base+1740,root+19,120,45);
   }
 }
 if(!$('#intro').checked){for(const k of ['drums','melody','counter','arp'])o[k]=o[k].filter(n=>n.t>=1920)}
 if(!$('#outro').checked){const cut=Math.max(0,(bars-4)*1920);for(const k of Object.keys(o))o[k]=o[k].filter(n=>n.t<cut)}
 state.notes=Object.entries(o).flatMap(([track,arr])=>arr.map(n=>({...n,track})));
 const generated={};
 for(const [id,arr] of Object.entries(o))generated[id]={midi:makeMidi(arr,bpm,id==='drums'?9:trackIds.indexOf(id),gm[id]||0,trackNames[id]),notes:arr};
 generated.full={midi:makeFullMidi(o,bpm),notes:state.notes};
 return generated;
}
function downloadBlob(name,data){const u=URL.createObjectURL(new Blob([data],{type:'audio/midi'})),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1200)}
function downloadTrack(id){const d=state.generated[id];if(d)downloadBlob(id==='full'?'melodix-instrumentale-full.mid':`melodix-${id}.mid`,d.midi)}
function generate(){
 const btn=$('#generate');btn.disabled=true;stopPreview();$('#statusBadge').textContent='GENERATING…';$('#statusBadge').classList.remove('done');$('#emptyOutput').hidden=false;$('#result').hidden=true;$('#emptyOutput').innerHTML='<div>✦</div><b>Construction de l\'instrumentale…</b><span>Structure · drums · 808 · harmonie · mélodie · variations</span>';
 setTimeout(()=>{state.generated=compose();renderPreview();renderTracks();renderTrackDownloads();$('#result').hidden=false;$('#emptyOutput').hidden=true;$('#all').disabled=false;btn.disabled=false;$('#statusBadge').textContent='GENERATED';$('#statusBadge').classList.add('done');$('#transportTitle').textContent=`${$('#style').value} · ${$('#mood').value}`},700);
}
function stopPreview(){state.playing=false;clearInterval(state.timer);state.timer=null;state.osc.forEach(o=>{try{o.stop()}catch{}});state.osc=[];if(state.ctx){try{state.ctx.close()}catch{}}state.ctx=null;$('#playPreview').textContent='▶';$('#transportFill').style.width='0%';$('#playTime').textContent='00:00'}
function playPreview(){
 if(!state.notes.length)return;stopPreview();state.playing=true;$('#playPreview').textContent='Ⅱ';
 const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx){alert('Web Audio indisponible dans ce navigateur.');stopPreview();return}
 const ctx=new Ctx();state.ctx=ctx;const bpm=+$('#bpm').value;const secTick=60/bpm/480,total=+$('#bars').value*1920,start=performance.now(),now=ctx.currentTime+.05;
 for(const n of state.notes){
   const osc=ctx.createOscillator(),gain=ctx.createGain(),when=now+n.t*secTick,dur=Math.max(.035,n.d*secTick);
   let freq=440*Math.pow(2,(n.p-69)/12);
   if(n.track==='drums')freq=n.p===36?75:n.p===38?180:n.p===46?420:720;
   osc.type=n.track==='drums'?'square':n.track==='bass'?'sawtooth':n.track==='chords'?'triangle':n.track==='arp'?'square':'sine';
   osc.frequency.setValueAtTime(freq,when);
   const vol=n.track==='drums'?.055:n.track==='bass'?.045:n.track==='chords'?.022:n.track==='arp'?.018:.03;
   gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(vol,when+.008);gain.gain.exponentialRampToValueAtTime(.0001,when+dur);
   osc.connect(gain).connect(ctx.destination);osc.start(when);osc.stop(when+dur+.015);state.osc.push(osc);
 }
 state.timer=setInterval(()=>{const elapsed=(performance.now()-start)/1000,p=Math.min(1,elapsed/(total*secTick));$('#transportFill').style.width=p*100+'%';$('#playTime').textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;if(p>=1)stopPreview()},50);
}
function loadReference(f){if(!f||!f.type.startsWith('audio/'))return;if(state.reference?.url)URL.revokeObjectURL(state.reference.url);const url=URL.createObjectURL(f);state.reference={url};$('#player').src=url;$('#player').hidden=false;$('#fileName').textContent=f.name;$('#format').textContent=(f.name.split('.').pop()||'AUDIO').toUpperCase();$('#refState').textContent='READY';$('#player').onloadedmetadata=()=>$('#duration').textContent=Number.isFinite($('#player').duration)?fmt($('#player').duration):'—'}
function fmt(s){return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}
const file=$('#file'),drop=$('#drop');
file.onchange=e=>loadReference(e.target.files[0]);
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag')}));
drop.addEventListener('drop',e=>loadReference(e.dataTransfer.files[0]));
$('#clearRef').onclick=()=>{if(state.reference?.url)URL.revokeObjectURL(state.reference.url);state.reference=null;file.value='';$('#player').removeAttribute('src');$('#player').load();$('#player').hidden=true;$('#fileName').textContent='Aucune référence';$('#duration').textContent='—';$('#format').textContent='—';$('#refState').textContent='AUTO'};
$('#energy').oninput=e=>$('#energyOut').textContent=e.target.value+'%';
$('#complexity').oninput=e=>$('#complexityOut').textContent=e.target.value+'%';
$('#style').onchange=()=>{renderAdvice();renderTracks()};
$('#bpm').oninput=()=>{if(state.notes.length)renderPreview()};
$('#bars').onchange=()=>{if(state.notes.length)renderPreview()};
$('#generate').onclick=generate;$('#regen').onclick=generate;$('#playPreview').onclick=()=>state.playing?stopPreview():playPreview();
$('#all').onclick=()=>downloadTrack('full');
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='SELECT')generate()});
renderAdvice();renderTracks();