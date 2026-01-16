// js/ui.js

const UI = {
    init: () => {
        // Apply saved settings
        const s = State.localData.settings;
        if(s.theme) UI.setTheme(s.theme);
        if(s.fontFam) UI.updateStyleVar('--font-fam', s.fontFam);
        if(s.fontSize) UI.updateStyleVar('--font-size', s.fontSize);
        if(s.btnPad) UI.updateStyleVar('--btn-pad', s.btnPad);
        if(s.anim === false) UI.toggleBgAnim(false);

        // Canvas Anim
        UI.initAnim();
    },

    showView: (id) => {
        ['v-home','v-select','v-quiz'].forEach(v => document.getElementById(v).classList.add('hidden'));
        const el = document.getElementById(id);
        el.classList.remove('hidden');
        // Reset display to flex/grid appropriately
        el.style.display = (id === 'v-home') ? 'grid' : 'flex';
    },

    goHome: () => {
        Game.stopTimer();
        UI.showView('v-home');
        UI.closeModal('m-score');
    },

    openModal: (id) => document.getElementById(id).style.display = 'flex',
    closeModal: (id) => document.getElementById(id).style.display = 'none',

    // --- Customization ---
    setTheme: (t) => {
        document.body.setAttribute('data-theme', t);
        UI.saveSetting('theme', t);
    },

    updateStyleVar: (key, val) => {
        document.documentElement.style.setProperty(key, val);
        // Map keys to setting names for storage
        let map = {'--font-fam':'fontFam', '--font-size':'fontSize', '--btn-pad':'btnPad'};
        if(map[key]) UI.saveSetting(map[key], val);
    },

    saveSetting: (key, val) => {
        State.localData.settings[key] = val;
        localStorage.setItem('settings', JSON.stringify(State.localData.settings));
    },

    toggleZenMode: () => {
        document.body.classList.toggle('zen-mode');
    },

    toggleBgAnim: (isActive) => {
        const c = document.getElementById('bg-canvas');
        c.style.display = isActive ? 'block' : 'none';
        UI.saveSetting('anim', isActive);
    },

    shareApp: () => {
        const url = "https://t.me/share/url?url=" + encodeURIComponent("Join me on MedQuiz Master! @Heailloo_bot");
        window.open(url, '_blank');
    },

    // Background Animation
    initAnim: () => {
        const c=document.getElementById('bg-canvas'), x=c.getContext('2d');
        let w,h,p=[]; 
        const r=()=>{w=c.width=window.innerWidth;h=c.height=window.innerHeight;}; 
        window.onresize=r; r();
        
        class P{
            constructor(){this.i();} 
            i(){this.x=Math.random()*w;this.y=Math.random()*h;this.r=Math.random()*4;this.vx=(Math.random()-.5)*.5;this.vy=(Math.random()-.5)*.5;} 
            u(){this.x+=this.vx;this.y+=this.vy;if(this.x<0||this.x>w||this.y<0||this.y>h)this.i();} 
            d(){x.beginPath();x.arc(this.x,this.y,this.r,0,Math.PI*2);x.fillStyle='rgba(100,100,200,0.15)';x.fill();}
        }
        p=Array(40).fill().map(()=>new P());
        function a(){
            x.clearRect(0,0,w,h);
            if(document.getElementById('bg-canvas').style.display !== 'none') {
                p.forEach(n=>{n.u();n.d()});
            }
            requestAnimationFrame(a);
        } a();
    }
};
