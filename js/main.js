// App Bootstrap
window.onload = async () => {
    
    // 1. Telegram WebApp Integration
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand(); // Requests full height
    
    // User Init (Safe combined name)
    const u = tg.initDataUnsafe.user;
    if (u) {
        State.user = { 
            id: u.id, 
            first_name: u.first_name, 
            full_name: `${u.first_name} ${u.last_name || ''}`.trim() 
        };
    } else {
        // Fallback for browser testing
        const stored = localStorage.getItem('mock_user_name');
        State.user.full_name = stored || "Browser User";
    }

    // 2. Data Initialization
    await Data.init(); // Index load
    
    // 3. UI Setup
    UI.init();
    
    // 4. Security Check
    if (ENABLE_SECURITY && !ALLOWED_IDS.includes(State.user.id)) {
        document.getElementById('lock-screen').style.display = 'flex';
        document.getElementById('debug-id').innerText = `ID: ${State.user.id}`;
        return; // Stop App
    } else {
        document.getElementById('app-wrap').style.display = 'flex';
    }

    // 5. Service Worker Registration (PWA)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('SW Registered'))
        .catch(err => console.log('SW Fail', err));
    }
};
