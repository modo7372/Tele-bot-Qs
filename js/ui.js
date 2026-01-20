const UI = {
    init: () => {
        // Init logic moved to applySettings to ensure safe loading
        UI.renderAvatars();
        UI.renderThemes();
    },

    applySettings: () => {
        const s = State.localData.settings || {};
        if(s.theme) UI.setTheme(s.theme);
        if(s.sound !== undefined) document.getElementById('chk-sound').checked = s.sound;
        if(s.haptic !== undefined) document.getElementById('chk-haptic').checked = s.haptic;
        
        // Restore Animation toggle
        const animState = (s.anim !== false); 
        document.getElementById('chk-anim').checked = animState;
        UI.toggleAnim(animState);
        
        if(document.getElementById('u-name')) document.getElementById('u-name').innerText = State.user.full_name;
        UI.updateAvatar(s.gender, s.avatarChar);
    },

    renderAvatars: () => {
        const chars = ["👨‍⚕️","👩‍⚕️","👨‍🔬","👩‍🔬","🦸‍♂️","🦸‍♀️","🧠","👽","🦁","🦊","🐸","👻"];
        const c = document.getElementById('avatar-list');
        if(c) {
            c.innerHTML = '';
            chars.forEach(a => {
                const d = document.createElement('div');
                d.className = 'chip';
                d.innerText = a;
                d.onclick = () => { UI.saveSetting('avatarChar', a); UI.updateAvatar(null, a); };
                c.appendChild(d);
            });
        }
    },
    
    updateAvatar: (g, char) => {
         const def = g === 'female' ? "👩‍⚕️" : "👨‍⚕️";
         const f = char || State.localData.settings.avatarChar || def;
         document.getElementById('u-avatar').innerText = f;
    },

    renderThemes: () => {
        const list = document.getElementById('theme-list');
        if(!list) return;
        list.innerHTML = '';
        THEMES.forEach(t => {
            const d = document.createElement('div');
            d.className = 'chip';
            d.style.background = t.color;
            d.style.width = '30px'; d.style.height = '30px'; d.innerText = '';
            d.onclick = () => UI.setTheme(t.id);
            list.appendChild(d);
        });
    },

    setTheme: (id) => {
        document.body.setAttribute('data-theme', id);
        UI.saveSetting('theme', id);
    },
    
    // --- Key Function: Swimming Particles (Canvas) ---
    initAnim: (isRandom = false) => {
        const c = document.getElementById('bg-canvas');
        if(!c) return;
        const x = c.getContext('2d');
        let w, h, particles = [];
        
        const rsz = () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; };
        window.addEventListener('resize', rsz); rsz();
        
        // Create Bubbles
        for(let i=0; i<20; i++) particles.push({
            x: Math.random()*w, y: Math.random()*h,
            r: Math.random()*15 + 5,
            vx: (Math.random() - 0.5) * 1,
            vy: -(Math.random() * 1 + 0.5)
        });
        
        function loop() {
            if(!State.localData.settings.anim && State.localData.settings.anim!==undefined) return; // Stop if disabled
            x.clearRect(0,0,w,h);
            x.fillStyle = "rgba(128,128,128,0.1)"; // Default color
            
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy;
                if(p.y < -50) p.y = h + 50;
                if(p.x > w+50) p.x = -50; if(p.x < -50) p.x = w+50;
                
                x.beginPath(); x.arc(p.x, p.y, p.r, 0, Math.PI*2); x.fill();
            });
            requestAnimationFrame(loop);
        }
        loop();
    },
    
    toggleAnim: (v) => {
        UI.saveSetting('anim', v);
        const cvs = document.getElementById('bg-canvas');
        if(cvs) cvs.style.display = v ? 'block' : 'none';
        if(v) UI.initAnim();
    },

    // --- Stats & UI Utils ---
    updateHomeStats: () => {
        if(!State.allQ.length) return;
        const total = State.allQ.length;
        const solved = State.localData.archive.length;
        const wrongCnt = State.localData.archive.filter(id => State.localData.mistakes.includes(id)).length;
        const correct = solved - wrongCnt;
        
        document.getElementById('home-correct').innerText = correct;
        
        const pct = Math.round((correct / (solved || 1)) * 100); 
        document.getElementById('home-pct').innerText = (solved > 0 ? pct : 0) + '%';
        
        const ring = document.getElementById('home-ring');
        if(ring) ring.style.background = `conic-gradient(var(--success) ${pct*3.6}deg, rgba(0,0,0,0.1) 0deg)`;
        
        // Modal
        document.getElementById('st-total').innerText = total;
        document.getElementById('st-solved').innerText = solved;
        document.getElementById('st-correct').innerText = correct;
        document.getElementById('st-wrong').innerText = wrongCnt;
    },
    
    showTotalStats: () => {
         UI.updateHomeStats();
         UI.openModal('m-stats');
    },

    showView: (v) => {
        ['v-home','v-select','v-quiz'].forEach(id=>document.getElementById(id).classList.add('hidden'));
        document.getElementById(v).classList.remove('hidden');
        if(v==='v-home') UI.updateHomeStats();
        // Scroll top
        document.getElementById(v).scrollTop = 0;
    },

    openModal: (id) => document.getElementById(id).style.display='flex',
    closeModal: (id) => document.getElementById(id).style.display='none',
    
    saveSetting: (k,v) => { State.localData.settings[k] = v; Data.save(); },
    
    toggleFullScreen: () => {
        if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
        else if(document.exitFullscreen) document.exitFullscreen();
    },
    
    saveProfile: () => {
         UI.saveSetting('gender', document.getElementById('set-gender').value);
         UI.updateAvatar(document.getElementById('set-gender').value, null);
    },

    playSound: (t) => {
        if(State.localData.settings.sound===false) return;
        const ctx = new (window.AudioContext||window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        if(t=='correct') { osc.type='sine'; osc.frequency.value=600; }
        else { osc.type='triangle'; osc.frequency.value=200; }
        osc.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.2); osc.stop(ctx.currentTime+0.2);
    }
};
