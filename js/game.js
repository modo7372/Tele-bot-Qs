// js/game.js

let tInt; // Timer variable
let cStep = ''; // Current Selection Step

const Game = {
    startFlow: (m) => {
        State.mode = m;
        State.pool = (m === 'mistakes') ? State.allQ.filter(q => State.localData.mistakes.includes(q.id)) : State.allQ;
        if(!State.pool.length) return alert('القائمة فارغة.');
        
        State.sel = {term:null, subj:null, lessons:[], chapters:[], limit:'All'};
        Game.renderSel('term');
    },

    renderSel: (step) => {
        cStep = step;
        UI.showView('v-select');
        const list = document.getElementById('sel-body'); list.innerHTML='';
        document.getElementById('sel-head').innerText = `Select ${step}`;
        document.getElementById('btn-all').classList.add('hidden');

        const sub = State.pool.filter(q => (!State.sel.term||q.term===State.sel.term) && (!State.sel.subj||q.subject===State.sel.subj));
        let items=[], isMulti=false;

        if(step==='term') items=[...new Set(sub.map(q=>q.term))];
        else if(step==='subj') items=[...new Set(sub.map(q=>q.subject))];
        else if(step==='lesson') { items=[...new Set(sub.map(q=>q.lesson))]; isMulti=true; }
        else if(step==='chapter') {
            isMulti=true;
            State.sel.lessons.forEach(l => {
                list.innerHTML += `<div style="font-weight:bold; color:var(--primary); margin:10px 0;">📂 ${l}</div>`;
                const g = document.createElement('div'); g.className='chip-grid';
                [...new Set(sub.filter(q=>q.lesson===l).map(q=>q.chapter))].forEach(ch => g.appendChild(Game.createChip(ch, true)));
                list.appendChild(g);
            });
            document.getElementById('btn-all').classList.remove('hidden');
            return;
        }
        else if(step==='limit') {
            ['10','20','30','All'].forEach(l => {
                const b = document.createElement('div'); b.className='chip'; b.innerText=l;
                b.onclick = () => { State.sel.limit=l; Game.initQuiz(); };
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
            if(multi) c.classList.toggle('selected');
            else {
                if(cStep==='term') State.sel.term=val;
                else if(cStep==='subj') State.sel.subj=val;
                Game.nextSel();
            }
        };
        return c;
    },

    nextSel: () => {
        const picked = Array.from(document.querySelectorAll('.chip.selected')).map(c=>c.dataset.val);
        if(cStep==='term') Game.renderSel('subj');
        else if(cStep==='subj') Game.renderSel('lesson');
        else if(cStep==='lesson') { if(!picked.length) return alert('Select one'); State.sel.lessons=picked; Game.renderSel('chapter'); }
        else if(cStep==='chapter') { if(!picked.length) return alert('Select one'); State.sel.chapters=picked; Game.renderSel('limit'); }
    },

    toggleAll: () => document.querySelectorAll('.chip').forEach(c => c.classList.toggle('selected')),

    // --- QUIZ LOGIC ---

    initQuiz: () => {
        let final = State.pool.filter(q => State.sel.term===q.term && State.sel.subj===q.subject && State.sel.lessons.includes(q.lesson) && State.sel.chapters.includes(q.chapter));
        if(!final.length) return alert('No questions.');
        
        final.sort(()=>0.5-Math.random());
        if(State.sel.limit!=='All') final = final.slice(0, parseInt(State.sel.limit));
        
        State.quiz = final; State.qIdx = 0; State.score = 0;
        UI.showView('v-quiz');
        
        if(State.mode==='timeAttack') Game.startTimer(); 
        else document.getElementById('timer-bar').style.display='none';
        
        Game.renderQ();
    },

    // Shortcut modes
    luckyShot: () => { State.mode='normal'; State.quiz=[State.allQ[Math.floor(Math.random()*State.allQ.length)]]; State.qIdx=0; UI.showView('v-quiz'); Game.renderQ(); },
    
    startArchive: (type) => { 
        const p = State.allQ.filter(q=>State.localData.archive.includes(q.id));
        if(!p.length) return alert('Archive empty');
        UI.closeModal('m-archive'); State.mode=(type==='view'?'view_mode':'normal');
        State.quiz=p; State.qIdx=0; UI.showView('v-quiz'); Game.renderQ();
    },

    startFavMode: () => {
        const p = State.allQ.filter(q=>State.localData.fav.includes(q.id));
        if(!p.length) return alert('Favorites empty');
        State.mode='normal'; State.quiz=p; State.qIdx=0; UI.showView('v-quiz'); Game.renderQ();
    },

    execSearch: () => {
        const id = parseInt(document.getElementById('inp-search').value);
        const q = State.allQ.find(x=>x.id===id);
        if(q) { State.mode='normal'; State.quiz=[q]; State.qIdx=0; UI.showView('v-quiz'); UI.closeModal('m-search'); Game.renderQ(); }
        else alert('Not found');
    },

    // Rendering Question
    answered: false,
    renderQ: () => {
        Game.answered = false;
        const q = State.quiz[State.qIdx];
        
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

        if(State.mode==='view_mode') Game.answer(q.correct_option_id, true);
    },

    answer: (idx, sim=false) => {
        if(Game.answered && !sim) return;
        Game.answered = true;
        const q = State.quiz[State.qIdx];
        const divs = document.querySelectorAll('.opt');

        divs[q.correct_option_id].classList.add('correct');

        if(idx === q.correct_option_id) {
            if(!sim) State.score++;
            State.localData.mistakes = State.localData.mistakes.filter(x=>x!==q.id);
        } else {
            divs[idx].classList.add('wrong');
            if(!State.localData.mistakes.includes(q.id)) State.localData.mistakes.push(q.id);
            if(!State.localData.archive.includes(q.id)) State.localData.archive.push(q.id);
            
            if(State.mode==='survival') { setTimeout(()=>alert('🔥 Game Over'), 500); return UI.goHome(); }
        }
        
        localStorage.setItem('mistakes', JSON.stringify(State.localData.mistakes));
        localStorage.setItem('archive', JSON.stringify(State.localData.archive));

        if(q.explanation) {
            const expBox = document.getElementById('q-exp');
            expBox.innerHTML = `<b>توضيح:</b> ${q.explanation}`;
            expBox.classList.remove('hidden');
        }
        document.getElementById('btn-next').classList.remove('hidden');
    },

    nextQ: () => { if(State.qIdx < State.quiz.length-1){ State.qIdx++; Game.renderQ(); } else Game.finishQuiz(); },

    // Timer
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
        // Save to Leaderboard
        Data.saveLeaderboard(State.score, State.quiz.length);

        const pct = Math.round((State.score/State.quiz.length)*100);
        document.getElementById('sc-val').innerText = `${pct}%`;
        document.getElementById('sc-txt').innerText = `${State.score} / ${State.quiz.length}`;
        UI.openModal('m-score');
    },

    // Favs
    toggleFav: () => {
        const id = State.quiz[State.qIdx].id;
        if(State.localData.fav.includes(id)) State.localData.fav = State.localData.fav.filter(x=>x!==id);
        else State.localData.fav.push(id);
        localStorage.setItem('fav', JSON.stringify(State.localData.fav));
        Game.updateFavUI();
    },
    updateFavUI: () => {
        const el = document.getElementById('fav-icon');
        const isFav = State.localData.fav.includes(State.quiz[State.qIdx].id);
        el.innerText = isFav ? "★" : "☆";
        el.style.color = isFav ? "#f1c40f" : "var(--txt-sec)";
    },

    // Leaderboard Display
    showRank: () => {
        if(!State.sel.term || !State.sel.subj) return alert('الترتيب متاح فقط عند اختيار مادة محددة.');
        
        const context = `${State.sel.term}_${State.sel.subj}`.replace(/[.#$/\[\]]/g, "_");
        document.getElementById('rank-topic').innerText = context.replace('_', ' > ');
        document.getElementById('rank-val').innerText = '...';
        UI.openModal('m-rank');

        db.ref(`ranks/${context}`).once('value', snap => {
            const data = snap.val();
            if(!data) { document.getElementById('rank-val').innerText = 'لا يوجد بيانات'; return; }
            
            // Convert to array handling both formats (old number vs new object)
            let arr = Object.keys(data).map(k => {
                let val = data[k];
                let s = (typeof val === 'object') ? val.score : val;
                let n = (typeof val === 'object') ? val.name : "User";
                return { id: k, score: s, name: n };
            });

            arr.sort((a,b) => b.score - a.score);
            
            const myRank = arr.findIndex(x => x.id == State.user.id) + 1;
            
            if(myRank > 0) {
                document.getElementById('rank-val').innerText = `#${myRank}`;
                document.getElementById('rank-user-name').innerText = State.user.first_name;
                document.getElementById('rank-total').innerText = `من بين ${arr.length} متسابق`;
            } else {
                document.getElementById('rank-val').innerText = 'غير مصنف';
            }
        });
    }
};
