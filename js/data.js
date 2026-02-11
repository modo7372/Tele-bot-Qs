const Data = {
    
    // Initialize Anonymous Auth
    initAuth: async () => {
        console.log("🔥 Initializing Firebase Auth...");
        
        try {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log("✅ Firebase auth ready:", user.uid);
                    currentUser = user;
                    updateAuthStatus('متصل', 'green');
                } else {
                    console.log("⚠️ Signing in anonymously...");
                    auth.signInAnonymously().catch(e => {
                        console.error("Auth failed:", e);
                        updateAuthStatus('فشل الاتصال', 'red');
                    });
                }
                unsubscribe();
            });
        } catch (e) {
            console.error("Auth init error:", e);
            updateAuthStatus('خطأ', 'red');
        }
    },

    // Get user path based on Telegram ID
    getUserPath: () => {
        const teleId = State.user.telegram_id || State.user.id || 'anonymous';
        return 'users/' + teleId;
    },

    // Check if admin
    isAdmin: () => {
        return ALLOWED_IDS.includes(Number(State.user.telegram_id || State.user.id));
    },

    // Load and sync data
    initSync: async () => {
        console.log("🔄 Syncing data for Tele ID:", State.user.telegram_id);
        
        // Load from local first (fast)
        Data.loadLocalData();
        
        // Then sync from Firebase
        if (currentUser) {
            try {
                const userPath = Data.getUserPath();
                const snapshot = await db.ref(userPath).once('value');
                const cloudData = snapshot.val();
                
                if (cloudData) {
                    console.log("☁️ Cloud data found, merging...");
                    // Merge cloud data (cloud wins for conflicts)
                    State.localData = {
                        mistakes: cloudData.mistakes || State.localData.mistakes,
                        archive: cloudData.archive || State.localData.archive,
                        fav: cloudData.fav || State.localData.fav,
                        settings: { ...State.localData.settings, ...cloudData.settings },
                        sessions: cloudData.sessions || []
                    };
                    
                    // Apply settings
                    if (State.localData.settings.theme) UI.setTheme(State.localData.settings.theme);
                } else {
                    console.log("☁️ No cloud data, saving local...");
                    await Data.saveData();
                }
                
                // Setup admin
                if (Data.isAdmin()) {
                    Data.setupAdminPanel();
                }
                
            } catch (e) {
                console.log("⚠️ Firebase sync failed:", e.message);
            }
        }
        
        // Load term selection
        const savedTerms = localStorage.getItem('globalSelectedTerms');
        if (savedTerms) {
            try {
                State.globalSelectedTerms = JSON.parse(savedTerms);
            } catch(e) {
                State.globalSelectedTerms = [];
            }
        }
    },

    // Load from localStorage only
    loadLocalData: () => {
        const defaults = {
            mistakes: [],
            archive: [],
            fav: [],
            settings: { hideIrrelevant: true, theme: 'light' },
            sessions: []
        };
        
        State.localData = {
            mistakes: Data.safeJSONParse(localStorage.getItem('mistakes'), defaults.mistakes),
            archive: Data.safeJSONParse(localStorage.getItem('archive'), defaults.archive),
            fav: Data.safeJSONParse(localStorage.getItem('fav'), defaults.fav),
            settings: Data.safeJSONParse(localStorage.getItem('settings'), defaults.settings),
            sessions: Data.safeJSONParse(localStorage.getItem('sessions'), defaults.sessions)
        };
    },

    safeJSONParse: (str, defaultVal) => {
        try {
            if (!str || str === 'undefined' || str === 'null') return defaultVal;
            return JSON.parse(str);
        } catch (e) {
            return defaultVal;
        }
    },

    // Save to Firebase (by Tele ID) and localStorage
    saveData: async () => {
        const dataToSave = {
            mistakes: State.localData.mistakes || [],
            archive: State.localData.archive || [],
            fav: State.localData.fav || [],
            settings: State.localData.settings || {},
            name: State.user.first_name,
            telegram_id: State.user.telegram_id,
            last_updated: firebase.database.ServerValue.TIMESTAMP
        };
        
        // Always save to localStorage
        localStorage.setItem('mistakes', JSON.stringify(dataToSave.mistakes));
        localStorage.setItem('archive', JSON.stringify(dataToSave.archive));
        localStorage.setItem('fav', JSON.stringify(dataToSave.fav));
        localStorage.setItem('settings', JSON.stringify(dataToSave.settings));
        localStorage.setItem('globalSelectedTerms', JSON.stringify(State.globalSelectedTerms));
        
        // Save to Firebase by Telegram ID
        if (currentUser) {
            try {
                const userPath = Data.getUserPath();
                await db.ref(userPath).update(dataToSave);
                console.log("💾 Saved to Firebase:", userPath);
            } catch (e) {
                console.log("⚠️ Firebase save failed:", e.message);
            }
        }
    },

    // Load questions
    loadQuestions: async () => {
        try {
            const list = await (await fetch('questions_list.json?v=10')).json();
            for(let f of list) {
                try {
                    let response = await fetch('Questions/' + f);
                    if (!response.ok) {
                        console.warn(`⚠️ Skipping: ${f}`);
                        continue;
                    }
                
                    let d = await response.json();
                    State.allQ.push(...d.questions.map(q => ({
                        ...q, 
                        term: q.term || d.meta?.source || 'Unknown', 
                        subject: q.subject || d.meta?.subject || 'Unknown', 
                        lesson: q.lesson || d.meta?.lesson || 'General', 
                        chapter: q.chapter || "General"
                    })));
                } catch(e) { 
                    console.warn('Failed to load:', f, e); 
                }
            }
        
            const dbStatus = document.getElementById('db-status');
            if(dbStatus) dbStatus.innerText = State.allQ.length + ' سؤال';
            if(UI && UI.updateHomeStats) UI.updateHomeStats();
            if(UI && UI.renderTermSelector) UI.renderTermSelector();

        } catch(e) { 
            const dbStatus = document.getElementById('db-status');
            if(dbStatus) dbStatus.innerText = "خطأ في التحميل"; 
            console.error(e);
        }
    },

    // Save session results
    saveSession: async () => {
        if (!State.quiz.length) return;
        
        const sessionData = {
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            mode: State.mode,
            score: State.score,
            total: State.quiz.length,
            accuracy: Math.round((State.score / State.quiz.length) * 100)
        };
        
        State.localData.sessions.push(sessionData);
        if (State.localData.sessions.length > 50) {
            State.localData.sessions = State.localData.sessions.slice(-50);
        }
        
        await Data.saveData();
    },

    // Admin functions
    setupAdminPanel: () => {
        console.log('👔 Admin detected');
        setTimeout(() => {
            const header = document.querySelector('.header-actions');
            if (header && !document.getElementById('btn-admin')) {
                const adminBtn = document.createElement('button');
                adminBtn.id = 'btn-admin';
                adminBtn.className = 'btn btn-ghost';
                adminBtn.innerText = '📊';
                adminBtn.title = 'Analytics';
                adminBtn.onclick = () => { Data.loadAnalytics(); UI.openModal('m-admin'); };
                header.appendChild(adminBtn);
            }
        }, 500);
    },

    loadAnalytics: async () => {
        if (!Data.isAdmin()) {
            alert("❌ غير مصرح");
            return;
        }
        
        try {
            const usersSnap = await db.ref('users').limitToLast(100).once('value');
            const users = usersSnap.val() || {};
            
            const container = document.getElementById('analytics-content');
            if (!container) return;
            
            let html = '<div class="stats-grid">';
            let totalUsers = 0;
            let totalQuestions = 0;
            
            Object.entries(users).forEach(([teleId, data]) => {
                totalUsers++;
                const solved = (data.archive || []).length;
                totalQuestions += solved;
                
                html += `
                    <div class="stat-item" style="text-align:left; direction:ltr;">
                        <h4>${data.name || 'Unknown'} (${teleId})</h4>
                        <p>Solved: ${solved} | Mistakes: ${(data.mistakes || []).length}</p>
                    </div>
                `;
            });
            
            html += '</div>';
            html += `<p style="margin-top:15px;">Total Users: ${totalUsers} | Total Solved: ${totalQuestions}</p>`;
            
            container.innerHTML = html;
            
        } catch (e) {
            console.error("Analytics failed:", e);
            alert("خطأ في التحميل");
        }
    }
};
