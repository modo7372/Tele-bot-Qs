let tInt; let cStep = ''; let autoNavTimer = null;

const Game = {
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

    startGlobalRandom: () => {
        let sub = Game.getFilteredPool();
        if(!sub.length) return alert('القائمة فارغة حسب الفلتر المختار.');
        State.mode = 'normal';
        sub.sort(() => 0.5 - Math.random());
        const count = Math.floor(Math.random() * 50) + 1;
        State.quiz = sub.slice(0, count);
        State.qIdx = 0; State.score = 0;
        UI.showView('v-quiz');
        UI.initAnim(true); 
        Game.renderQ();
    },

    startFlow: (m) => {
        State.mode = m;
        State.pool = Game.getFilteredPool();
        if(m === 'mistakes') {
            State.pool = State.pool.filter(q => State.localData.mistakes.includes(q.id));
        }
        if(!State.pool.length) return alert('لا توجد أسئلة متاحة في هذا الوضع/الفلتر.');
        State.sel = {term:null, subj:null, lessons:[], chapters:[], limit:'All'};
        Game.renderSel('term');
    },

    startRandomInMode: () => {
        let sub = State.pool;
        if(State.sel.term) sub = sub.filter(q => q.term === State.sel.term);
        if(State.sel.subj) sub = sub.filter(q => q.subject === State.sel.subj);
        if(State.sel.lessons.length) sub = sub.filter(q => State.sel.lessons.includes(q.lesson));
        
        if(!sub.length) return alert('لا توجد أسئلة هنا');
        sub.sort(() => 0.5 - Math.random());
        
        const count = Math.floor(Math.random() * 50) + 1;
        State.quiz = sub.slice(0, count);
        State.qIdx = 0; State.score = 0;
        UI.showView('v-quiz');
        UI.initAnim(true);
        if(State.mode==='timeAttack') Game.startTimer();
        Game.renderQ();
    },

    renderSel: (step) => {
        cStep = step; UI.showView('v-select');
        const list = document.getElementById('sel-body'); list.innerHTML='';
        const titleMap = {'term':'الترم','subj':'المادة','lesson':'المحاضرة','chapter':'الفصل','limit':'العدد'};
        document.getElementById('sel-head').innerText = `اختر ${titleMap[step] || step}`;
        
        const btnRnd = document.getElementById('btn-mode-random');
        btnRnd.classList.add('hidden');
        document.getElementById('btn-all').classList.add('hidden');

        const sub = State.pool.filter(q => (!State.sel.term||q.term===State.sel.term) && (!State.sel.subj||q.subject===State.sel.subj));
        
        if(step !== 'limit' && step !== 'term') {
             btnRnd.classList.remove('hidden');
             btnRnd.innerText = `🎲 امتحان عشوائي من الـ ${titleMap[step] || step} الحالية`;
        }

        let items=[], isMulti=false;

        if(step==='term') items=[...new Set(sub.map(q=>q.term))];
        else if(step==='subj') items=[...new Set(sub.map(q=>q.subject))];
        else if(step==='lesson') { items=[...new Set(sub.map(q=>q.lesson))]; isMulti=true; }
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

    initQuiz: () => {
        let final = State.pool.filter(q => State.sel.term===q.term && State.sel.subj===q.subject && State.sel.lessons.includes(q.lesson) && State.sel.chapters.includes(q.chapter));
        if(!final.length) return alert('No questions.');
        
        final.sort(()=>0.5-Math.random());
        if(State.sel.limit!=='All') final = final.slice(0, parseInt(State.sel.limit));
        
        State.quiz = final; State.qIdx = 0; State.score = 0;
        UI.showView('v-quiz');
        if(State.mode==='timeAttack') Game.startTimer(); else document.getElementById('timer-bar').style.display='none';
        Game.renderQ();
    },

    luckyShot: () => { State.mode='normal'; State.quiz=[State.allQ[Math.floor(Math.random()*State.allQ.length)]]; State.qIdx=0; UI.showView('v-quiz'); Game.renderQ(); },
    
    startArchive: (type) => { 
        const p = State.allQ.filter(q=>State.localData.archive.includes(q.id));
        if(!p.length) return alert('الأرشيف فارغ');
        UI.closeModal('m-archive'); State.mode=(type==='view'?'view_mode':'normal');
        State.quiz=p; State.qIdx=0; UI.showView('v-quiz'); Game.renderQ();
    },
    
    startFavMode: () => {
        const p = State.allQ.filter(q=>State.localData.fav.includes(q.id));
        if(!p.length) return alert('المفضلة فارغة');
        State.mode='normal'; State.quiz=p; State.qIdx=0; UI.showView('v-quiz'); Game.renderQ();
    },
    
    execSearch: () => {
        const id = parseInt(document.getElementById('inp-search').value);
        const q = State.allQ.find(x=>x.id===id);
        if(q) { State.mode='normal'; State.quiz=[q]; State.qIdx=0; UI.showView('v-quiz'); UI.closeModal('m-search'); Game.renderQ(); }
        else alert('غير موجود');
    },

    answered: false,
    renderQ: () => {
        clearTimeout(autoNavTimer);
        Game.answered = false;
        const q = State.quiz[State.qIdx];
        const isAlreadyAnswered = State.localData.archive.includes(q.id) && State.mode === 'view_mode';
        
        document.getElementById('q-id').innerText = q.id;
        document.getElementById('q-idx').innerText = `${State.qIdx+1}/${State.quiz.length}`;
        document.getElementById('q-path').innerText = `${q.subject} > ${q.lesson}`;
        document.getElementById('q-txt').innerText = q.question;
        Game.updateFavUI();

        const opts = document.getElementById('q-opts'); opts.innerHTML='';
        document.getElementById('q-exp').classList.add('hidden');
        document.getElementById('btn-next').classList.add('hidden');

        q.options.forEach((o, i) => {
            const d = document.createElement('div'); d.className='opt';
            d.innerHTML = `<span>${o}</span>`;
            d.onclick = () => Game.answer(i);
            opts.appendChild(d);
        });
        
        if(isAlreadyAnswered) { Game.answer(q.correct_option_id, true); }
    },

    answer: (idx, sim=false) => {
        if(Game.answered && !sim) return;
        Game.answered = true;
        const q = State.quiz[State.qIdx];
        const divs = document.querySelectorAll('.opt');

        divs[q.correct_option_id].classList.add('correct');
        const isCorrect = (idx === q.correct_option_id);

        if(isCorrect) {
            if(!sim) { State.score++; AudioSys.playSuccess(); Game.triggerHaptic('success'); }
            State.localData.mistakes = State.localData.mistakes.filter(x=>x!==q.id);
        } else {
            divs[idx].classList.add('wrong');
            if(!sim) { AudioSys.playError(); Game.triggerHaptic('error'); }
            if(!State.localData.mistakes.includes(q.id)) State.localData.mistakes.push(q.id);
            if(State.mode==='survival') { setTimeout(()=>alert('🔥 Game Over'), 500); return UI.goHome(); }
        }
        
        if(!State.localData.archive.includes(q.id)) State.localData.archive.push(q.id);
        Data.saveData();

        if(q.explanation) {
            const expBox = document.getElementById('q-exp');
            expBox.innerHTML = `<b>توضيح:</b> ${q.explanation}`;
            expBox.classList.remove('hidden');
        }
        document.getElementById('btn-next').classList.remove('hidden');

        if(!sim && State.mode !== 'view_mode') {
            const delay = isCorrect ? 1000 : 3000;
            autoNavTimer = setTimeout(() => { if(Game.answered) Game.nextQ(); }, delay);
        }
    },

    navQ: (dir) => {
        if(dir === -1 && State.qIdx > 0) { State.qIdx--; Game.renderQ(); } 
        else if (dir === 1) { Game.nextQ(); }
    },

    nextQ: () => { 
        if(State.qIdx < State.quiz.length-1){ State.qIdx++; Game.renderQ(); Game.triggerHaptic('selection'); } 
        else Game.finishQuiz(); 
    },

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
        if(!State.sel.term || !State.sel.subj) return alert('الترتيب متاح عند اختيار مادة.');
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
