const UI = {
    init: () => {
        console.log("🎨 UI Initializing...");
        
        const savedTheme = State.localData.settings?.theme || 'light';
        UI.setTheme(savedTheme);
        
        if (State.localData.settings?.anim === false) {
            UI.toggleAnim(false);
        } else {
            UI.initAnim(true);
        }
        
        const soundEnabled = State.localData.settings?.sound !== false;
        const hapticEnabled = State.localData.settings?.haptic !== false;
        document.getElementById('chk-sound').checked = soundEnabled;
        document.getElementById('chk-haptic').checked = hapticEnabled;
        
        const fontSize = State.localData.settings?.fontSize || '14px';
        document.getElementById('set-size').value = fontSize;
        UI.updateStyleVar('--font-size', fontSize);
        
        const gender = State.localData.settings?.gender || 'male';
        document.getElementById('set-gender').value = gender;
        UI.renderAvatarList(gender);
        
        UI.updateProfileDisplay();
        UI.updateHomeStats();
        UI.renderThemeList();
        
        const autoHide = State.localData.settings?.hideIrrelevant === true;
        document.getElementById('chk-auto-hide-main').checked = autoHide;
        
        UI.renderTermSelector();
        UI.updateActiveTermIndicator();
        
        console.log("✅ UI Initialized");
    },

    showView: (viewId) => {
        ['v-home', 'v-select', 'v-quiz', 'v-pdf'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        
        const target = document.getElementById(viewId);
        if (target) {
            target.classList.remove('hidden');
            window.scrollTo(0, 0);
        }
    },

    goHome: () => {
        UI.showView('v-home');
        UI.updateHomeStats();
        UI.updateActiveTermIndicator();
        if(typeof Game !== 'undefined') Game.stopTimer();
    },

    openModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    },

    closeModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    },

    setTheme: (themeId) => {
        document.body.setAttribute('data-theme', themeId);
        State.localData.settings.theme = themeId;
        
        if (window.Telegram?.WebApp?.isVersionAtLeast('6.1')) {
            const primary = getComputedStyle(document.body).getPropertyValue('--primary').trim();
            if (primary) window.Telegram.WebApp.setHeaderColor(primary);
        }
        
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
            chip.style.color = ['light', 'minimal', 'mint'].includes(theme.id) ? '#333' : '#fff';
            chip.innerText = theme.name;
            
            if (State.localData.settings?.theme === theme.id) {
                chip.classList.add('selected');
            }
            
            chip.onclick = () => {
                if(typeof Game !== 'undefined') Game.triggerHaptic('selection');
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
        let width, height, bubbles = [], animationId;
        
        const resize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        
        class Bubble {
            constructor() { this.reset(); }
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
        
        resize();
        bubbles = Array(20).fill().map(() => new Bubble());
        
        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            bubbles.forEach(b => { b.update(); b.draw(); });
            animationId = requestAnimationFrame(animate);
        };
        
        animate();
        window.addEventListener('resize', resize);
        UI._bubbleAnim = { id: animationId };
    },

    stopBubbleAnimation: () => {
        if (UI._bubbleAnim?.id) cancelAnimationFrame(UI._bubbleAnim.id);
    },

    updateProfileDisplay: () => {
        const nameEl = document.getElementById('u-name');
        const avatarEl = document.getElementById('u-avatar');
        
        if (nameEl) nameEl.innerText = State.user.first_name || 'Guest';
        if (avatarEl) {
            avatarEl.innerText = State.localData.settings?.avatar || '👤';
        }
    },

    renderAvatarList: (gender) => {
        const container = document.getElementById('avatar-list');
        if (!container) return;
        
        const avatars = gender === 'female' 
            ? ['👩‍⚕️', '👩‍💼', '👩‍🎓', '👩‍🔬', '👩', '👸', '👩‍🔧', '🦸‍♀️']
            : ['👨‍⚕️', '👨‍💼', '👨‍🎓', '🧑‍🔬', '👨', '🤵', '👨‍🔧', '🦸‍♂️'];
        
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
                if(typeof Game !== 'undefined') Game.triggerHaptic('selection');
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
        let pool = [...State.allQ];
        if (State.globalSelectedTerms?.length > 0) {
            pool = pool.filter(q => State.globalSelectedTerms.includes(q.term));
        }
        
        const total = pool.length;
        const archive = State.localData.archive?.filter(id => {
            const q = State.allQ.find(x => x.id === id);
            return q && (State.globalSelectedTerms.length === 0 || State.globalSelectedTerms.includes(q.term));
        }).length || 0;
        
        const mistakes = State.localData.mistakes?.filter(id => {
            const q = State.allQ.find(x => x.id === id);
            return q && (State.globalSelectedTerms.length === 0 || State.globalSelectedTerms.includes(q.term));
        }).length || 0;
        
        const correct = archive - mistakes;
        const pct = total > 0 ? Math.round((archive / total) * 100) : 0;
        
        if (document.getElementById('home-pct')) document.getElementById('home-pct').innerText = pct + '%';
        if (document.getElementById('home-correct')) document.getElementById('home-correct').innerText = correct;
        if (document.getElementById('home-total')) document.getElementById('home-total').innerText = total;
        
        const ring = document.getElementById('home-progress-ring');
        if (ring) {
            ring.style.background = `conic-gradient(var(--primary) ${pct}%, transparent ${pct}%)`;
        }
    },

    showTotalStats: () => {
        let pool = [...State.allQ];
        if (State.globalSelectedTerms?.length > 0) {
            pool = pool.filter(q => State.globalSelectedTerms.includes(q.term));
        }
        
        const total = pool.length;
        const archive = State.localData.archive?.filter(id => {
            const q = State.allQ.find(x => x.id === id);
            return q && (State.globalSelectedTerms.length === 0 || State.globalSelectedTerms.includes(q.term));
        }).length || 0;
        
        const mistakes = State.localData.mistakes?.filter(id => {
            const q = State.allQ.find(x => x.id === id);
            return q && (State.globalSelectedTerms.length === 0 || State.globalSelectedTerms.includes(q.term));
        }).length || 0;
        
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
        State.showIrrelevantOptions = !val;
    },

    renderTermSelector: () => {
        const container = document.getElementById('term-selector-chips');
        if (!container) return;
        
        const terms = [...new Set(State.allQ.map(q => q.term))].filter(t => t).sort();
        
        if (terms.length === 0) {
            container.innerHTML = '<div style="color:var(--txt-sec); text-align:center; padding:10px;">جاري تحميل التروم...</div>';
            return;
        }
        
        container.innerHTML = '';
        terms.forEach(term => {
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.innerText = term;
            chip.dataset.term = term;
            
            if (State.globalSelectedTerms.includes(term)) {
                chip.classList.add('selected');
            }
            
            chip.onclick = () => {
                if(typeof Game !== 'undefined') Game.triggerHaptic('selection');
                chip.classList.toggle('selected');
                
                const termValue = chip.dataset.term;
                if (chip.classList.contains('selected')) {
                    if (!State.globalSelectedTerms.includes(termValue)) {
                        State.globalSelectedTerms.push(termValue);
                    }
                } else {
                    State.globalSelectedTerms = State.globalSelectedTerms.filter(t => t !== termValue);
                }
                
                UI.updateActiveTermIndicator();
                UI.updateHomeStats();
                Data.saveData();
            };
            
            container.appendChild(chip);
        });
        
        UI.updateActiveTermIndicator();
    },

    updateActiveTermIndicator: () => {
        const indicator = document.getElementById('active-term-indicator');
        const list = document.getElementById('active-terms-list');
        
        if (!indicator || !list) return;
        
        if (State.globalSelectedTerms.length === 0) {
            indicator.classList.add('hidden');
        } else {
            indicator.classList.remove('hidden');
            list.innerText = State.globalSelectedTerms.join(' + ');
        }
    }
};
