// ============================================
// MAIN APPLICATION ENTRY
// ============================================

window.onload = async () => {
    const APP_VER = '3.0-firebase';
    const savedVer = localStorage.getItem('app_version');
    if(savedVer !== APP_VER) {
        localStorage.setItem('app_version', APP_VER);
        console.log('App Updated to ' + APP_VER);
    }

    const tg = window.Telegram.WebApp; 
    tg.ready(); 
    tg.expand();
    
    State.user = tg.initDataUnsafe.user || {id: 0, first_name: "Guest", telegram_id: null};
    State.user.telegram_id = State.user.id;
    
    const isAllowed = ALLOWED_IDS.includes(Number(State.user.id));
    
    const lockScreen = document.getElementById('lock-screen');
    const appWrap = document.getElementById('app-wrap');
    
    if (ENABLE_SECURITY && !isAllowed) {
        if(lockScreen) {
            lockScreen.innerHTML = `
                <div class="lock-icon">🔒</div>
                <h3>وضع محدود</h3>
                <p>أنت لا تستخدم تليجرام أو ID غير مصرح</p>
                <button onclick="enableDemoMode()" class="btn btn-primary" style="margin-top:15px;">
                    متابعة في الوضع التجريبي
                </button>
                <p style="font-size:0.7em; opacity:0.5; margin-top:10px;">ID: ${State.user.id}</p>
            `;
            lockScreen.style.display = 'flex';
        }
    } else {
        if(lockScreen) lockScreen.style.display = 'none';
        if(appWrap) appWrap.style.display = 'flex';
    }
    
    if(tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
        const primary = getComputedStyle(document.body).getPropertyValue('--primary');
        if(primary) tg.setHeaderColor(primary.trim());
    }

    await Data.initAuth();
    await Data.initSync();
    UI.init();
    Data.loadQuestions();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(e => console.log('SW Fail', e));
    }

    State.sessionStartTime = Date.now();

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

window.enableDemoMode = () => {
    document.getElementById('lock-screen').style.display = 'none';
    document.getElementById('app-wrap').style.display = 'flex';
    State.user.first_name = "Demo User";
    State.user.id = 0;
    State.user.telegram_id = 0;
    State.isAnonymous = true;
    UI.updateProfileDisplay();
};
