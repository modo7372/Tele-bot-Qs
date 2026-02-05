// ============================================
// DATA MANAGEMENT & FIREBASE INTEGRATION
// ============================================

const Data = {
    
    // Initialize Anonymous Authentication
    initAuth: async () => {
        try {
            // Listen for auth state changes
            auth.onAuthStateChanged((user) => {
                if (user) {
                    currentUser = user;
                    State.firebaseUid = user.uid;
                    State.isAnonymous = user.isAnonymous;
                    console.log('Auth state: User signed in', user.uid);
                    
                    // Link Telegram ID if available
                    if (State.user.telegram_id && State.user.telegram_id !== 0) {
                        db.ref('user_links/' + user.uid).set({
                            telegram_id: State.user.telegram_id,
                            name: State.user.first_name,
                            last_seen: firebase.database.ServerValue.TIMESTAMP
                        });
                    }
                } else {
                    console.log('Auth state: No user');
                    Data.signInAnonymous();
                }
            });
            
            // Check current auth state
            if (!auth.currentUser) {
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

    // Load Questions
    loadQuestions: async () => {
        try {
            const list = await (await fetch('questions_list.json')).json();
            for(let f of list) {
                try {
                    let d = await (await fetch('Questions/' + f)).json();
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

        } catch(e) { 
            const dbStatus = document.getElementById('db-status');
            if(dbStatus) dbStatus.innerText = "خطأ في التحميل"; 
            console.error(e);
        }
    },
    
    // Load user data from Firebase with local fallback
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
        
        // Check admin status
        isAdmin = checkAdmin(State.user.telegram_id);
        if (isAdmin) {
            Data.setupAdminPanel();
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
        
        // LocalStorage
        localStorage.setItem('mistakes', JSON.stringify(State.localData.mistakes));
        localStorage.setItem('archive', JSON.stringify(State.localData.archive));
        localStorage.setItem('fav', JSON.stringify(State.localData.fav));
        localStorage.setItem('settings', JSON.stringify(State.localData.settings));
        
        // Firebase
        if (currentUser) {
            try {
                await db.ref('user_progress/' + currentUser.uid).update(dataToSave);
            } catch (e) {
                console.log("Firebase save failed, kept local:", e);
            }
        }
    },

    // NEW: Save detailed session analytics
    saveSessionAnalytics: async () => {
        if (!State.quiz.length || State.mode === 'view_mode') return;
        
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
            }
            
            // Save detailed analytics
            const sessionKey = db.ref('analytics/sessions').push().key;
            await db.ref('analytics/sessions/' + sessionKey).set(sessionData);
            
            await Data.updateUserStats(sessionData);
            
        } catch (e) {
            console.log("Analytics save failed:", e);
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
        
        // Identify weak areas (<60% accuracy)
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
    },

    setupAdminPanel: () => {
        console.log('Admin user detected');
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
            }
        }, 500);
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
            Data.renderAnalytics({ sessions, users });
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
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'medquiz_analytics_' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
        });
    },

    saveLeaderboard: (score) => {
        // Now handled in saveSessionAnalytics
    }
};
