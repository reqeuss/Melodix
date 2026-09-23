const $=s=>document.querySelector(s);
const state={generated:{},notes:[],playing:false,timer:null,reference:null,inspiration:null,players:{},ctx:null,audioCtx:null,drumCtx:null};

const palette={
Rap:[['Drums','808 / Trap Kit','Punchy'],['Bass','808 Sub','Glide'],['Chords','Electric Piano','Warm'],['Melody','Bell / Pluck','Hook'],['Counter melody','Soft Pad','Air']],
Drill:[['Drums','Drill Kit','Tight'],['Bass','808 Slide','Glide'],['Chords','Dark Piano','Sparse'],['Melody','Bell Pluck','Cold'],['Counter melody','Choir Pad','Dark']],
Trap:[['Drums','Trap Kit','Sharp'],['Bass','808','Deep'],['Chords','Dark Keys','Wide'],['Melody','Synth Lead','Catchy'],['Counter melody','Pluck','Detail']],
Hyperpop:[['Drums','Digital Kit','Bright'],['Bass','Distorted Bass','Heavy'],['Chords','Juno Pad','Wide'],['Melody','Supersaw','Huge'],['Counter melody','Digital Pluck','Glitchy']],
'R&B':[['Drums','Neo Soul Kit','Soft'],['Bass','Moog Bass','Round'],['Chords','Rhodes','Warm'],['Melody','Soft Lead','Smooth'],['Counter melody','Vocal Pad','Air']],
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

function renderAdvice(){const a=palette[$('#style').value]||palette.Rap;$('#instrumentAdvice').innerHTML=a.map(x=>'<div class="advice"><b>'+x[0]+'</b><span>'+x[1]+' · '+x[2]+'</span></div>').join('')}
function renderTracks(){const a=palette[$('#style').value]||palette.Rap;$('#tracks').innerHTML=trackIds.map((id,i)=>{const p=a[i]||['Arp / Texture','Synth Pluck','Motion'];return '<div class="track"><i class="dot"></i><div class="track-info"><b>'+trackNames[id]+'</b><small>'+p[1]+' · '+p[2]+'</small></div><small>MIDI</small><button type="button" data-track="'+id+'">↓</button></div>'}).join('');document.querySelectorAll('[data-track]').forEach(b=>b.onclick=()=>downloadTrack(b.dataset.track))}
function renderTrackDownloads(){const ids=Object.keys(state.generated).filter(x=>x!=='full');$('#trackDownloads').innerHTML=ids.map(id=>'<button class="track-download" data-track="'+id+'" type="button">'+trackNames[id]+'</button>').join('');document.querySelectorAll('.track-download').forEach(b=>b.onclick=()=>downloadTrack(b.dataset.track))}
function renderPreview(){const bars=+$('#bars').value,total=bars*1920;$('#previewMeta').textContent=bars+' mesures · '+$('#bpm').value+' BPM';const lanes=[['drums','DRUMS'],['bass','BASS'],['chords','CHORDS'],['melody','MELODY'],['counter','COUNTER'],['arp','ARP']];$('#timeline').innerHTML=lanes.map(([id,name])=>'<div class="midi-lane"><span>'+name+'</span><div class="lane-notes" data-lane="'+id+'"></div></div>').join('');for(const n of state.notes){const lane=document.querySelector('[data-lane="'+n.track+'"]');if(!lane)continue;const el=document.createElement('i');el.className='midi-note';el.style.left=Math.min(99.8,n.t/total*100)+'%';el.style.width=Math.max(.25,n.d/total*100)+'%';el.style.top=Math.max(3,Math.min(91,88-(n.p%48)*1.6))+'%';lane.appendChild(el)}}
function hash64(str,seed=0xcbf29ce484222325n){let h=seed;for(let i=0;i<str.length;i++){h^=BigInt(str.charCodeAt(i));h=BigInt.asUintN(64,h*0x100000001b3n)}return h}
function rng(seed){let a=hash64(seed,0xcbf29ce484222325n),b=hash64(seed.split('').reverse().join(''),0x9e3779b97f4a7c15n);if((a|b)===0n)b=1n;return()=>{a=BigInt.asUintN(64,a^((a<<23n)&0xffffffffffffffffn));a=BigInt.asUintN(64,a^ (a>>17n));a=BigInt.asUintN(64,a^b);b=BigInt.asUintN(64,b^ (b>>26n));const x=BigInt.asUintN(64,a+b);return Number(x>>11n)/9007199254740992}}
function randomSeed(){const bytes=new Uint8Array(16);if(window.crypto?.getRandomValues)crypto.getRandomValues(bytes);else for(let i=0;i<16;i++)bytes[i]=Math.floor(Math.random()*256);return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')}
function vlq(n){let b=n&127,out=[];while((n>>=7)){b<<=8;b|=(n&127)|128}for(;;){out.push(b&255);if(b&128)b>>=8;else break}return out}
function u32(n){return[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]}
function chunk(tag,data){return[...tag].map(c=>c.charCodeAt(0)).concat(u32(data.length),data)}
function makeTrack(notes,bpm,channel,program,name){const tempo=Math.round(60000000/bpm),events=[{t:0,data:[255,3,name.length,...name.split('').map(c=>c.charCodeAt(0))]},{t:0,data:[192|channel,program&127]},{t:0,data:[255,81,3,(tempo>>16)&255,(tempo>>8)&255,tempo&255]}];for(const n of notes){events.push({t:n.t,data:[144|channel,n.p&127,n.v&127]},{t:n.t+n.d,data:[128|channel,n.p&127,0]})}events.sort((a,b)=>a.t-b.t);let data=[],last=0;for(const e of events){data.push(...vlq(Math.max(0,e.t-last)),...e.data);last=e.t}data.push(0,255,47,0);return data}
function makeMidi(notes,bpm,channel,program,name){return new Uint8Array([...chunk('MThd',[0,0,0,6,0,0,0,1,1,224]),...chunk('MTrk',makeTrack(notes,bpm,channel,program,name))])}
function makeFullMidi(all,bpm){const entries=Object.entries(all),tracks=entries.map(([id,notes],i)=>chunk('MTrk',makeTrack(notes,bpm,id==='drums'?9:i%9,gm[id]||0,trackNames[id])));return new Uint8Array([...chunk('MThd',[0,0,0,6,0,1,(tracks.length>>8)&255,tracks.length&255,1,224]),...tracks.flat()])}
function add(a,t,p,d,v,ch=0){a.push({t:Math.round(t),p:Math.max(0,Math.min(127,Math.round(p))),d:Math.max(20,Math.round(d)),v:Math.max(1,Math.min(127,Math.round(v))),ch})}
function chooseScale(style,mood){if(style==='Hard Techno')return[0,1,3,4,7,8,10];if(mood==='Joyeuse'||style==='Pop'||style==='R&B')return[0,2,4,5,7,9,11];if(mood==='Épique')return[0,2,3,5,7,9,10];return[0,2,3,5,7,8,10]}
function sectionFor(bar,bars){const x=bar/bars;if(x<.125)return'intro';if(x<.375)return'verse';if(x<.625)return'hook';if(x<.875)return'verse2';return'outro'}
function analyzeReference(buffer){const rate=buffer.sampleRate,frames=buffer.length,step=Math.max(1,Math.floor(rate/16000)),sample=new Float32Array(Math.ceil(frames/step));for(let i=0,j=0;i<frames;i+=step,j++){let v=0;for(let ch=0;ch<buffer.numberOfChannels;ch++)v+=buffer.getChannelData(ch)[i]||0;sample[j]=v/buffer.numberOfChannels}let sum=0,zc=0;for(let i=1;i<sample.length;i++){const v=sample[i],p=sample[i-1];sum+=v*v;if((v>=0)!==(p>=0))zc++}const rms=Math.sqrt(sum/sample.length),brightness=Math.min(1,zc/sample.length*2.4),energy=Math.min(1,rms*5),duration=buffer.duration;let best=0,bestLag=0;const minLag=Math.floor(rate/step*60/180),maxLag=Math.ceil(rate/step*60/60);for(let lag=Math.max(2,minLag);lag<=Math.min(maxLag,sample.length/2);lag+=2){let ac=0,n=0;for(let i=lag;i<sample.length;i+=Math.max(1,Math.floor(sample.length/8000))){ac+=sample[i]*sample[i-lag];n++}ac/=Math.max(1,n);if(ac>best){best=ac;bestLag=lag}}const tempo=bestLag?Math.max(60,Math.min(200,Math.round(60/(bestLag*step/rate)))):140;const chroma=new Array(12).fill(0),N=1024;for(let start=0;start+N<sample.length;start+=N){for(let k=1;k<N/2;k++){let re=0,im=0;for(let n=0;n<N;n+=8){const x=sample[start+n],a=2*Math.PI*k*n/N;re+=x*Math.cos(a);im-=x*Math.sin(a)}const mag=Math.hypot(re,im),freq=k*rate/(step*N);if(freq>=55&&freq<1760){const midi=Math.round(69+12*Math.log2(freq/440));chroma[(midi%12+12)%12]+=mag}}}let keyIndex=0;for(let i=1;i<12;i++)if(chroma[i]>chroma[keyIndex])keyIndex=i;const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];return{tempo,energy,brightness,duration,key:names[keyIndex],keyIndex}}
async function inspectReference(file){try{$('#analysisText').textContent='Analyse audio · tempo, énergie, texture…';$('#analysisBadge').textContent='SCAN';const ac=new (window.AudioContext||window.webkitAudioContext)();const buf=await ac.decodeAudioData(await file.arrayBuffer());state.inspiration=analyzeReference(buf);await ac.close();const i=state.inspiration;$('#analysisText').textContent='≈ '+i.tempo+' BPM · '+i.key+' · énergie '+Math.round(i.energy*100)+'% · texture '+(i.brightness>.55?'brillante':'sombre');$('#analysisBadge').textContent='INSPIRÉ';if($('#bpm').value==140)$('#bpm').value=i.tempo}catch(e){state.inspiration=null;$('#analysisText').textContent='Référence chargée · analyse indisponible';$('#analysisBadge').textContent='AUDIO'}}
function compose(){
  const insp=state.inspiration,bpm=Math.max(60,Math.min(200,+$('#bpm').value||140)),bars=+$('#bars').value;
  const style=$('#style').value,mood=$('#mood').value,complexity=+$('#complexity').value/100,energy=+$('#energy').value/100;
  const seed=$('#seed').value+'|'+style+'|'+mood+'|'+$('#substyle').value;
  const r=rng(seed);
  const pick=a=>a[Math.floor(r()*a.length)];
  const chance=p=>r()<p;
  const step=120,barTicks=1920;
  const o={drums:[],bass:[],chords:[],melody:[],counter:[],arp:[]};
  const rootBase={Rap:[48,50,45,43],Drill:[38,41,43,36],Trap:[48,43,45,41],Hyperpop:[57,53,60,55],'R&B':[45,50,52,48],Pop:[48,43,45,50],Phonk:[45,41,43,38],'Hard Techno':[41,43,36,38],'Lo-fi':[48,45,43,50],Rock:[40,43,45,38],Experimental:[50,46,53,48]};
  const roots=(rootBase[style]||rootBase.Rap).slice();
  if(insp) roots.forEach((_,i)=>roots[i]+=((insp.keyIndex-(i*2+3))%12+12)%12);
  const scale=chooseScale(style,mood);
  const modeSets={
    major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],
    phrygian:[0,1,3,5,7,8,10],harmonic:[0,2,3,5,7,8,11],pentatonic:[0,2,4,7,9],blues:[0,3,5,6,7,10]
  };
  const chosenMode=pick(style==='Hard Techno'?['minor','phrygian','dorian']:style==='R&B'?['minor','dorian','major']:['minor','minor','dorian','major','harmonic','pentatonic']);
  const musicalScale=modeSets[chosenMode]||scale;
  const progressionLibrary=[
    [0,3,5,4],[0,5,3,4],[0,3,4,5],[0,5,4,3],[0,4,5,3],[0,2,5,4],
    [0,6,3,4],[0,4,2,5],[0,3,6,5],[0,5,2,6],[0,3,5,1],[0,4,3,6]
  ];
  let progression=pick(progressionLibrary);
  if(style==='Hard Techno') progression=pick([[0,0,3,5],[0,3,0,5],[0,0,5,3]]);
  const qualities=style==='R&B'?['min7','maj7','min7','dom7']:['minor','minor','major','major'];
  const chord=(root,q)=>{
    const map={major:[0,4,7],minor:[0,3,7],min7:[0,3,7,10],maj7:[0,4,7,11],dom7:[0,4,7,10],sus2:[0,2,7],sus4:[0,5,7],add9:[0,4,7,14]};
    return (map[q]||map.minor).map(x=>root+x);
  };
  const voicing=(notes,inv)=>{
    const a=notes.map((p,i)=>p+(i<inv?12:0));
    return a.sort((x,y)=>x-y);
  };
  const chordBars=[];
  const motifLength=pick([4,6,8,12]);
  const motif=[];
  for(let i=0;i<motifLength;i++){
    const degree=Math.floor(r()*musicalScale.length);
    const octave=chance(.16)?12:0;
    motif.push({d:degree,o:octave});
  }
  const rhythmBanks={
    Rap:[[0,3,6,8,11,14],[0,4,7,10,12,15],[0,2,5,8,10,13,15]],
    Drill:[[0,3,7,10,14],[0,2,6,9,13,15],[0,5,8,11,14,15]],
    Trap:[[0,3,5,8,11,14],[0,4,7,10,12,15],[0,2,6,9,11,14]],
    Phonk:[[0,3,6,10,14],[0,5,9,12,14],[0,2,7,10,13,15]],
    'Hard Techno':[[0,2,4,6,8,10,12,14],[0,3,4,7,8,11,12,15]],
    'R&B':[[0,4,7,10,14],[0,3,6,9,12,15],[0,5,8,11,14]],
    Pop:[[0,4,8,12],[0,3,6,9,12,15],[0,2,5,8,10,13]],
    LoFi:[[0,4,7,11,14],[0,3,8,12,15]],
    Rock:[[0,4,8,12],[0,3,6,9,12,15]],
    Hyperpop:[[0,2,5,7,10,12,14,15],[0,3,6,8,11,13,15]],
    Experimental:[[0,1,5,6,9,12,14],[0,2,3,7,11,13,15]]
  };
  const bank=rhythmBanks[style]||rhythmBanks.Rap;
  const drumPattern=pick(bank);
  const hatDensity=style==='Hard Techno'?1:.55+complexity*.4;
  const sectionFor2=bar=>{
    const x=bar/bars;
    if(x<.10)return'intro';
    if(x<.30)return'verse';
    if(x<.38)return'pre';
    if(x<.60)return'hook';
    if(x<.76)return'verse2';
    if(x<.88)return'break';
    return'outro';
  };
  const degreePitch=(root,degree,oct=0)=>{
    const len=musicalScale.length,idx=((degree%len)+len)%len,cycles=Math.floor(degree/len);
    return root+musicalScale[idx]+12*cycles+oct;
  };
  let lastMelody=null,lastBass=null;
  for(let bar=0;bar<bars;bar++){
    const base=bar*barTicks,section=sectionFor2(bar),hook=section==='hook',pre=section==='pre',intro=section==='intro',brk=section==='break',outro=section==='outro';
    const pg=progression[bar%progression.length];
    const root=roots[pg%roots.length];
    let q=qualities[pg%qualities.length];
    if(style==='Pop'||style==='R&B') q=chance(.28)?pick(['maj7','min7','add9']):q;
    else if(chance(.18)) q=pick(['minor','sus2','sus4','add9']);
    const notes=chord(root,q);
    const inv=chance(.55)?Math.floor(r()*Math.min(3,notes.length)):0;
    const voiced=voicing(notes,inv);
    chordBars.push({root,notes:voiced});
    const chordDur=hook?1880:brk?1440:1840;
    voiced.forEach((p,j)=>{
      if(!intro||j===0||chance(.55)) add(o.chords,base,p,chordDur,34+energy*24+(hook?14:0));
    });
    if(pre||hook) add(o.chords,base+960,voiced[voiced.length-1]+12,700,42+energy*22);
    const bassPattern=style==='Hard Techno'?[0,2,4,6,8,10,12,14]:pick([
      [0,3,7,11,14],[0,4,8,11,15],[0,2,6,9,12,14],[0,5,8,10,14]
    ]);
    for(const s of bassPattern){
      if(intro&&s>3)continue;
      if(brk&&chance(.72))continue;
      const isAccent=s===0||s===8;
      const degree=chance(.72)?0:pick([0,0,2,4,5]);
      const p=degree===0?root-12:degreePitch(root,degree,-12);
      const octaveJump=hook&&chance(.12)?12:0;
      const t=base+s*step+(chance(.12)?20:0);
      const d=pick([240,300,360,420,540]);
      if(!lastBass||Math.abs(p-lastBass)<19||chance(.7)){add(o.bass,t,p+octaveJump,d,isAccent?92:72+energy*18);lastBass=p;}
    }
    if((hook||pre)&&chance(.6))add(o.bass,base+1680,root-12+(chance(.35)?12:0),150,62);
    const kick=drumPattern;
    for(let s=0;s<16;s++){
      const t=base+s*step;
      let hit=kick.includes(s);
      if(style==='Hard Techno')hit=s%2===0;
      if(hook&&chance(.13))hit=true;
      if(brk)hit=s===0;
      if(intro)hit=hit&&s%4===0;
      if(hit)add(o.drums,t,36,80,96+energy*25,9);
      if(!intro&&!brk&&(s===4||s===12||(hook&&s===15)))add(o.drums,t,38,65,88+energy*20,9);
      if(!intro&&!brk){
        const hats=s%2===0||chance(hatDensity*.22);
        if(hats)add(o.drums,t+(chance(.12)?18:0),42,28,42+complexity*38,9);
        if(complexity>.55&&chance(.18))add(o.drums,t+60,42,20,35+energy*25,9);
      }
    }
    if($('#fills').checked&&bar%4===3&&!intro&&!brk){
      for(let s=12;s<16;s++)if(chance(.7))add(o.drums,base+s*step,45,25,55+energy*30,9);
    }
    const melodyDensity=Math.round((3+complexity*8)*(hook?1.25:pre?1.05:brk?.35:1));
    const transform=bar%4;
    for(let n=0;n<melodyDensity;n++){
      const m=motif[(n+bar*2)%motif.length];
      let degree=m.d;
      if(transform===1)degree=-degree;
      if(transform===2)degree=m.d+(n%2?2:0);
      if(transform===3)degree=m.d+(n%3===0?musicalScale.length:0);
      degree+=pick([0,0,0,1,-1]);
      let p=degreePitch(root,degree,m.o);
      if(lastMelody!==null&&Math.abs(p-lastMelody)>12)p+=p>lastMelody?-12:12;
      const positions=pick([[0,2,4,7,10,12,14],[1,4,6,9,12,14],[0,3,5,8,11,15]]);
      const pos=positions[n%positions.length];
      const t=base+pos*step+pick([0,0,20,40]);
      const d=pick([70,100,130,170,220]);
      add(o.melody,t,p,d,48+energy*38+(hook?12:0));lastMelody=p;
      if($('#counter').checked&&(hook||pre)&&n%3===1){
        const cp=p+pick([-12,-7,5,7]);
        add(o.counter,t+pick([80,100,140]),cp,pick([100,140,180]),35+energy*24);
      }
    }
    if($('#arp').checked&&!intro&&!brk){
      const arpOrder=pick([[0,1,2,1],[0,2,1,2],[0,1,3,2],[2,1,0,1]]);
      const arps=hook?8:4;
      for(let s=0;s<arps;s++){
        const p=voiced[arpOrder[s%4]%voiced.length]+12+(hook&&chance(.35)?12:0);
        add(o.arp,base+s*(hook?240:480),p,hook?100:150,28+energy*20);
      }
    }
    if($('#variations').checked&&bar%4===3&&!intro&&!brk){
      add(o.melody,base+1740,degreePitch(root,motif[(bar+3)%motif.length].d+2,12),100,65+energy*20);
    }
  }
  if(!$('#intro').checked)for(const k of ['drums','melody','counter','arp'])o[k]=o[k].filter(n=>n.t>=1920);
  if(!$('#outro').checked){const cut=Math.max(0,(bars-4)*1920);for(const k of Object.keys(o))o[k]=o[k].filter(n=>n.t<cut);}
  for(const k of Object.keys(o)){
    o[k].sort((a,b)=>a.t-b.t||a.p-b.p);
    if(k!=='drums')for(const n of o[k])n.v=Math.max(1,Math.min(127,n.v+(r()-.5)*10));
  }
  state.notes=Object.entries(o).flatMap(([track,arr])=>arr.map(n=>({...n,track})));
  const generated={};
  for(const[id,arr]of Object.entries(o))generated[id]={midi:makeMidi(arr,bpm,id==='drums'?9:trackIds.indexOf(id),gm[id]||0,trackNames[id]),notes:arr};
  generated.full={midi:makeFullMidi(o,bpm),notes:state.notes};
  return generated;
}
async function composeWithLocalAI(){
  const style=$('#style').value,mood=$('#mood').value,substyle=$('#substyle').value;
  const bpm=Math.max(60,Math.min(200,+$('#bpm').value||140)),bars=+$('#bars').value;
  const energy=+$('#energy').value,complexity=+$('#complexity').value;
  const insp=state.inspiration;
  const model=localStorage.getItem('melodix-ai-model')||'qwen3:8b';
  const key=insp?.key||'C', tempo=insp?.tempo||bpm;
  const prompt=`You are the music director of Melodix. Compose an ORIGINAL instrumental arrangement.
Style: ${style}. Sub-style: ${substyle}. Mood: ${mood}. Tempo: ${tempo} BPM. Key center: ${key}.
Energy: ${energy}/100. Complexity: ${complexity}/100.
Create an 8-bar musical seed phrase that can be expanded into ${bars} bars.
Think like a producer: strong groove, memorable motif, coherent harmony, bass following harmony, drums with variation, call/response, tension before hooks.
Do NOT write prose. Return ONLY valid JSON with exactly:
{"mode":"major|minor|dorian|phrygian|harmonic","progression":[8 integers 0-6],"melody":[{"bar":0-7,"beat":0-15,"degree":-7..14,"length":1..8,"velocity":1..127}],"bass":[{"bar":0-7,"beat":0-15,"degree":-7..7,"length":1..8,"velocity":1..127}],"drums":[{"bar":0-7,"beat":0-15,"kind":"kick|snare|hat|openhat","velocity":1..127}]}
Rules: progression uses scale degrees as chord roots; melody must be singable and repetitive with purposeful variation; bass should mostly use chord root/third/fifth; drums must establish genre groove. Avoid random notes.`;
  const res=await fetch('http://127.0.0.1:11434/api/chat',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model,messages:[{role:'user',content:prompt}],stream:false,format:'json',options:{temperature:.72,num_ctx:8192}})
  });
  if(!res.ok)throw new Error('Ollama HTTP '+res.status);
  const data=await res.json();
  const raw=data.message?.content||'';
  const plan=JSON.parse(raw.replace(/^\`\`\`json\\s*/,'').replace(/\`\`\`$/,'').trim());
  if(!Array.isArray(plan.progression)||!Array.isArray(plan.melody)||!Array.isArray(plan.bass)||!Array.isArray(plan.drums))throw new Error('AI score incomplete');
  return renderAIPlan(plan,bpm,bars,style,energy,complexity);
}
function renderAIPlan(plan,bpm,bars,style,energy,complexity){
  const scaleMap={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],phrygian:[0,1,3,5,7,8,10],harmonic:[0,2,3,5,7,8,11]};
  const scale=scaleMap[plan.mode]||scaleMap.minor;
  const roots={Rap:48,Drill:38,Trap:48,Hyperpop:57,'R&B':45,Pop:48,Phonk:45,'Hard Techno':41,'Lo-fi':48,Rock:40,Experimental:50};
  const root=state.inspiration?.keyIndex??(roots[style]||48)%12;
  const rootMidi=state.inspiration?60+root:(roots[style]||48);
  const o={drums:[],bass:[],chords:[],melody:[],counter:[],arp:[]};
  const tick=120,barTicks=1920;
  const degreePitch=(degree,oct=0)=>{const i=((degree%scale.length)+scale.length)%scale.length;return rootMidi+scale[i]+12*Math.floor(degree/scale.length)+oct};
  const chordFor=d=>[d,d+2,d+4,d+6].map(x=>degreePitch(x));
  for(let bar=0;bar<bars;bar++){
    const src=bar%8, section=sectionFor(bar,bars), hook=section==='hook', intro=section==='intro', brk=section==='break';
    const prog=((Number(plan.progression[src])||0)%7+7)%7;
    const chord=chordFor(prog);
    chord.forEach((p,i)=>{if(!intro||i===0)add(o.chords,bar*barTicks,p,hook?1880:1800,38+energy*.24)});
    for(const n of plan.bass.filter(x=>Number(x.bar)===src)){
      if(brk&&((bar*31+Number(n.beat)*17)%100)<65)continue;
      add(o.bass,bar*barTicks+Number(n.beat)*tick,degreePitch(Number(n.degree)||0,-12),Math.max(80,Number(n.length||2)*tick),Math.min(127,Number(n.velocity||80)+(hook?8:0)));
    }
    for(const n of plan.melody.filter(x=>Number(x.bar)===src)){
      let degree=Number(n.degree)||0;
      if(bar>=8&&bar%4===0)degree+=2;
      if(bar>=16&&bar%8>=4)degree-=1;
      add(o.melody,bar*barTicks+Number(n.beat)*tick,degreePitch(degree,12),Math.max(50,Number(n.length||2)*tick/2),Math.min(127,Number(n.velocity||70)+(hook?10:0)));
      if($('#counter').checked&&hook&&Number(n.beat)%4===2)add(o.counter,bar*barTicks+Number(n.beat)*tick+60,degreePitch(degree-2,12),100,42+energy*.2);
    }
    for(const n of plan.drums.filter(x=>Number(x.bar)===src)){
      const p={kick:36,snare:38,hat:42,openhat:46}[n.kind];if(p)add(o.drums,bar*barTicks+Number(n.beat)*tick,p,p===42?28:70,Number(n.velocity)||70,9);
    }
    if(!intro&&!brk&&$('#arp').checked){
      for(let s=0;s<(hook?8:4);s++)add(o.arp,bar*barTicks+s*(hook?240:480),chord[s%chord.length]+12,120,28+energy*.18);
    }
    if($('#fills').checked&&bar%4===3&&!intro)for(let s=13;s<16;s++)add(o.drums,bar*barTicks+s*tick,45,25,55+energy*.25,9);
  }
  if(!$('#intro').checked)for(const k of ['drums','melody','counter','arp'])o[k]=o[k].filter(n=>n.t>=1920);
  if(!$('#outro').checked){const cut=Math.max(0,(bars-4)*1920);for(const k of Object.keys(o))o[k]=o[k].filter(n=>n.t<cut);}
  state.notes=Object.entries(o).flatMap(([track,arr])=>arr.map(n=>({...n,track})));
  const generated={};
  for(const[id,arr]of Object.entries(o))generated[id]={midi:makeMidi(arr,bpm,id==='drums'?9:trackIds.indexOf(id),gm[id]||0,trackNames[id]),notes:arr};
  generated.full={midi:makeFullMidi(o,bpm),notes:state.notes};
  return generated;
}

function downloadBlob(name,data,type='audio/midi'){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1200)}
function downloadTrack(id){const d=state.generated[id];if(d)downloadBlob(id==='full'?'melodix-instrumentale-full.mid':'melodix-'+id+'.mid',d.midi)}
const crcTable=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function zipStore(files){const enc=new TextEncoder(),local=[],central=[];let offset=0;for(const f of files){const name=enc.encode(f.name),data=f.data,crc=crc32(data),h=[80,75,3,4,20,0,0,0,0,0,0,0,0,0,crc&255,(crc>>>8)&255,(crc>>>16)&255,(crc>>>24)&255,data.length&255,(data.length>>>8)&255,(data.length>>>16)&255,(data.length>>>24)&255,name.length&255,(name.length>>>8)&255,0,0];local.push(new Uint8Array([...h,...name,...data]));const ch=[80,75,1,2,20,0,20,0,0,0,0,0,0,0,crc&255,(crc>>>8)&255,(crc>>>16)&255,(crc>>>24)&255,data.length&255,(data.length>>>8)&255,(data.length>>>16)&255,(data.length>>>24)&255,data.length&255,(data.length>>>8)&255,(data.length>>>16)&255,(data.length>>>24)&255,name.length&255,(name.length>>>8)&255,0,0,0,0,0,0,0,0,offset&255,(offset>>>8)&255,(offset>>>16)&255,(offset>>>24)&255];central.push(new Uint8Array([...ch,...name]));offset+=h.length+name.length+data.length}const size=central.reduce((a,b)=>a+b.length,0),end=new Uint8Array([80,75,5,6,0,0,0,0,central.length?files.length:0,0,central.length?files.length:0,0,size&255,(size>>>8)&255,(size>>>16)&255,(size>>>24)&255,offset&255,(offset>>>8)&255,(offset>>>16)&255,(offset>>>24)&255,0,0]);return new Blob([...local,...central,end],{type:'application/zip'})}
function downloadZip(){const files=Object.entries(state.generated).filter(([id])=>id!=='full').map(([id,d])=>({name:'midi/melodix-'+id+'.mid',data:d.midi}));files.push({name:'melodix-instrumentale-full.mid',data:state.generated.full.midi});downloadBlob('melodix-midi-pack.zip',zipStore(files),'application/zip')}
async function loadReference(f){if(!f||!f.type.startsWith('audio/'))return;if(state.reference?.url)URL.revokeObjectURL(state.reference.url);const url=URL.createObjectURL(f);state.reference={url};$('#player').src=url;$('#player').hidden=false;$('#fileName').textContent=f.name;$('#format').textContent=(f.name.split('.').pop()||'AUDIO').toUpperCase();$('#refState').textContent='READY';$('#player').onloadedmetadata=()=>$('#duration').textContent=Number.isFinite($('#player').duration)?fmt($('#player').duration):'—';await inspectReference(f)}
function fmt(s){return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}
function nativeInstrument(ctx,type,p,when,dur,vel){const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();const freq=440*Math.pow(2,(p-69)/12);const wave=type==='lead'?'sawtooth':type==='pad'?'triangle':type==='arp'?'square':'sine';o.type=wave;o.frequency.setValueAtTime(freq,when);if(type==='lead')o.detune.setValueAtTime(-7,when);f.type='lowpass';f.frequency.setValueAtTime(type==='lead'?2600:type==='pad'?1800:4200,when);f.Q.value=type==='lead'?3:0.7;const peak=Math.min(.22,.05+vel/600);g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(peak,when+.012);g.gain.exponentialRampToValueAtTime(Math.max(.018,peak*.55),when+Math.min(.12,dur*.35));g.gain.exponentialRampToValueAtTime(.0001,when+dur);o.connect(f).connect(g).connect(ctx.destination);o.start(when);o.stop(when+dur+.03)}
function playNativePreview(bpm){const c=state.audioCtx;if(!c||c.state!=='running')throw new Error('AudioContext unavailable');const secTick=60/bpm/480,now=c.currentTime+.08;for(const n of state.notes){if(n.track==='bass'||n.track==='drums')continue;const type=n.track==='melody'?'lead':n.track==='counter'?'pad':n.track==='arp'?'arp':'chords';try{nativeInstrument(c,type,n.p,now+n.t*secTick,Math.max(.08,n.d*secTick),n.v)}catch(e){console.warn('note preview skipped',e)}}try{play808Preview(bpm);playDrumsPreview(bpm)}catch(e){console.warn('rhythm preview skipped',e)}}
async function playPreview(){if(!state.notes.length)return;clearInterval(state.timer);state.timer=null;state.playing=true;$('#playPreview').textContent='Ⅱ';const bpm=+$('#bpm').value||140;try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)throw new Error('WebAudio unavailable');if(!state.audioCtx||state.audioCtx.state==='closed')state.audioCtx=new Ctx();if(state.audioCtx.state!=='running')await state.audioCtx.resume();if(state.audioCtx.state!=='running')throw new Error('AudioContext not running');playNativePreview(bpm);const start=performance.now(),secTick=60/bpm/480,total=+$('#bars').value*1920;state.timer=setInterval(()=>{const elapsed=(performance.now()-start)/1000,p=Math.min(1,elapsed/(total*secTick));$('#transportFill').style.width=p*100+'%';$('#playTime').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(Math.floor(elapsed%60)).padStart(2,'0');if(p>=1)stopPreview()},50)}catch(e){console.error('Melodix preview:',e);state.playing=false;$('#playPreview').textContent='▶';clearInterval(state.timer);state.timer=null;alert('Le moteur audio du navigateur n’a pas pu démarrer. Les MIDI restent disponibles.')}}
function play808Preview(bpm){const c=state.audioCtx;if(!c)return;const notes=state.notes.filter(x=>x.track==='bass'),now=c.currentTime+.12;for(const n of notes){const when=now+n.t/480*60/bpm,dur=Math.max(.08,n.d/480*60/bpm),o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(Math.min(90,440*Math.pow(2,(n.p-69)/12)*2.2),when);o.frequency.exponentialRampToValueAtTime(Math.max(28,440*Math.pow(2,(n.p-69)/12)),when+Math.min(.09,dur*.35));g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(.62,when+.006);g.gain.exponentialRampToValueAtTime(.16,when+Math.min(.12,dur*.35));g.gain.exponentialRampToValueAtTime(.0001,when+dur);o.connect(g).connect(c.destination);o.start(when);o.stop(when+dur+.02)}}
function playDrumsPreview(bpm){const c=state.audioCtx;if(!c)return;for(const n of state.notes.filter(x=>x.track==='drums')){const when=c.currentTime+.12+n.t/480*60/bpm,g=c.createGain(),o=c.createOscillator();o.type=n.p===42?'square':'sine';o.frequency.setValueAtTime(n.p===36?82:n.p===38?190:720,when);if(n.p===36)o.frequency.exponentialRampToValueAtTime(42,when+.07);g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(Math.min(.22,n.v/650),when+.004);g.gain.exponentialRampToValueAtTime(.0001,when+(n.p===36?.12:.07));o.connect(g).connect(c.destination);o.start(when);o.stop(when+(n.p===36?.14:.09))}}
function stopPreview(){state.playing=false;clearInterval(state.timer);state.timer=null;Object.values(state.players).forEach(p=>{try{p.stop()}catch{}});state.players={};if(state.drumCtx){try{state.drumCtx.close()}catch{}state.drumCtx=null}if(state.audioCtx&&state.audioCtx.state==='running'){try{state.audioCtx.suspend()}catch{}}$('#playPreview').textContent='▶';$('#transportFill').style.width='0%';$('#playTime').textContent='00:00'}
async function generate(){
  const btn=$('#generate');btn.disabled=true;stopPreview();
  $('#statusBadge').textContent='AI LOCALE…';$('#emptyOutput').hidden=false;$('#result').hidden=true;
  $('#emptyOutput').innerHTML='<div>✦</div><b>Composition par intelligence musicale…</b><span>Analyse · harmonie · groove · mélodie · arrangement</span>';
  try{
    state.generated=await composeWithLocalAI();
    $('#emptyOutput').innerHTML='<div>✦</div><b>Rendu du morceau…</b><span>Finalisation MIDI et aperçu</span>';
  }catch(e){
    console.warn('Melodix Local AI unavailable:',e);
    $('#statusBadge').textContent='MODE CRÉATIF';
    state.generated=compose();
  }
  renderPreview();renderTracks();renderTrackDownloads();$('#result').hidden=false;$('#emptyOutput').hidden=true;
  $('#all').disabled=false;$('#zip').disabled=false;btn.disabled=false;$('#statusBadge').textContent='GENERATED';$('#statusBadge').classList.add('done');
  $('#transportTitle').textContent=$('#style').value+' · '+$('#mood').value;
}
const seedButton=$('#randomSeed');if(seedButton)seedButton.onclick=()=>{$('#seed').value=randomSeed();$('#seed').focus()};if($('#seed').value==='melodix-01')$('#seed').value=randomSeed();
const file=$('#file'),drop=$('#drop');file.onchange=e=>loadReference(e.target.files[0]);['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag')}));drop.addEventListener('drop',e=>loadReference(e.dataTransfer.files[0]));$('#clearRef').onclick=()=>{if(state.reference?.url)URL.revokeObjectURL(state.reference.url);state.reference=null;state.inspiration=null;file.value='';$('#player').removeAttribute('src');$('#player').load();$('#player').hidden=true;$('#fileName').textContent='Aucune référence';$('#duration').textContent='—';$('#format').textContent='—';$('#refState').textContent='AUTO';$('#analysisText').textContent='Aucune référence · moteur créatif autonome';$('#analysisBadge').textContent='AUTO'};$('#energy').oninput=e=>$('#energyOut').textContent=e.target.value+'%';$('#complexity').oninput=e=>$('#complexityOut').textContent=e.target.value+'%';$('#style').onchange=()=>{renderAdvice();renderTracks()};$('#generate').onclick=generate;$('#regen').onclick=generate;$('#playPreview').onclick=()=>state.playing?stopPreview():playPreview();$('#all').onclick=()=>downloadTrack('full');$('#zip').onclick=downloadZip;document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='SELECT')generate()});renderAdvice();renderTracks();