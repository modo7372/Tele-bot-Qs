let timerInt;
const GameEngine = {
    instant: true,
    setFilter: (v) => State.filters=v,
    toggleInstant: (v) => GameEngine.instant=v,

    start: (qs, mode, topic) => {
        State.quiz = { questions:qs, mode:mode, answers:new Array(qs.length), currentIndex:0, topic:topic };
        UI.showView('v-quiz');
        
        const isTime = mode === 'timeAttack';
        document.getElementById('timer-bar').style.display = isTime ? 'block':'none';
        document.getElementById('btn-show-ans').classList.toggle('hidden', mode!=='review');
        
        if(isTime) GameEngine.timer(60);
        GameEngine.render();
    },

    render: () => {
        const idx = State.quiz.currentIndex;
        const q = State.quiz.questions[idx];
        const ans = State.quiz.answers[idx];

        document.getElementById('q-idx').innerText = `${idx+1}/${State.quiz.questions.length}`;
        document.getElementById('q-id').innerText = q.id;
        document.getElementById('q-path').innerText = State.quiz.topic;
        document.getElementById('q-txt').innerText = q.question;
        
        // Fav Icon update
        const isFav = State.localData.fav.includes(q.id);
        document.getElementById('btn-fav-icon').innerText = isFav ? '★' : '☆';

        const box = document.getElementById('q-opts'); box.innerHTML='';
        document.getElementById('q-exp').classList.add('hidden');
        document.getElementById('btn-check').classList.add('hidden');

        q.options.forEach((txt, i) => {
            const div = document.createElement('div');
            div.className = 'opt'; div.innerText = txt;
            
            // Replay State
            if(ans) {
                div.style.pointerEvents = 'none';
                if(i===q.correct_option_id) div.classList.add('correct');
                else if(ans.idx===i) div.classList.add('wrong');
            }

            div.onclick = () => GameEngine.click(i, div);
            box.appendChild(div);
        });
        
        if(ans) GameEngine.showExp();
    },

    click: (i, el) => {
        if(State.quiz.answers[State.quiz.currentIndex]) return;
        document.querySelectorAll('.opt').forEach(d=>d.classList.remove('selected'));
        el.classList.add('selected');

        if(GameEngine.instant || State.quiz.mode==='survival' || State.quiz.mode==='timeAttack') {
            GameEngine.submit(i);
        } else {
            document.getElementById('btn-check').classList.remove('hidden');
        }
    },
    
    checkManual: () => {
        const sel = document.querySelector('.opt.selected');
        if(sel) {
            // Find index
            const nodes = sel.parentNode.children;
            const idx = Array.prototype.indexOf.call(nodes, sel);
            GameEngine.submit(idx);
        }
    },

    submit: (i) => {
        const qIdx = State.quiz.currentIndex;
        const q = State.quiz.questions[qIdx];
        const isCorr = (i === q.correct_option_id);
        
        State.quiz.answers[qIdx] = { id:q.id, idx:i, isCorr:isCorr };
        
        // Save Mistake/Success
        if(isCorr) {
             UI.playSound('correct');
             State.localData.mistakes = State.localData.mistakes.filter(x=>x!=q.id);
        } else {
             UI.playSound('wrong');
             if(!State.localData.mistakes.includes(q.id)) State.localData.mistakes.push(q.id);
        }
        
        if(!State.localData.archive.includes(q.id)) State.localData.archive.push(q.id);
        Data.save();

        // UI
        GameEngine.render(); // Refreshes to show Correct/Wrong colors via logic

        if(State.quiz.mode==='survival' && !isCorr) { alert('Game Over!'); return GameEngine.finish(); }

        // --- Logic you requested: Manual if Wrong, Auto if Correct ---
        if(GameEngine.instant && State.quiz.mode!=='review') {
            if(isCorr) {
                setTimeout(() => { if(State.quiz.currentIndex===qIdx) GameEngine.navQ(1); }, 1000);
            }
            // If Wrong: Do nothing (Waiting for user)
        }
    },
    
    showExp: () => {
        const q = State.quiz.questions[State.quiz.currentIndex];
        if(q.explanation) {
             const e = document.getElementById('q-exp'); e.innerText = q.explanation; e.classList.remove('hidden');
        }
    },
    
    toggleAnswerView: () => {
        // Just show correct answer (cheat peek)
        const qIdx = State.quiz.currentIndex;
        const q = State.quiz.questions[qIdx];
        if(!State.quiz.answers[qIdx]) {
             const opts = document.getElementById('q-opts').children;
             if(opts[q.correct_option_id]) opts[q.correct_option_id].classList.add('correct');
             GameEngine.showExp();
        }
    },
    
    navQ: (d) => {
        const nx = State.quiz.currentIndex + d;
        if(nx >= 0 && nx < State.quiz.questions.length) {
            State.quiz.currentIndex = nx;
            GameEngine.render();
        } else if(nx >= State.quiz.questions.length && State.quiz.mode !=='review') {
            GameEngine.finish();
        }
    },
    
    finish: () => {
        clearInterval(timerInt);
        const ans = State.quiz.answers.filter(a=>a);
        const score = ans.filter(a=>a.isCorr).length;
        document.getElementById('sc-val').innerText = Math.round((score/State.quiz.questions.length)*100) + '%';
        document.getElementById('sc-txt').innerText = `${score} / ${State.quiz.questions.length}`;
        UI.openModal('m-score');
        
        // Report
        if(State.quiz.mode !== 'review') Data.reportScore(State.quiz.topic, score);
    },
    
    toggleFav: () => {
        const q = State.quiz.questions[State.quiz.currentIndex];
        if(State.localData.fav.includes(q.id)) State.localData.fav = State.localData.fav.filter(x=>x!=q.id);
        else State.localData.fav.push(q.id);
        Data.save();
        GameEngine.render(); // update star
    },
    
    timer: (s) => {
        let t = s;
        const b = document.getElementById('timer-bar');
        clearInterval(timerInt);
        timerInt = setInterval(()=>{
             t--;
             b.style.width = (t/s*100) + '%';
             if(t<=0) GameEngine.finish();
        },1000);
    },
    confirmExit: () => { if(confirm('إنهاء؟')) { clearInterval(timerInt); UI.goHome(); } }
};
