window.onload = async () => {
    // 0. Cache Buster Logic (New)
    const APP_VER = '2.0'; 
    const savedVer = localStorage.getItem('app_version');
    if(savedVer !== APP_VER) {
        // Clear old caches if needed, or just update version
        // caches.delete('medquiz-v1'); // If you had an old cache name
        localStorage.setItem('app_version', APP_VER);
        console.log('App Updated to ' + APP_VER);
    }

    // 1. Data & Sync
    await Data.initSync();

    // 2. UI Init
    UI.init();

    // 3. Telegram & Security
    const tg = window.Telegram.WebApp; 
    tg.ready(); tg.expand();
    
    try {
        if(tg.isVersionAtLeast('6.1')) {
           tg.setHeaderColor(getComputedStyle(document.body).getPropertyValue('--primary'));
        }
    } catch(e){}

    State.user = tg.initDataUnsafe.user || {id: 0, first_name: "Guest"};
    UI.updateProfileDisplay(); // Update name immediately

    if(ENABLE_SECURITY) {
        if(ALLOWED_IDS.includes(State.user.id)) {
            document.getElementById('lock-screen').style.display = 'none';
            document.getElementById('app-wrap').style.display = 'flex';
        } else {
            document.getElementById('debug-id').innerText = `ID: ${State.user.id}`;
            return;
        }
    } else {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app-wrap').style.display = 'flex';
    }

    // 4. Load Qs
    Data.loadQuestions();

    // 5. PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(()=>console.log('SW Ready')).catch(()=>console.log('SW Fail'));
    }

    // 6. Keys
    document.addEventListener('keydown', e => {
        if(document.getElementById('v-quiz').classList.contains('hidden')) return;
        const k = e.key.toLowerCase(), m = {'a':0,'b':1,'c':2,'d':3,'e':4}; 
        if(m[k]!==undefined) Game.answer(m[k]);
        if(k===' '||k==='enter') { e.preventDefault(); Game.nextQ(); }
        if(k==='arrowright') Game.nextQ();
        if(k==='arrowleft') Game.navQ(-1);
        if(k==='s') Game.toggleFav();
    });
};
