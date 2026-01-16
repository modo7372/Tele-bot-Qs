// js/config.js

// 🛑 ALLOWED TELEGRAM IDs
const ALLOWED_IDS = [ 5814737296, 2004826495 ]; 

// 🛑 SECURITY FLAG (Keep false for development)
const ENABLE_SECURITY = false; 

// Firebase Configuration
const FB_CONF = { 
    apiKey: "AIzaSyDEZFJmcXK2LxYAZ-Yjv_M1HbC6zi_qilg", 
    authDomain: "exambotdb.firebaseapp.com", 
    databaseURL: "https://exambotdb-default-rtdb.firebaseio.com", 
    projectId: "exambotdb", 
    storageBucket: "exambotdb.firebasestorage.app", 
    messagingSenderId: "950600562980", 
    appId: "1:950600562980:web:f993c22d45e5cfdd3d9bb1" 
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(FB_CONF);
}
const db = firebase.database();

// State Object
const State = {
    user: { id: 0, first_name: "Guest", username: null },
    allQ: [],
    pool: [],
    quiz: [],
    qIdx: 0,
    score: 0,
    mode: 'normal',
    localData: { 
        mistakes: JSON.parse(localStorage.getItem('mistakes')||'[]'), 
        archive: JSON.parse(localStorage.getItem('archive')||'[]'), 
        fav: JSON.parse(localStorage.getItem('fav')||'[]'),
        settings: JSON.parse(localStorage.getItem('settings')||'{}') // New
    },
    sel: { term:null, subj:null, lessons:[], chapters:[], limit:'All' }
};
