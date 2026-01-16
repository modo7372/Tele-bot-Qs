// js/data.js

const Data = {
    loadQuestions: async () => {
        try {
            const list = await (await fetch('questions_list.json')).json();
            for(let f of list) {
                try {
                    let d = await (await fetch(`Questions/${f}`)).json();
                    // Normalize data structure
                    State.allQ.push(...d.questions.map(q => ({
                        ...q, 
                        term: q.term || d.meta.source, 
                        subject: q.subject || d.meta.subject, 
                        lesson: q.lesson || d.meta.lesson, 
                        chapter: q.chapter || "General"
                    })));
                } catch(e){ console.warn("Skipped file:", f); }
            }
            document.getElementById('db-status').innerText = `${State.allQ.length} Questions Loaded`;
        } catch(e){ 
            document.getElementById('db-status').innerText = "Load Error"; 
        }
    },

    saveLeaderboard: (score, total) => {
        // Only save if context exists
        if(State.sel.term && State.sel.subj) {
            const context = `${State.sel.term}_${State.sel.subj}`.replace(/[.#$/\[\]]/g, "_");
            const userId = State.user.id;
            const userName = State.user.first_name || "Unknown";
            
            // Console Log as requested
            console.log(`📡 Stats Upload: UserID=${userId}, Name=${userName}, ScoreAdded=${score}, Context=${context}`);

            const ref = db.ref(`ranks/${context}/${userId}`);
            
            // Transaction to update score safely
            ref.transaction((currentData) => {
                if (currentData === null) {
                    return { score: score, name: userName };
                } else {
                    // Handle legacy data (if it was just a number)
                    let oldScore = (typeof currentData === 'object') ? currentData.score : currentData;
                    return { score: oldScore + score, name: userName };
                }
            });
        }
    }
};
