// Handles Categories, Filtering, and preparing the questions
const GameSelect = {
    
    step: '', // term -> subject -> lesson -> chapter
    
    // Quick Launchers
    startGlobalRandom: async () => {
        UI.haptic('selection');
        alert("جاري تجهيز الاختبار..."); // Simple Loader
        
        // Randomize: Fetch all headers (Lazy simulation: fetch specific indexes if we had them)
        // Strategy: Fetch ALL first, since Global means global. 
        const allQ = await Data.fetchQuestionsByCriteria({ mode: 'global' });
        
        if(!allQ.length) return alert('خطأ في تحميل الأسئلة');
        
        // Filter based on dropdown
        const pool = GameSelect.applyUserFilters(allQ);
        if(!pool.length) return alert('لا توجد أسئلة بهذا الفلتر');

        // Shuffle & Slice
        pool.sort(() => Math.random() - 0.5);
        const sub = pool.slice(0, 30);
        
        GameEngine.start(sub, 'normal', 'Global Random');
    },

    startFlow: (mode) => {
        State.quiz.mode = mode; // 'normal', 'survival', 'timeAttack'
        State.selection = {term:null, subject:null, lessons:[], limit:50};
        
        // Prepare Selection Screen (Term)
        GameSelect.renderStep('term');
        UI.showView('v-select');
    },

    // Step Rendering Logic
    renderStep: async (step) => {
        GameSelect.step = step;
        const cont = document.getElementById('sel-body');
        cont.innerHTML = 'Thinking...';
        
        const head = document.getElementById('sel-head');
        const titleMap = {term:'الترم/المصدر', subject:'المادة', lesson:'الدرس', chapter:'الفصل'};
        head.innerText = `اختر ${titleMap[step]}`;
        
        // Buttons
        document.getElementById('btn-all').classList.add('hidden');
        document.getElementById('btn-mode-random').classList.add('hidden');
        
        // 1. Get Pool needed to decide options
        // Ideally we query the Index only, not full Questions
        let options = new Set();
        let questionsForContext = []; 

        if (step === 'term') {
            State.questionsIndex.forEach(f => {
                // Heuristic: Extract Term from filename e.g. "7_Endocrine_..." -> "Endocrine" or predefined map
                // Simplifying: Show full filename as Category for robustness
                const term = f.file.split('_')[1] || "General"; 
                options.add(term);
            });
        } 
        else if (step === 'subject') {
            // Filter Index based on selected Term
            State.questionsIndex.forEach(f => {
                 if(f.file.includes(State.selection.term) || f.file.includes("Surgery")) { 
                    const sub = f.file.split('(')[0].replace(/_/g, ' ').replace(State.selection.term, '').trim(); 
                    options.add(sub || "General"); 
                 }
            });
        }
        else {
             // For Lesson/Chapter we need to fetch the content of specific files
             // To prevent heavy load, we load ONLY files matching current term+subject
             questionsForContext = await Data.fetchQuestionsByCriteria({
                 term: State.selection.term, 
                 subject: State.selection.subject // Pass subject to refine fetch if we had metadata
             });
             
             State.activeQuizPool = questionsForContext; // Store temporarly
             
             questionsForContext.forEach(q => {
                 if (step === 'lesson') options.add(q.lesson);
                 if (step === 'chapter') if(State.selection.lessons.includes(q.lesson)) options.add(q.chapter);
             });
        }

        cont.innerHTML = '';
        const list = Array.from(options).sort();
        
        if(!list.length) cont.innerHTML = '<p>لا توجد بيانات</p>';

        const isMulti = (step === 'lesson' || step === 'chapter');
        if(isMulti) document.getElementById('btn-all').classList.remove('hidden');

        list.forEach(opt => {
             const chip = document.createElement('div');
             chip.className = 'opt-chip-item ' + (isMulti ? '' : 'nav-item'); // CSS needs
             // Using UI.js Chip styles but simpler
             chip.className = 'chip'; 
             chip.innerText = opt;
             chip.dataset.val = opt;
             
             chip.onclick = () => {
                 UI.haptic('selection');
                 if(isMulti) chip.classList.toggle('selected');
                 else {
                     // Single select -> Auto Next
                     document.querySelectorAll('.chip').forEach(c=>c.classList.remove('selected'));
                     chip.classList.add('selected');
                     if(step==='term') State.selection.term = opt;
                     if(step==='subject') State.selection.subject = opt;
                     GameSelect.nextSel();
                 }
             };
             cont.appendChild(chip);
        });
        
        // Show "Random Exam from Previous" button in steps after Subject
        if (step === 'lesson' || step === 'chapter') {
            document.getElementById('btn-mode-random').classList.remove('hidden');
        }
    },

    nextSel: () => {
        const picked = Array.from(document.querySelectorAll('.chip.selected')).map(c=>c.dataset.val);
        
        if (GameSelect.step === 'term') GameSelect.renderStep('subject');
        else if (GameSelect.step === 'subject') GameSelect.renderStep('lesson');
        else if (GameSelect.step === 'lesson') {
            if(!picked.length) return alert("اختر درساً واحداً على الأقل");
            State.selection.lessons = picked;
            GameSelect.launchQuiz(false); // Launch directly, skipping chapters for simplification in Mobile UX
        }
    },
    
    prevSel: () => {
        if (GameSelect.step === 'term') UI.showView('v-home');
        else if (GameSelect.step === 'subject') GameSelect.renderStep('term');
        else if (GameSelect.step === 'lesson') GameSelect.renderStep('subject');
    },

    toggleAll: () => document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('selected')),
    
    // --- Filters ---
    applyUserFilters: (pool) => {
        const filter = State.filters; 
        const mistakes = State.localData.mistakes;
        const arch = State.localData.archive;

        if (filter === 'new') return pool.filter(q => !arch.includes(q.id));
        if (filter === 'wrong') return pool.filter(q => mistakes.includes(q.id));
        if (filter === 'answered') return pool.filter(q => arch.includes(q.id));
        return pool;
    },

    // --- Launchers ---
    launchQuiz: (randomFromCurrent) => {
        // Filter pool from State.activeQuizPool (already loaded in renderStep)
        let candidates = State.activeQuizPool;
        
        if (State.selection.lessons.length) {
            candidates = candidates.filter(q => State.selection.lessons.includes(q.lesson));
        }

        candidates = GameSelect.applyUserFilters(candidates);

        if (!candidates.length) return alert('لا أسئلة في الفئة المختارة/الفلتر.');

        // Shuffle
        candidates.sort(() => Math.random() - 0.5);

        // Limit for Normal flow (User selectable limit or default)
        const limit = randomFromCurrent ? 30 : candidates.length > 50 ? 50 : candidates.length;
        
        GameEngine.start(candidates.slice(0, limit), State.quiz.mode, `${State.selection.subject}`);
    },
    
    startRandomInMode: () => {
         // Collects whatever is currently loaded/selected context and randomizes
         GameSelect.launchQuiz(true);
    },

    luckyShot: async () => {
        const qList = await Data.fetchQuestionsByCriteria({mode: 'global'}); // Fetches all (lazy trade-off)
        if(qList.length) {
            const r = qList[Math.floor(Math.random()*qList.length)];
            GameEngine.start([r], 'lucky', 'Lucky Shot');
        }
    },

    // Archive / Search Handling
    searchWrong: async () => {
        const all = await Data.fetchQuestionsByCriteria({mode: 'global'});
        const wrongs = all.filter(q => State.localData.mistakes.includes(q.id));
        if(wrongs.length) {
             UI.closeModal('m-search');
             GameEngine.start(wrongs, 'review', 'مراجعة الأخطاء');
        } else {
            alert('لا يوجد أخطاء مسجلة');
        }
    },

    execSearch: async () => {
        const id = document.getElementById('inp-search-id').value;
        const txt = document.getElementById('inp-search-txt').value.toLowerCase();
        
        if(!id && txt.length < 3) return alert('أدخل بيانات بحث صحيحة');
        
        document.querySelector('#m-search .btn-primary').innerText = 'بحث...';
        
        const all = await Data.fetchQuestionsByCriteria({mode: 'global'});
        let res = [];

        if (id) res = all.filter(q => q.id == id);
        else if (txt) res = all.filter(q => q.question.toLowerCase().includes(txt));
        
        document.querySelector('#m-search .btn-primary').innerText = 'بحث';
        
        if(res.length) {
             UI.closeModal('m-search');
             GameEngine.start(res, 'review', `Search: ${res.length}`);
        } else alert('لا نتائج');
    },

    startArchive: async (mode) => {
        // Loads questions from Archive IDs
        if(!State.localData.archive.length) return alert('الأرشيف فارغ');
        const all = await Data.fetchQuestionsByCriteria({mode: 'global'});
        const pool = all.filter(q => State.localData.archive.includes(q.id));
        UI.closeModal('m-archive');
        GameEngine.start(pool, mode === 'view' ? 'review' : 'normal', 'الأرشيف');
    },
    
    startFavMode: async () => {
        if(!State.localData.fav.length) return alert('لا يوجد مفضلة');
        const all = await Data.fetchQuestionsByCriteria({mode: 'global'});
        const pool = all.filter(q => State.localData.fav.includes(q.id));
        UI.closeModal('m-archive');
        GameEngine.start(pool, 'normal', '⭐ المفضلة');
    },

    randomizeUI: () => {
         const t = THEMES[Math.floor(Math.random()*THEMES.length)];
         document.body.setAttribute('data-theme', t.id);
         State.localData.settings.theme = t.id;
         Data.save();
    },

    startRankMode: () => {
        UI.openModal('m-rank');
        // Calculate Global Score from local
        document.getElementById('rank-val').innerText = '---';
        
        // Show Global Leaderboard
        db.ref('ranks').limitToLast(10).once('value').then(snap => {
             // Complex leaderboard UI needs logic per topic
             // For global simple view, just show text
             document.getElementById('rank-total').innerText = "نظام الترتيب يحتاج انترنت";
        });
        document.getElementById('rank-user-name').innerText = State.user.full_name;
    }
};
