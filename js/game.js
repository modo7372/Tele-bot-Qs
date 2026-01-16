let tInt; let cStep = ''; let autoNavTimer = null;

const Game = {
    // --- أدوات مساعدة ---
    triggerHaptic: (type) => {
        if(State.localData.settings?.haptic === false) return;
        if (window.Telegram.WebApp.isVersionAtLeast && window.Telegram.WebApp.isVersionAtLeast('6.1')) {
            try {
                if(type === 'success') Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                else if(type === 'error') Telegram.WebApp.HapticFeedback.notificationOccurred('error');
                else Telegram.WebApp.HapticFeedback.selectionChanged();
            } catch(e){}
        }
    },

    randomizeUI: () => {
        Game.triggerHaptic('selection');
        const rndTheme = THEMES[Math.floor(Math.random() * THEMES.length)];
        UI.setTheme(rndTheme.id);
        const fonts = ["'Cairo', sans-serif", "'Segoe UI', Tahoma, sans-serif", "'Courier New', monospace"];
        UI.updateStyleVar('--font-fam', fonts[Math.floor(Math.random() * fonts.length)]);
        UI.initAnim(true); 
    },

    toggleInstant: (val) => { State.instantFeedback = val; },
    
    // تأكيد الخروج من الاختبار
    confirmExit: () => {
        if(confirm('هل تريد الخروج والعودة للقائمة الرئيسية؟')) {
            UI.goHome();
        }
    },

    // --- الفلاتر ---
    setFilter: (f, el) => {
        State.filter = f;
        document.querySelectorAll('#filter-opts .chip').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
    },

    getFilteredPool: () => {
        let p = [...State.allQ];
        const mist = State.localData.mistakes;
        const arch = State.localData.archive;
        
        if(State.filter === 'new') p = p.filter(q => !arch.includes(q.id));
        else if(State.filter === 'wrong') p = p.filter(q => mist.includes(q.id));
        else if(State.filter === 'answered') p = p.filter(q => arch.includes(q.id));
        
        return p;
    },

    // --- أوضاع اللعب ---
    // 1. ضربة حظ
    luckyShot: () => {
        let pool = Game.getFilteredPool();
        if(!pool.length) return alert('لا توجد أسئلة متاحة حسب الفلتر المختار.');
        
        const q = pool[Math.floor(Math.random() * pool.length)];
        Game.startQuizSession([q], 'lucky');
    },

    // 2. اختبار عشوائي سريع
    startGlobalRandom: () => {
        let sub = Game.getFilteredPool();
        if(!sub.length) return alert('القائمة فارغة حسب الفلتر المختار.');
        sub.sort(() => 0.5 - Math.random());
        const count = Math.floor(Math.random() * 50) + 1;
        Game.startQuizSession(sub.slice(0, count), 'normal');
    },

    // 3. بدء تدفق الاختيار
    startFlow: (m) => {
        State.tempMode = m; 
        State.isRankMode = false; // نتأكد أننا في وضع اللعب
        State.pool = Game.getFilteredPool();
        
        if(m === 'mistakes') {
            State.pool = State.pool.filter(q => State.localData.mistakes.includes(q.id));
        }

        if(!State.pool.length) return alert('لا توجد أسئلة متاحة في هذا الوضع/الفلتر.');
        
        State.sel = {term:null, subj:null, lessons:[], chapters:[], limit:'All'};
        Game.renderSel('term');
    },
    
    // بدء وضع الترتيب (يختار المادة ثم يعرض الترتيب)
    startRankMode: () => {
        State.isRankMode = true; // تفعيل وضع الترتيب
        State.pool = State.allQ; // نحتاج كل الأسئلة لبناء القائمة
        State.sel = {term:null, subj:null, lessons:[], chapters:[], limit:'All'};
        Game.renderSel('term');
    },

    // داخل وضع الاختيار: بدء عشوائي
    startRandomInMode: () => {
        let sub = State.pool;
        if(State.sel.term) sub = sub.filter(q => q.term === State.sel.term);
        if(State.sel.subj) sub = sub.filter(q => q.subject === State.sel.subj);
        if(State.sel.lessons.length) sub = sub.filter(q => State.sel.lessons.includes(q.lesson));
        
        if(!sub.length) return alert('لا توجد أسئلة هنا');
        sub.sort(() => 0.5 - Math.random());
        
        const count = Math.floor(Math.random() * 50) + 1;
        Game.startQuizSession(sub.slice(0, count), State.tempMode || 'normal');
    },

    // --- منطق الاختيار (Selection Logic) ---
    renderSel: (step) => {
        cStep = step; UI.showView('v-select');
        const list = document.getElementById('sel-body'); list.innerHTML='';
        const titleMap = {'term':'الترم','subj':'المادة','lesson':'المحاضرة','chapter':'الفصل','limit':'العدد'};
        
        // إذا كنا في وضع الترتيب، نغير العناوين قليلاً
        const prefix = State.isRankMode ? "ترتيب: " : "اختر ";
        document.getElementById('sel-head').innerText = `${prefix} ${titleMap[step] || step}`;
        
        const btnRnd = document.getElementById('btn-mode-random');
        btnRnd.classList.add('hidden');
        document.getElementById('btn-all').classList.add('hidden');

        // فلترة القائمة بناء على الاختيارات السابقة
        const sub = State.pool.filter(q => (!State.sel.term||q.term===State.sel.term) && (!State.sel.subj||q.subject===State.sel.subj));
        
        // زر عشوائي (يظهر فقط في وضع اللعب وليس الترتيب)
        if(!State.isRankMode && step !== 'limit' && step !== 'term') {
             btnRnd.classList.remove('hidden');
             btnRnd.innerText = `🎲 امتحان عشوائي من الـ ${titleMap[step] || step} الحالية`;
        }

        let items=[], isMulti=false;

        if(step==='term') items=[...new Set(sub.map(q=>q.term))];
        else if(step==='subj') items=[...new Set(sub.map(q=>q.subject))];
        else if(step==='lesson') { 
            // إذا كنا في وضع الترتيب، نتوقف عند اختيار المادة
            if(State.isRankMode) return Game.showRank(); 
            items=[...new Set(sub.map(q=>q.lesson))]; isMulti=true; 
        }
        else if(step==='chapter') {
            isMulti=true;
            State.sel.lessons.forEach(l => {
                const lDiv = document.createElement('div');
                lDiv.innerHTML = `<div style="position:sticky; top:0; background:var(--glass-bg); padding:5px; z-index:2; font-weight:bold; color:var(--primary); border-bottom:1px solid #ccc;">📂 ${l}</div>`;
                const g = document.createElement('div'); g.className='chip-grid'; g.style.padding='5px';
                [...new Set(sub.filter(q=>q.lesson===l).map(q=>q.chapter))].forEach(ch => g.appendChild(Game.createChip(ch, true)));
                lDiv.appendChild(g);
                list.appendChild(lDiv);
            });
            document.getElementById('btn-all').classList.remove('hidden');
            return;
        }
        else if(step==='limit') {
            ['10','20','30','50','All'].forEach(l => {
                const b = document.createElement('div'); b.className='chip'; b.innerText=l;
                b.onclick = () => { 
                    document.querySelectorAll('.chip').forEach(c=>c.classList.remove('selected'));
                    b.classList.add('selected');
                    State.sel.limit=l; 
                };
                list.appendChild(b);
            });
            return;
        }

        const g = document.createElement('div'); g.className='chip-grid';
        items.sort().forEach(i => g.appendChild(Game.createChip(i, isMulti)));
        list.appendChild(g);
        if(isMulti) document.getElementById('btn-all').classList.remove('hidden');
    },

    createChip: (val, multi) => {
        const c = document.createElement('div'); c.className='chip'; c.innerText=val; c.dataset.val=val;
        c.onclick = () => {
            Game.triggerHaptic('selection');
            if(multi) c.classList.toggle('selected');
            else {
                document.querySelectorAll('.chip').forEach(ch=>ch.classList.remove('selected'));
                c.classList.add('selected');
                if(cStep==='term') State.sel.term=val;
                else if(cStep==='subj') State.sel.subj=val;
                Game.nextSel();
            }
        };
        return c;
    },

    nextSel: () => {
        if(cStep === 'term' && !State.sel.term) return alert('الرجاء اختيار الترم');
        if(cStep === 'subj' && !State.sel.subj) return alert('الرجاء اختيار المادة');
        
        if(cStep==='term') Game.renderSel('subj');
        else if(cStep==='subj') Game.renderSel('lesson');
        else if(cStep==='lesson') { 
            const picked = Array.from(document.querySelectorAll('.chip.selected')).map(c=>c.dataset.val);
            if(!picked.length) return alert('اختر محاضرة واحدة على الأقل'); 
            State.sel.lessons=picked; Game.renderSel('chapter'); 
        }
        else if(cStep==='chapter') { 
            const picked = Array.from(document.querySelectorAll('.chip.selected')).map(c=>c.dataset.val);
            if(!picked.length) return alert('اختر فصلاً واحداً على الأقل'); 
            State.sel.chapters=picked; Game.renderSel('limit'); 
        }
        else if(cStep==='limit') {
            if(!State.sel.limit) State.sel.limit = 'All';
            Game.initQuiz();
        }
    },

    prevSel: () => {
        if(cStep === 'term') UI.goHome();
        else if(cStep === 'subj') { State.sel.term = null; Game.renderSel('term'); }
        else if(cStep === 'lesson') { State.sel.subj = null; Game.renderSel('subj'); }
        else if(cStep === 'chapter') { Game.renderSel('lesson'); }
        else if(cStep === 'limit') Game.renderSel('chapter');
    },
    
    toggleAll: () => document.querySelectorAll('.chip').forEach(c => c.classList.toggle('selected')),

    // --- بدء جلسة الاختبار ---
    initQuiz: () => {
        let final = State.pool.filter(q => State.sel.term===q.term && State.sel.subj===q.subject && State.sel.lessons.includes(q.lesson) && State.sel.chapters.includes(q.chapter));
        if(!final.length) return alert('No questions.');
        
        final.sort(()=>0.5-Math.random());
        if(State.sel.limit!=='All') final = final.slice(0, parseInt(State.sel.limit));
        
        Game.startQuizSession(final, State.tempMode || 'normal');
    },

    startQuizSession: (questions, mode) => {
        State.quiz = questions;
        State.mode = mode;
        State.qIdx = 0;
        State.score = 0;
        
        State.answers = new Array(questions.length).fill(null).map(() => ({ answered: false, selectedIdx: null, isCorrect: false }));
        State.instantFeedback = document.getElementById('chk-instant').checked;

        UI.showView('v-quiz');
        UI.initAnim(true);

        if(mode === 'timeAttack') Game.startTimer();
        else document.getElementById('timer-bar').style.display='none';

        const isSearchOrView = (mode === 'view_mode' || mode === 'search_mode');
        document.getElementById('btn-finish').style.display = isSearchOrView ? 'none' : 'inline-block';
        document.getElementById('archive-controls').classList.toggle('hidden', !isSearchOrView);

        Game.renderQ();
    },

    // --- الأرشيف والبحث ---
    startArchive: (type) => { 
        const p = State.allQ.filter(q=>State.localData.archive.includes(q.id));
        if(!p.length) return alert('الأرشيف فارغ');
        UI.closeModal('m-archive');
        Game.startQuizSession(p, type==='view'?'view_mode':'normal');
    },

    execSearch: () => {
        const idVal = document.getElementById('inp-search-id').value;
        const txtVal = document.getElementById('inp-search-txt').value.toLowerCase();
        
        let found = [];
        if(idVal) {
            const q = State.allQ.find(x => x.id == idVal);
            if(q) found.push(q);
        } else if (txtVal && txtVal.length > 2) {
            found = State.allQ.filter(q => q.question.toLowerCase().includes(txtVal));
        }

        if(found.length) {
            UI.closeModal('m-search');
            Game.startQuizSession(found, 'search_mode');
        } else {
            alert('لم يتم العثور على نتائج.');
        }
    },

    searchWrong: () => {
        const mistakes = State.localData.mistakes;
        if(!mistakes.length) return alert('لا يوجد سجل أخطاء.');
        const found = State.allQ.filter(q => mistakes.includes(q.id));
        UI.closeModal('m-search');
        Game.startQuizSession(found, 'search_mode');
    },

    toggleAnswerView: () => {
        const qState = State.answers[State.qIdx];
        const q = State.quiz[State.qIdx];
        
        if(qState.answered) {
            qState.answered = false; 
            Game.renderQ();
        } else {
            Game.answer(q.correct_option_id, true); 
        }
    },

    // --- عرض السؤال ---
    renderQ: () => {
        clearTimeout(autoNavTimer);
        const q = State.quiz[State.qIdx];
        const qState = State.answers[State.qIdx]; 

        document.getElementById('q-id').innerText = q.id;
        document.getElementById('q-idx').innerText = `${State.qIdx+1}/${State.quiz.length}`;
        document.getElementById('q-path').innerText = `${q.subject} > ${q.lesson}`;
        document.getElementById('q-txt').innerText = q.question;
        
        Game.updateFavUI();

        const opts = document.getElementById('q-opts'); opts.innerHTML='';
        const expBox = document.getElementById('q-exp');
        const btnCheck = document.getElementById('btn-check');
        
        expBox.classList.add('hidden');
        btnCheck.classList.add('hidden');

        q.options.forEach((o, i) => {
            const d = document.createElement('div'); d.className='opt';
            d.innerHTML = `<span>${o}</span>`;
            
            if(qState.answered) {
                if(i === q.correct_option_id) d.classList.add('correct');
                else if(i === qState.selectedIdx) d.classList.add('wrong');
                d.style.pointerEvents = 'none'; 
            } else if (qState.selectedIdx === i) {
                d.classList.add('selected-temp');
            }

            d.onclick = () => Game.handleOptionClick(i, d);
            opts.appendChild(d);
        });

        if(qState.answered && q.explanation) {
            expBox.innerHTML = `<b>توضيح:</b> ${q.explanation}`;
            expBox.classList.remove('hidden');
        }

        if(!State.instantFeedback && qState.selectedIdx !== null && !qState.answered) {
            btnCheck.classList.remove('hidden');
        }
    },

    handleOptionClick: (idx, el) => {
        const qState = State.answers[State.qIdx];
        if(qState.answered) return; 

        qState.selectedIdx = idx;

        if(State.instantFeedback || State.mode === 'lucky') {
            Game.confirmAnswer(idx);
        } else {
            document.querySelectorAll('.opt').forEach(o => o.classList.remove('selected-temp'));
            el.classList.add('selected-temp');
            document.getElementById('btn-check').classList.remove('hidden');
        }
    },

    checkManual: () => {
        const qState = State.answers[State.qIdx];
        if(qState.selectedIdx !== null) {
            Game.confirmAnswer(qState.selectedIdx);
        }
    },

    confirmAnswer: (idx, isSim = false) => {
        const q = State.quiz[State.qIdx];
        const qState = State.answers[State.qIdx];
        
        qState.answered = true; 
        qState.selectedIdx = idx;
        
        const isCorrect = (idx === q.correct_option_id);
        qState.isCorrect = isCorrect;

        const divs = document.querySelectorAll('.opt');
        divs.forEach(d => d.classList.remove('selected-temp')); 
        
        divs[q.correct_option_id].classList.add('correct');

        if(isCorrect) {
            if(!isSim) {
                State.score++;
                AudioSys.playSuccess();
                Game.triggerHaptic('success');
                State.localData.mistakes = State.localData.mistakes.filter(x=>x!==q.id);
            }
        } else {
            divs[idx].classList.add('wrong');
            if(!isSim) {
                AudioSys.playError();
                Game.triggerHaptic('error');
                if(!State.localData.mistakes.includes(q.id)) State.localData.mistakes.push(q.id);
                if(State.mode==='survival') { 
                    setTimeout(()=>alert('🔥 Game Over'), 500); 
                    return UI.goHome(); 
                }
            }
        }

        if(!State.localData.archive.includes(q.id)) State.localData.archive.push(q.id);
        Data.saveData();

        if(q.explanation) {
            const expBox = document.getElementById('q-exp');
            expBox.innerHTML = `<b>توضيح:</b> ${q.explanation}`;
            expBox.classList.remove('hidden');
        }

        document.getElementById('btn-check').classList.add('hidden'); 

        if(State.instantFeedback && !isSim && State.mode !== 'view_mode' && State.mode !== 'search_mode') {
            const delay = isCorrect ? 1000 : 3000;
            autoNavTimer = setTimeout(() => {
                if(State.qIdx < State.quiz.length - 1) Game.nextQ();
            }, delay);
        }
    },

    answer: (idx, sim=true) => {
        const qState = State.answers[State.qIdx];
        qState.selectedIdx = idx; 
        Game.confirmAnswer(idx, sim);
    },

    navQ: (dir) => {
        const newIdx = State.qIdx + dir;
        if(newIdx >= 0 && newIdx < State.quiz.length) {
            State.qIdx = newIdx;
            Game.renderQ();
            Game.triggerHaptic('selection');
        } else if (newIdx >= State.quiz.length && State.mode !== 'view_mode' && State.mode !== 'search_mode') {
            Game.finishQuiz();
        } else {
            Game.triggerHaptic('error');
        }
    },

    nextQ: () => Game.navQ(1),

    startTimer: () => {
        let t = 60; const b = document.getElementById('timer-bar'); b.style.display='block';
        clearInterval(tInt);
        tInt = setInterval(()=>{
            t--; b.style.width = (t/60*100)+'%';
            if(t<=0) { clearInterval(tInt); alert('⏰ Time Up'); Game.finishQuiz(); }
        },1000);
    },
    stopTimer: () => clearInterval(tInt),

    finishQuiz: () => {
        Game.stopTimer();
        clearTimeout(autoNavTimer);
        
        let finalScore = State.answers.filter(a => a.isCorrect).length;
        State.score = finalScore;

        Data.saveLeaderboard(State.score);
        AudioSys.playSuccess();
        const pct = Math.round((State.score/State.quiz.length)*100);
        document.getElementById('sc-val').innerText = `${pct}%`;
        document.getElementById('sc-txt').innerText = `${State.score} / ${State.quiz.length}`;
        UI.openModal('m-score');
    },

    toggleFav: () => {
        const id = State.quiz[State.qIdx].id;
        if(State.localData.fav.includes(id)) State.localData.fav = State.localData.fav.filter(x=>x!==id);
        else State.localData.fav.push(id);
        Data.saveData();
        Game.updateFavUI();
        Game.triggerHaptic('selection');
    },
    updateFavUI: () => {
        const el = document.getElementById('btn-fav-big');
        const isFav = State.localData.fav.includes(State.quiz[State.qIdx].id);
        el.innerText = isFav ? "★ في المفضلة (S)" : "☆ أضف للمفضلة (S)";
        el.style.backgroundColor = isFav ? "var(--primary)" : "transparent";
        el.style.color = isFav ? "#fff" : "var(--txt-sec)";
    },

    showRank: () => {
        // إذا كنا في وضع الترتيب وتم اختيار مادة
        if(!State.sel || !State.sel.term || !State.sel.subj) {
             return alert('يجب اختيار مادة لعرض ترتيبها');
        }

        const ctx = `${State.sel.term}_${State.sel.subj}`.replace(/[.#$/\[\]]/g, "_");
        document.getElementById('rank-topic').innerText = ctx.replace('_', ' > ');
        document.getElementById('rank-val').innerText = '...';
        UI.openModal('m-rank');

        db.ref(`ranks/${ctx}`).once('value', snap => {
            const data = snap.val();
            if(!data) { document.getElementById('rank-val').innerText = 'No Data'; return; }
            let arr = Object.keys(data).map(k => {
                let v = data[k]; return { id: k, score: (v.score||v), name: (v.name||"User") };
            });
            arr.sort((a,b) => b.score - a.score);
            const myRank = arr.findIndex(x => x.id == State.user.id) + 1;
            document.getElementById('rank-val').innerText = myRank>0 ? `#${myRank}` : 'Unranked';
            document.getElementById('rank-user-name').innerText = State.user.first_name;
            document.getElementById('rank-total').innerText = `${arr.length} Players`;
        });
    }
};
