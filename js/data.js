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
            
            // تحديث العداد النصي في الهيدر
            document.getElementById('db-status').innerText = `${State.allQ.length} سؤال`;
            
            // --- الإضافة الجديدة ---
            // تحديث دائرة الإنجاز (Progress Ring) في الصفحة الرئيسية فور انتهاء التحميل
            if(UI && UI.updateHomeStats) UI.updateHomeStats();

        } catch(e){ document.getElementById('db-status').innerText = "خطأ في التحميل"; }
    },
    
    initSync: async () => {
        const local = {
            mistakes: JSON.parse(localStorage.getItem('mistakes')||'[]'),
            archive: JSON.parse(localStorage.getItem('archive')||'[]'),
            fav: JSON.parse(localStorage.getItem('fav')||'[]'),
            settings: JSON.parse(localStorage.getItem('settings')||'{}')
        };
        State.localData = local;

        if (window.Telegram.WebApp.isVersionAtLeast && window.Telegram.WebApp.isVersionAtLeast('6.9')) {
            try {
                Telegram.WebApp.CloudStorage.getItem('medquiz_data', (err, val) => {
                    if(!err && val) {
                        const cloud = JSON.parse(val);
                        State.localData = { ...local, ...cloud };
                        if(State.localData.settings.theme) UI.setTheme(State.localData.settings.theme);
                        if(State.localData.settings.anim === false) UI.toggleAnim(false);
                        if(State.localData.settings.fontSize) UI.updateStyleVar('--font-size', State.localData.settings.fontSize);
                    }
                });
            } catch(e) { console.log("Cloud init skipped: ", e); }
        } else {
             if(State.localData.settings.theme) UI.setTheme(State.localData.settings.theme);
        }
    },

    saveData: () => {
        const str = JSON.stringify(State.localData);
        localStorage.setItem('mistakes', JSON.stringify(State.localData.mistakes));
        localStorage.setItem('archive', JSON.stringify(State.localData.archive));
        localStorage.setItem('fav', JSON.stringify(State.localData.fav));
        localStorage.setItem('settings', JSON.stringify(State.localData.settings));
        
        if (window.Telegram.WebApp.isVersionAtLeast && window.Telegram.WebApp.isVersionAtLeast('6.9')) {
            try {
                Telegram.WebApp.CloudStorage.setItem('medquiz_data', str);
            } catch(e){ console.log("Cloud save skipped"); }
        }
    },

    saveLeaderboard: (score) => {
        // MODIFICATION 3.2: Use State.sel.terms (assuming first term for rank or user manually ensures single selection for ranking)
        if(State.sel.terms.length === 1 && State.sel.subj) { 
            const ctx = `${State.sel.terms[0]}_${State.sel.subj}`.replace(/[.#$/\[\]]/g, "_");
            db.ref(`ranks/${ctx}/${State.user.id}`).transaction((curr) => {
                let old = (curr && typeof curr==='object') ? curr.score : (curr||0);
                return { score: old + score, name: State.user.first_name };
            });
        }
    }
};
