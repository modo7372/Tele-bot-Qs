// js/config.js

const ALLOWED_IDS = [ 5814737296, 2004826495 ]; 
const ENABLE_SECURITY = false; // Set true in production

// Firebase Config
const FB_CONF = { apiKey: "AIzaSyDEZFJmcXK2LxYAZ-Yjv_M1HbC6zi_qilg", authDomain: "exambotdb.firebaseapp.com", databaseURL: "https://exambotdb-default-rtdb.firebaseio.com", projectId: "exambotdb", storageBucket: "exambotdb.firebasestorage.app", messagingSenderId: "950600562980", appId: "1:950600562980:web:f993c22d45e5cfdd3d9bb1" };
if (!firebase.apps.length) firebase.initializeApp(FB_CONF);
const db = firebase.database();

// Theme Definitions
const THEMES = [
    { id: 'light', name: 'Light', color: '#f5f7fa' },
    { id: 'dark', name: 'Dark', color: '#232526' },
    { id: 'midnight', name: 'Midnight', color: '#0f2027' },
    { id: 'forest', name: 'Forest', color: '#134E5E' },
    { id: 'ocean', name: 'Ocean', color: '#4facfe' },
    { id: 'sunset', name: 'Sunset', color: '#f6d365' },
    { id: 'lavender', name: 'Lavender', color: '#cd9cf2' },
    { id: 'coffee', name: 'Coffee', color: '#3e2b26' },
    { id: 'hacker', name: 'Hacker', color: '#000000' },
    { id: 'minimal', name: 'Minimal', color: '#ffffff' }
];

const State = {
    user: { id: 0, first_name: "Guest" },
    allQ: [], pool: [], quiz: [], qIdx: 0, score: 0, mode: 'normal',
    localData: { mistakes: [], archive: [], fav: [], settings: {} },
    sel: { term:null, subj:null, lessons:[], chapters:[], limit:'All' }
};
