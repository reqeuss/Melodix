/* Melodix Instrument Engine
 * Neural MIDI -> sampled instruments.
 * The composer decides WHAT to play; this layer decides HOW it sounds.
 */
(function(){
  const styleMap={
    Rap:{chords:"electric_piano_1",melody:"lead_1_square",counter:"pad_2_warm",arp:"marimba",bass:"synth_bass_1"},
    Drill:{chords:"acoustic_grand_piano",melody:"lead_5_charang",counter:"choir_aahs",arp:"music_box",bass:"synth_bass_2"},
    Trap:{chords:"electric_piano_2",melody:"lead_2_sawtooth",counter:"pad_3_polysynth",arp:"marimba",bass:"synth_bass_1"},
    Hyperpop:{chords:"electric_grand_piano",melody:"lead_2_sawtooth",counter:"pad_8_sweep",arp:"celesta",bass:"synth_bass_2"},
    "R&B":{chords:"electric_piano_1",melody:"alto_sax",counter:"pad_2_warm",arp:"vibraphone",bass:"electric_bass_finger"},
    Pop:{chords:"acoustic_grand_piano",melody:"lead_6_voice",counter:"string_ensemble_1",arp:"glockenspiel",bass:"electric_bass_finger"},
    Phonk:{chords:"electric_piano_2",melody:"lead_1_square",counter:"choir_aahs",arp:"agogo",bass:"synth_bass_2"},
    "Hard Techno":{chords:"synth_strings_1",melody:"lead_2_sawtooth",counter:"pad_6_metallic",arp:"synth_drum",bass:"synth_bass_2"},
    "Lo-fi":{chords:"electric_piano_1",melody:"acoustic_grand_piano",counter:"pad_2_warm",arp:"kalimba",bass:"acoustic_bass"},
    Rock:{chords:"electric_guitar_clean",melody:"overdriven_guitar",counter:"string_ensemble_1",arp:"electric_guitar_clean",bass:"electric_bass_pick"},
    Experimental:{chords:"pad_7_halo",melody:"lead_4_chiff",counter:"pad_5_bowed",arp:"fx_3_crystal",bass:"fretless_bass"}
  };

  let cache=new Map();
  let session=null;

  function rawContext(){
    try{return window.Tone?.getContext?.().rawContext||window.Tone?.getContext?.()._context||window.Tone?.getContext?.();}catch{return null}
  }

  async function load(style, destination){
    if(!window.Soundfont) throw new Error("Soundfont player unavailable");
    const ac=rawContext();
    if(!ac) throw new Error("WebAudio context unavailable");
    const names=styleMap[style]||styleMap.Rap;
    const unique=[names.chords,names.melody,names.counter,names.arp,names.bass];
    const players={};
    for(const name of unique){
      const key=name+"|"+style;
      if(!cache.has(key)){
        const promise=Soundfont.instrument(ac,name,{
          soundfont:"MusyngKite",
          format:"ogg",
          destination,
          gain:0.72
        });
        cache.set(key,promise);
      }
      players[name]=await cache.get(key);
    }
    session={style,names,players,destination};
    return session;
  }

  function play(track,midi,when,duration,velocity){
    if(!session)return false;
    const name=session.names[track];
    const instrument=session.players[name];
    if(!instrument)return false;
    const gain=Math.max(.03,Math.min(1,(Number(velocity)||80)/127));
    try{
      instrument.play(Number(midi),when,{duration:Math.max(.03,duration),gain});
      return true;
    }catch(e){
      console.warn("Melodix sampled note skipped",e);
      return false;
    }
  }

  function stop(){
    for(const instrument of Object.values(session?.players||{})){
      try{instrument.stop()}catch{}
    }
  }

  function dispose(){
    stop();
    session=null;
  }

  window.MelodixInstruments={load,play,stop,dispose,styleMap};
})();