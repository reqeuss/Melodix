/* Melodix Generative Music Engine v3 — deterministic candidate search */
(function(){
  const TRACKS=["drums","bass","chords","melody","counter","arp"];
  const SCALES={minor:[0,2,3,5,7,8,10],major:[0,2,4,5,7,9,11],dorian:[0,2,3,5,7,9,10],phrygian:[0,1,3,5,7,8,10],harmonic:[0,2,3,5,7,8,11],pentatonic:[0,2,4,7,9],blues:[0,3,5,6,7,10]};
  const PROGS=[[0,3,5,4],[0,5,3,4],[0,3,4,5],[0,5,4,3],[0,4,5,3],[0,2,5,4],[0,6,3,4],[0,4,2,5],[0,3,6,5],[0,5,2,6],[0,3,5,1],[0,4,3,6]];
  const STYLE={Rap:{m:["minor","dorian","harmonic"],r:[48,50,45,43],d:"hiphop"},Drill:{m:["minor","phrygian"],r:[38,41,43,36],d:"drill"},Trap:{m:["minor","harmonic","dorian"],r:[48,43,45,41],d:"trap"},Hyperpop:{m:["major","minor","dorian"],r:[57,53,60,55],d:"hyper"},"R&B":{m:["minor","dorian","major"],r:[45,50,52,48],d:"rnb"},Pop:{m:["major","minor"],r:[48,43,45,50],d:"pop"},Phonk:{m:["minor","phrygian"],r:[45,41,43,38],d:"phonk"},"Hard Techno":{m:["minor","phrygian","dorian"],r:[41,43,36,38],d:"techno"},"Lo-fi":{m:["minor","dorian","major"],r:[48,45,43,50],d:"lofi"},Rock:{m:["minor","major"],r:[40,43,45,38],d:"rock"},Experimental:{m:["dorian","phrygian","blues","harmonic"],r:[50,46,53,48],d:"experimental"}};
  const hash=s=>{let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
  const rng=s=>{let x=hash(s)||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296}};
  const pick=(r,a)=>a[Math.floor(r()*a.length)],clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const add=(a,t,p,d,v,ch=0)=>a.push({t:Math.round(t),p:clamp(Math.round(p),0,127),d:Math.max(20,Math.round(d)),v:clamp(Math.round(v),1,127),ch});
  const degree=(root,scale,d,oct=0)=>{const i=((d%scale.length)+scale.length)%scale.length;return root+scale[i]+12*Math.floor(d/scale.length)+oct};
  const chord=(root,q)=>({maj:[0,4,7],min:[0,3,7],min7:[0,3,7,10],maj7:[0,4,7,11],dom7:[0,4,7,10],sus2:[0,2,7],sus4:[0,5,7],add9:[0,4,7,14]}[q]||[0,3,7]).map(x=>root+x);
  function score(o,bars,energy,complexity){
    const all=Object.values(o).flat();if(!all.length)return-1e9;
    const counts=new Array(bars).fill(0);for(const n of all)counts[Math.floor(n.t/1920)]=counts[Math.floor(n.t/1920)]+1;
    let variance=0;for(let i=1;i<counts.length;i++)variance+=Math.abs(counts[i]-counts[i-1]);
    const coverage=counts.filter(Boolean).length/bars,target=bars*(18+complexity*30);
    return coverage*500-Math.abs(all.length-target)*2-variance*.7+Math.min(o.melody.length,bars*7)*2+Math.min(o.chords.length,bars*3)+energy*30;
  }
  function candidate(p,salt){
    const r=rng(p.seed+"|"+salt),cfg=STYLE[p.style]||STYLE.Rap,scale=SCALES[pick(r,cfg.m)],roots=cfg.r.slice(),prog=pick(r,PROGS).slice();
    if(p.style==="Hard Techno")prog.splice(0,4,...pick(r,[[0,0,3,5],[0,3,0,5],[0,0,5,3]]));
    const o={drums:[],bass:[],chords:[],melody:[],counter:[],arp:[]},step=120,bar=1920;
    const motifLen=pick(r,[4,6,8,12]),motif=Array.from({length:motifLen},()=>({d:Math.floor(r()*scale.length),oct:r()<.15?12:0}));
    let lastMel=roots[0],lastBass=roots[0]-12;
    for(let b=0;b<p.bars;b++){
      const base=b*bar,hook=b>=p.bars*.30&&b<p.bars*.62,intro=b<p.bars*.10,bridge=b>=p.bars*.74&&b<p.bars*.86;
      const root=roots[prog[b%4]%roots.length],q=p.style==="R&B"?pick(r,["min7","maj7","dom7","add9"]):pick(r,["min","min","maj","sus2","sus4","add9"]);
      let ch=chord(root,q);const inv=r()<.55?Math.floor(r()*Math.min(3,ch.length)):0;ch=ch.map((x,i)=>x+(i<inv?12:0)).sort((a,z)=>a-z);
      ch.forEach((x,i)=>{if(!intro||i===0||r()<.62)add(o.chords,base,x,bridge?1200:hook?1840:1720,30+p.energy*32+(hook?12:0))});
      const bp=cfg.d==="techno"?[0,2,4,6,8,10,12,14]:pick(r,[[0,3,7,11,14],[0,4,8,11,15],[0,2,6,9,12,14],[0,5,8,10,14]]);
      for(const s of bp){if(intro&&s>3||bridge&&r()<.72)continue;let pitch=s===0?root-12:degree(root,scale,pick(r,[0,0,2,4,5]),-12);if(Math.abs(pitch-lastBass)>19&&r()<.55)pitch=lastBass;add(o.bass,base+s*step+(r()<.12?18:0),pitch+(hook&&r()<.12?12:0),pick(r,[220,280,340,420,520]),s===0?95:72+p.energy*20);lastBass=pitch}
      const patterns={hiphop:[[0,3,6,8,11,14],[0,4,7,10,12,15]],drill:[[0,3,7,10,14],[0,2,6,9,13,15]],trap:[[0,3,5,8,11,14],[0,4,7,10,12,15]],phonk:[[0,3,6,10,14],[0,5,9,12,14]],techno:[[0,2,4,6,8,10,12,14]],hyper:[[0,2,5,7,10,12,14,15]],rnb:[[0,4,7,10,14],[0,3,6,9,12,15]],pop:[[0,4,8,12],[0,3,6,9,12,15]],lofi:[[0,4,7,11,14],[0,3,8,12,15]],rock:[[0,4,8,12],[0,3,6,9,12,15]],experimental:[[0,1,5,6,9,12,14],[0,2,3,7,11,13,15]]};
      const kp=pick(r,patterns[cfg.d]||patterns.hiphop);
      for(let s=0;s<16;s++){const t=base+s*step;let k=cfg.d==="techno"?s%2===0:kp.includes(s);if(hook&&r()<.12)k=true;if(bridge)k=s===0;if(intro)k=k&&s%4===0;if(k)add(o.drums,t,36,80,95+p.energy*28,9);if(!intro&&!bridge&&(s===4||s===12||(hook&&s===15)))add(o.drums,t,38,65,82+p.energy*25,9);if(!intro&&!bridge&&(s%2===0||r()<p.complexity*.25))add(o.drums,t+(r()<.1?18:0),42,24,40+p.complexity*42,9);if(p.complexity>.62&&!bridge&&r()<.16)add(o.drums,t+60,42,18,32+p.energy*25,9)}
      if(p.fills&&b%4===3&&!intro&&!bridge)for(let s=12;s<16;s++)if(r()<.72)add(o.drums,base+s*step,45,25,55+p.energy*30,9);
      const density=Math.round((3+p.complexity*8)*(hook?1.35:bridge?.35:1));
      for(let n=0;n<density;n++){const m=motif[(n+b*2)%motifLen];let d=m.d+(b%4===2&&n%2?2:b%4===3&&n%3===0?scale.length:0)+(r()<.22?pick(r,[-1,0,1]):0);if(b%4===1)d=-d;let pitch=degree(root,scale,d,m.o);if(Math.abs(pitch-lastMel)>12)pitch+=pitch>lastMel?-12:12;const pos=pick(r,[[0,2,4,7,10,12,14],[1,4,6,9,12,14],[0,3,5,8,11,15]]);add(o.melody,base+pos[n%pos.length]*step+(r()<.12?20:0),pitch,pick(r,[60,90,120,180]),48+p.energy*40+(hook?12:0));lastMel=pitch;if(p.counter&&hook&&n%3===1)add(o.counter,base+pos[n%pos.length]*step+pick(r,[80,100,140]),pitch+pick(r,[-12,-7,5,7]),pick(r,[90,120,160]),35+p.energy*25)}
      if(p.arp&&!intro&&!bridge){const order=pick(r,[[0,1,2,1],[0,2,1,2],[0,1,3,2]]);for(let s=0;s<(hook?8:4);s++)add(o.arp,base+s*(hook?240:480),ch[order[s%4]%ch.length]+12+(hook&&r()<.3?12:0),hook?90:150,28+p.energy*22)}
      if(p.variations&&b%4===3&&!intro&&!bridge)add(o.melody,base+1740,degree(root,scale,motif[(b+3)%motifLen].d+2,12),100,65+p.energy*20);
    }
    for(const id of TRACKS){o[id].sort((a,b)=>a.t-b.t||a.p-b.p);for(const n of o[id]){if(id!=="drums")n.v=clamp(n.v+(r()-.5)*8,1,127);if(id==="drums"&&r()<.08)n.v*=.72}}
    return{notes:o,score:score(o,p.bars,p.energy,p.complexity)};
  }
  function compose(p){const c=Array.from({length:8},(_,i)=>candidate(p,i)).sort((a,b)=>b.score-a.score),best=c[0],out={notes:Object.entries(best.notes).flatMap(([track,a])=>a.map(n=>({...n,track}))),meta:{score:best.score,candidates:c.length}};if(typeof makeMidi==="function"){for(const[id,a]of Object.entries(best.notes))out[id]={midi:makeMidi(a,p.bpm,id==="drums"?9:TRACKS.indexOf(id),gm[id]||0,trackNames[id]),notes:a};out.full={midi:makeFullMidi(best.notes,p.bpm),notes:out.notes}}return out}
  window.MelodixEngine={compose,version:"3.0.0"};
})();