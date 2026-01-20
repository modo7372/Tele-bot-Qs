const Data = {
    // 1. Initial Index Loading (Lightweight)
    init: async () => {
        try {
            // Fetch list of files
            const list = await (await fetch('questions_list.json')).json();
            
            // Build the index without loading content
            State.questionsIndex = list.map(filename => {
                // filename example: "7_Endocrine_a_Thyroid (7400-7540).json"
                // Parse it to get basic metadata if needed, otherwise just store ref
                return { file: filename, loaded: false };
            });

            document.getElementById('db-status').innerText = `${list.length} Topics Ready`;
            Data.syncUser();

        } catch(e) { console.error("Index Load Error", e); }
    },

    // 2. Lazy Load specific topics
    // Returns an array of questions
    fetchQuestionsByCriteria: async (criteriaObj) => {
        let pool = [];
        
        // Find which files match the criteria (term/subject)
        // Since we didn't parse full metadata in step 1 to save memory, 
        // we'll rely on matching filenames if criteria is 'term/subject' based,
        // or just load specific files if we know them.
        
        // For simplicity in this app structure: we iterate all files if needed or matching ones
        const tasks = State.questionsIndex.map(async (item) => {
            // Lazy check: Do we need this file?
            // criteriaObj: { term, subject }
            // Since filenames are weird ("7_Endocrine..."), let's filter after load OR match string
            // Improved strategy: Load if file string contains Subject name
            let shouldLoad = false;
            
            if (criteriaObj.mode === 'global') shouldLoad = true;
            else if (criteriaObj.term && item.file.includes(criteriaObj.term)) shouldLoad = true;
            else if (criteriaObj.subject && item.file.includes(criteriaObj.subject)) shouldLoad = true;
            // Fallback for simple names
            else shouldLoad = true; // For now load everything needed.
            
            // In a strict memory optimization, we would regex match filename before fetch.
            
            if (shouldLoad) {
                 // Try getting from Cache first (via SW or internal map)
                 try {
                     const res = await fetch(`Questions/${item.file}`);
                     const json = await res.json();
                     
                     // Transform and push
                     const questions = json.questions.map(q => ({
                         ...q, 
                         file_source: item.file,
                         subject: q.subject || json.meta.subject || "General",
                         lesson: q.lesson || json.meta.lesson,
                         chapter: q.chapter || "General"
                     }));
                     return questions;
                 } catch(err) { return []; }
            }
            return [];
        });

        const results = await Promise.all(tasks);
        results.forEach(arr => pool.push(...arr));
        
        // Update total questions count helper for ID search
        // State.allQ_Reference = pool; // OPTIONAL: Keep ref only if RAM permits
        return pool;
    },
    
    // 3. User Sync
    syncUser: () => {
        // Load Local
        const s = localStorage.getItem('medquiz_data');
        if(s) State.localData = { ...State.localData, ...JSON.parse(s) };

        // Telegram Cloud Storage (If available)
        if (window.Telegram && Telegram.WebApp.CloudStorage) {
            Telegram.WebApp.CloudStorage.getItem('data', (err, val) => {
                if(!err && val) {
                    State.localData = { ...State.localData, ...JSON.parse(val) };
                    UI.applySettings(); // Re-apply if cloud had newer settings
                }
            });
        }
    },

    save: () => {
        localStorage.setItem('medquiz_data', JSON.stringify(State.localData));
        if (window.Telegram && Telegram.WebApp.CloudStorage) {
            Telegram.WebApp.CloudStorage.setItem('data', JSON.stringify(State.localData));
        }
    },

    // 4. Scoreboard Update (Fixing the offline/sync issue)
    reportScore: (topic, scoreVal) => {
        const u = State.user;
        // 1. Total Global Score (Accumulative)
        db.ref(`users/${u.id}/total`).transaction(cur => (cur || 0) + scoreVal).catch(e=>console.log("Offline stats save local only"));
        
        // 2. Specific Leaderboard
        const safeTopic = topic.replace(/[.#$/\[\]]/g, "_"); // Firebase safe key
        db.ref(`ranks/${safeTopic}/${u.id}`).update({
            name: u.full_name,
            score: firebase.database.ServerValue.increment(scoreVal)
        }).catch(() => {});
        
        // 3. Local Stat update
        State.localData.stats.totalCorrect += scoreVal;
        State.localData.stats.totalAttempts++;
        Data.save();
    },

    // 5. PWA Download (Pre-cache all)
    downloadAllForOffline: async () => {
        if(!confirm("سيتم تحميل حوالي 5-10 ميجابايت للعمل بدون انترنت. هل توافق؟")) return;
        
        const btn = document.getElementById('btn-pwa-install');
        btn.innerText = "جاري التحميل...";
        btn.disabled = true;

        try {
             // We use a specific cache name defined in SW
             const cache = await caches.open('medquiz-v3-questions');
             
             // Add basic assets
             await cache.addAll(['index.html', 'css/style.css', 'js/main.js']);

             // Add all questions
             const promises = State.questionsIndex.map(f => {
                 return cache.add(`Questions/${f.file}`);
             });
             
             await Promise.all(promises);
             alert("تم التحميل بنجاح! التطبيق يعمل الآن بدون انترنت.");
             btn.innerText = "تم التحميل ✅";
        } catch (e) {
            alert("حدث خطأ أثناء التحميل.");
            btn.innerText = "فشل التحميل ❌";
            btn.disabled = false;
        }
    }
};
