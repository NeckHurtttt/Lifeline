// Música generativa original del juego "Los Tira Vida 02" del equipo (CC0, dominio público). Sin grabaciones.
// Se activa con el botón MÚSICA. Modos: 'orbit' tranquilo, 'danger' en emergencias, 'victory' al cumplir la misión.
export class Soundtrack {
  constructor(){this.ctx=null;this.master=null;this.volume=.75;this.muted=false;this.mode='orbit';this.beat=0;this.next=0;this.timer=null;}
  async start(){
    try{
      if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=this.volume;const comp=this.ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;this.master.connect(comp).connect(this.ctx.destination);}
      await this.ctx.resume();
      if(!this.timer){this.next=this.ctx.currentTime+.1;this.timer=setInterval(()=>this.schedule(),80);}
      return true;
    }catch{return false;}
  }
  setVolume(v){this.volume=Math.max(0,Math.min(1,v));if(this.master)this.master.gain.setTargetAtTime(this.muted?0:this.volume,this.ctx.currentTime,.08);}
  toggle(){this.muted=!this.muted;this.setVolume(this.volume);return this.muted;}
  modeTo(mode){this.mode=mode;}
  note(midi,at,duration,level=.1,type='triangle'){
    const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=440*2**((midi-69)/12);
    g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(level,at+.018);g.gain.exponentialRampToValueAtTime(.001,at+duration);
    o.connect(g).connect(this.master);o.start(at);o.stop(at+duration+.03);
  }
  schedule(){
    if(!this.ctx||this.ctx.state!=='running')return;
    if(this.next<this.ctx.currentTime)this.next=this.ctx.currentTime+.05;
    const tension=this.mode==='danger',victory=this.mode==='victory';const beatLength=tension?.15:.21;
    while(this.next<this.ctx.currentTime+.3){
      if(this.mode==='phonk'){this.phonk(this.beat,this.next);this.next+=.115;this.beat++;continue;}
      const b=this.beat%64,chord=Math.floor(b/16),roots=victory?[48,55,57,53]:[45,41,48,43],root=roots[chord];
      if(b%8===0){for(const interval of [0,7,victory?16:15])this.note(root+interval,this.next,beatLength*10,.038,'triangle');}
      if(b%4===0)this.note(root-12,this.next,beatLength*3,.13,'triangle');
      const phrase=[0,7,12,15,7,19,12,7,3,10,15,19,12,22,19,10];
      if(b%2===0)this.note(root+12+phrase[Math.floor(b/2)%16],this.next,beatLength*1.8,this.mode==='orbit'?.035:.075,'square');
      if(tension&&b%2===1)this.note(root+19,this.next,beatLength*.6,.04,'sawtooth');
      if(this.mode!=='orbit'&&b%4===0){this.note(28,this.next,.12,.22,'sine');this.note(72+(b%8?7:0),this.next,.035,.025,'triangle');}
      this.next+=beatLength;this.beat++;
    }
  }

  // Modo 'phonk' (eventos relámpago): beat original estilo drift phonk, todo sintetizado.
  // Cencerro (cowbell) con la melodía, 808 distorsionado que baja de tono, bombo, palmas y hi-hats con redobles.
  noiseBuf(){if(!this._noise){const n=this.ctx.sampleRate*.5,b=this.ctx.createBuffer(1,n,this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;this._noise=b;}return this._noise;}
  hit(at,dur,level,freq,type='highpass'){const src=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();src.buffer=this.noiseBuf();f.type=type;f.frequency.value=freq;
    g.gain.setValueAtTime(level,at);g.gain.exponentialRampToValueAtTime(.001,at+dur);src.connect(f).connect(g).connect(this.master);src.start(at);src.stop(at+dur+.02);}
  kick(at){const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.frequency.setValueAtTime(150,at);o.frequency.exponentialRampToValueAtTime(42,at+.12);
    g.gain.setValueAtTime(.55,at);g.gain.exponentialRampToValueAtTime(.001,at+.3);o.connect(g).connect(this.master);o.start(at);o.stop(at+.32);}
  bass(at,midi,dur){if(!this._shaper){this._shaper=this.ctx.createWaveShaper();const c=new Float32Array(1024);for(let i=0;i<1024;i++){const x=i/512-1;c[i]=Math.tanh(x*4);}this._shaper.curve=c;this._shaper.connect(this.master);}
    const o=this.ctx.createOscillator(),g=this.ctx.createGain(),f=440*2**((midi-69)/12);o.type='sine';o.frequency.setValueAtTime(f*1.5,at);o.frequency.exponentialRampToValueAtTime(f,at+.06);
    o.frequency.setValueAtTime(f,at+dur*.7);o.frequency.exponentialRampToValueAtTime(f*.7,at+dur);
    g.gain.setValueAtTime(.32,at);g.gain.setValueAtTime(.32,at+dur*.8);g.gain.exponentialRampToValueAtTime(.001,at+dur);o.connect(g).connect(this._shaper);o.start(at);o.stop(at+dur+.02);}
  cowbell(at,midi,level=.07){const f=440*2**((midi-69)/12),bp=this.ctx.createBiquadFilter(),g=this.ctx.createGain();bp.type='bandpass';bp.frequency.value=f*1.2;bp.Q.value=2.5;
    g.gain.setValueAtTime(level,at);g.gain.exponentialRampToValueAtTime(level*.35,at+.05);g.gain.exponentialRampToValueAtTime(.001,at+.32);bp.connect(g).connect(this.master);
    for(const m of [1,1.48]){const o=this.ctx.createOscillator();o.type='square';o.frequency.value=f*m;o.connect(bp);o.start(at);o.stop(at+.34);}}
  phonk(step,at){
    const b=step%64,s=b%16,bar=Math.floor(b/16);
    const roots=[37,37,33,35]; // Do# menor: C#, C#, A, B
    if([0,7,10].includes(s)||(bar===3&&s===14))this.kick(at);
    if([0,7,10].includes(s))this.bass(at,roots[bar]-12,s===0?.6:.32);
    if(s===4||s===12){this.hit(at,.16,.32,1400,'bandpass');this.hit(at+.012,.12,.18,2500,'bandpass');}
    const roll=bar===3&&s>=12;
    if(s%2===0||roll)this.hit(at,.035,roll?.07:.1,8000);
    if(roll&&s%2===1)this.hit(at+.057,.03,.06,8000);
    // Melodía de cencerro (original): dos frases que se repiten
    const mel=[[73,0],[0,0],[76,0],[73,0],[0,0],[80,0],[78,0],[0,0],[76,0],[0,0],[73,0],[71,0],[0,0],[73,0],[0,0],[68,0]];
    const n=mel[s][0];if(n)this.cowbell(at,n+(bar===2?-4:bar===3?-2:0));
  }
  effect(kind){if(!this.ctx||this.muted)return;const t=this.ctx.currentTime;
    const seq=kind==='craft'?[60,67,72,79]:kind==='mine'?[55,67]:kind==='alert'?[69,57,69]:[64,71];
    seq.forEach((n,i)=>this.note(n,t+i*.065,.12,.10,'square'));
  }
  suspend(){this.ctx?.suspend();}
  resume(){this.ctx?.resume();}
}

export const music = new Soundtrack();
