export type RequestState<I,O> =
  | {phase:'idle'}
  | {phase:'loading';input:I;retry:boolean}
  | {phase:'ready';input:I;retry:boolean;value:O}
  | {phase:'error';input:I;retry:boolean;reason:'timeout'|'network';error:unknown};

/** An explicit retry repeats one read; edits/cancellation invalidate late responses. */
export class RetryableRequest<I,O> {
  state:RequestState<I,O>={phase:'idle'};
  private generation=0;
  private controller:AbortController|null=null;
  private perform:(input:I,signal:AbortSignal)=>Promise<O>;
  private change:(state:RequestState<I,O>)=>void;
  private timeoutMs:number;
  constructor(perform:(input:I,signal:AbortSignal)=>Promise<O>,change:(state:RequestState<I,O>)=>void,timeoutMs=15000){this.perform=perform;this.change=change;this.timeoutMs=timeoutMs;}
  private publish(state:RequestState<I,O>){this.state=state;this.change(state);}
  cancel(){this.generation++;this.controller?.abort('cancelled');this.controller=null;this.publish({phase:'idle'});}
  retry(){return this.state.phase==='error'?this.start(this.state.input,true):Promise.resolve();}
  async start(input:I,retry=false):Promise<void>{
    const generation=++this.generation;
    this.controller?.abort('superseded');
    const controller=new AbortController();this.controller=controller;
    this.publish({phase:'loading',input,retry});
    let abort=()=>{};
    const interrupted=new Promise<never>((_,reject)=>{abort=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',abort,{once:true});});
    const timer=setTimeout(()=>controller.abort('timeout'),this.timeoutMs);
    let outcome:RequestState<I,O>;
    try {
      const value=await Promise.race([this.perform(input,controller.signal),interrupted]);
      outcome={phase:'ready',input,retry,value};
    }catch(error){outcome={phase:'error',input,retry,reason:controller.signal.reason==='timeout'?'timeout':'network',error};}
    finally{clearTimeout(timer);controller.signal.removeEventListener('abort',abort);}
    if(generation!==this.generation)return;
    this.controller=null;
    this.publish(outcome);
  }
}
