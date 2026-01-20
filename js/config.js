// --- CONFIGURATION ---

// Whitelist IDs for debug/locked mode (not strict security, just UI gate)
const ALLOWED_IDS = [ 5814737296, 2004826495 ]; 
const ENABLE_SECURITY = false; // Toggle lock screen

// Firebase
const FB_CONF = { apiKey: "AIzaSyDEZFJmcXK2LxYAZ-Yjv_M1HbC6zi_qilg", authDomain: "exambotdb.firebaseapp.com", databaseURL: "https://exambotdb-default-rtdb.firebaseio.com", projectId: "exambotdb", storageBucket: "exambotdb.firebasestorage.app", messagingSenderId: "950600562980", appId: "1:950600562980:web:f993c22d45e5cfdd3d9bb1" };
if (!firebase.apps.length) firebase.initializeApp(FB_CONF);
const db = firebase.database();

// State Object - Central Truth
const State = {
    user: { id: 0, first_name: "Guest", full_name: "Guest User" },
    
    // Core Data
    questionsIndex: [], // Array of file metadata {file: '...', term: '...', subject: '...'}
    activeQuizPool: [], // Questions loaded for current session
    
    // Quiz Session
    quiz: { 
        questions: [], 
        currentIndex: 0, 
        answers: [], // {qid:123, selected:1, correct:true/false}
        mode: 'normal', 
        startTime: 0 
    },
    
    // User Settings & History
    localData: {
        mistakes: [], // Array of Question IDs
        archive: [],  // Array of IDs user has answered at least once
        fav: [],
        settings: {},
        stats: { totalCorrect: 0, totalAttempts: 0 }
    },

    // UI State
    selection: { term:null, subject:null, lessons:[], limit: 50 },
    filters: 'all' // all, new, wrong, answered
};

// Available Themes
const THEMES = [
    { id: 'light', color: '#f5f7fa' },
    { id: 'dark', color: '#232526' },
    { id: 'midnight', color: '#0f2027' },
    { id: 'forest', color: '#134E5E' },
    { id: 'ocean', color: '#4facfe' }
];
