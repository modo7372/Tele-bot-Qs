const Data = {
    init: async () => {
        // 1. Sync User Config
        await Data.initSync();
        // 2. Load Content
        await Data.loadQuestions();
        return true;
    },

    loadQuestions: async () => {
        const statusEl = document.getElementById('db-status');
        statusEl.innerText = "Loading data...";
        
        try {
            // Get Index
            const list = await (await fetch('questions_list.json')).json();
            
            // Bulk Fetch (Using Promises for parallel load)
            const tasks = list.map(async (file) => {
                try {
                    // Cache-First strategy via SW handles this
                    const res = await fetch(`Questions/${file}`);
                    const json = await res.json();
                    
                    // Attach context to every question so it's searchable and filterable independently
                    return json.questions.map(q => ({
                         id: q.id,
                         question: q.question,
                         options: q.options,
                         correct_option_id: q.correct_option_id,
                         explanation: q.explanation || "",
                         // Meta tags for selection
                         term: q.term || json.meta.source, 
                         subject: q.subject || json.meta.subject, 
                         lesson: q.lesson || json.meta.lesson, 
                         chapter: q.chapter || "General"
                    }));
                } catch(e) { 
                    console.warn(`File load failed: ${file}`);
                    return []; 
                }
            });

            const loadedArrays = await Promise.all(tasks);
            State.allQ = loadedArrays.flat(); // Merge all into one giant array
            
            statusEl.innerText = "Ready";
            UI.updateHomeStats(); // Init Stats now that we know total count

        } catch(e) {
            console.error(e);
            statusEl.innerText = "Offline/Err";
        }
    },

    initSync: async () => {
        // A. Load Local (Instant)
        const local = localStorage.getItem('medquiz_data');
        if(local) State.localData = { ...State.localData, ...JSON.parse(local) };
        UI.applySettings();

        // B. Cloud (Telegram > 6.9 Only) - Prevents Version 6.0 crash
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) {
                try {
                    tg.CloudStorage.getItem('medquiz_data', (err, val) => {
                        if (!err && val) {
                            State.localData = { ...State.localData, ...JSON.parse(val) };
                            UI.applySettings();
                        }
                    });
                } catch(e) { /* Old version, ignore */ }
            }
        }
    },

    save: () => {
        const str = JSON.stringify(State.localData);
        localStorage.setItem('medquiz_data', str);
        
        // Cloud Save Safe-Check
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            if(tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) {
                try { tg.CloudStorage.setItem('medquiz_data', str); } catch(e){}
            }
        }
    }
};
