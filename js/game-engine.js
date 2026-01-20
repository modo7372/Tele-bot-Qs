// Controls the quiz Flow
let timerInterval;

const GameEngine = {
    
    instant: true,
    
    setFilter: (val) => { State.filters = val; },
    toggleInstant: (v) => { GameEngine.instant = v; },

    start: (questions, mode, topicTitle) => {
        State.quiz.questions = questions;
        State.quiz.mode = mode; // review, survival, lucky, timeAttack
        State.quiz.currentIndex = 0;
        State.quiz.answers = new Array(questions.length).fill(null); // {id, choice, isCorrect}
        State.quiz.startTime = Date.now();
        State.quiz.topic = topicTitle;

        // View Setup
        UI.showView('v-quiz');
        
        // Hiding/Showing relevant buttons
        const isReview = (mode === 'review');
        document.getElementById('btn-show-ans').classList.toggle('hidden', !isReview);
        document.getElementById('btn-check').classList.add('hidden');
        
        // Timer
        document.getElementById('timer-bar').style.display = (mode==='timeAttack') ? 'block' : 'none';
        
        GameEngine.renderQuestion();
        
        if (mode === 'timeAttack') GameEngine.startTimer(60); 
    },
    
    stop: () => {
        clearInterval(timerInterval);
    },

    renderQuestion: () => {
        const i = State.quiz.currentIndex;
        const q = State.quiz.questions[i];
        
        document.getElementById('q-id').innerText = q.id;
        document.getElementById('q-idx').innerText = `${i+1}/${State.quiz.questions.length}`;
        document.getElementById('q-path').innerText = State.quiz.topic || 'General';
        
        // Handling Fav Button
        const btnFav = document.getElementById('btn-fav-icon');
        btnFav.style.color = State.localData.fav.includes(q.id) ? 'var(--primary)' : 'var(--txt-sec)';
        btnFav.innerText = State.localData.fav.includes(q.id) ? '★' : '☆';

        document.getElementById('q-txt').innerText = q.question;
        
        const optsDiv = document.getElementById('q-opts');
        optsDiv.innerHTML = '';
        document.getElementById('q-exp').classList.add('hidden');
        document.getElementById('btn-check').classList.add('hidden');

        // Render Options
        q.options.forEach((optText, optIdx) => {
             const div = document.createElement('div');
             div.className = 'opt';
             div.innerText = optText;
             
             // Check Previous State
             const ans = State.quiz.answers[i];
             if (ans) {
                 div.style.pointerEvents = 'none';
                 if (optIdx === q.correct_option_id) div.classList.add('correct');
                 else if (optIdx === ans.choice) div.classList.add('wrong');
             }

             div.onclick = () => GameEngine.selectOption(optIdx, div);
             optsDiv.appendChild(div);
        });

        // Review mode automatically shows answer explanation if available and already answered/viewing
        if (State.quiz.mode === 'review' || State.quiz.answers[i]) {
            if (State.quiz.answers[i]) GameEngine.showExplanation();
        }
    },

    selectOption: (optIdx, el) => {
        if (State.quiz.answers[State.quiz.currentIndex]) return; // Already answered

        // UI Feedback (temp selection)
        document.querySelectorAll('.opt').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        
        // Logic
        if (GameEngine.instant || State.quiz.mode === 'survival' || State.quiz.mode === 'timeAttack') {
            GameEngine.submitAnswer(optIdx);
        } else {
            // Wait for confirmation button
            document.getElementById('btn-check').classList.remove('hidden');
        }
    },
    
    checkManual: () => {
        const el = document.querySelector('.opt.selected');
        if(!el) return;
        // Determine Index
        const parent = el.parentNode;
        const idx = Array.prototype.indexOf.call(parent.children, el);
        GameEngine.submitAnswer(idx);
    },

    submitAnswer: (idx) => {
        const i = State.quiz.currentIndex;
        const q = State.quiz.questions[i];
        const isCorrect = (idx === q.correct_option_id);
        
        // Save State
        State.quiz.answers[i] = { id: q.id, choice: idx, isCorrect: isCorrect };

        // UI Reveal
        const opts = document.querySelectorAll('.opt');
        opts[q.correct_option_id].classList.add('correct');
        opts[idx].classList.remove('selected'); // Remove temp style
        if(!isCorrect) opts[idx].classList.add('wrong');

        // Logic Consequences
        if (isCorrect) {
            UI.playSound('correct');
            UI.haptic('success');
            // Remove from mistakes if it was there
            State.localData.mistakes = State.localData.mistakes.filter(x => x !== q.id);
        } else {
            UI.playSound('wrong');
            UI.haptic('error');
            // Add to mistakes
            if(!State.localData.mistakes.includes(q.id)) State.localData.mistakes.push(q.id);
            
            if (State.quiz.mode === 'survival') {
                setTimeout(()=> { alert('🔥 Game Over!'); GameEngine.finishQuiz(); }, 500);
                return;
            }
        }

        // Add to Archive (Solved)
        if(!State.localData.archive.includes(q.id)) State.localData.archive.push(q.id);
        Data.save();

        GameEngine.showExplanation();
        document.getElementById('btn-check').classList.add('hidden');

        // Auto Move (if normal mode)
        if (GameEngine.instant && State.quiz.mode !== 'review' && isCorrect) {
            setTimeout(() => {
                // Only move if user hasn't moved manually yet
                if (State.quiz.currentIndex === i) GameEngine.navQ(1);
            }, 1000); // 1 second delay for correct answers
        }
    },

    showExplanation: () => {
         const q = State.quiz.questions[State.quiz.currentIndex];
         if(q.explanation) {
             const div = document.getElementById('q-exp');
             div.innerText = q.explanation;
             div.classList.remove('hidden');
         }
    },

    // Used in Review Mode to peek without answering
    toggleAnswerView: () => {
        const i = State.quiz.currentIndex;
        if (State.quiz.answers[i]) return; // already done
        
        const q = State.quiz.questions[i];
        // Simulate correct answer simply to show visual
        const opts = document.querySelectorAll('.opt');
        opts[q.correct_option_id].classList.add('correct');
        GameEngine.showExplanation();
    },

    navQ: (dir) => {
        const next = State.quiz.currentIndex + dir;
        if (next >= 0 && next < State.quiz.questions.length) {
            State.quiz.currentIndex = next;
            GameEngine.renderQuestion();
        } else if (next >= State.quiz.questions.length && State.quiz.mode !== 'review') {
            GameEngine.finishQuiz();
        }
    },
    
    startTimer: (seconds) => {
        let t = seconds;
        const bar = document.getElementById('timer-bar');
        clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
             t--;
             bar.style.width = (t/seconds*100) + "%";
             if(t <= 0) {
                 clearInterval(timerInterval);
                 alert('⏰ الوقت انتهى');
                 GameEngine.finishQuiz();
             }
        }, 1000);
    },
    
    toggleFav: () => {
         const q = State.quiz.questions[State.quiz.currentIndex];
         if(State.localData.fav.includes(q.id)) State.localData.fav = State.localData.fav.filter(x=>x!=q.id);
         else State.localData.fav.push(q.id);
         Data.save();
         GameEngine.renderQuestion(); // Re-render button
         UI.haptic('selection');
    },

    finishQuiz: () => {
        GameEngine.stop();
        const answers = State.quiz.answers.filter(a => a);
        const score = answers.filter(a => a.isCorrect).length;
        const total = State.quiz.questions.length; // Count attempted? No count Total quiz size.
        
        const pct = Math.round((score/total)*100);
        
        // Report to Database
        // If not review/search
        if (State.quiz.mode === 'normal' || State.quiz.mode === 'timeAttack' || State.quiz.mode === 'survival') {
             Data.reportScore(State.quiz.topic, score);
        }

        // Show Score Modal
        document.getElementById('sc-val').innerText = `${pct}%`;
        document.getElementById('sc-txt').innerText = `إجابة صحيحة: ${score} من ${total}`;
        
        UI.openModal('m-score');
        UI.playSound('correct');
    },
    
    confirmExit: () => {
        if(confirm('إنهاء الاختبار والعودة للقائمة؟')) UI.goHome();
    }
};
