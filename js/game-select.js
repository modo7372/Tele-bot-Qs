const GameSelect = {
    step: 'term', // current step

    startGlobalRandom: () => {
        let pool = GameSelect.filterPool(State.allQ);
        if(!pool.length) return alert('No questions found (Check Filter)');
        
        pool.sort(()=>Math.random()-0.5);
        
        // Logic: 10 to 50 questions
        const max = 50; 
        const min = 10;
        const limit = Math.floor(Math.random() * (max - min + 1)) + min; 
        
        GameEngine.start(pool.slice(0, limit), 'normal', 'Global Random');
    },

    startFlow: (mode) => {
        State.quiz.mode = mode;
        State.selection = { term:null, subj:null, lessons:[], limit:50 };
        GameSelect.render('term');
        UI.showView('v-select');
    },

    // Step Rendering
    render: (step) => {
        GameSelect.step = step;
        const map = {term:'Source/Term', subj:'Subject', lesson:'Lesson', limit:'Limit'};
        document.getElementById('sel-head').innerText = "Select " + map[step];
        const body = document.getElementById('sel-body'); body.innerHTML = '';

        // Context Buttons
        document.getElementById('btn-all').classList.add('hidden');
        document.getElementById('btn-mode-rnd').classList.add('hidden');
        if(step!=='term' && step!=='limit') document.getElementById('btn-mode-rnd').classList.remove('hidden');

        // Filter Source Data
        let subset = GameSelect.filterPool(State.allQ);
        if(State.selection.term) subset = subset.filter(q=>q.term == State.selection.term);
        if(State.selection.subj) subset = subset.filter(q=>q.subject == State.selection.subj);

        if(!subset.length) return body.innerHTML = '<div style="padding:20px; text-align:center; opacity:0.6">No Questions</div>';

        // Extract Uniques
        let items = [];
        let multi = false;
        
        if(step==='term') items = [...new Set(subset.map(q=>q.term))];
        else if(step==='subj') items = [...new Set(subset.map(q=>q.subject))];
        else if(step==='lesson') { items = [...new Set(subset.map(q=>q.lesson))]; multi=true; }
        else if(step==='limit') { ['10','20','30','50','100','All'].forEach(l=>GameSelect.addChip(l,false)); return; }

        if(multi) document.getElementById('btn-all').classList.remove('hidden');

        // Build UI
        const wrap = document.createElement('div'); wrap.className='scroll-chips';
        items.sort().forEach(val => {
            const el = document.createElement('div'); el.className='chip'; el.innerText = val; el.dataset.val=val;
            el.onclick = () => {
                if(multi) el.classList.toggle('selected');
                else { GameSelect.applySel(val); GameSelect.nextSel(); }
            };
            wrap.appendChild(el);
        });
        body.appendChild(wrap);
    },

    // UI Helpers
    addChip: (v, multi) => {
         const el = document.createElement('div'); el.className='chip'; el.innerText=v; el.dataset.val=v;
         el.onclick = () => { 
             document.querySelectorAll('#sel-body .chip').forEach(x=>x.classList.remove('selected'));
             el.classList.add('selected'); 
             GameSelect.applySel(v); 
             GameSelect.launch();
         };
         document.getElementById('sel-body').appendChild(el);
    },

    nextSel: () => {
        const picked = Array.from(document.querySelectorAll('#sel-body .selected')).map(c=>c.dataset.val);
        const s = GameSelect.step;

        if(s==='term') GameSelect.render('subj');
        else if(s==='subj') GameSelect.render('lesson');
        else if(s==='lesson') {
             if(!picked.length) return alert('Select at least one');
             State.selection.lessons = picked;
             GameSelect.render('limit');
        }
    },
    
    prevSel: () => {
        const s = GameSelect.step;
        if(s==='term') UI.showView('v-home');
        if(s==='subj') GameSelect.render('term');
        if(s==='lesson') GameSelect.render('subj');
        if(s==='limit') GameSelect.render('lesson');
    },

    applySel: (v) => {
        if(GameSelect.step==='term') State.selection.term = v;
        if(GameSelect.step==='subj') State.selection.subj = v;
        if(GameSelect.step==='limit') State.selection.limit = v;
    },
    
    toggleAll: () => document.querySelectorAll('#sel-body .chip').forEach(c=>c.classList.toggle('selected')),

    // --- EXECUTION ---
    filterPool: (arr) => {
        const f = State.filters;
        if(f==='new') return arr.filter(q=>!State.localData.archive.includes(q.id));
        if(f==='wrong') return arr.filter(q=>State.localData.mistakes.includes(q.id));
        if(f==='answered') return arr.filter(q=>State.localData.archive.includes(q.id));
        return arr; // All
    },

    launch: (rndMode=false) => {
        let p = GameSelect.filterPool(State.allQ);
        p = p.filter(q=>q.term==State.selection.term && q.subject==State.selection.subj);
        if(!rndMode) p = p.filter(q=>State.selection.lessons.includes(q.lesson));
        
        if(!p.length) return alert('No data');
        
        p.sort(()=>Math.random()-0.5);
        if(State.selection.limit!=='All') p = p.slice(0, parseInt(State.selection.limit));
        
        GameEngine.start(p, State.quiz.mode, State.selection.subj);
    },

    startRandomInMode: () => GameSelect.launch(true),

    // Search
    searchWrong: () => {
         const m = State.allQ.filter(q=>State.localData.mistakes.includes(q.id));
         if(m.length) { UI.closeModal('m-search'); GameEngine.start(m,'review','My Mistakes'); }
         else alert('No mistakes found');
    },
    
    execSearch: () => {
        const id = document.getElementById('inp-search-id').value;
        const txt = document.getElementById('inp-search-txt').value.toLowerCase();
        let r = [];
        if(id) r = State.allQ.filter(q=>q.id==id);
        else if(txt) r = State.allQ.filter(q=>q.question.toLowerCase().includes(txt));
        
        if(r.length) { UI.closeModal('m-search'); GameEngine.start(r, 'review', `Search: ${id||txt}`); }
        else alert('No results');
    },

    // Archive / Utils
    startArchive: (mode) => {
         const a = State.allQ.filter(q=>State.localData.archive.includes(q.id));
         if(!a.length) return alert('Empty Archive');
         UI.closeModal('m-archive');
         GameEngine.start(a, mode==='view'?'review':'normal', 'Archive');
    },
    
    startFavMode: () => {
         const a = State.allQ.filter(q=>State.localData.fav.includes(q.id));
         if(!a.length) return alert('No Favorites');
         UI.closeModal('m-archive');
         GameEngine.start(a, 'normal', 'Favorites');
    },
    
    luckyShot: () => {
         const pool = GameSelect.filterPool(State.allQ);
         if(pool.length) GameEngine.start([pool[Math.floor(Math.random()*pool.length)]], 'lucky', 'Lucky');
    },
    
    randomTheme: () => {
        const r = THEMES[Math.floor(Math.random()*THEMES.length)];
        UI.saveSetting('theme', r); UI.applySettings();
    }
};
