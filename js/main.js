window.onload = async () => {
    // 1. Data & Sync
    await Data.initSync();

    // 2. UI Init
    UI.init();

    // 3. Telegram & Security
    const tg = window.Telegram.WebApp; 
    tg.ready(); tg.expand();
    
    // Set colors based on theme if possible
    try {
        if(tg.isVersionAtLeast('6.1')) {
           tg.setHeaderColor(getComputedStyle(document.body).getPropertyValue('--primary'));
        }
    } catch(e){}

    State.user = tg.initDataUnsafe.user || {id: 0, first_name: "Guest"};

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

    // 5. PWA Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(()=>console.log('SW Ready')).catch(()=>console.log('SW Fail'));
    }

    // 6. Keys
    document.addEventListener('keydown', e => {
        if(document.getElementById('v-quiz').classList.contains('hidden')) return;
        const k = e.key.toLowerCase(), m = {'a':0,'b':1,'c':2,'d':3,'e':4}; 
        if(m[k]!==undefined) Game.answer(m[k]);
        if((k===' '||k==='enter') && Game.answered) { e.preventDefault(); Game.nextQ(); }
        if(k==='s') Game.toggleFav();
    });
};
