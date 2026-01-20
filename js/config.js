const ALLOWED_IDS = [ 5814737296 ];
const ENABLE_SECURITY = false; // Set true to enable ID lock

const State = {
    user: { id: 0, first_name: "Guest", full_name: "Guest" },
    
    // Core Database (All questions loaded here)
    allQ: [], 
    
    // Quiz Runtime State
    quiz: { 
        questions: [], currentIndex: 0, answers: [], mode: 'normal', topic: '' 
    },
    
    // Persisted Data (Saved to storage)
    localData: {
        mistakes: [], archive: [], fav: [], settings: {}
    },

    // UI Helper State
    selection: { term:null, subj:null, lessons:[], limit:50 },
    filters: 'all' // all, new, wrong, answered
};

// Available CSS Themes
const THEMES = ['light', 'dark', 'midnight', 'forest', 'sunset', 'ocean'];
