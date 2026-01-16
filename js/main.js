window.onload = async () => {
    // 0. Cache Buster Logic
    const APP_VER = '2.1'; 
    const savedVer = localStorage.getItem('app_version');
    if(savedVer !== APP_VER) {
        localStorage.setItem('app_version', APP_VER);
        console.log('App Updated to ' + APP_VER);
    }

    // 1. Telegram Init & Security Check (PRIORITY 1)
    // We run this FIRST to ensure Lock Screen is removed even if other things fail.
    const tg = window.Telegram.WebApp; 
    tg.ready(); tg.expand();
    
    State.user = tg.initDataUnsafe.user || {id: 0, first_name: "Guest"};

    // Security Logic
    const lockScreen = document.getElementById('lock-screen');
    const appWrap = document.getElementById('app-wrap');
    const debugId = document.getElementById('debug-id');

    if(ENABLE_SECURITY) {
        if(ALLOWED_IDS.includes(State.user.id)) {
            if(lockScreen) lockScreen.style.display = 'none';
            if(appWrap) appWrap.style.display = 'flex';
        } else {
            // Access denied
            if(debugId) debugId.innerText = `ID: ${State.user.id}`;
            // Stop execution here if security is strictly enabled and user not allowed
            return; 
        }
    } else {
        // Security Disabled - Open App Immediately
        if(lockScreen) lockScreen.style.display = 'none';
        if(appWrap) appWrap.style.display = 'flex';
    }

    // 2. Data & Sync
    try {
        await Data.initSync();
    } catch(e) { console.error("Data Sync Error:", e); }

    // 3. UI Init
    try {
        UI.init();
        // Try to set header color safely
        if(tg.isVersionAtLeast('6.1')) {
           const primary = getComputedStyle(document.body).getPropertyValue('--primary');
           if(primary) tg.setHeaderColor(primary.trim());
        }
    } catch(e) { console.error("UI Init Error:", e); }

    // 4. Load Questions
    Data.loadQuestions();

    // 5. PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(()=>console.log('SW Ready')).catch(e=>console.log('SW Fail', e));
    }

    // 6. Keys
    document.addEventListener('keydown', e => {
        const vQuiz = document.getElementById('v-quiz');
        if(!vQuiz || vQuiz.classList.contains('hidden')) return;
        
        const k = e.key.toLowerCase(), m = {'a':0,'b':1,'c':2,'d':3,'e':4}; 
        if(m[k]!==undefined) Game.answer(m[k]);
        if(k===' '||k==='enter') { e.preventDefault(); Game.nextQ(); }
        if(k==='arrowright') Game.nextQ();
        if(k==='arrowleft') Game.navQ(-1);
        if(k==='s') Game.toggleFav();
    });
};
