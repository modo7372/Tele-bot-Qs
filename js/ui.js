const AudioSys = {
    ctx: null,
    enabled: false,
    init: () => {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        AudioSys.ctx = new AudioContext();
    },
    playTone: (freq, type, duration) => {
        if (!AudioSys.enabled || !AudioSys.ctx) return;
        const osc = AudioSys.ctx.createOscillator();
        const gain = AudioSys.ctx.createGain();
        osc.type = type; osc.frequency.value = freq;
        osc.connect(gain); gain.connect(AudioSys.ctx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, AudioSys.ctx.currentTime + duration);
        osc.stop(AudioSys.ctx.currentTime + duration);
    },
    playSuccess: () => { AudioSys.playTone(600, 'sine', 0.1); setTimeout(()=>AudioSys.playTone(800, 'sine', 0.2), 100); },
    playError: () => { AudioSys.playTone(300, 'sawtooth', 0.1); setTimeout(()=>AudioSys.playTone(200, 'sawtooth', 0.2), 100); },
    playClick: () => { AudioSys.playTone(1200, 'triangle', 0.05); }
};

const UI = {
    init: () => {
        UI.renderThemes();
        
        // Load Settings
        const s = State.localData.settings || {};
        UI.setTheme(s.theme || 'light');
        if(s.fontFam) UI.updateStyleVar('--font-fam', s.fontFam);
        if(s.fontSize) UI.updateStyleVar('--font-size', s.fontSize);
        
        document.getElementById('chk-sound').checked = s.sound !== false;
        document.getElementById('chk-haptic').checked = s.haptic !== false;
        document.getElementById('chk-anim').checked = s.anim !== false;
        
        AudioSys.enabled = s.sound !== false;

        // Init Anim (Bubbles)
        UI.initAnim();
        if(s.anim === false) UI.toggleAnim(false);

        // Unlock Audio
        document.body.addEventListener('click', () => {
            if(AudioSys.ctx && AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
            if(!AudioSys.ctx) AudioSys.init();
        }, {once:true});
    },

    renderThemes: () => {
        const c = document.getElementById('theme-list');
        THEMES.forEach(t => {
            const d = document.createElement('div');
            d.className = 'theme-preview';
            d.style.background = t.color;
            d.title = t.name;
            d.onclick = () => UI.setTheme(t.id);
            c.appendChild(d);
        });
    },

    showView: (id) => {
        ['v-home','v-select','v-quiz'].forEach(v => document.getElementById(v).classList.add('hidden'));
        const el = document.getElementById(id);
        el.classList.remove('hidden');
        el.style.display = (id === 'v-home') ? 'grid' : 'flex';
    },

    goHome: () => { Game.stopTimer(); UI.showView('v-home'); UI.closeModal('m-score'); },
    openModal: (id) => document.getElementById(id).style.display = 'flex',
    closeModal: (id) => document.getElementById(id).style.display = 'none',

    setTheme: (t) => {
        document.body.setAttribute('data-theme', t);
        document.querySelectorAll('.theme-preview').forEach(e => e.classList.remove('active'));
        const active = document.querySelector(`.theme-preview[style*="${THEMES.find(x=>x.id==t)?.color}"]`);
        if(active) active.classList.add('active');
        UI.saveSetting('theme', t);
    },

    toggleSound: (v) => { AudioSys.enabled = v; UI.saveSetting('sound', v); },
    toggleHaptic: (v) => { UI.saveSetting('haptic', v); },
    toggleAnim: (v) => { 
        const cvs = document.getElementById('bg-canvas');
        if(v) cvs.classList.remove('hidden'); else cvs.classList.add('hidden');
        UI.saveSetting('anim', v); 
    },

    updateStyleVar: (key, val) => {
        document.documentElement.style.setProperty(key, val);
        if(key === '--font-fam') UI.saveSetting('fontFam', val);
        if(key === '--font-size') UI.saveSetting('fontSize', val);
    },

    saveSetting: (key, val) => {
        State.localData.settings = State.localData.settings || {};
        State.localData.settings[key] = val;
        Data.saveData(); 
    },

    shareApp: () => window.open("https://t.me/share/url?url=" + encodeURIComponent("Join me on MedQuiz Master!"), '_blank'),

    // Floating Bubbles Animation
    initAnim: () => {
        const c=document.getElementById('bg-canvas'), x=c.getContext('2d');
        let w,h,p=[]; 
        const r=()=>{w=c.width=window.innerWidth;h=c.height=window.innerHeight;}; 
        window.onresize=r; r();
        
        class P{
            constructor(){this.i();} 
            i(){
                this.x=Math.random()*w;
                this.y=h+Math.random()*100; // Start below screen
                this.r=Math.random()*15 + 5; // Size 5-20
                this.vx=(Math.random()-.5)*1; 
                this.vy=-(Math.random()*1 + 0.5); // Always up
                this.a = Math.random() * 0.3; // Alpha
            } 
            u(){
                this.x+=this.vx; this.y+=this.vy; 
                if(this.y < -50) this.i(); // Reset if off top
            } 
            d(){
                x.beginPath();
                x.arc(this.x,this.y,this.r,0,Math.PI*2);
                x.fillStyle=`rgba(120,120,120,${this.a})`;
                x.fill();
            }
        }
        
        p=Array(25).fill().map(()=>new P()); // 25 Bubbles
        function a(){
            x.clearRect(0,0,w,h); 
            p.forEach(n=>{n.u();n.d()}); 
            requestAnimationFrame(a);
        } 
        a();
    }
};
