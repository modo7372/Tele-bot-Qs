const Data = {
    
    // Initialize Anonymous Authentication
    initAuth: async () => {
        console.log("🔥 Initializing Firebase Auth...");
        
        try {
            // Check if already signed in
            const unsubscribe = auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log("✅ Already signed in:", user.uid);
                    currentUser = user;
                    State.firebaseUid = user.uid;
                    State.isAnonymous = user.isAnonymous;
                    updateAuthStatus('متصل', 'green');
                    
                    // Link Telegram ID
                    if (State.user.telegram_id && State.user.telegram_id !== 0) {
                        db.ref('user_links/' + user.uid).set({
                            telegram_id: State.user.telegram_id,
                            name: State.user.first_name,
                            last_seen: firebase.database.ServerValue.TIMESTAMP
                        }).catch(e => console.log("Link error:", e));
                    }
                } else {
                    console.log("⚠️ No user, signing in anonymously...");
                    Data.signInAnonymous();
                }
                unsubscribe();
            });
            
        } catch (e) {
            console.error("❌ Auth init error:", e);
            updateAuthStatus('خطأ في الاتصال', 'red');
        }
    },

    signInAnonymous: async () => {
        try {
            updateAuthStatus('جاري تسجيل الدخول...', 'orange');
            const userCredential = await auth.signInAnonymously();
            
            if (userCredential && userCredential.user) {
                currentUser = userCredential.user;
                State.firebaseUid = currentUser.uid;
                State.isAnonymous = true;
                localStorage.setItem('firebase_uid', currentUser.uid);
                
                console.log("✅✅✅ SIGNED IN! UID:", currentUser.uid);
                updateAuthStatus('متصل', 'green');
                
                // Save to localStorage for persistence
                localStorage.setItem('firebase_uid', currentUser.uid);
                
                return currentUser;
            }
        } catch (e) {
            console.error("❌ Anonymous auth FAILED:", e);
            updateAuthStatus('فشل تسجيل الدخول', 'red');
            
            if (e.code === 'auth/admin-restricted-operation') {
                alert("⚠️ خطأ: لم يتم تفعيل تسجيل الدخول المجهول في Firebase\n\n" +
                      "يرجى الذهاب إلى:\n" +
                      "Firebase Console > Authentication > Sign-in method > Anonymous > Enable");
            } else if (e.code === 'auth/network-request-failed') {
                alert("⚠️ خطأ في الاتصال بالشبكة");
            } else {
                console.error("Error code:", e.code, "Message:", e.message);
            }
        }
    },

    // Show Firebase UID to user
    showFirebaseUid: () => {
        if (currentUser) {
            alert("🔥 معرف المستخدم (Firebase UID):\n\n" + currentUser.uid + 
                  "\n\nانسخ هذا المعرف وأضفه إلى:\n" +
                  "Firebase Console > Database > admins/" + currentUser.uid + " = true");
        } else {
            alert("❌ لم يتم تسجيل الدخول بعد");
        }
    },

    // Load Questions
    loadQuestions: async () => {
        try {
            const list = await (await fetch('questions_list.json')).json();
            for(let f of list) {
                try {
                    let response = await fetch('Questions/' + f);
                
                    // Check if response is OK before parsing
                    if (!response.ok) {
                        console.warn(`⚠️ File not found (skipping): ${f}`);
                        continue; // Skip this file and continue with next
                    }
                
                    let d = await response.json();
                    State.allQ.push(...d.questions.map(q => ({
                        ...q, 
                        term: q.term || d.meta.source, 
                        subject: q.subject || d.meta.subject, 
                        lesson: q.lesson || d.meta.lesson, 
                        chapter: q.chapter || "General"
                    })));
                } catch(e) { 
                    console.warn('Failed to load:', f, e); 
                }
            }
        
            const dbStatus = document.getElementById('db-status');
            if(dbStatus) dbStatus.innerText = State.allQ.length + ' سؤال';
            if(UI && UI.updateHomeStats) UI.updateHomeStats();
            // Re-render term selector after questions load
            if(UI && UI.renderTermSelector) UI.renderTermSelector();

        } catch(e) { 
            const dbStatus = document.getElementById('db-status');
            if(dbStatus) dbStatus.innerText = "خطأ في التحميل"; 
            console.error(e);
        }
    },
    
    // Load user data from Firebase with local fallback
    initSync: async () => {
        console.log("🔄 Starting data sync...");
        
        // DEBUG - Check Telegram data
        console.log("🔍 State.user:", State.user);
        console.log("🔍 telegram_id:", State.user.telegram_id);
        console.log("🔍 ALLOWED_IDS:", ALLOWED_IDS);

        // FIXED: Safely load globalSelectedTerms with null check
        try {
            const savedTerms = localStorage.getItem('globalSelectedTerms');
            if (savedTerms && savedTerms !== 'undefined') {
                State.globalSelectedTerms = JSON.parse(savedTerms);
            } else {
                State.globalSelectedTerms = [];
            }
        } catch (e) {
            console.log("⚠️ Error loading globalSelectedTerms:", e);
            State.globalSelectedTerms = [];
        }

        // Load local data first - FIXED: with null/undefined checks
        const local = {
            mistakes: Data.safeJSONParse(localStorage.getItem('mistakes'), []),
            archive: Data.safeJSONParse(localStorage.getItem('archive'), []),
            fav: Data.safeJSONParse(localStorage.getItem('fav'), []),
            settings: Data.safeJSONParse(localStorage.getItem('settings'), {}),
            sessions: Data.safeJSONParse(localStorage.getItem('sessions'), [])
        };
        State.localData = local;
        
        // Sync with Firebase
        if (currentUser) {
            try {
                const snapshot = await db.ref('user_progress/' + currentUser.uid).once('value');
                const cloudData = snapshot.val();
                
                if (cloudData) {
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
                console.log("⚠️ Firebase sync failed:", e.message);
            }
        }
        
        // ============================================
        // ADMIN CHECK - FIXED VERSION
        // ============================================
        console.log("🔍 Checking admin...");
        
        // Get Telegram ID and convert to number
        const tgId = State.user.telegram_id || State.user.id;
        const tgIdNum = Number(tgId);
        
        console.log("🔍 tgId:", tgId, "->", tgIdNum);
        console.log("🔍 ALLOWED_IDS:", ALLOWED_IDS);
        console.log("🔍 Match?", ALLOWED_IDS.includes(tgIdNum));
        
        // CRITICAL: Use window.isAdmin to ensure it's global
        window.isAdmin = ALLOWED_IDS.includes(tgIdNum);
        console.log("👤 Admin status:", window.isAdmin);
        
        if (window.isAdmin) {
            console.log("👔 Setting up admin panel...");
            Data.setupAdminPanel();
        }
    },

    // NEW: Safe JSON parse helper
    safeJSONParse: (str, defaultVal) => {
        try {
            if (!str || str === 'undefined' || str === 'null') return defaultVal;
            return JSON.parse(str);
        } catch (e) {
            return defaultVal;
        }
    },

    mergeArrays: (local, cloud) => {
        if (!cloud) return local;
        if (!local) return cloud;
        return [...new Set([...local, ...cloud])];
    },

    // Save to both Firebase and LocalStorage
    saveData: async () => {
        const dataToSave = {
            mistakes: State.localData.mistakes,
            archive: State.localData.archive,
            fav: State.localData.fav,
            settings: State.localData.settings,
            last_updated: firebase.database.ServerValue.TIMESTAMP
        };
        
        // LocalStorage - FIXED: Always save valid JSON
        localStorage.setItem('globalSelectedTerms', JSON.stringify(State.globalSelectedTerms || []));
        localStorage.setItem('mistakes', JSON.stringify(State.localData.mistakes || []));
        localStorage.setItem('archive', JSON.stringify(State.localData.archive || []));
        localStorage.setItem('fav', JSON.stringify(State.localData.fav || []));
        localStorage.setItem('settings', JSON.stringify(State.localData.settings || {}));
        
        // Firebase
        if (currentUser) {
            try {
                await db.ref('user_progress/' + currentUser.uid).update(dataToSave);
                console.log("💾 Saved to Firebase");
            } catch (e) {
                console.log("⚠️ Firebase save failed:", e.message);
            }
        }
    },

    // NEW: Save detailed session analytics
    saveSessionAnalytics: async () => {
        if (!State.quiz.length || State.mode === 'view_mode') {
            console.log("⏭️ Skipping analytics");
            return;
        }
        
        console.log("📊 Saving session analytics...");
        
        const sessionData = {
            user_id: currentUser ? currentUser.uid : 'anonymous',
            telegram_id: State.user.telegram_id || 0,
            user_name: State.user.first_name,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            mode: State.mode,
            term: State.sel.terms[0] || 'random',
            subject: State.sel.subj || 'mixed',
            lessons: State.sel.lessons || [],
            total_questions: State.quiz.length,
            score: State.score,
            accuracy: Math.round((State.score / State.quiz.length) * 100),
            time_spent: State.sessionStartTime ? Date.now() - State.sessionStartTime : 0,
            answers: State.answers.map((a, idx) => ({
                question_id: State.quiz[idx].id,
                subject: State.quiz[idx].subject,
                lesson: State.quiz[idx].lesson,
                chapter: State.quiz[idx].chapter,
                is_correct: a.isCorrect,
                selected_option: a.selectedIdx,
                correct_option: State.quiz[idx].correct_option_id
            })),
            mistakes_made: State.answers.filter(a => !a.isCorrect).map((a, idx) => ({
                question_id: State.quiz[idx].id,
                subject: State.quiz[idx].subject,
                lesson: State.quiz[idx].lesson,
                chapter: State.quiz[idx].chapter
            }))
        };
        
        try {
            // Save to leaderboard
            if (State.sel.terms.length === 1 && State.sel.subj) {
                const ctx = (State.sel.terms[0] + '_' + State.sel.subj).replace(/[.#$/[\\]]/g, "_");
                await db.ref('leaderboards/' + ctx + '/' + currentUser.uid).set({
                    score: sessionData.score,
                    accuracy: sessionData.accuracy,
                    total: sessionData.total_questions,
                    name: State.user.first_name,
                    timestamp: sessionData.timestamp
                });
                console.log("🏆 Leaderboard updated");
            }
            
            // Save detailed analytics
            const sessionKey = db.ref('analytics/sessions').push().key;
            await db.ref('analytics/sessions/' + sessionKey).set(sessionData);
            console.log("✅ Analytics saved:", sessionKey);
            
            await Data.updateUserStats(sessionData);
            
        } catch (e) {
            console.error("❌ Analytics save failed:", e);
        }
    },

    updateUserStats: async (session) => {
        if (!currentUser) return;
        
        const statsRef = db.ref('analytics/user_stats/' + currentUser.uid);
        const snapshot = await statsRef.once('value');
        const current = snapshot.val() || {
            total_sessions: 0,
            total_questions: 0,
            total_correct: 0,
            subjects: {},
            weak_areas: [],
            strong_areas: []
        };
        
        current.total_sessions++;
        current.total_questions += session.total_questions;
        current.total_correct += session.score;
        current.last_active = session.timestamp;
        current.telegram_id = session.telegram_id;
        current.user_name = session.user_name;
        
        // Subject breakdown
        session.answers.forEach(ans => {
            if (!current.subjects[ans.subject]) {
                current.subjects[ans.subject] = { total: 0, correct: 0, chapters: {} };
            }
            current.subjects[ans.subject].total++;
            if (ans.is_correct) current.subjects[ans.subject].correct++;
            
            if (!current.subjects[ans.subject].chapters[ans.chapter]) {
                current.subjects[ans.subject].chapters[ans.chapter] = { total: 0, correct: 0 };
            }
            current.subjects[ans.subject].chapters[ans.chapter].total++;
            if (ans.is_correct) current.subjects[ans.subject].chapters[ans.chapter].correct++;
        });
        
        // Identify weak areas
        const weakAreas = [];
        const strongAreas = [];
        Object.entries(current.subjects).forEach(([subj, data]) => {
            const accuracy = data.correct / data.total;
            if (accuracy < 0.6) weakAreas.push(subj);
            else if (accuracy > 0.85) strongAreas.push(subj);
        });
        current.weak_areas = weakAreas;
        current.strong_areas = strongAreas;
        
        await statsRef.set(current);
        console.log("👤 User stats updated");
    },

    setupAdminPanel: () => {
        console.log('👔 Admin detected');
        setTimeout(() => {
            const header = document.querySelector('.header-actions');
            if (header && !document.getElementById('btn-admin')) {
                const adminBtn = document.createElement('button');
                adminBtn.id = 'btn-admin';
                adminBtn.className = 'btn btn-ghost';
                adminBtn.innerText = '📊';
                adminBtn.title = 'Analytics Panel';
                adminBtn.onclick = () => { Data.loadAnalytics(); UI.openModal('m-admin'); };
                header.appendChild(adminBtn);
                console.log("📊 Admin button added");
            }
        }, 500);
    },

    loadAnalytics: async () => {
        if (!isAdmin) {
            alert("❌ غير مصرح");
            return;
        }
        
        console.log("📈 Loading analytics...");
        try {
            const [sessionsSnap, usersSnap] = await Promise.all([
                db.ref('analytics/sessions').limitToLast(100).once('value'),
                db.ref('analytics/user_stats').once('value')
            ]);
            
            const sessions = sessionsSnap.val() || {};
            const users = usersSnap.val() || {};
            console.log("📊 Data:", Object.keys(sessions).length, "sessions,", Object.keys(users).length, "users");
            Data.renderAnalytics({ sessions, users });
        } catch (e) {
            console.error("Failed:", e);
            alert("خطأ في تحميل التحليلات: " + e.message);
        }
    },

    renderAnalytics: (data) => {
        const container = document.getElementById('analytics-content');
        if (!container) return;
        
        const sessions = Object.values(data.sessions || {});
        const users = Object.values(data.users || {});
        
        const totalUsers = users.length;
        const totalSessions = sessions.length;
        const totalQuestions = sessions.reduce((sum, s) => sum + (s.total_questions || 0), 0);
        const avgAccuracy = sessions.length > 0 
            ? Math.round(sessions.reduce((sum, s) => sum + (s.accuracy || 0), 0) / sessions.length)
            : 0;
        
        // Find weak subjects
        const subjectStats = {};
        sessions.forEach(s => {
            (s.mistakes_made || []).forEach(m => {
                if (!subjectStats[m.subject]) subjectStats[m.subject] = { mistakes: 0 };
                subjectStats[m.subject].mistakes++;
            });
        });
        
        const topWeakSubjects = Object.entries(subjectStats)
            .sort((a, b) => b[1].mistakes - a[1].mistakes)
            .slice(0, 5);
        
        // Most active users
        const userActivity = {};
        sessions.forEach(s => {
            if (!userActivity[s.user_name]) userActivity[s.user_name] = { sessions: 0, questions: 0 };
            userActivity[s.user_name].sessions++;
            userActivity[s.user_name].questions += s.total_questions || 0;
        });
        
        const topUsers = Object.entries(userActivity)
            .sort((a, b) => b[1].questions - a[1].questions)
            .slice(0, 5);
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item"><h3>المستخدمين</h3><p>${totalUsers}</p></div>
                <div class="stat-item"><h3>الجلسات</h3><p>${totalSessions}</p></div>
                <div class="stat-item"><h3>الأسئلة</h3><p>${totalQuestions}</p></div>
                <div class="stat-item"><h3>متوسط الدقة</h3><p>${avgAccuracy}%</p></div>
            </div>
            
            <h4 style="margin:20px 0 10px; color:var(--primary)">📉 المواد الأكثر صعوبة</h4>
            ${topWeakSubjects.map(([subj, stats]) => 
                `<div style="padding:8px; background:rgba(0,0,0,0.05); margin:3px 0; border-radius:5px; text-align:left; direction:ltr;">
                    ${subj}: ${stats.mistakes} errors
                </div>`
            ).join('')}
            
            <h4 style="margin:20px 0 10px; color:var(--primary)">🔥 الأكثر نشاطاً</h4>
            ${topUsers.map(([name, stats]) => 
                `<div style="padding:8px; background:rgba(0,0,0,0.05); margin:3px 0; border-radius:5px; text-align:left; direction:ltr;">
                    ${name}: ${stats.questions} questions (${stats.sessions} sessions)
                </div>`
            ).join('')}
            
            <button class="btn btn-primary full-width" onclick="Data.exportAnalytics()" style="margin-top:20px;">
                📥 تصدير البيانات الكاملة (JSON)
            </button>
        `;
    },

    exportAnalytics: () => {
        db.ref('analytics').once('value').then(snap => {
            const data = snap.val();
            const dataStr = JSON.stringify(data, null, 2);
            
            // Create a secure modal for data display since downloads are sandboxed
            const modal = document.createElement('div');
            modal.innerHTML = `
                <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;justify-content:center;align-items:center;padding:20px;">
                    <div style="background:#fff;padding:20px;border-radius:10px;width:100%;max-width:600px;max-height:90vh;display:flex;flex-direction:column;gap:15px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <h3 style="margin:0;color:#333">📊 Export Analytics</h3>
                            <button class="close-modal-btn" style="background:none;border:none;font-size:24px;cursor:pointer;">&times;</button>
                        </div>
                        <p style="margin:0;color:#666;font-size:14px;line-height:1.4;">
                            ⚠️ Downloads are disabled in this environment.<br>
                            Please copy the raw data below:
                        </p>
                        <textarea id="export-area" style="width:100%;height:300px;font-family:monospace;border:1px solid #ccc;border-radius:5px;padding:10px;font-size:12px;resize:none;" readonly>${dataStr}</textarea>
                        <div style="display:flex;gap:10px;">
                            <button id="btn-copy" style="flex:1;padding:12px;background:#4CAF50;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:16px;">
                                📋 Copy to Clipboard
                            </button>
                            <button class="close-modal-btn-main" style="flex:1;padding:12px;background:#f44336;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:16px;">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Close handlers
            const close = () => { if(document.body.contains(modal)) document.body.removeChild(modal); };
            modal.querySelector('.close-modal-btn').onclick = close;
            modal.querySelector('.close-modal-btn-main').onclick = close;
            
            // Copy handler
            document.getElementById('btn-copy').onclick = function() {
                const textArea = document.getElementById('export-area');
                textArea.select();
                
                // Try modern API first, fall back to execCommand
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(dataStr).then(() => {
                        this.innerText = "✅ Copied!";
                        setTimeout(() => this.innerText = "📋 Copy to Clipboard", 2000);
                    }).catch(err => {
                        console.error("Clipboard API failed:", err);
                        document.execCommand('copy');
                        this.innerText = "✅ Copied (Manual)";
                    });
                } else {
                    document.execCommand('copy');
                    this.innerText = "✅ Copied (Legacy)";
                }
            };

        }).catch(err => {
             console.error("Firebase read error:", err);
             alert("Error fetching data: " + err.message);
        });
    },
    saveLeaderboard: (score) => {
        // Handled in saveSessionAnalytics
    }
};
