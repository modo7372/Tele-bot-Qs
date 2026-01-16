const AVATARS = ["👨‍⚕️","👩‍⚕️","👨‍🔬","👩‍🔬","🦸‍♂️","🦸‍♀️","🧠","🦁","🦊","🐸","👻","🤖"];

const AudioSys = {
    ctx: null, enabled: false,
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
        UI.renderAvatars();
        
        // Load Settings
        const s = State.localData.settings || {};
        UI.setTheme(s.theme || 'light');
        if(s.fontFam) UI.updateStyleVar('--font-fam', s.fontFam);
        if(s.fontSize) UI.updateStyleVar('--font-size', s.fontSize);
        
        document.getElementById('chk-sound').checked = s.sound !== false;
        document.getElementById('chk-haptic').checked = s.haptic !== false;
        document.getElementById('chk-anim').checked = s.anim !== false;

        // Profile
        document.getElementById('set-gender').value = s.gender || 'male';
        UI.updateProfileDisplay();
        
        AudioSys.enabled = s.sound !== false;

        // Init Anim (Bubbles)
        UI.initAnim();
        if(s.anim === false) UI.toggleAnim(false);

        document.body.addEventListener('click', () => {
            if(AudioSys.ctx && AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
            if(!AudioSys.ctx) AudioSys.init();
        }, {once:true});
    },

    renderThemes: () => {
        const c = document.getElementById('theme-list'); c.innerHTML = '';
        THEMES.forEach(t => {
            const d = document.createElement('div');
            d.className = 'theme-preview';
            d.style.background = t.color;
            d.onclick = () => UI.setTheme(t.id);
            c.appendChild(d);
        });
    },

    renderAvatars: () => {
        const c = document.getElementById('avatar-list');
        AVATARS.forEach(a => {
            const d = document.createElement('div');
            d.className = 'avatar-opt';
            d.innerText = a;
            d.onclick = () => {
                document.querySelectorAll('.avatar-opt').forEach(x=>x.classList.remove('selected'));
                d.classList.add('selected');
                UI.saveSetting('avatar', a);
                UI.updateProfileDisplay();
            };
            c.appendChild(d);
        });
    },

    updateProfileDisplay: () => {
        const s = State.localData.settings || {};
        const av = s.avatar || (s.gender === 'female' ? "👩‍⚕️" : "👨‍⚕️");
        document.getElementById('u-avatar').innerText = av;
        document.getElementById('u-name').innerText = State.user.first_name || "Guest";
    },

    saveProfile: () => {
        const g = document.getElementById('set-gender').value;
        UI.saveSetting('gender', g);
        UI.updateProfileDisplay();
    },

    showTotalStats: () => {
        const total = State.allQ.length;
        if(total === 0) return alert('البيانات غير محملة');
        
        const solved = State.localData.archive.length;
        const mistakes = State.localData.mistakes.length;
        // In this logic, answered - mistakes = correct (approximate, assuming archived means tried)
        // A better approach is to track "correct" explicitly, but we work with what we have.
        // Assuming 'mistakes' stores IDs of questions currently wrong.
        
        // Actually, let's count strictly based on IDs:
        // Solved = Unique IDs in Archive
        // Wrong = IDs in Archive AND in Mistakes
        // Correct = IDs in Archive AND NOT in Mistakes
        
        const wrongCnt = State.localData.archive.filter(id => State.localData.mistakes.includes(id)).length;
        const correctCnt = solved - wrongCnt;
        
        document.getElementById('st-total').innerText = total;
        document.getElementById('st-solved').innerText = Math.round((solved/total)*100) + '%';
        document.getElementById('st-correct').innerText = correctCnt;
        document.getElementById('st-wrong').innerText = wrongCnt;
        
        const acc = solved > 0 ? Math.round((correctCnt/solved)*100) : 0;
        document.getElementById('st-acc').innerText = acc + '%';
        document.getElementById('st-bar').style.width = acc + '%';
        
        UI.openModal('m-stats');
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

    // --- Enhanced Animation ---
    initAnim: (randomize = false) => {
        const c=document.getElementById('bg-canvas'), x=c.getContext('2d');
        let w,h,p=[]; 
        const r=()=>{w=c.width=window.innerWidth;h=c.height=window.innerHeight;}; 
        window.onresize=r; r();
        
        class P{
            constructor(){this.i();} 
            i(){
                this.x=Math.random()*w;
                this.y=h+Math.random()*100; 
                this.r=Math.random()*15 + 5; 
                this.vx=(Math.random()-.5)*1; 
                this.vy=-(Math.random()*1 + 0.5); 
                this.a = Math.random() * 0.3;
                // Random shapes if randomize is true
                this.type = randomize ? Math.floor(Math.random()*3) : 0; // 0:Circle, 1:Square, 2:Tri
            } 
            u(){
                this.x+=this.vx; this.y+=this.vy; 
                if(this.y < -50) this.i(); 
            } 
            d(){
                x.fillStyle=`rgba(120,120,120,${this.a})`;
                x.beginPath();
                if(this.type === 0) {
                     x.arc(this.x,this.y,this.r,0,Math.PI*2);
                } else if (this.type === 1) {
                    x.fillRect(this.x, this.y, this.r*1.5, this.r*1.5);
                } else {
                    x.moveTo(this.x, this.y);
                    x.lineTo(this.x+this.r, this.y+this.r*2);
                    x.lineTo(this.x-this.r, this.y+this.r*2);
                }
                x.fill();
            }
        }
        
        p=Array(25).fill().map(()=>new P()); 
        function a(){
            x.clearRect(0,0,w,h); 
            p.forEach(n=>{n.u();n.d()}); 
            requestAnimationFrame(a);
        } 
        a();
    }
};
