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
        // Load local data first
        const local = {
            mistakes: JSON.parse(localStorage.getItem('mistakes') || '[]'),
            archive: JSON.parse(localStorage.getItem('archive') || '[]'),
            fav: JSON.parse(localStorage.getItem('fav') || '[]'),
            settings: JSON.parse(localStorage.getItem('settings') || '{}'),
            sessions: JSON.parse(localStorage.getItem('sessions') || '[]')
        };
        State.localData = local;
    
        // Sync with Firebase
        if (currentUser) {
            try {
                const snapshot = await db.ref('user_progress/' + currentUser.uid).once('value');
                const cloudData = snapshot.val();
            
                if (cloudData) {
                    // Merge cloud data with local
                    State.localData = {
                        mistakes: Data.mergeArrays(local.mistakes, cloudData.mistakes),
                        archive: Data.mergeArrays(local.archive, cloudData.archive),
                        fav: Data.mergeArrays(local.fav, cloudData.fav),
                        settings: { ...local.settings, ...cloudData.settings },
                        sessions: cloudData.sessions || local.sessions
                    };
                
                    if (State.localData.settings.theme) UI.setTheme(State.localData.settings.theme);
                    if (State.localData.settings.anim === false) UI.toggleAnim(false);
                }
            
                Data.saveData();
            } catch (e) {
                console.log("Firebase sync skipped, using local:", e);
            }
        }
    
        isAdmin = checkAdmin(State.user.telegram_id);
        if (isAdmin) Data.setupAdminPanel();
    },
