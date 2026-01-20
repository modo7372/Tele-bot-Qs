const GameSelect = {
    step: 'term',

    startGlobalRandom: () => {
        // Fix: Removed "Always takes 30" logic -> Random 10 to 50
        const sub = GameSelect.filterPool(State.allQ);
        if(!sub.length) return alert('لا يوجد أسئلة (تأكد من الفلتر)');
        sub.sort(()=>Math.random()-0.5);
        const limit = Math.floor(Math.random() * 40) + 10;
        GameEngine.start(sub.slice(0, limit), 'normal', 'Global Random');
    },

    startFlow: (mode) => {
        State.quiz.mode = mode;
        State.selection = {term:null, subj:null, lessons:[], chapters:[], limit:'All'};
        GameSelect.renderSel('term');
        UI.showView('v-select');
    },

    renderSel: (step) => {
        GameSelect.step = step;
        const map = {term:'الترم/المصدر',subj:'المادة',lesson:'الدرس',chapter:'الفصل',limit:'العدد'};
        document.getElementById('sel-head').innerText = `اختر ${map[step]}`;
        const body = document.getElementById('sel-body'); body.innerHTML='';
        
        // Buttons
        document.getElementById('btn-mode-random').classList.add('hidden');
        document.getElementById('btn-all').classList.add('hidden');
        
        // 1. Get subset
        let subset = GameSelect.filterPool(State.allQ); // Respects filters
        if(State.selection.term) subset = subset.filter(q=>q.term==State.selection.term);
        if(State.selection.subj) subset = subset.filter(q=>q.subject==State.selection.subj);
        if(State.selection.lessons.length) subset = subset.filter(q=>State.selection.lessons.includes(q.lesson));
        
        if(!subset.length) { body.innerHTML='<p style="padding:10px">لا يوجد بيانات</p>'; return; }

        if (step !== 'term' && step !== 'limit') document.getElementById('btn-mode-random').classList.remove('hidden');

        // 2. Generate Options
        let items = [];
        let isMulti = false;

        if(step==='term') items = [...new Set(subset.map(q=>q.term))];
        else if(step==='subj') items = [...new Set(subset.map(q=>q.subject))];
        else if(step==='lesson') { items = [...new Set(subset.map(q=>q.lesson))]; isMulti=true; }
        else if(step==='chapter') { 
             items = [...new Set(subset.map(q=>q.chapter))]; isMulti=true; 
        }
        else if(step==='limit') {
            ['10','20','30','50','100','All'].forEach(l => GameSelect.addChip(l, false, body, true));
            return;
        }

        if(isMulti) document.getElementById('btn-all').classList.remove('hidden');
        items.sort().forEach(val => GameSelect.addChip(val, isMulti, body));
    },
    
    addChip: (val, multi, parent, isLimit=false) => {
        const d = document.createElement('div');
        d.className = 'chip'; d.innerText = val; d.dataset.val=val;
        d.onclick = () => {
             if(multi) d.classList.toggle('selected');
             else {
                 document.querySelectorAll('.chip').forEach(c=>c.classList.remove('selected'));
                 d.classList.add('selected');
                 // Auto move
                 if(GameSelect.step==='term') State.selection.term = val;
                 if(GameSelect.step==='subj') State.selection.subj = val;
                 if(isLimit) State.selection.limit = val;
                 GameSelect.nextSel();
             }
        };
        parent.appendChild(d);
    },

    nextSel: () => {
        const picked = Array.from(document.querySelectorAll('#sel-body .selected')).map(c=>c.dataset.val);
        if(GameSelect.step==='term') GameSelect.renderSel('subj');
        else if(GameSelect.step==='subj') GameSelect.renderSel('lesson');
        else if(GameSelect.step==='lesson') {
            if(!picked.length) return alert('اختر درسا واحدا');
            State.selection.lessons = picked;
            GameSelect.renderSel('chapter');
        }
        else if(GameSelect.step==='chapter') {
            if(!picked.length) return alert('اختر فصلا واحدا');
            State.selection.chapters = picked;
            GameSelect.renderSel('limit');
        }
        else if(GameSelect.step==='limit') {
            GameSelect.launch();
        }
    },
    
    prevSel: () => {
         const s = GameSelect.step;
         if(s=='term') UI.showView('v-home');
         if(s=='subj') GameSelect.renderSel('term');
         if(s=='lesson') GameSelect.renderSel('subj');
         if(s=='chapter') GameSelect.renderSel('lesson');
         if(s=='limit') GameSelect.renderSel('chapter');
    },

    launch: (rndMode=false) => {
        let pool = GameSelect.filterPool(State.allQ);
        // Apply Selection Context
        if(State.selection.term) pool = pool.filter(q=>q.term==State.selection.term);
        if(State.selection.subj) pool = pool.filter(q=>q.subject==State.selection.subj);
        
        if(!rndMode) {
             // Precise
             pool = pool.filter(q=>State.selection.lessons.includes(q.lesson) && State.selection.chapters.includes(q.chapter));
        }

        if(!pool.length) return alert('القائمة فارغة');
        pool.sort(()=>Math.random()-0.5);

        const l = State.selection.limit;
        if(l && l!=='All') pool = pool.slice(0, parseInt(l));
        
        GameEngine.start(pool, State.quiz.mode, State.selection.subj||'Quiz');
    },
    
    startRandomInMode: () => GameSelect.launch(true), // "Test from prev selections"
    toggleAll: () => document.querySelectorAll('#sel-body .chip').forEach(c=>c.classList.toggle('selected')),

    // --- Search Logic (Restored) ---
    searchWrong: () => {
        const wr = State.allQ.filter(q=>State.localData.mistakes.includes(q.id));
        if(!wr.length) return alert('لا يوجد أخطاء');
        UI.closeModal('m-search');
        GameEngine.start(wr, 'review', 'الأخطاء');
    },
    
    execSearch: () => {
        const id = document.getElementById('inp-search-id').value;
        const txt = document.getElementById('inp-search-txt').value.toLowerCase();
        let res = [];
        
        if(id) res = State.allQ.filter(q=>q.id==id);
        else if(txt) res = State.allQ.filter(q=>q.question.toLowerCase().includes(txt));
        
        if(!res.length) return alert('لم يتم العثور على شيء');
        UI.closeModal('m-search');
        GameEngine.start(res, 'review', `بحث: ${txt||id}`);
    },

    // --- Helpers ---
    filterPool: (arr) => {
        const f = State.filters;
        if(f==='new') return arr.filter(q=>!State.localData.archive.includes(q.id));
        if(f==='wrong') return arr.filter(q=>State.localData.mistakes.includes(q.id));
        if(f==='answered') return arr.filter(q=>State.localData.archive.includes(q.id));
        return arr; // All
    },
    
    randomizeUI: () => {
        const r = THEMES[Math.floor(Math.random()*THEMES.length)];
        UI.setTheme(r.id);
    },
    
    luckyShot: () => {
        const pool = GameSelect.filterPool(State.allQ);
        if(!pool.length) return;
        const q = pool[Math.floor(Math.random()*pool.length)];
        GameEngine.start([q], 'lucky', 'Lucky Shot');
    }
};
