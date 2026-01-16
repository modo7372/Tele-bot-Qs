// js/main.js

window.onload = () => {
    // 1. UI Init
    UI.init();

    // 2. Telegram Auth
    const tg = window.Telegram.WebApp; 
    tg.ready();
    tg.expand();
    
    // Get User Data
    State.user = tg.initDataUnsafe.user || {id: 0, first_name: "Guest", username: "Guest"};

    // 3. Security Check
    if(ENABLE_SECURITY) {
        if(ALLOWED_IDS.includes(State.user.id)) {
            document.getElementById('lock-screen').style.display = 'none';
            document.getElementById('app-wrap').style.display = 'flex';
        } else {
            document.getElementById('debug-id').innerText = `ID: ${State.user.id}`;
            return; // Stop here
        }
    } else {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app-wrap').style.display = 'flex';
    }

    // 4. Load Data
    Data.loadQuestions();

    // 5. Global Key Bindings
    document.addEventListener('keydown', e => {
        if(document.getElementById('v-quiz').classList.contains('hidden')) return;
        
        const k = e.key.toLowerCase();
        // Options A, B, C, D
        const m = {'a':0, 'b':1, 'c':2, 'd':3, 'e':4}; 
        if(m[k] !== undefined) Game.answer(m[k]);
        
        // Next on Enter/Space if answered
        if((k === ' ' || k === 'enter') && Game.answered) { 
            e.preventDefault(); 
            Game.nextQ(); 
        }
    });
};
