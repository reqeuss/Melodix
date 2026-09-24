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
function composeFromTranscription(ns){const bpm=Math.max(60,Math.min(200,+$('#bpm').value||state.inspiration?.tempo||140)),bars=+$('#bars').value,total=bars*1920,o={drums:[],bass:[],chords:[],melody:[],counter:[],arp:[]};const notes=(ns?.notes||[]).filter(n=>Number.isFinite(n.pitch)&&Number.isFinite(n.startTime));if(!notes.length)throw new Error('Aucune note détectée');const avg=Math.round(notes.reduce((a,n)=>a+n.pitch,0)/notes.length),shift=(state.inspiration?.keyIndex??0)-(avg%12);for(const n of notes){const t=Math.round(n.startTime*bpm*8),d=Math.max(30,Math.round((n.endTime-n.startTime)*bpm*8));if(t<total)add(o.melody,t,n.pitch+shift,d,n.velocity||80)}for(let bar=0;bar<bars;bar++){const base=bar*1920,src=o.melody.filter(n=>n.t>=base&&n.t<base+1920);const root=src[0]?.p??(state.inspiration?.keyIndex??0)+48;[root,root+3,root+7].forEach(p=>add(o.chords,base,p,1760,32));add(o.bass,base,root-12,420,90);if(src[0])add(o.bass,base+720,src[0].p-24,300,76);add(o.drums,base,36,80,110,9);add(o.drums,base+960,38,70,100,9);for(let s=0;s<16;s+=2)add(o.drums,base+s*120,42,24,48,9);if($('#counter').checked&&src[1])add(o.counter,base+480,src[1].p-7,120,42);if($('#arp').checked&&src.length)add(o.arp,base+240,src[0].p+12,160,32)}state.notes=Object.entries(o).flatMap(([track,arr])=>arr.map(n=>({...n,track})));const generated={};for(const[id,arr]of Object.entries(o))generated[id]={midi:makeMidi(arr,bpm,id==='drums'?9:trackIds.indexOf(id),gm[id]||0,trackNames[id]),notes:arr};generated.full={midi:makeFullMidi(o,bpm),notes:state.notes};return generated}
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
let creationMode='reference';
let browserTranscriber=null;const TRANSCRIPTION_CHECKPOINT='https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni_q2';async function transcribeReference(){if(!state.reference)throw new Error('Aucune référence');if(!window.transcription?.OnsetsAndFrames)throw new Error('Transcription IA indisponible');if(!browserTranscriber){browserTranscriber=new transcription.OnsetsAndFrames(TRANSCRIPTION_CHECKPOINT,180);await browserTranscriber.initialize()}const blob=await fetch(state.reference.url).then(r=>r.blob());return browserTranscriber.transcribeFromAudioFile(blob)}
function setCreationMode(mode){creationMode=mode;const ref=mode==='reference';$('#modeReference')?.classList.toggle('active',ref);$('#modeImagine')?.classList.toggle('active',!ref);$('#referencePanel').style.opacity=ref?'1':'.62';$('#controlEyebrow').textContent=ref?'AUDIO → MIDI':'AI COMPOSITION';$('#controlTitle').textContent=ref?'Analyse & reconstruction':'Imagine';$('#pipeline').innerHTML=ref?'<span class="active">Audio</span><i>→</i><span>IA Analyse</span><i>→</i><span>MIDI</span><i>→</i><span>Instru</span>':'<span class="active">Seed</span><i>→</i><span>IA Imagine</span><i>→</i><span>Arrangement</span><i>→</i><span>Instru</span>';$('#generate').innerHTML=ref?'<span>✦</span> ANALYSER & CRÉER <kbd>ENTER</kbd>':'<span>✦</span> IMAGINER L\'INSTRUMENTALE <kbd>ENTER</kbd>';$('#analysisText').textContent=ref?(state.reference?'Référence prête · analyse musicale disponible':'En attente d\'une référence'):'Aucune référence nécessaire · moteur autonome';$('#analysisBadge').textContent=ref?(state.reference?'READY':'WAIT'):'AUTO'}
let browserMusicAI=null;
let browserMusicAIContextBars=0;
const BROWSER_AI_CHECKPOINTS={
  deep:'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/trio_16bar',
  fallback:'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/trio_4bar'
};

async function getBrowserMusicAI(){
  const requestedBars=+$('#bars').value||32;
  const wanted=requestedBars>=16?'deep':'fallback';
  if(browserMusicAI && browserMusicAIContextBars>=(wanted==='deep'?16:4))return browserMusicAI;
  if(!window.music_vae?.MusicVAE)throw new Error('Magenta.js non chargé');
  $('#statusBadge').textContent=wanted==='deep'?'IA DEEP · 16 MESURES':'IA WEB · 4 MESURES';
  $('#emptyOutput').innerHTML='<div>🧠</div><b>Chargement du cerveau musical…</b><span>Melodix prépare un modèle à long contexte directement dans ton navigateur.</span>';
  try{
    browserMusicAI=new music_vae.MusicVAE(BROWSER_AI_CHECKPOINTS[wanted]);
    await browserMusicAI.initialize();
    browserMusicAIContextBars=wanted==='deep'?16:4;
  }catch(e){
    if(wanted==='deep'){
      console.warn('Long-context MusicVAE indisponible, fallback 4-bar:',e);
      browserMusicAI=new music_vae.MusicVAE(BROWSER_AI_CHECKPOINTS.fallback);
      await browserMusicAI.initialize();
      browserMusicAIContextBars=4;
    }else throw e;
  }
  return browserMusicAI;
}

function hashSeedNumber(seed){
  let h=2166136261;
  for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
}

function renderBrowserAISequence(sample,bars,bpm,energy,complexity){
  const o={drums:[],bass:[],chords:[],melody:[],counter:[],arp:[]};
  const sourceBars=Math.max(1,Math.round((sample.totalQuantizedSteps||64)/16));
  const stepsPerBar=16,barTicks=1920;
  const scale=chooseScale($('#style').value,$('#mood').value);
  const r=rng($('#seed').value+'|browser-arrangement');
  const style=$('#style').value;
  const baseRoot=state.inspiration?.keyIndex ?? ({Rap:0,Drill:2,Trap:0,Hyperpop:9,'R&B':9,Pop:0,Phonk:9,'Hard Techno':5,'Lo-fi':0,Rock:4,Experimental:2}[style]||0);
  const byTrack={melody:[],bass:[],drums:[]};
  for(const n of sample.notes||[]){
    const track=n.isDrum?'drums':(n.instrument===1?'bass':'melody');
    byTrack[track].push(n);
  }
  const melodic=byTrack.melody.filter(n=>!n.isDrum);
  const firstMelody=melodic[0]?.pitch??60;
  const pitchShift=baseRoot-((firstMelody%12+12)%12);
  const repeatCount=Math.ceil(bars/sourceBars);
  for(let repeat=0;repeat<repeatCount;repeat++){
    const repeatOffset=repeat*sourceBars*barTicks;
    const x=Math.min(.999,(repeat*sourceBars)/bars);
    const section=x<.10?'intro':x<.30?'verse':x<.38?'pre':x<.60?'hook':x<.76?'verse2':x<.88?'break':'outro';
    for(const [track,notes] of Object.entries(byTrack)){
      for(const n of notes){
        const qs=Number.isFinite(n.quantizedStartStep)?n.quantizedStartStep:0;
        const qe=Number.isFinite(n.quantizedEndStep)?n.quantizedEndStep:qs+1;
        const t=repeatOffset+qs*(barTicks/stepsPerBar);
        const d=Math.max(30,(qe-qs)*(barTicks/stepsPerBar));
        if(t>=bars*barTicks)continue;
        if(section==='break'&&track!=='melody'&&r()<.72)continue;
        let p=n.pitch;
        if(track!=='drums')p+=pitchShift;
        if(track==='bass')p-=12;
        // Controlled octave/register variation prevents a copied loop from sounding flat.
        if(track==='melody'&&section==='hook'&&r()<.16)p+=12;
        if(track==='bass'&&section==='hook'&&r()<.10)p+=12;
        p=Math.max(0,Math.min(127,p));
        const v=Math.max(1,Math.min(127,(n.velocity||80)+(energy-50)*.18+(r()-.5)*7));
        add(o[track],t+Math.round((r()-.5)*Math.min(16,d*.06)),p,d,v,track==='drums'?9:0);
      }
    }

    // Build actual chord beds from the generated musical material instead of random chords.
    const barStart=repeatOffset;
    const sourceMelody=melodic.filter(n=>{
      const q=n.quantizedStartStep||0;
      return q>=0&&q<sourceBars*stepsPerBar;
    });
    const anchor=sourceMelody.length?sourceMelody[Math.min(sourceMelody.length-1,repeat%Math.max(1,sourceMelody.length))].pitch+pitchShift:60;
    const root=baseRoot+scale[(Math.floor(anchor/2)+repeat)%scale.length];
    const quality=(style==='R&B'||style==='Pop')?(repeat%3===0?'maj7':'min7'):(repeat%4===2?'sus2':'minor');
    const intervals={minor:[0,3,7],maj7:[0,4,7,11],min7:[0,3,7,10],sus2:[0,2,7]}[quality]||[0,3,7];
    const voicing=intervals.map((x,i)=>root+x+(i===1&&repeat%2?12:0));
    for(const p of voicing)add(o.chords,barStart,p,Math.min(sourceBars*barTicks-80,1840),32+energy*.25);
    // Reinforce bass with root movement while keeping the AI bass line.
    if(!byTrack.bass.length||r()<.7){
      for(let b=0;b<sourceBars;b++){
        const bt=barStart+b*barTicks;
        add(o.bass,bt,root-12,Math.min(420,barTicks*.32),82+energy*.12);
        if(r()<.62)add(o.bass,bt+960,root-12+(r()<.35?12:0),300,68+energy*.12);
      }
    }
    if($('#counter').checked&&(section==='hook'||section==='pre')){
      const source=sourceMelody.slice(0,8);
      for(const n of source){
        const t=barStart+(n.quantizedStartStep||0)*(barTicks/stepsPerBar)+70;
        if(t>=bars*barTicks)continue;
        add(o.counter,t,Math.max(0,Math.min(127,n.pitch+pitchShift-7)),Math.max(60,(n.quantizedEndStep-n.quantizedStartStep)*(barTicks/stepsPerBar)*.5),38+energy*.2);
      }
    }
    if($('#arp').checked&&(section==='hook'||section==='verse2')){
      const chordTop=Math.max(...voicing);
      for(let i=0;i<8;i++)add(o.arp,barStart+i*240,chordTop+12+(i%2?0:7),120,28+complexity*.35);
    }
  }
  if(!$('#intro').checked)for(const k of ['drums','melody','counter','arp'])o[k]=o[k].filter(n=>n.t>=barTicks);
  if(!$('#outro').checked){const cut=Math.max(0,(bars-4)*barTicks);for(const k of Object.keys(o))o[k]=o[k].filter(n=>n.t<cut)}
  for(const k of Object.keys(o))o[k].sort((a,b)=>a.t-b.t||a.p-b.p);
  state.notes=Object.entries(o).flatMap(([track,arr])=>arr.map(n=>({...n,track})));
  const generated={};
  for(const[id,arr]of Object.entries(o))generated[id]={midi:makeMidi(arr,bpm,id==='drums'?9:trackIds.indexOf(id),gm[id]||0,trackNames[id]),notes:arr};
  generated.full={midi:makeFullMidi(o,bpm),notes:state.notes};
  return generated;
}

async function composeWithBrowserAI(){
  const model=await getBrowserMusicAI();
  const bars=+$('#bars').value,bpm=Math.max(60,Math.min(200,+$('#bpm').value||140));
  const energy=+$('#energy').value,complexity=+$('#complexity').value;
  const seed=$('#seed').value;
  const style=$('#style').value;
  if(window.tf?.random?.setSeed)tf.random.setSeed(hashSeedNumber(seed));

  // Long-context hierarchical generation:
  // 16-bar neural ideas -> section planner -> continuity scoring -> full arrangement.
  const contextBars=browserMusicAIContextBars||4;
  const sections=Math.max(1,Math.ceil(bars/contextBars));
  const temperature=Math.max(.38,Math.min(1.05,.44+complexity/170));
  const candidateCount=sections>=4?2:3;
  const samples=await model.sample(sections*candidateCount,temperature);

  const candidates=[];
  for(let i=0;i<samples.length;i++){
    const section=Math.floor(i/candidateCount);
    if(!candidates[section])candidates[section]=[];
    candidates[section].push(samples[i]);
  }

  const chosen=[];
  let previous=null;
  const sectionNames=['intro','verse','pre','hook','verse2','break','hook2','outro'];
  for(let i=0;i<sections;i++){
    const pool=candidates[i]||[];
    let best=pool[0],bestScore=-Infinity;
    for(const candidate of pool){
      const stats=sequenceStats(candidate);
      let score=scoreMusicCandidate(candidate,previous,style,complexity);
      const sectionName=sectionNames[Math.min(sectionNames.length-1,Math.floor(i*8/Math.max(1,sections)))];
      // Global arrangement preferences: hooks need more density, breaks less.
      if(sectionName.includes('hook'))score+=stats.density*0.9;
      if(sectionName==='break')score-=stats.density*0.35;
      score+=(hashSeedNumber(seed+'|deep|'+i+'|'+(candidate.notes?.length||0))%1000)/100000;
      if(score>bestScore){bestScore=score;best=candidate}
    }
    chosen.push(best||{notes:[],totalQuantizedSteps:contextBars*16});
    previous=sequenceStats(best||{notes:[]});
  }

  // Assemble sections without destroying the model's long-range material.
  const merged={notes:[],totalQuantizedSteps:sections*contextBars*16};
  for(let i=0;i<chosen.length;i++){
    const section=chosen[i];
    const offset=i*contextBars*16;
    for(const n of section.notes||[]){
      const qs=Number.isFinite(n.quantizedStartStep)?n.quantizedStartStep:0;
      const qe=Number.isFinite(n.quantizedEndStep)?n.quantizedEndStep:qs+1;
      if(qs>=contextBars*16)continue;
      merged.notes.push({
        ...n,
        quantizedStartStep:qs+offset,
        quantizedEndStep:qe+offset
      });
    }
  }

  // Add deterministic macro-level transformations so repeated sections evolve
  // instead of becoming literal copies.
  const macroRng=rng(seed+'|macro-arrangement');
  const totalSteps=bars*16;
  const trimmed=merged.notes.filter(n=>n.quantizedStartStep<totalSteps);
  for(const n of trimmed){
    const bar=Math.floor((n.quantizedStartStep||0)/16);
    const section=Math.floor((bar/bars)*8);
    if(!n.isDrum && section===3 && macroRng()<.14)n.pitch=Math.min(127,n.pitch+12);
    if(!n.isDrum && section===5 && macroRng()<.22)n.pitch=Math.max(0,n.pitch-12);
    if(n.isDrum && section===3 && macroRng()<.12)n.velocity=Math.min(127,(n.velocity||80)+12);
  }
  merged.notes=trimmed;
  merged.totalQuantizedSteps=totalSteps;

  $('#statusBadge').textContent=contextBars>=16?'IA DEEP · 16 MESURES':'IA WEB · 4 MESURES';
  return renderBrowserAISequence(merged,bars,bpm,energy,complexity);
}

function downloadBlob(name,data,type='audio/midi'){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1200)}
function downloadTrack(id){const d=state.generated[id];if(d)downloadBlob(id==='full'?'melodix-instrumentale-full.mid':'melodix-'+id+'.mid',d.midi)}
const crcTable=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function zipStore(files){const enc=new TextEncoder(),local=[],central=[];let offset=0;for(const f of files){const name=enc.encode(f.name),data=f.data,crc=crc32(data),h=[80,75,3,4,20,0,0,0,0,0,0,0,0,0,crc&255,(crc>>>8)&255,(crc>>>16)&255,(crc>>>24)&255,data.length&255,(data.length>>>8)&255,(data.length>>>16)&255,(data.length>>>24)&255,name.length&255,(name.length>>>8)&255,0,0];local.push(new Uint8Array([...h,...name,...data]));const ch=[80,75,1,2,20,0,20,0,0,0,0,0,0,0,crc&255,(crc>>>8)&255,(crc>>>16)&255,(crc>>>24)&255,data.length&255,(data.length>>>8)&255,(data.length>>>16)&255,(data.length>>>24)&255,data.length&255,(data.length>>>8)&255,(data.length>>>16)&255,(data.length>>>24)&255,name.length&255,(name.length>>>8)&255,0,0,0,0,0,0,0,0,offset&255,(offset>>>8)&255,(offset>>>16)&255,(offset>>>24)&255];central.push(new Uint8Array([...ch,...name]));offset+=h.length+name.length+data.length}const size=central.reduce((a,b)=>a+b.length,0),end=new Uint8Array([80,75,5,6,0,0,0,0,central.length?files.length:0,0,central.length?files.length:0,0,size&255,(size>>>8)&255,(size>>>16)&255,(size>>>24)&255,offset&255,(offset>>>8)&255,(offset>>>16)&255,(offset>>>24)&255,0,0]);return new Blob([...local,...central,end],{type:'application/zip'})}
function downloadZip(){const files=Object.entries(state.generated).filter(([id])=>id!=='full').map(([id,d])=>({name:'midi/melodix-'+id+'.mid',data:d.midi}));files.push({name:'melodix-instrumentale-full.mid',data:state.generated.full.midi});downloadBlob('melodix-midi-pack.zip',zipStore(files),'application/zip')}
async function loadReference(f){if(!f||!f.type.startsWith('audio/'))return;if(state.reference?.url)URL.revokeObjectURL(state.reference.url);const url=URL.createObjectURL(f);state.reference={url};$('#player').src=url;$('#player').hidden=false;$('#fileName').textContent=f.name;$('#format').textContent=(f.name.split('.').pop()||'AUDIO').toUpperCase();$('#refState').textContent='READY';$('#player').onloadedmetadata=()=>$('#duration').textContent=Number.isFinite($('#player').duration)?fmt($('#player').duration):'—';await inspectReference(f)}
function fmt(s){return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}
const synthProfiles={
  Rap:{chord:["FMSynth",{harmonicity:1.5,modulationIndex:3,volume:-13}],melody:["Synth",{oscillator:{type:"triangle"},envelope:{attack:.01,decay:.16,sustain:.35,release:.22},volume:-10}],counter:["AMSynth",{volume:-17}],arp:["PluckSynth",{attackNoise:.35,dampening:.72,resonance:.82,volume:-15}]},
  Drill:{chord:["PolySynth",{voice:"Synth",options:{oscillator:{type:"triangle"},envelope:{attack:.01,decay:.22,sustain:.28,release:.45},volume:-15}}],melody:["FMSynth",{harmonicity:2,modulationIndex:7,volume:-13}],counter:["AMSynth",{volume:-20}],arp:["PluckSynth",{volume:-17}]},
  Trap:{chord:["PolySynth",{voice:"Synth",options:{oscillator:{type:"sawtooth"},envelope:{attack:.02,decay:.25,sustain:.32,release:.5},volume:-16}}],melody:["FMSynth",{harmonicity:1.5,modulationIndex:5,volume:-12}],counter:["Synth",{oscillator:{type:"square"},volume:-20}],arp:["PluckSynth",{volume:-16}]},
  Hyperpop:{chord:["PolySynth",{voice:"Synth",options:{oscillator:{type:"sawtooth"},envelope:{attack:.01,decay:.2,sustain:.5,release:.4},volume:-18}}],melody:["PolySynth",{voice:"FMSynth",options:{harmonicity:2,modulationIndex:8,volume:-15}}],counter:["AMSynth",{volume:-19}],arp:["PluckSynth",{volume:-15}]},
  "R&B":{chord:["PolySynth",{voice:"Synth",options:{oscillator:{type:"triangle"},envelope:{attack:.05,decay:.5,sustain:.45,release:1.1},volume:-15}}],melody:["FMSynth",{harmonicity:1.5,modulationIndex:2,volume:-14}],counter:["AMSynth",{volume:-19}],arp:["PluckSynth",{volume:-18}]},
  Pop:{chord:["PolySynth",{voice:"Synth",options:{oscillator:{type:"triangle"},envelope:{attack:.03,decay:.3,sustain:.5,release:.7},volume:-15}}],melody:["Synth",{oscillator:{type:"sine"},envelope:{attack:.01,decay:.18,sustain:.5,release:.35},volume:-11}],counter:["FMSynth",{harmonicity:2,modulationIndex:3,volume:-19}],arp:["PluckSynth",{volume:-17}]},
  Phonk:{chord:["PolySynth",{voice:"Synth",options:{oscillator:{type:"square"},envelope:{attack:.01,decay:.25,sustain:.3,release:.45},volume:-18}}],melody:["FMSynth",{harmonicity:2,modulationIndex:9,volume:-12}],counter:["AMSynth",{volume:-20}],arp:["PluckSynth",{volume:-15}]},
  "Hard Techno":{chord:["PolySynth",{voice:"Synth",options:{oscillator:{type:"sawtooth"},envelope:{attack:.005,decay:.12,sustain:.7,release:.2},volume:-20}}],melody:["MonoSynth",{oscillator:{type:"sawtooth"},envelope:{attack:.005,decay:.12,sustain:.5,release:.12},volume:-12}],counter:["AMSynth",{volume:-20}],arp:["MonoSynth",{oscillator:{type:"square"},envelope:{attack:.005,decay:.08,sustain:.3,release:.1},volume:-18}]},
  "Lo-fi":{chord:["PolySynth",{voice:"Synth",options:{oscillator:{type:"triangle"},envelope:{attack:.08,decay:.5,sustain:.5,release:1.2},volume:-17}}],melody:["FMSynth",{harmonicity:1.5,modulationIndex:2,volume:-14}],counter:["AMSynth",{volume:-21}],arp:["PluckSynth",{volume:-19}]},
  Rock:{chord:["PolySynth",{voice:"Synth",options:{oscillator:{type:"sawtooth"},envelope:{attack:.01,decay:.18,sustain:.55,release:.35},volume:-18}}],melody:["MonoSynth",{oscillator:{type:"square"},envelope:{attack:.01,decay:.15,sustain:.5,release:.25},volume:-12}],counter:["FMSynth",{harmonicity:1,modulationIndex:2,volume:-19}],arp:["PluckSynth",{volume:-18}]},
  Experimental:{chord:["PolySynth",{voice:"Synth",options:{oscillator:{type:"fatsawtooth",spread:25,count:3},envelope:{attack:.03,decay:.35,sustain:.45,release:.8},volume:-20}}],melody:["FMSynth",{harmonicity:3,modulationIndex:10,volume:-14}],counter:["AMSynth",{volume:-21}],arp:["PluckSynth",{volume:-16}]}
};

state.tone={ready:false,tracks:[],drums:[],bass:null,master:null};

function disposeTonePlayer(){
  if(!window.Tone)return;
  try{Tone.getTransport().stop();Tone.getTransport().cancel(0)}catch{}
  for(const x of state.tone.tracks||[])try{x.dispose()}catch{}
  for(const x of state.tone.drums||[])try{x.dispose()}catch{}
  if(state.tone.bass)try{state.tone.bass.dispose()}catch{}
  if(state.tone.master)try{state.tone.master.dispose()}catch{}
  state.tone={ready:false,tracks:[],drums:[],bass:null,master:null};
}

function makeToneSynth(type,opts){
  const C=Tone[type];
  if(!C)throw new Error("Tone instrument unavailable: "+type);
  if(type==="PolySynth")return new C(Tone.Synth,opts.options||{});
  return new C(opts||{});
}

async function prepareTonePlayer(){
  if(!window.Tone)throw new Error("Tone.js unavailable");
  await Tone.start();
  if(Tone.getContext().state!=="running")throw new Error("AudioContext is not running");
  disposeTonePlayer();
  const style=$('#style').value, profile=synthProfiles[style]||synthProfiles.Rap;
  const master=new Tone.Gain(.78).toDestination();
  const comp=new Tone.Compressor(-18,3).connect(master);
  state.tone.master=master;
  const tracks=[];
  for(const id of ['chords','melody','counter','arp']){
    const spec=profile[id==="chords"?"chord":id];
    const synth=makeToneSynth(spec[0],spec[1]);
    synth.connect(comp); tracks.push(synth);
  }
  const bass=new Tone.MonoSynth({
    oscillator:{type:"sine"},
    filter:{type:"lowpass",frequency:240,Q:1},
    envelope:{attack:.004,decay:.14,sustain:.5,release:.16},
    filterEnvelope:{attack:.001,decay:.08,sustain:.2,release:.12,baseFrequency:45,octaves:3},
    volume:-5
  }).connect(comp);
  const kick=new Tone.MembraneSynth({pitchDecay:.02,octaves:5,envelope:{attack:.001,decay:.2,sustain:0,release:.05},volume:-4}).connect(comp);
  const snare=new Tone.NoiseSynth({noise:{type:"white"},envelope:{attack:.001,decay:.08,sustain:0,release:.03},volume:-11}).connect(comp);
  const hat=new Tone.MetalSynth({frequency:180,envelope:{attack:.001,decay:.025,release:.02},harmonicity:5.1,modulationIndex:28,resonance:2500,volume:-19}).connect(comp);
  const clap=new Tone.NoiseSynth({noise:{type:"pink"},envelope:{attack:.001,decay:.1,sustain:0,release:.03},volume:-15}).connect(comp);
  state.tone={ready:true,tracks,drums:[kick,snare,hat,clap],bass,master};
  return {transport:Tone.getTransport(),tracks,bass,kick,snare,hat,clap};
}

function scheduleTonePreview(bpm,bars){
  const {transport,tracks,bass,kick,snare,hat,clap}=state.tone;
  const secPerTick=60/bpm/480;
  transport.stop();transport.cancel(0);transport.bpm.value=bpm;transport.timeSignature=4;transport.position=0;
  for(const n of state.notes){
    const at=Math.max(0,(Number(n.t)||0)*secPerTick);
    const dur=Math.max(.03,(Number(n.d)||1)*secPerTick);
    const v=Math.max(.05,Math.min(.9,(Number(n.v)||80)/127));
    try{
      if(n.track==="bass"){bass.triggerAttackRelease(noteName(n.p),dur,at,v);continue}
      if(n.track==="drums"){
        const p=Number(n.p);
        if(p===36)kick.triggerAttackRelease("C1",dur,at,v);
        else if(p===38||p===40)snare.triggerAttackRelease(dur,at,v);
        else if(p===42||p===44||p===46)hat.triggerAttackRelease(dur,at,v);
        else clap.triggerAttackRelease(dur,at,v);
        continue;
      }
      const idx={chords:0,melody:1,counter:2,arp:3}[n.track];
      const synth=tracks[idx??1];
      synth.triggerAttackRelease(noteName(n.p),dur,at,v);
    }catch(err){console.warn("Melodix note skipped",err)}
  }
  transport.scheduleOnce(()=>stopPreview(),bars*4*60/bpm);
}

async function playPreview(){
  if(!state.notes.length){$('#statusBadge').textContent='NOTHING TO PLAY';return}
  if(state.playing){stopPreview();return}
  try{
    state.playing=true;$('#playPreview').textContent='■';$('#statusBadge').textContent='STARTING AUDIO…';
    const bpm=Math.max(60,Math.min(200,+$('#bpm').value||140));
    const bars=Math.max(1,+$('#bars').value||32);
    const duration=bars*4*60/bpm;
    const p=await prepareTonePlayer();
    scheduleTonePreview(bpm,bars);
    p.transport.start("+0.08");
    $('#statusBadge').textContent='PLAYING';$('#playTime').textContent='00:00';$('#transportFill').style.width='0%';
    const started=performance.now();
    clearInterval(state.timer);
    state.timer=setInterval(()=>{
      if(!state.playing)return;
      const elapsed=Math.min(duration,(performance.now()-started)/1000);
      $('#transportFill').style.width=Math.min(100,elapsed/duration*100)+'%';
      $('#playTime').textContent=fmt(elapsed);
      if(elapsed>=duration)stopPreview();
    },50);
  }catch(e){
    console.error("Melodix Tone player:",e);
    state.playing=false;clearInterval(state.timer);state.timer=null;disposeTonePlayer();
    $('#playPreview').textContent='▶';$('#statusBadge').textContent='PLAYER ERROR';
    $('#playTime').textContent='00:00';$('#transportFill').style.width='0%';
  }
}

function stopPreview(){
  state.playing=false;clearInterval(state.timer);state.timer=null;
  disposeTonePlayer();
  $('#playPreview').textContent='▶';$('#transportFill').style.width='0%';$('#playTime').textContent='00:00';
}

async function generate(){
  const btn=$('#generate');btn.disabled=true;stopPreview();
  $('#statusBadge').textContent='IA WEB…';$('#emptyOutput').hidden=false;$('#result').hidden=true;
  $('#emptyOutput').innerHTML='<div>🧠</div><b>Composition musicale en cours…</b><span>IA + arrangement multi-couches + variations + instruments.</span>';
  try{
    if(creationMode==='reference'){try{const ns=await transcribeReference();state.generated=composeFromTranscription(ns)}catch(e){console.warn('Transcription IA:',e);state.generated=compose()}}else state.generated=await composeWithBrowserAI();
  }catch(e){
    console.warn('Melodix Browser AI unavailable:',e);
    $('#statusBadge').textContent='MODE CRÉATIF';
    $('#emptyOutput').innerHTML='<div>✦</div><b>IA Web indisponible · moteur de secours</b><span>La génération MIDI reste disponible.</span>';
    state.generated=compose();
  }
  renderPreview();renderTracks();renderTrackDownloads();$('#result').hidden=false;$('#emptyOutput').hidden=true;
  $('#all').disabled=false;$('#zip').disabled=false;btn.disabled=false;$('#statusBadge').textContent='GENERATED';$('#statusBadge').classList.add('done');
  $('#transportTitle').textContent=$('#style').value+' · '+$('#mood').value+' · IA Web';
}
if($('#modeReference'))$('#modeReference').onclick=()=>setCreationMode('reference');if($('#modeImagine'))$('#modeImagine').onclick=()=>setCreationMode('imagine');setCreationMode('reference');
const seedButton=$('#randomSeed');if(seedButton)seedButton.onclick=()=>{$('#seed').value=randomSeed();$('#seed').focus()};if($('#seed').value==='melodix-01')$('#seed').value=randomSeed();
const file=$('#file'),drop=$('#drop');file.onchange=e=>loadReference(e.target.files[0]);['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag')}));drop.addEventListener('drop',e=>loadReference(e.dataTransfer.files[0]));$('#clearRef').onclick=()=>{if(state.reference?.url)URL.revokeObjectURL(state.reference.url);state.reference=null;state.inspiration=null;file.value='';$('#player').removeAttribute('src');$('#player').load();$('#player').hidden=true;$('#fileName').textContent='Aucune référence';$('#duration').textContent='—';$('#format').textContent='—';$('#refState').textContent='AUTO';$('#analysisText').textContent='Aucune référence · moteur créatif autonome';$('#analysisBadge').textContent='AUTO'};$('#energy').oninput=e=>$('#energyOut').textContent=e.target.value+'%';$('#complexity').oninput=e=>$('#complexityOut').textContent=e.target.value+'%';$('#style').onchange=()=>{renderAdvice();renderTracks()};$('#generate').onclick=generate;$('#regen').onclick=generate;$('#playPreview').onclick=()=>state.playing?stopPreview():playPreview();$('#all').onclick=()=>downloadTrack('full');$('#zip').onclick=downloadZip;document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='SELECT')generate()});renderAdvice();renderTracks();