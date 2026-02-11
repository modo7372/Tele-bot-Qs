/* --- START OF FILE ui.js --- */

const UI = {
    init: () => {
        console.log("🎨 UI Initializing...");
        
        // Initialize theme
        const savedTheme = State.localData.settings?.theme || 'light';
        UI.setTheme(savedTheme);
        
        // Initialize animation state
        if (State.localData.settings?.anim === false) {
            UI.toggleAnim(false);
        } else {
            UI.initAnim(true);
        }
        
        // Initialize sound/haptic settings
        const soundEnabled = State.localData.settings?.sound !== false;
        const hapticEnabled = State.localData.settings?.haptic !== false;
        document.getElementById('chk-sound').checked = soundEnabled;
        document.getElementById('chk-haptic').checked = hapticEnabled;
        
        // Initialize font size
        const fontSize = State.localData.settings?.fontSize || '14px';
        document.getElementById('set-size').value = fontSize;
        UI.updateStyleVar('--font-size', fontSize);
        
        // Initialize gender/avatar
        const gender = State.localData.settings?.gender || 'male';
        document.getElementById('set-gender').value = gender;
        UI.renderAvatarList(gender);
        
        // Update profile display
        UI.updateProfileDisplay();
        UI.updateHomeStats();
        
        // Setup theme list
        UI.renderThemeList();
        
        // Setup auto-hide checkbox
        const autoHide = State.localData.settings?.hideIrrelevant === true;
        document.getElementById('chk-auto-hide-main').checked = autoHide;
        
        console.log("✅ UI Initialized");
    },

    showView: (viewId) => {
        // Hide all views
        ['v-home', 'v-select', 'v-quiz', 'v-pdf'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        
        // Show target view
        const target = document.getElementById(viewId);
        if (target) {
            target.classList.remove('hidden');
            // Scroll to top
            window.scrollTo(0, 0);
        }
    },

    goHome: () => {
        UI.showView('v-home');
        UI.updateHomeStats();
        Game.stopTimer();
        clearTimeout(autoNavTimer);
    },

    openModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        }
    },

    closeModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            // Restore body scroll
            document.body.style.overflow = '';
        }
    },

    setTheme: (themeId) => {
        document.body.setAttribute('data-theme', themeId);
        State.localData.settings.theme = themeId;
        
        // Update Telegram header color if available
        if (window.Telegram?.WebApp?.isVersionAtLeast('6.1')) {
            const primary = getComputedStyle(document.body).getPropertyValue('--primary').trim();
            if (primary) window.Telegram.WebApp.setHeaderColor(primary);
        }
        
        // Re-render theme list to update selection
        UI.renderThemeList();
    },

    renderThemeList: () => {
        const container = document.getElementById('theme-list');
        if (!container) return;
        
        container.innerHTML = '';
        THEMES.forEach(theme => {
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.style.background = theme.color;
            chip.style.color = theme.id === 'light' || theme.id === 'minimal' || theme.id === 'mint' ? '#333' : '#fff';
            chip.innerText = theme.name;
            
            if (State.localData.settings?.theme === theme.id) {
                chip.classList.add('selected');
            }
            
            chip.onclick = () => {
                Game.triggerHaptic('selection');
                UI.setTheme(theme.id);
                Data.saveData();
            };
            
            container.appendChild(chip);
        });
    },

    initAnim: (active) => {
        const canvas = document.getElementById('bg-canvas');
        if (!canvas) return;
        
        if (active) {
            canvas.style.display = 'block';
            UI.startBubbleAnimation();
        } else {
            canvas.style.display = 'none';
            UI.stopBubbleAnimation();
        }
        State.localData.settings.anim = active;
    },

    toggleAnim: (val) => {
        document.getElementById('chk-anim').checked = val;
        UI.initAnim(val);
    },

    startBubbleAnimation: () => {
        const canvas = document.getElementById('bg-canvas');
        if (!canvas || !canvas.getContext) return;
        
        const ctx = canvas.getContext('2d');
        let width, height;
        let bubbles = [];
        let animationId;
        
        const resize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        
        class Bubble {
            constructor() {
                this.reset();
            }
            
            reset() {
                this.x = Math.random() * width;
                this.y = height + Math.random() * 100;
                this.size = Math.random() * 20 + 5;
                this.speed = Math.random() * 1 + 0.5;
                this.opacity = Math.random() * 0.5 + 0.1;
            }
            
            update() {
                this.y -= this.speed;
                if (this.y < -50) this.reset();
            }
            
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(108, 92, 231, ${this.opacity})`;
                ctx.fill();
            }
        }
        
        const init = () => {
            resize();
            bubbles = Array(20).fill().map(() => new Bubble());
        };
        
        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            bubbles.forEach(b => {
                b.update();
                b.draw();
            });
            animationId = requestAnimationFrame(animate);
        };
        
        init();
        animate();
        
        window.addEventListener('resize', resize);
        
        // Store reference to stop later
        UI._bubbleAnim = { id: animationId, bubbles };
    },

    stopBubbleAnimation: () => {
        if (UI._bubbleAnim?.id) {
            cancelAnimationFrame(UI._bubbleAnim.id);
        }
    },

    updateProfileDisplay: () => {
        const nameEl = document.getElementById('u-name');
        const avatarEl = document.getElementById('u-avatar');
        
        if (nameEl) nameEl.innerText = State.user.first_name || 'Guest';
        
        if (avatarEl) {
            const avatar = State.localData.settings?.avatar || '👤';
            avatarEl.innerText = avatar;
        }
    },

    renderAvatarList: (gender) => {
        const container = document.getElementById('avatar-list');
        if (!container) return;
        
        const maleAvatars = ['👨‍⚕️', '👨‍💼', '👨‍🎓', '🧑‍🔬', '👨', '🤵', '👨‍🔧', '🦸‍♂️'];
        const femaleAvatars = ['👩‍⚕️', '👩‍💼', '👩‍🎓', '👩‍🔬', '👩', '👸', '👩‍🔧', '🦸‍♀️'];
        
        const avatars = gender === 'female' ? femaleAvatars : maleAvatars;
        
        container.innerHTML = '';
        avatars.forEach(avatar => {
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.innerText = avatar;
            chip.style.fontSize = '1.5em';
            
            if (State.localData.settings?.avatar === avatar) {
                chip.classList.add('selected');
            }
            
            chip.onclick = () => {
                State.localData.settings.avatar = avatar;
                State.localData.settings.gender = gender;
                UI.updateProfileDisplay();
                UI.renderAvatarList(gender);
                Data.saveData();
                Game.triggerHaptic('selection');
            };
            
            container.appendChild(chip);
        });
    },

    saveProfile: () => {
        const gender = document.getElementById('set-gender').value;
        State.localData.settings.gender = gender;
        UI.renderAvatarList(gender);
        Data.saveData();
    },

    updateHomeStats: () => {
        const total = State.allQ.length;
        const archive = State.localData.archive?.length || 0;
        const correct = State.localData.archive?.length - State.localData.mistakes?.length || 0;
        const pct = total > 0 ? Math.round((archive / total) * 100) : 0;
        
        const pctEl = document.getElementById('home-pct');
        const correctEl = document.getElementById('home-correct');
        const totalEl = document.getElementById('home-total');
        const ring = document.getElementById('home-progress-ring');
        
        if (pctEl) pctEl.innerText = pct + '%';
        if (correctEl) correctEl.innerText = correct;
        if (totalEl) totalEl.innerText = total;
        
        if (ring) {
            ring.style.background = `conic-gradient(var(--primary) ${pct}%, transparent ${pct}%)`;
        }
    },

    showTotalStats: () => {
        const total = State.allQ.length;
        const archive = State.localData.archive?.length || 0;
        const mistakes = State.localData.mistakes?.length || 0;
        const correct = archive - mistakes;
        const solvedPct = total > 0 ? Math.round((archive / total) * 100) : 0;
        const accPct = archive > 0 ? Math.round((correct / archive) * 100) : 0;
        
        document.getElementById('st-total').innerText = total;
        document.getElementById('st-solved').innerText = solvedPct + '%';
        document.getElementById('st-correct').innerText = correct;
        document.getElementById('st-wrong').innerText = mistakes;
        document.getElementById('st-acc').innerText = accPct + '%';
        
        const bar = document.getElementById('st-bar');
        if (bar) bar.style.width = accPct + '%';
        
        UI.openModal('m-stats');
    },

    toggleSound: (val) => {
        State.localData.settings.sound = val;
        Data.saveData();
    },

    toggleHaptic: (val) => {
        State.localData.settings.haptic = val;
        Data.saveData();
    },

    updateStyleVar: (varName, value) => {
        document.documentElement.style.setProperty(varName, value);
        if (varName === '--font-size') {
            State.localData.settings.fontSize = value;
            Data.saveData();
        }
    },

    toggleAutoHide: (val) => {
        State.localData.settings.hideIrrelevant = val;
        Data.saveData();
        // Update current quiz state if in quiz
        State.showIrrelevantOptions = !val;
    }
};
