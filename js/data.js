const Data = {
    // 1. Safe Load All Questions (Fixes Search & Random Issues)
    loadQuestions: async () => {
        try {
            document.getElementById('db-status').innerText = "جاري التحميل...";
            const list = await (await fetch('questions_list.json')).json();
            
            // Sequential Fetch to prevent network congestion, or Parallel
            const fetchPromises = list.map(async file => {
                try {
                    const res = await fetch(`Questions/${file}`);
                    const data = await res.json();
                    
                    // Flatten data structure
                    return data.questions.map(q => ({
                        ...q,
                        term: q.term || data.meta.source, 
                        subject: q.subject || data.meta.subject, 
                        lesson: q.lesson || data.meta.lesson, 
                        chapter: q.chapter || "General"
                    }));
                } catch(err) { return []; }
            });

            const results = await Promise.all(fetchPromises);
            State.allQ = results.flat();

            document.getElementById('db-status').innerText = `${State.allQ.length} سؤال جاهز`;
            UI.updateHomeStats(); // Refresh stats now that data exists

        } catch(e) {
            console.error("Data Load Error", e);
            document.getElementById('db-status').innerText = "خطأ تحميل";
        }
    },

    // 2. Safe User Sync (Fixes 'invokeStorageMethod' Crash)
    initSync: async () => {
        // Load from LocalStorage first (Fast & Safe)
        const local = localStorage.getItem('medquiz_data');
        if(local) State.localData = { ...State.localData, ...JSON.parse(local) };

        // Telegram Cloud - Check version to avoid 6.0 crash
        if (window.Telegram && window.Telegram.WebApp) {
             const tg = window.Telegram.WebApp;
             if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) {
                 try {
                    tg.CloudStorage.getItem('medquiz_data', (err, val) => {
                        if(!err && val) {
                            State.localData = { ...State.localData, ...JSON.parse(val) };
                            UI.applySettings();
                        }
                    });
                 } catch(e) { console.log("Cloud check skipped", e); }
             }
        }
        UI.applySettings();
    },

    save: () => {
        const str = JSON.stringify(State.localData);
        localStorage.setItem('medquiz_data', str);
        
        // Safe Cloud Save
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) {
                tg.CloudStorage.setItem('medquiz_data', str);
            }
        }
    },
    
    reportScore: (ctx, score) => {
        // Update Total Stats locally
        // (Use proper counting logic if needed)
    }
};
