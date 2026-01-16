// js/data.js

const Data = {
    loadQuestions: async () => {
        try {
            const list = await (await fetch('questions_list.json')).json();
            for(let f of list) {
                try {
                    let d = await (await fetch(`Questions/${f}`)).json();
                    State.allQ.push(...d.questions.map(q => ({
                        ...q, term: q.term || d.meta.source, subject: q.subject || d.meta.subject, 
                        lesson: q.lesson || d.meta.lesson, chapter: q.chapter || "General"
                    })));
                } catch(e){}
            }
            document.getElementById('db-status').innerText = `${State.allQ.length} Questions`;
        } catch(e){ document.getElementById('db-status').innerText = "Err"; }
    },

    // --- Sync Logic (Cloud + Local) ---
    initSync: async () => {
        // Load from LocalStorage first (Fast)
        const local = {
            mistakes: JSON.parse(localStorage.getItem('mistakes')||'[]'),
            archive: JSON.parse(localStorage.getItem('archive')||'[]'),
            fav: JSON.parse(localStorage.getItem('fav')||'[]'),
            settings: JSON.parse(localStorage.getItem('settings')||'{}')
        };
        State.localData = local;

        // Try Cloud Storage only if supported (v6.9+)
        if (window.Telegram.WebApp.isVersionAtLeast && window.Telegram.WebApp.isVersionAtLeast('6.9')) {
            try {
                Telegram.WebApp.CloudStorage.getItem('medquiz_data', (err, val) => {
                    if(!err && val) {
                        const cloud = JSON.parse(val);
                        State.localData = { ...local, ...cloud };
                        // Apply loaded settings immediately
                        if(State.localData.settings.theme) UI.setTheme(State.localData.settings.theme);
                    }
                });
            } catch(e) { console.log("Cloud unavailable"); }
        }
    },

    saveData: () => {
        const str = JSON.stringify(State.localData);
        localStorage.setItem('mistakes', JSON.stringify(State.localData.mistakes));
        localStorage.setItem('archive', JSON.stringify(State.localData.archive));
        localStorage.setItem('fav', JSON.stringify(State.localData.fav));
        localStorage.setItem('settings', JSON.stringify(State.localData.settings));
        
        // Sync to Cloud only if supported (v6.9+)
        if (window.Telegram.WebApp.isVersionAtLeast && window.Telegram.WebApp.isVersionAtLeast('6.9')) {
            try {
                Telegram.WebApp.CloudStorage.setItem('medquiz_data', str);
            } catch(e){}
        }
    },

    saveLeaderboard: (score) => {
        if(State.sel.term && State.sel.subj) {
            const ctx = `${State.sel.term}_${State.sel.subj}`.replace(/[.#$/\[\]]/g, "_");
            db.ref(`ranks/${ctx}/${State.user.id}`).transaction((curr) => {
                let old = (curr && typeof curr==='object') ? curr.score : (curr||0);
                return { score: old + score, name: State.user.first_name };
            });
        }
    }
};
