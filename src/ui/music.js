// Música generativa original del juego "Los Tira Vida 02" del equipo (CC0, dominio público). Sin grabaciones.
// Se activa con el botón MÚSICA. Modos: 'orbit' tranquilo, 'danger' en emergencias, 'victory' al cumplir la misión.
export class Soundtrack {
  constructor(){this.ctx=null;this.master=null;this.volume=.22;this.muted=false;this.mode='orbit';this.beat=0;this.next=0;this.timer=null;}
  async start(){
    try{
      if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=this.volume;this.master.connect(this.ctx.destination);}
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
  effect(kind){if(!this.ctx||this.muted)return;const t=this.ctx.currentTime;
    const seq=kind==='craft'?[60,67,72,79]:kind==='mine'?[55,67]:kind==='alert'?[69,57,69]:[64,71];
    seq.forEach((n,i)=>this.note(n,t+i*.065,.12,.10,'square'));
  }
  suspend(){this.ctx?.suspend();}
  resume(){this.ctx?.resume();}
}

export const music = new Soundtrack();
