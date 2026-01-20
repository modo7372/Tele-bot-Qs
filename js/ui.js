const UI = {
    init: () => {
        // Init happens in applySettings logic called by Data
        UI.renderSettingChips();
    },

    applySettings: () => {
        const s = State.localData.settings || {};
        
        // 1. Theme
        document.body.setAttribute('data-theme', s.theme || 'light');
        
        // 2. Avatar/Name
        const g = s.gender || 'male';
        const char = s.char || (g==='female' ? '👩‍⚕️' : '👨‍⚕️');
        document.getElementById('u-avatar').innerText = char;
        if(document.getElementById('u-name')) document.getElementById('u-name').innerText = State.user.full_name;

        // 3. Inputs
        const setCheck = (id, k) => { if(document.getElementById(id)) document.getElementById(id).checked = (s[k]!==false); };
        setCheck('chk-anim', 'anim');
        setCheck('chk-sound', 'sound');
        setCheck('chk-haptic', 'haptic');
        
        // 4. Anim
        UI.toggleAnim(s.anim !== false);
    },

    renderSettingChips: () => {
        const avBox = document.getElementById('avatar-list');
        const thBox = document.getElementById('theme-list');
        
        // Avatars
        avBox.innerHTML = '';
        ['👨‍⚕️','👩‍⚕️','🧑‍🔬','🧙‍♂️','🤖','🦊','👻','👽','🌚','🌞','😎'].forEach(c => {
             const d = document.createElement('div'); d.className='chip'; d.innerText=c;
             d.onclick = () => { UI.saveSetting('char', c); UI.applySettings(); };
             avBox.appendChild(d);
        });
        
        // Themes
        thBox.innerHTML = '';
        THEMES.forEach(t => {
            const d = document.createElement('div'); d.className='chip';
            // Simple logic: we don't need JS hex colors. CSS variables handle visual logic.
            // But for preview in settings, we set attribute so CSS can color it.
            d.innerText = t;
            d.setAttribute('data-theme', t); // Let CSS color it based on attribute logic
            d.onclick = () => { UI.saveSetting('theme', t); UI.applySettings(); };
            thBox.appendChild(d);
        });
    },

    // Navigation
    showView: (v) => {
        ['v-home','v-select','v-quiz'].forEach(x=>document.getElementById(x).classList.add('hidden'));
        document.getElementById(v).classList.remove('hidden');
        if(v==='v-home') UI.updateHomeStats();
        // Reset scroll
        document.getElementById(v).scrollTop = 0;
    },
    
    openModal: (id) => document.getElementById(id).style.display = 'flex',
    closeModal: (id) => document.getElementById(id).style.display = 'none',
    toggleFullScreen: () => { if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{}); else document.exitFullscreen(); },

    // Visuals
    updateHomeStats: () => {
        const solved = State.localData.archive.length;
        const total = State.allQ.length || 1;
        // Calc Correct: Archive minus Matches in Mistakes
        const mist = State.localData.mistakes;
        const wrongCnt = State.localData.archive.filter(id => mist.includes(id)).length;
        const correct = solved - wrongCnt;
        
        const pct = solved > 0 ? Math.round((correct/solved)*100) : 0;

        document.getElementById('home-correct').innerText = correct;
        document.getElementById('home-pct').innerText = pct + "%";
        
        const ring = document.getElementById('home-ring');
        ring.style.background = `conic-gradient(var(--success) ${pct*3.6}deg, transparent 0)`;
        
        // Modal Data
        document.getElementById('st-total').innerText = total;
        document.getElementById('st-solved').innerText = solved;
        document.getElementById('st-correct').innerText = correct;
        document.getElementById('st-wrong').innerText = wrongCnt;
    },

    saveSetting: (k,v) => {
        State.localData.settings[k] = v;
        Data.save();
    },
    
    saveProfile: () => {
        UI.saveSetting('gender', document.getElementById('set-gender').value);
        UI.applySettings();
    },

    playSound: (isCorrect) => {
        if(State.localData.settings.sound===false) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = isCorrect ? 'sine' : 'square';
            o.frequency.value = isCorrect ? 600 : 150;
            o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1); o.stop(ctx.currentTime+0.15);
        } catch(e){}
    },

    // --- ANIMATION SYSTEM ---
    toggleAnim: (active) => {
        const cvs = document.getElementById('bg-canvas');
        if(active) { 
            cvs.style.display='block'; 
            AnimSys.start(); 
        } else { 
            cvs.style.display='none'; 
            AnimSys.stop(); 
        }
        if(active !== State.localData.settings.anim) UI.saveSetting('anim', active);
    },
};

const AnimSys = {
    running: false,
    start: () => {
        if(AnimSys.running) return;
        AnimSys.running = true;
        const c = document.getElementById('bg-canvas');
        const ctx = c.getContext('2d');
        let w, h, p=[];
        const rs=()=>{w=c.width=window.innerWidth; h=c.height=window.innerHeight;}; window.onresize=rs; rs();
        
        for(let i=0; i<20; i++) p.push({x:Math.random()*w, y:Math.random()*h, s:Math.random()+0.5, r:Math.random()*10});
        
        const loop = () => {
            if(!AnimSys.running) return;
            ctx.clearRect(0,0,w,h);
            // Particle Color based on Theme CSS var for consistency
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--particle-col');
            p.forEach(d => {
                d.y -= d.s; if(d.y < -20) d.y = h+20;
                ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.28); ctx.fill();
            });
            requestAnimationFrame(loop);
        };
        loop();
    },
    stop: () => { AnimSys.running = false; }
};
