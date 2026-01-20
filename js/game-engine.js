let tInt;

const GameEngine = {
    instant: true,
    setFilter: (v) => State.filters = v,
    toggleInstant: (v) => GameEngine.instant = v,

    start: (pool, mode, title) => {
        State.quiz = { questions:pool, currentIndex:0, answers: new Array(pool.length), mode:mode, topic:title };
        UI.showView('v-quiz');

        const isTime = mode === 'timeAttack';
        document.getElementById('timer-bar').style.display = isTime ? 'block':'none';
        if(isTime) GameEngine.runTimer(60); else clearInterval(tInt);
        
        // Hide review buttons initially
        document.getElementById('btn-show-ans').classList.toggle('hidden', mode!=='review');
        
        GameEngine.render();
    },

    render: () => {
        const i = State.quiz.currentIndex;
        const q = State.quiz.questions[i];
        const ans = State.quiz.answers[i];

        document.getElementById('q-idx').innerText = `${i+1} / ${State.quiz.questions.length}`;
        document.getElementById('q-id').innerText = q.id;
        document.getElementById('q-txt').innerText = q.question;
        document.getElementById('q-path').innerText = State.quiz.topic;
        
        // Fav
        document.getElementById('btn-fav').innerText = State.localData.fav.includes(q.id) ? "★" : "☆";

        const box = document.getElementById('q-opts'); box.innerHTML='';
        document.getElementById('q-exp').classList.add('hidden');
        document.getElementById('btn-check').classList.add('hidden');

        q.options.forEach((txt, optI) => {
             const d = document.createElement('div'); d.className='opt'; d.innerText=txt;
             
             // Answered State
             if(ans) {
                 d.style.pointerEvents = 'none';
                 if(optI === q.correct_option_id) d.classList.add('correct');
                 else if(ans.choice === optI) d.classList.add('wrong');
             }
             
             d.onclick = () => GameEngine.selOption(optI, d);
             box.appendChild(d);
        });

        if(ans) GameEngine.showExp();
    },

    selOption: (idx, el) => {
        if(State.quiz.answers[State.quiz.currentIndex]) return;
        
        document.querySelectorAll('.opt').forEach(x=>x.classList.remove('selected'));
        el.classList.add('selected');

        if(GameEngine.instant || State.quiz.mode==='survival' || State.quiz.mode==='timeAttack') {
            GameEngine.submit(idx);
        } else {
            document.getElementById('btn-check').classList.remove('hidden');
        }
    },
    
    checkManual: () => {
         const s = document.querySelector('.opt.selected');
         if(s) {
             const idx = Array.from(s.parentNode.children).indexOf(s);
             GameEngine.submit(idx);
         }
    },

    submit: (choice) => {
        const cur = State.quiz.currentIndex;
        const q = State.quiz.questions[cur];
        const isCorr = (choice === q.correct_option_id);

        State.quiz.answers[cur] = { id:q.id, choice:choice, isCorrect:isCorr };
        
        // --- Persistence ---
        if(!State.localData.archive.includes(q.id)) State.localData.archive.push(q.id);
        
        if(isCorr) {
             UI.playSound(true);
             State.localData.mistakes = State.localData.mistakes.filter(x=>x!=q.id);
        } else {
             UI.playSound(false);
             if(!State.localData.mistakes.includes(q.id)) State.localData.mistakes.push(q.id);
        }
        Data.save();

        // --- Update UI (Colors) ---
        GameEngine.render(); 

        if(!isCorr && State.quiz.mode==='survival') {
             setTimeout(()=>{alert('Survival Mode Ended!'); GameEngine.finish();},500);
             return;
        }

        // --- SPECIAL FEATURE: AUTO-NAV ONLY ON SUCCESS ---
        if(GameEngine.instant && State.quiz.mode!=='review') {
             if(isCorr) {
                 setTimeout(() => {
                     // Check user didn't move manually already
                     if(State.quiz.currentIndex === cur) GameEngine.navQ(1);
                 }, 1000); 
             }
             // Else (Wrong): Wait for manual navigation
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

    showExp: () => {
         const e = State.quiz.questions[State.quiz.currentIndex].explanation;
         if(e) {
             const div = document.getElementById('q-exp'); div.innerHTML = "<b>Note:</b> " + e; div.classList.remove('hidden');
         }
    },
    
    toggleFav: () => {
         const q = State.quiz.questions[State.quiz.currentIndex];
         if(State.localData.fav.includes(q.id)) State.localData.fav=State.localData.fav.filter(x=>x!=q.id);
         else State.localData.fav.push(q.id);
         Data.save();
         GameEngine.render();
    },

    toggleAnswerView: () => {
        const cur = State.quiz.currentIndex;
        if(State.quiz.answers[cur]) return;
        
        const q = State.quiz.questions[cur];
        // Visual Reveal
        const opts = document.getElementById('q-opts').children;
        opts[q.correct_option_id].classList.add('correct');
        GameEngine.showExp();
    },

    runTimer: (sec) => {
        let t = sec;
        const b = document.getElementById('timer-bar');
        clearInterval(tInt);
        tInt = setInterval(()=>{
             t--; b.style.width=(t/sec*100)+'%';
             if(t<=0) GameEngine.finish();
        }, 1000);
    },
    
    finish: () => {
        clearInterval(tInt);
        const ans = State.quiz.answers.filter(x=>x);
        const sc = ans.filter(x=>x.isCorrect).length;
        document.getElementById('sc-val').innerText = Math.round(sc/State.quiz.questions.length*100) + "%";
        document.getElementById('sc-txt').innerText = `${sc} / ${State.quiz.questions.length}`;
        UI.openModal('m-score');
    },
    confirmExit: () => { if(confirm("End Quiz?")) UI.goHome(); }
};
