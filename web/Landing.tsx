import { ArrowUpRight, ArrowRight, ShieldCheck, Link, MessageSquare, QrCode, Image, Check, Moon, Sun, Fingerprint, HeartHandshake } from 'lucide-react';
import './landing.css';

export function Landing({enter,dark,toggleTheme}:{enter:()=>void;dark:boolean;toggleTheme:()=>void}) {
  return <div className="landing">
    <a className="skip" href="#landing-main">Skip to content</a>
    <header className="lp-nav">
      <a href="#" className="lp-logo"><ShieldCheck/> SafeLink<span>AI</span></a>
      <nav aria-label="Landing navigation"><a href="#protection">Protection</a><a href="#how-it-works">How it works</a></nav>
      <div className="lp-nav-actions"><button className="lp-theme" onClick={toggleTheme} aria-label={dark?'Use light theme':'Use dark theme'}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button><button className="lp-button lp-small" onClick={enter}>Open workspace <ArrowUpRight size={16}/></button></div>
    </header>
    <main id="landing-main" className="lp-main">
      <section className="lp-hero">
        <div className="lp-hero-copy"><div className="lp-kicker"><span/> A LITTLE PAUSE. A LOT MORE PEACE OF MIND.</div>
          <h1>The internet moves fast.<br/><em>Trust takes<br/>a second look.</em></h1>
          <p>A suspicious link. An urgent message. A QR code you don’t quite trust. Get a clearer picture before you take the next step.</p>
          <div className="lp-hero-actions"><button className="lp-button" onClick={enter}>Start checking <ArrowUpRight size={20}/></button><a href="#how-it-works">See how it works <ArrowRight size={17}/></a></div>
          <div className="lp-assurances"><span><Check size={15}/> No account needed to scan</span><span><Check size={15}/> বাংলা & English</span></div>
        </div>
        <div className="lp-art" aria-label="Illustrative message analysis preview">
          <div className="lp-orbit lp-orbit-one"/><div className="lp-orbit lp-orbit-two"/>
          <span className="lp-art-caption">A SECOND LOOK, BEFORE THE FIRST CLICK</span>
          <div className="lp-floating lp-floating-top"><Fingerprint size={20}/><span>Your information.<br/><strong>Your choice.</strong></span></div>
          <div className="lp-preview"><div className="lp-preview-head"><span><ShieldCheck size={19}/> SafeLink check</span><span className="lp-preview-label">ILLUSTRATION</span></div><div className="lp-message"><MessageSquare size={18}/><p>“Your account will be blocked.<br/>Share your PIN to verify now.”</p></div><div className="lp-verdict"><span className="lp-warning">!</span><div><small>TAKE A CLOSER LOOK</small><h2>A reason to pause.</h2></div><ArrowUpRight size={22}/></div><div className="lp-signals"><span>Requests a private PIN</span><span>Pressures you to act</span></div><div className="lp-advice"><ShieldCheck size={17}/><p>Verify through the official app.<br/>Keep your PIN to yourself.</p></div></div>
          <div className="lp-floating lp-floating-bottom"><span className="lp-dot"/><span>Clear reasons.<br/><strong>More confident choices.</strong></span></div>
          <div className="lp-art-foot">LESS GUESSWORK <span>↗</span> MORE CLARITY</div>
        </div>
      </section>
      <div className="lp-strip"><span>BUILT FOR EVERYDAY DIGITAL LIFE</span><strong>Read the signals.</strong><span className="lp-star">✳</span><strong>Understand the risk.</strong><span className="lp-star">✳</span><strong>Choose your next step.</strong></div>
      <section id="protection" className="lp-section"><div className="lp-section-heading"><div><span className="lp-kicker">ONE PLACE. FOUR SECOND LOOKS.</span><h2>Whatever arrives.<br/>Check before you trust.</h2></div><p>Make space for a smarter decision, whether it lands in your inbox or appears on your screen.</p></div>
        <div className="lp-features">{[{icon:Link,n:'01',title:'Links, decoded.',text:'Look for misleading addresses, look-alike brands and suspicious URL patterns.'},{icon:MessageSquare,n:'02',title:'Messages, understood.',text:'Spot credential requests, pressure tactics and scam language in বাংলা, Banglish and English.'},{icon:QrCode,n:'03',title:'QR codes, revealed.',text:'See what a QR code contains before deciding whether to open its destination.'},{icon:Image,n:'04',title:'Screenshots, read.',text:'Extract text from a screenshot and check the message behind the image.'}].map(f=><article key={f.n}><div className="lp-feature-top"><f.icon size={26}/><span>{f.n}</span></div><h3>{f.title}</h3><p>{f.text}</p><button onClick={enter} aria-label={'Open scanner: '+f.title}>Take a second look <ArrowUpRight size={17}/></button></article>)}</div>
      </section>
      <section id="how-it-works" className="lp-method"><div><span className="lp-kicker">CLARITY, NOT COMPLICATION.</span><h2>From “is this safe?”<br/>to “here’s my next step.”</h2><p>No technical background needed. Just something you want to double-check.</p><button className="lp-button" onClick={enter}>Try your first check <ArrowUpRight size={19}/></button></div><ol>{[['Bring your doubt.','Paste a link or message, or upload a QR code or screenshot.'],['See the reasons.','Review the warning signals and which checks were performed.'],['Take an informed step.','Use practical guidance to verify the sender and protect your information.']].map(([h,p],i)=><li key={h}><span>0{i+1}</span><div><h3>{h}</h3><p>{p}</p></div></li>)}</ol></section>
      <section className="lp-trust"><HeartHandshake size={38}/><div><h2>A little more care.<br/>For you and your people.</h2><p>Save checks with an account, review community signals, and set up Family Shield. External AI and threat checks are optional and depend on configured services.</p></div><div className="lp-honesty"><ShieldCheck size={24}/><h3>Guidance, with honesty.</h3><p>Risk indicators aren’t guarantees. SafeLink explains what it finds, and a low score never proves something is safe.</p></div></section>
      <section className="lp-final"><span className="lp-kicker">BEFORE YOU CLICK, TAKE A SECOND LOOK.</span><h2>A safer habit<br/>starts with one check.</h2><button className="lp-button" onClick={enter}>Open SafeLink <ArrowUpRight size={21}/></button><p>Start as a guest. Create an account when you’re ready.</p></section>
    </main><footer className="lp-footer"><a className="lp-logo" href="#"><ShieldCheck/> SafeLink<span>AI</span></a><p>Built for a safer click.</p><span>Pause. Check. Proceed thoughtfully.</span></footer>
  </div>;
}
