const Data = {
    // 1. Loading Questions (Kept from original)
    loadQuestions: async () => {
        try {
            const list = await (await fetch('questions_list.json')).json();
            for (let f of list) {
                try {
                    let d = await (await fetch(`Questions/${f}`)).json();
                    State.allQ.push(...d.questions.map(q => ({
                        ...q,
                        term: q.term || d.meta.source,
                        subject: q.subject || d.meta.subject,
                        lesson: q.lesson || d.meta.lesson,
                        chapter: q.chapter || "General"
                    })));
                } catch (e) {}
            }

            // Update header counter
            if (document.getElementById('db-status')) {
                document.getElementById('db-status').innerText = `${State.allQ.length} سؤال`;
            }

            // Update Home Progress Ring
            if (UI && UI.updateHomeStats) UI.updateHomeStats();
        } catch (e) {
            if (document.getElementById('db-status')) {
                document.getElementById('db-status').innerText = "خطأ في التحميل";
            }
        }
    },

    // 2. Authentication Initialization (New)
    initAuth: async () => {
        try {
            auth.onAuthStateChanged((user) => {
                if (user) {
                    currentUser = user;
                    State.firebaseUid = user.uid;
                    State.isAnonymous = user.isAnonymous;
                    console.log('Auth state: User signed in', user.uid);
                    // Re-sync data when auth changes
                    Data.initSync();
                } else {
                    console.log('Auth state: No user');
                    Data.signInAnonymous();
                }
            });

            const currentUserAuth = auth.currentUser;
            if (!currentUserAuth) {
                await Data.signInAnonymous();
            }
        } catch (e) {
            console.error('Auth init error:', e);
        }
    },

    signInAnonymous: async () => {
        try {
            const userCredential = await auth.signInAnonymously();
            currentUser = userCredential.user;
            State.firebaseUid = currentUser.uid;
            State.isAnonymous = true;
            localStorage.setItem('firebase_uid', currentUser.uid);
            console.log('Signed in anonymously:', currentUser.uid);
        } catch (e) {
            console.error('Anonymous auth failed:', e);
        }
    },

    // 3. Synchronization (Replaced as requested)
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
        if (typeof currentUser !== 'undefined' && currentUser) {
            try {
                const snapshot = await db.ref('user_progress/' + currentUser.uid).once('value');
                const cloudData = snapshot.val();

                if (cloudData) {
                    // Merge cloud data with local
                    State.localData = {
                        mistakes: Data.mergeArrays(local.mistakes, cloudData.mistakes),
                        archive: Data.mergeArrays(local.archive, cloudData.archive),
                        fav: Data.mergeArrays(local.fav, cloudData.fav),
                        settings: { ...local.settings, ...cloudData.settings
                        },
                        sessions: cloudData.sessions || local.sessions
                    };

                    // Apply settings immediately
                    if (State.localData.settings.theme) UI.setTheme(State.localData.settings.theme);
                    if (State.localData.settings.anim === false) UI.toggleAnim(false);
                }

                // Save merged data back to ensure consistency
                Data.saveData();
            } catch (e) {
                console.log("Firebase sync skipped, using local:", e);
            }
        } else {
            // Apply local settings if no user yet
            if (State.localData.settings.theme) UI.setTheme(State.localData.settings.theme);
        }

        // Check for Admin
        if (typeof State.user !== 'undefined' && typeof checkAdmin !== 'undefined') {
            isAdmin = checkAdmin(State.user.telegram_id);
            if (isAdmin) Data.setupAdminPanel();
        }
    },

    // Helper for merging arrays (New)
    mergeArrays: (local, cloud) => {
        if (!cloud) return local;
        if (!local) return cloud;
        // Merge and remove duplicates based on value/ID
        // Assumes simple arrays or requires specific logic for objects, 
        // here using Set for primitive/string arrays implies question IDs.
        // If arrays contain objects, you might need a deep merge or ID check.
        // Assuming Question IDs (strings/ints):
        return [...new Set([...local, ...cloud])];
    },

    // 4. Saving Data (Updated to include Firebase write)
    saveData: () => {
        // Save to LocalStorage
        localStorage.setItem('mistakes', JSON.stringify(State.localData.mistakes));
        localStorage.setItem('archive', JSON.stringify(State.localData.archive));
        localStorage.setItem('fav', JSON.stringify(State.localData.fav));
        localStorage.setItem('settings', JSON.stringify(State.localData.settings));
        localStorage.setItem('sessions', JSON.stringify(State.localData.sessions || []));

        // Save to Firebase (New Logic)
        if (typeof currentUser !== 'undefined' && currentUser) {
            try {
                db.ref('user_progress/' + currentUser.uid).update({
                    mistakes: State.localData.mistakes,
                    archive: State.localData.archive,
                    fav: State.localData.fav,
                    settings: State.localData.settings
                    // specific sessions are usually too heavy to sync entire array here, 
                    // relying on saveSessionAnalytics for history
                });
            } catch (e) {
                console.log("Cloud save skipped");
            }
        }

        // Keep legacy Telegram Cloud support if needed
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) {
            try {
                const str = JSON.stringify(State.localData);
                Telegram.WebApp.CloudStorage.setItem('medquiz_data', str);
            } catch (e) {}
        }
    },

    // 5. Analytics & Session Saving (New)
    saveSessionAnalytics: async () => {
        if (!State.quiz.length || State.mode === 'view_mode') return;

        const sessionData = {
            user_id: typeof currentUser !== 'undefined' && currentUser ? currentUser.uid : 'anonymous',
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
            // Save to leaderboard (Legacy/Simple Leaderboard)
            if (State.sel.terms.length === 1 && State.sel.subj) {
                const ctx = (State.sel.terms[0] + '_' + State.sel.subj).replace(/[.#$/[\]]/g, "_");
                await db.ref('leaderboards/' + ctx + '/' + currentUser.uid).set({
                    score: sessionData.score,
                    accuracy: sessionData.accuracy,
                    total: sessionData.total_questions,
                    name: State.user.first_name,
                    timestamp: sessionData.timestamp
                });
            }

            // Save detailed analytics
            const sessionKey = db.ref('analytics/sessions').push().key;
            await db.ref('analytics/sessions/' + sessionKey).set(sessionData);

            // Update cumulative user stats
            await Data.updateUserStats(sessionData);

        } catch (e) {
            console.log("Analytics save failed:", e);
        }
    },

    // New Helper: Update User Stats (Required by saveSessionAnalytics)
    updateUserStats: async (session) => {
        if (!currentUser) return;
        const statsRef = db.ref(`analytics/user_stats/${currentUser.uid}`);
        
        await statsRef.transaction((current) => {
            if (!current) {
                current = { 
                    total_score: 0, 
                    total_questions: 0, 
                    sessions_count: 0,
                    name: session.user_name
                };
            }
            
            return {
                ...current,
                name: session.user_name, // Update name in case it changed
                total_score: (current.total_score || 0) + session.score,
                total_questions: (current.total_questions || 0) + session.total_questions,
                sessions_count: (current.sessions_count || 0) + 1,
                last_active: firebase.database.ServerValue.TIMESTAMP
            };
        });
    },

    // Original Leaderboard function (Kept for compatibility)
    saveLeaderboard: (score) => {
        // This is largely redundant due to saveSessionAnalytics but kept for safety
        if (State.sel.terms.length === 1 && State.sel.subj) {
            const ctx = `${State.sel.terms[0]}_${State.sel.subj}`.replace(/[.#$/\[\]]/g, "_");
            db.ref(`ranks/${ctx}/${State.user.id}`).transaction((curr) => {
                let old = (curr && typeof curr === 'object') ? curr.score : (curr || 0);
                return {
                    score: old + score,
                    name: State.user.first_name
                };
            });
        }
    },

    // 6. Admin Panel Functions (New)
    setupAdminPanel: () => {
        console.log('Admin user detected');
        setTimeout(() => {
            const header = document.querySelector('.header-actions');
            // Ensure we don't add duplicate buttons
            if (header && !document.getElementById('btn-admin')) {
                const adminBtn = document.createElement('button');
                adminBtn.id = 'btn-admin';
                adminBtn.className = 'btn btn-ghost';
                adminBtn.innerText = '📊';
                adminBtn.title = 'Analytics Panel';
                adminBtn.onclick = () => {
                    Data.loadAnalytics();
                    if (UI && UI.openModal) UI.openModal('m-admin');
                };
                header.appendChild(adminBtn);
            }
        }, 1500); // Slight delay to ensure DOM is ready
    },

    loadAnalytics: async () => {
        if (!isAdmin) return;
        try {
            const [sessionsSnap, usersSnap] = await Promise.all([
                db.ref('analytics/sessions').limitToLast(100).once('value'),
                db.ref('analytics/user_stats').once('value')
            ]);

            const sessions = sessionsSnap.val() || {};
            const users = usersSnap.val() || {};
            Data.renderAnalytics({
                sessions,
                users
            });
        } catch (e) {
            console.error("Failed to load analytics:", e);
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
        const avgAccuracy = sessions.length > 0 ?
            Math.round(sessions.reduce((sum, s) => sum + (s.accuracy || 0), 0) / sessions.length) :
            0;

        // Find weak subjects
        const subjectStats = {};
        sessions.forEach(s => {
            (s.mistakes_made || []).forEach(m => {
                if (!subjectStats[m.subject]) subjectStats[m.subject] = {
                    mistakes: 0
                };
                subjectStats[m.subject].mistakes++;
            });
        });

        const topWeakSubjects = Object.entries(subjectStats)
            .sort((a, b) => b[1].mistakes - a[1].mistakes)
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
            
            <button class="btn btn-primary full-width" onclick="Data.exportAnalytics()" style="margin-top:20px;">
                📥 تصدير البيانات الكاملة (JSON)
            </button>
        `;
    },

    exportAnalytics: () => {
        db.ref('analytics').once('value').then(snap => {
            const data = snap.val();
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'medquiz_analytics_' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
        });
    }
};
