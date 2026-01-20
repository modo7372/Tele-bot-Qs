window.onload = async () => {
    
    // 1. Initialize Telegram Platform
    const tg = window.Telegram.WebApp;
    tg.ready(); tg.expand();
    
    // User data safely
    const u = tg.initDataUnsafe.user;
    if(u) {
        State.user.id = u.id;
        State.user.first_name = u.first_name;
        State.user.full_name = u.first_name + (u.last_name ? ' '+u.last_name : '');
    }

    // 2. Lock Screen Gate
    if(ENABLE_SECURITY) {
        if(!ALLOWED_IDS.includes(State.user.id)) {
             document.getElementById('debug-id').innerText = `ID: ${State.user.id} Not Allowed`;
             return;
        }
    }
    document.getElementById('lock-screen').style.display='none';
    document.getElementById('app-wrap').style.display='flex';
    
    // 3. Init Data Layer
    await Data.init();
    
    // 4. Register PWA Worker
    if('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
        .then(()=>console.log("PWA OK"))
        .catch(console.error);
    }
    
    // 5. Setup UI Initials
    UI.init();
};
