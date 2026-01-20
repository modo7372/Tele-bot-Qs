const UI = {
    // --- Initial Setup ---
    init: () => {
        UI.applySettings();
        UI.renderHomeStats();
    },

    applySettings: () => {
        const s = State.localData.settings || {};
        // Theme
        if(s.theme) document.body.setAttribute('data-theme', s.theme);
        // Toggle toggles
        const setC = (id, k) => { if(document.getElementById(id)) document.getElementById(id).checked = (s[k]!==false); };
        setC('chk-sound', 'sound');
        setC('chk-haptic', 'haptic');
        setC('chk-anim', 'anim');
        
        // Profile
        if(document.getElementById('u-name')) document.getElementById('u-name').innerText = State.user.full_name;
        UI.renderAvatar(s.gender, s.avatarChar);
        UI.toggleAnim(s.anim !== false);
    },

    renderAvatar: (gender, char) => {
        const def = gender === 'female' ? "👩‍⚕️" : "👨‍⚕️";
        document.getElementById('u-avatar').innerText = char || def;
    },

    // --- Navigation ---
    showView: (vid) => {
        ['v-home','v-select','v-quiz'].forEach(v => document.getElementById(v).classList.add('hidden'));
        const el = document.getElementById(vid);
        el.classList.remove('hidden');
        el.style.display = (vid==='v-home') ? 'grid' : 'flex';
        
        if(vid === 'v-home') UI.renderHomeStats();
    },

    openModal: (mid) => document.getElementById(mid).style.display = 'flex',
    closeModal: (mid) => document.getElementById(mid).style.display = 'none',

    toggleFullScreen: () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(e => {
                alert("جهازك لا يدعم ملء الشاشة أو تم الرفض.");
            });
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    },

    // --- Stats Rendering ---
    renderHomeStats: () => {
        // Calculate based on history
        const solved = State.localData.archive.length;
        // Simplified accuracy: Look at mistakes count relative to solved? 
        // Logic: solved = correct + mistakes(that were logged).
        // A better stat is: solved_unique. 
        // Let's use simplified local stats object if available
        let correct = State.localData.stats.totalCorrect || 0;
        let total = State.questionsIndex.length * 100; // Est total
        
        document.getElementById('home-correct').innerText = correct;
        
        // Progress ring logic (Abstract representation)
        // Since total Qs aren't fully loaded, we use ratio of Solved/Correct?
        // Let's just show accuracy
        const attempts = State.localData.stats.totalAttempts || 1;
        const pct = Math.round((correct / attempts) * 100);
        
        document.getElementById('home-pct').innerText = (pct || 0) + '%';
        const ring = document.getElementById('home-ring');
        ring.style.background = `conic-gradient(var(--success) ${pct*3.6}deg, rgba(0,0,0,0.1) 0deg)`;

        // Update Modal Stats
        document.getElementById('st-total').innerText = attempts;
        document.getElementById('st-solved').innerText = solved;
        document.getElementById('st-correct').innerText = correct;
        document.getElementById('st-wrong').innerText = attempts - correct;
    },

    // --- Audio/Haptics ---
    playSound: (type) => {
        if(State.localData.settings.sound === false) return;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        
        if(type==='correct') { osc.type='sine'; osc.frequency.value=600; }
        else if(type==='wrong') { osc.type='sawtooth'; osc.frequency.value=200; }
        else { osc.type='triangle'; osc.frequency.value=1200; } // click
        
        osc.start();
        g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);
        osc.stop(ctx.currentTime + 0.15);
    },
    
    haptic: (style) => {
        if(State.localData.settings.haptic === false) return;
        if(window.Telegram && Telegram.WebApp.HapticFeedback) {
            if(style === 'success' || style === 'error') Telegram.WebApp.HapticFeedback.notificationOccurred(style);
            else Telegram.WebApp.HapticFeedback.selectionChanged();
        }
    },

    // --- Preferences Actions ---
    toggleSound: (v) => { State.localData.settings.sound = v; Data.save(); },
    toggleHaptic: (v) => { State.localData.settings.haptic = v; Data.save(); },
    toggleAnim: (v) => { 
        const cvs = document.getElementById('bg-canvas');
        if(cvs) cvs.style.display = v ? 'block' : 'none';
        State.localData.settings.anim = v; 
        Data.save(); 
        if(v) AnimationBG.start(); else AnimationBG.stop();
    },
    
    saveProfile: () => {
        const g = document.getElementById('set-gender').value;
        State.localData.settings.gender = g;
        UI.renderAvatar(g, null);
        Data.save();
    },
    
    goHome: () => {
        GameEngine.stop();
        UI.showView('v-home');
        UI.closeModal('m-score');
    }
};

// Canvas Background Logic (Lightweight)
const AnimationBG = {
    running: false,
    start: () => {
        if(AnimationBG.running) return;
        AnimationBG.running = true;
        const canvas = document.getElementById('bg-canvas');
        const ctx = canvas.getContext('2d');
        let width, height, particles = [];
        
        const resize = () => { width=canvas.width=window.innerWidth; height=canvas.height=window.innerHeight; };
        window.addEventListener('resize', resize); resize();

        for(let i=0; i<15; i++) particles.push({ x:Math.random()*width, y:Math.random()*height, r:Math.random()*4+1, vy:-Math.random()*0.5-0.1 });

        const draw = () => {
            if(!AnimationBG.running) return;
            ctx.clearRect(0,0,width,height);
            ctx.fillStyle = "rgba(120,120,120,0.15)";
            particles.forEach(p => {
                p.y += p.vy; if(p.y < -10) p.y = height + 10;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
            });
            requestAnimationFrame(draw);
        };
        draw();
    },
    stop: () => { AnimationBG.running = false; }
};
