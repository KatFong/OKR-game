// --- Sound Engine (Web Audio API) ---
const SoundFX = {
    ctx: null,
    isMuted: false,
    init: function() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },
    playTone: function(freq, type, duration, vol = 0.1) {
        if (this.isMuted || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.stop(this.ctx.currentTime + duration);
    },
    playType: function() {
        this.playTone(800 + Math.random() * 200, 'square', 0.05, 0.03);
    },
    playPop: function() {
        this.playTone(400, 'sine', 0.1, 0.1);
        setTimeout(() => this.playTone(600, 'sine', 0.2, 0.1), 50);
    },
    playSend: function() {
        this.playTone(300, 'triangle', 0.1, 0.1);
        setTimeout(() => this.playTone(500, 'triangle', 0.1, 0.1), 80);
    },
    playSuccess: function() {
        this.playTone(440, 'square', 0.1, 0.1);
        setTimeout(() => this.playTone(554, 'square', 0.1, 0.1), 100);
        setTimeout(() => this.playTone(659, 'square', 0.4, 0.1), 200);
    }
};

// --- Particle System (Confetti) ---
function fireConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#f1c40f', '#e74c3c', '#3498db', '#9b59b6', '#2ecc71'];

    for (let i = 0; i < 100; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.5) * 20,
            size: Math.random() * 8 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 100
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;
        particles.forEach(p => {
            if (p.life > 0) {
                active = true;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.5;
                p.life--;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, p.size, p.size);
            }
        });
        if (active) requestAnimationFrame(animate);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    animate();
}

// --- Configuration & Constants ---
const defaultApiKey = "";
const SYSTEM_PROMPT = typeof window !== 'undefined' && window.SYSTEM_PROMPT ? window.SYSTEM_PROMPT : '';

// --- State Management ---
const state = {
    okrs: [],
    messages: [
        { id: 1, sender: 'npc', text: '你好，冒險者！我是公會導師「露米娜」。', timestamp: new Date() },
        { id: 1.1, sender: 'npc', text: '我們來制定屬於你的傳奇篇章吧。', timestamp: new Date() },
        { id: 1.2, sender: 'npc', text: '首先，請告訴我，你現階段最核心的「目標 (Objective)」是什麼？\n(請直接告訴我你想達成什麼願景，例如：成為小富婆、成為行業頂尖高手)', timestamp: new Date() }
    ],
    userApiKey: "",
    isLoading: false,
    isSidebarOpen: false,
    dailyTasks: [],
    tasksFilter: 'my'  // 'my' | 'ended' 獨立任務頁篩選
};

// --- DOM Elements ---
const els = {
    messagesContainer: document.getElementById('messages-container'),
    chatInput: document.getElementById('chat-input'),
    btnSend: document.getElementById('btn-send'),
    loadingIndicator: document.getElementById('loading-indicator'),
    sidebar: document.getElementById('sidebar'),
    modalApiKey: document.getElementById('modal-api-key'),
    inputApiKey: document.getElementById('input-api-key'),
    btnSettings: document.getElementById('btn-settings'),
    btnSound: document.getElementById('btn-sound'),
    btnSidebarToggle: document.getElementById('btn-sidebar-toggle'),
    sidebarBadge: document.getElementById('sidebar-badge'),
    btnCloseSidebar: document.getElementById('btn-close-sidebar'),
    btnSaveKey: document.getElementById('btn-save-key'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    totalQuestList: document.getElementById('total-quest-list'),
    totalQuestEmpty: document.getElementById('total-quest-empty'),
    dailyTaskInput: document.getElementById('daily-task-input'),
    btnAddDailyTask: document.getElementById('btn-add-daily-task'),
    dailyTasksList: document.getElementById('daily-tasks-list'),
    dailyTasksEmpty: document.getElementById('daily-tasks-empty'),
    viewChat: document.getElementById('view-chat'),
    viewTasks: document.getElementById('view-tasks'),
    btnTasksBack: document.getElementById('btn-tasks-back'),
    filterMyTasks: document.getElementById('filter-my-tasks'),
    filterEndedTasks: document.getElementById('filter-ended-tasks'),
    taskCardsList: document.getElementById('task-cards-list'),
    taskCardsEmpty: document.getElementById('task-cards-empty')
};

// --- Initialization ---
function init() {
    const savedOkrs = localStorage.getItem('pixel_chat_okrs');
    if (savedOkrs) state.okrs = JSON.parse(savedOkrs);

    const savedKey = localStorage.getItem('pixel_api_key');
    if (savedKey) state.userApiKey = savedKey;

    const savedDailyTasks = localStorage.getItem('pixel_daily_tasks');
    if (savedDailyTasks) state.dailyTasks = JSON.parse(savedDailyTasks);

    renderMessages();
    renderTotalQuestList();
    renderDailyTasks();
    lucide.createIcons();

    els.btnSend.addEventListener('click', handleSendMessage);
    els.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });

    document.addEventListener('click', () => SoundFX.init(), { once: true });

    els.btnSound.addEventListener('click', () => {
        SoundFX.isMuted = !SoundFX.isMuted;
        const icon = SoundFX.isMuted ? 'volume-x' : 'volume-2';
        els.btnSound.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5"></i>`;
        lucide.createIcons();
    });

    els.btnSettings.addEventListener('click', () => {
        els.inputApiKey.value = state.userApiKey;
        els.modalApiKey.classList.remove('hidden');
        SoundFX.playType();
    });

    els.btnSidebarToggle.addEventListener('click', () => {
        showTasksPage();
        SoundFX.playType();
    });
    els.btnTasksBack.addEventListener('click', () => {
        showChatPage();
        SoundFX.playType();
    });
    els.filterMyTasks.addEventListener('click', () => {
        state.tasksFilter = 'my';
        renderTaskCards();
        updateTasksFilterUI();
        SoundFX.playType();
    });
    els.filterEndedTasks.addEventListener('click', () => {
        state.tasksFilter = 'ended';
        renderTaskCards();
        updateTasksFilterUI();
        SoundFX.playType();
    });
    els.btnCloseSidebar.addEventListener('click', toggleSidebar);
    els.btnCloseModal.addEventListener('click', () => els.modalApiKey.classList.add('hidden'));
    els.btnSaveKey.addEventListener('click', () => {
        handleSaveKey();
        SoundFX.playSuccess();
    });

    els.btnAddDailyTask.addEventListener('click', addDailyTask);
    els.dailyTaskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addDailyTask();
    });
}

function getTodayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// --- Logic & Rendering ---
function showTasksPage() {
    if (els.viewChat) els.viewChat.classList.add('hidden');
    if (els.viewTasks) els.viewTasks.classList.remove('hidden');
    state.tasksFilter = 'my';
    updateTasksFilterUI();
    renderTaskCards();
    lucide.createIcons();
    if (els.sidebarBadge) els.sidebarBadge.classList.add('hidden');
}

function showChatPage() {
    if (els.viewTasks) els.viewTasks.classList.add('hidden');
    if (els.viewChat) els.viewChat.classList.remove('hidden');
    lucide.createIcons();
}

function updateTasksFilterUI() {
    if (!els.filterMyTasks || !els.filterEndedTasks) return;
    if (state.tasksFilter === 'my') {
        els.filterMyTasks.classList.add('bg-[#3498db]', 'text-[#f1c40f]');
        els.filterMyTasks.classList.remove('bg-[#34495e]', 'text-slate-300');
        els.filterEndedTasks.classList.remove('bg-[#3498db]', 'text-[#f1c40f]');
        els.filterEndedTasks.classList.add('bg-[#34495e]', 'text-slate-300');
    } else {
        els.filterEndedTasks.classList.add('bg-[#3498db]', 'text-[#f1c40f]');
        els.filterEndedTasks.classList.remove('bg-[#34495e]', 'text-slate-300');
        els.filterMyTasks.classList.remove('bg-[#3498db]', 'text-[#f1c40f]');
        els.filterMyTasks.classList.add('bg-[#34495e]', 'text-slate-300');
    }
}

function isOKRCompleted(okr) {
    return okr.keyResults.every(kr => kr.current >= kr.target);
}

function getOKRProgress(okr) {
    const total = okr.keyResults.length;
    const done = okr.keyResults.filter(kr => kr.current >= kr.target).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { done, total, pct };
}

function renderTaskCards() {
    if (!els.taskCardsList || !els.taskCardsEmpty) return;
    const isEnded = state.tasksFilter === 'ended';
    const list = state.okrs.filter(okr => isOKRCompleted(okr) === isEnded);
    els.taskCardsList.innerHTML = '';
    if (list.length === 0) {
        els.taskCardsList.classList.add('hidden');
        els.taskCardsEmpty.classList.remove('hidden');
        els.taskCardsEmpty.innerHTML = isEnded
            ? '<p class="font-bold">尚無已結束的任務</p><p class="mt-1">完成關鍵結果後會出現在這裡。</p>'
            : '<p class="font-bold">尚無任務</p><p class="mt-1">返回與露米娜制定 OKR，任務會出現在這裡。</p>';
        return;
    }
    els.taskCardsEmpty.classList.add('hidden');
    els.taskCardsList.classList.remove('hidden');
    list.forEach(okr => {
        const { done, total, pct } = getOKRProgress(okr);
        const completed = isOKRCompleted(okr);
        const card = document.createElement('div');
        card.className = 'bg-[#ecf0f1] border-2 border-black p-4 flex gap-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]';
        card.innerHTML = `
            <div class="shrink-0 w-12 h-12 sm:w-14 sm:h-14 border-2 border-black flex items-center justify-center bg-[#9b59b6] shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]">
                <i data-lucide="${completed ? 'check-circle' : 'target'}" class="w-6 h-6 sm:w-7 sm:h-7 text-white"></i>
            </div>
            <div class="flex-1 min-w-0">
                <h3 class="font-bold text-[#2c3e50] text-sm leading-tight mb-1">${escapeHtml(okr.objective)}</h3>
                <p class="text-xs text-[#2c3e50] mb-2">
                    ${completed ? '<i data-lucide="check" class="w-3.5 h-3.5 text-[#2ecc71] inline align-middle mr-0.5"></i> 今日已完成 ' + Math.min(100, pct) + '%' : done + '/' + total + ' 關鍵結果達成'}
                </p>
                <div class="w-full h-2 bg-[#2c3e50] border-2 border-black overflow-hidden">
                    <div class="h-full bg-[#e67e22] transition-all duration-300" style="width: ${Math.min(100, pct)}%"></div>
                </div>
            </div>
        `;
        els.taskCardsList.appendChild(card);
    });
    lucide.createIcons();
}

function toggleSidebar() {
    state.isSidebarOpen = !state.isSidebarOpen;
    if (state.isSidebarOpen) {
        els.sidebar.classList.remove('translate-x-full');
        els.sidebar.classList.add('translate-x-0');
        els.sidebarBadge.classList.add('hidden');
        renderTotalQuestList();
        renderDailyTasks();
        lucide.createIcons();
    } else {
        els.sidebar.classList.remove('translate-x-0');
        els.sidebar.classList.add('translate-x-full');
    }
}

function addMessage(text, sender = 'npc', animate = false) {
    const msgObj = {
        id: Date.now() + Math.random(),
        sender,
        text,
        timestamp: new Date()
    };
    state.messages.push(msgObj);

    if (animate) {
        renderSingleMessage(msgObj, true);
    } else {
        renderMessages();
    }
}

function formatText(text) {
    if (!text) return '';
    const lines = text.split('\n');
    let html = '<div class="space-y-1 w-full break-words">';

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) {
            html += '<div class="h-2"></div>';
            return;
        }
        if (trimmed.startsWith('### ')) {
            html += `<h3 class="text-base font-black text-[#e67e22] mt-3 mb-1 uppercase tracking-wider border-b-2 border-[#e67e22]/20 pb-1">${parseBold(trimmed.substring(4))}</h3>`;
        } else if (trimmed.startsWith('## ')) {
            html += `<h2 class="text-lg font-black text-[#d35400] mt-4 mb-2 uppercase tracking-widest border-b-2 border-[#d35400] pb-1">${parseBold(trimmed.substring(3))}</h2>`;
        } else if (trimmed.startsWith('# ')) {
            html += `<h1 class="text-xl font-black text-[#c0392b] mt-5 mb-3 uppercase tracking-widest border-b-4 border-[#c0392b] pb-1">${parseBold(trimmed.substring(2))}</h1>`;
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            html += `<div class="flex items-start pl-2 text-base sm:text-lg font-semibold"><span class="mr-2 font-bold text-[#3498db]">•</span><div class="flex-1">${parseBold(trimmed.substring(2))}</div></div>`;
        } else if (/^\d+\.\s/.test(trimmed)) {
            const match = trimmed.match(/^(\d+\.\s)(.*)/);
            if (match) {
                html += `<div class="flex items-start pl-2 text-base sm:text-lg font-semibold"><span class="mr-2 font-bold text-[#e67e22] font-mono">${match[1]}</span><div class="flex-1">${parseBold(match[2])}</div></div>`;
            }
        } else {
            html += `<div class="block text-base sm:text-lg font-semibold">${parseBold(line)}</div>`;
        }
    });
    html += '</div>';
    return html;
}

function parseBold(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-[#9b59b6]">$1</strong>');
}

const LUMINA_AVATAR_URL = 'assets/lumina-avatar.png';

function createMessageHTML(msg) {
    const isUser = msg.sender === 'user';
    const isSystem = msg.sender === 'system';

    let avatarIcon = 'sparkles';
    let avatarBg = 'bg-[#9b59b6]';

    if (isUser) {
        avatarIcon = 'user';
        avatarBg = 'bg-[#3498db]';
    } else if (isSystem) {
        avatarIcon = 'terminal';
        avatarBg = 'bg-[#95a5a6]';
    }

    const isLumina = !isUser && !isSystem;
    const avatarHTML = isLumina
        ? `<img src="${LUMINA_AVATAR_URL}" alt="露米娜" class="w-full h-full object-cover object-top" />`
        : `<i data-lucide="${avatarIcon}" class="text-white w-6 h-6"></i>`;

    let bubbleClass = `p-3 sm:p-4 border-2 border-black text-base sm:text-lg font-semibold leading-relaxed shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] max-w-3xl `;
    if (isUser) {
        bubbleClass += 'bg-white text-black rounded-tl-xl rounded-bl-xl rounded-br-xl';
    } else if (isSystem) {
        bubbleClass += 'bg-[#34495e] text-white border-slate-500 font-mono text-sm font-semibold';
    } else {
        bubbleClass += 'bg-[#ecf0f1] text-[#2c3e50] rounded-tr-xl rounded-br-xl rounded-bl-xl';
    }

    const senderName = isUser ? '' : (isSystem ? 'SYSTEM' : 'LUMINA (MENTOR)');
    const senderColor = isSystem ? 'text-[#bdc3c7]' : 'text-[#f1c40f]';

    return `
        <div class="shrink-0 w-10 h-10 sm:w-12 sm:h-12 border-2 border-black flex items-center justify-center overflow-hidden shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] ${avatarBg}">
            ${avatarHTML}
        </div>
        <div class="max-w-[85%] flex flex-col ${isUser ? 'items-end' : 'items-start'}">
            ${!isUser ? `<span class="${senderColor} text-xs font-bold mb-1 uppercase tracking-wider block">${senderName}</span>` : ''}
            <div class="${bubbleClass}">
                ${formatText(msg.text)}
            </div>
        </div>
    `;
}

function renderMessages() {
    const container = els.messagesContainer;
    container.innerHTML = '';
    state.messages.forEach(msg => {
        const wrapper = document.createElement('div');
        wrapper.className = `flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`;
        wrapper.innerHTML = createMessageHTML(msg);
        container.appendChild(wrapper);
    });
    container.appendChild(els.loadingIndicator);
    lucide.createIcons();
    container.scrollTop = container.scrollHeight;
}

function renderSingleMessage(msg, animate = false) {
    const container = els.messagesContainer;
    const wrapper = document.createElement('div');
    wrapper.className = `flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''} ${animate ? 'animate-pop' : ''}`;
    wrapper.innerHTML = createMessageHTML(msg);

    container.insertBefore(wrapper, els.loadingIndicator);
    lucide.createIcons();
    container.scrollTop = container.scrollHeight;

    if (animate && msg.sender !== 'user') SoundFX.playPop();
}

// --- 任務側欄：總任務 List ---
function renderTotalQuestList() {
    if (!els.totalQuestList || !els.totalQuestEmpty) return;
    if (state.okrs.length === 0) {
        els.totalQuestList.innerHTML = '';
        els.totalQuestList.classList.add('hidden');
        els.totalQuestEmpty.classList.remove('hidden');
        return;
    }
    els.totalQuestEmpty.classList.add('hidden');
    els.totalQuestList.classList.remove('hidden');
    els.totalQuestList.innerHTML = '';
    state.okrs.forEach(okr => {
        const okrEl = document.createElement('div');
        okrEl.className = "bg-white border-2 border-[#d2b48c] p-3 shadow-[4px_4px_0_0_rgba(210,180,140,0.5)]";
        let krsHtml = '';
        okr.keyResults.forEach(kr => {
            const percentage = Math.min(100, Math.max(0, (kr.current / kr.target) * 100));
            let barColor = "bg-blue-500";
            if (percentage >= 100) barColor = "bg-yellow-400";
            else if (percentage >= 70) barColor = "bg-green-500";
            else if (percentage < 30) barColor = "bg-red-500";
            krsHtml += `
                <div class="mb-3">
                    <div class="flex items-center gap-1.5 mb-1">
                        <i data-lucide="check-circle-2" class="w-3 h-3 ${kr.current >= kr.target ? "text-green-500" : "text-slate-300"}"></i>
                        <span class="text-xs font-bold ${kr.current >= kr.target ? "text-slate-400 line-through" : "text-slate-700"}">${kr.title}</span>
                    </div>
                    <div class="w-full font-mono mt-1">
                        <div class="w-full bg-slate-800 h-4 p-0.5 border-2 border-slate-600 relative">
                            <div class="h-full ${barColor} relative transition-all duration-500" style="width: ${percentage}%"></div>
                        </div>
                        <div class="text-[10px] text-right mt-0.5 font-bold text-slate-500">${kr.current}/${kr.target} ${kr.unit}</div>
                    </div>
                    <input type="range" min="0" max="${kr.target}" step="${kr.target/100}" value="${kr.current}"
                        class="w-full h-1 mt-1 bg-slate-200 rounded-none appearance-none cursor-pointer accent-black"
                        oninput="updateProgress(${okr.id}, ${kr.id}, this.value)">
                </div>
            `;
        });
        okrEl.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <span class="text-xs font-bold bg-[#f1c40f] text-black px-1 border border-black">QUEST</span>
                <button onclick="deleteOKR(${okr.id})" class="text-slate-400 hover:text-red-500">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
            <h3 class="font-bold text-slate-800 text-sm mb-3 leading-tight">${okr.objective}</h3>
            <div class="space-y-3">${krsHtml}</div>
        `;
        els.totalQuestList.appendChild(okrEl);
    });
    lucide.createIcons();
}

// --- 任務頁：每日任務 ---
function renderDailyTasks() {
    if (!els.dailyTasksList || !els.dailyTasksEmpty) return;
    const today = getTodayKey();
    const todayTasks = state.dailyTasks.filter(t => t.date === today);
    if (todayTasks.length === 0) {
        els.dailyTasksList.innerHTML = '';
        els.dailyTasksList.classList.add('hidden');
        els.dailyTasksEmpty.classList.remove('hidden');
        return;
    }
    els.dailyTasksEmpty.classList.add('hidden');
    els.dailyTasksList.classList.remove('hidden');
    els.dailyTasksList.innerHTML = '';
    todayTasks.forEach(t => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 py-2 px-3 bg-white border-2 border-[#d2b48c]';
        row.innerHTML = `
            <button type="button" onclick="toggleDailyTask(${t.id})" class="shrink-0 p-0.5 rounded border-2 border-black ${t.done ? 'bg-[#2ecc71] text-white' : 'bg-white text-slate-400'}">
                <i data-lucide="${t.done ? 'check' : 'circle'}" class="w-4 h-4"></i>
            </button>
            <span class="flex-1 text-sm font-bold ${t.done ? 'text-slate-400 line-through' : 'text-slate-800'}">${escapeHtml(t.title)}</span>
            <button type="button" onclick="deleteDailyTask(${t.id})" class="text-slate-400 hover:text-red-500 p-1">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        `;
        els.dailyTasksList.appendChild(row);
    });
    lucide.createIcons();
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function addDailyTask() {
    const title = els.dailyTaskInput.value.trim();
    if (!title) return;
    const task = {
        id: Date.now() + Math.random(),
        title,
        done: false,
        date: getTodayKey()
    };
    state.dailyTasks.push(task);
    localStorage.setItem('pixel_daily_tasks', JSON.stringify(state.dailyTasks));
    els.dailyTaskInput.value = '';
    renderDailyTasks();
    lucide.createIcons();
    SoundFX.playPop();
}

window.toggleDailyTask = function(id) {
    const t = state.dailyTasks.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    localStorage.setItem('pixel_daily_tasks', JSON.stringify(state.dailyTasks));
    renderDailyTasks();
    lucide.createIcons();
    SoundFX.playType();
};

window.deleteDailyTask = function(id) {
    state.dailyTasks = state.dailyTasks.filter(x => x.id !== id);
    localStorage.setItem('pixel_daily_tasks', JSON.stringify(state.dailyTasks));
    renderDailyTasks();
    lucide.createIcons();
};

// --- Actions (exposed on window for inline handlers) ---
window.updateProgress = function(okrId, krId, val) {
    state.okrs = state.okrs.map(okr => {
        if (okr.id !== okrId) return okr;
        return {
            ...okr,
            keyResults: okr.keyResults.map(kr => {
                if (kr.id !== krId) return kr;
                return { ...kr, current: Number(val) };
            })
        };
    });
    localStorage.setItem('pixel_chat_okrs', JSON.stringify(state.okrs));
    renderTotalQuestList();
};

window.deleteOKR = function(id) {
    if (confirm("確定要放棄這個任務嗎？")) {
        state.okrs = state.okrs.filter(o => o.id !== id);
        localStorage.setItem('pixel_chat_okrs', JSON.stringify(state.okrs));
        renderTotalQuestList();
    }
};

async function handleSendMessage() {
    const text = els.chatInput.value.trim();
    if (!text || state.isLoading) return;

    addMessage(text, 'user', true);
    els.chatInput.value = '';
    SoundFX.playSend();

    await generateAIResponse(text);
}

async function generateAIResponse(userMessage) {
    const currentKey = state.userApiKey || defaultApiKey;
    if (!currentKey) {
        els.modalApiKey.classList.remove('hidden');
        addMessage("請先設定 API 金鑰以啟動 AI 導師功能。", "system", true);
        return;
    }

    state.isLoading = true;
    els.loadingIndicator.classList.remove('hidden');
    els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;

    try {
        const history = state.messages
            .filter(m => m.sender !== 'system')
            .map(m => ({
                role: m.sender === 'user' ? 'user' : 'model',
                parts: [{ text: m.text.replace(/\|\|\|/g, '\n') }]
            }));

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${currentKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: history,
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
            })
        });

        const data = await response.json();

        if (data.error) {
            if (data.error.code === 403 || data.error.status === 'PERMISSION_DENIED') {
                els.modalApiKey.classList.remove('hidden');
                addMessage("API 金鑰無效或權限不足 (403)。", "system", true);
            } else {
                addMessage(`通訊錯誤: ${data.error.message}`, "system", true);
            }
            state.isLoading = false;
            els.loadingIndicator.classList.add('hidden');
            return;
        }

        let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "...";

        const jsonMatch = aiText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            try {
                const questData = JSON.parse(jsonMatch[1]);
                const newOkr = {
                    id: Date.now() + Math.random(),
                    objective: questData.objective,
                    keyResults: questData.keyResults.map((kr, idx) => ({
                        id: Date.now() + Math.random() + idx,
                        title: kr.title,
                        current: 0,
                        target: Number(kr.target) || 100,
                        unit: kr.unit || "%"
                    }))
                };
                state.okrs.unshift(newOkr);
                localStorage.setItem('pixel_chat_okrs', JSON.stringify(state.okrs));
                renderTotalQuestList();

                els.sidebarBadge.classList.remove('hidden');
                SoundFX.playSuccess();
                fireConfetti();

                aiText = aiText.replace(/```json\n[\s\S]*?\n```/, "").trim();
                aiText += "|||(✨ 任務已登錄！點擊右上角「任務」查看。)";
            } catch (e) {
                console.error("JSON Parse Error", e);
            }
        }

        const parts = aiText.split('|||').map(p => p.trim()).filter(p => p);

        if (parts.length === 0) {
            state.isLoading = false;
            els.loadingIndicator.classList.add('hidden');
            return;
        }

        let index = 0;
        function showNextPart() {
            if (index >= parts.length) {
                state.isLoading = false;
                els.loadingIndicator.classList.add('hidden');
                return;
            }

            addMessage(parts[index], 'npc', true);

            index++;
            if (index < parts.length) {
                setTimeout(showNextPart, 1000);
            } else {
                state.isLoading = false;
                els.loadingIndicator.classList.add('hidden');
            }
        }
        showNextPart();

    } catch (error) {
        console.error(error);
        addMessage("網路連線錯誤。", "system", true);
        state.isLoading = false;
        els.loadingIndicator.classList.add('hidden');
    }
}

function handleSaveKey() {
    const key = els.inputApiKey.value.trim();
    if (key) {
        state.userApiKey = key;
        localStorage.setItem('pixel_api_key', key);
        els.modalApiKey.classList.add('hidden');

        const lastContentMsg = state.messages.filter(m => m.sender !== 'system').pop();

        if (lastContentMsg && lastContentMsg.sender === 'user') {
            addMessage("金鑰更新成功！ 對接AI 導師...", "system", true);
            generateAIResponse(lastContentMsg.text);
        } else {
            addMessage("金鑰更新成功！", "system", true);
        }
    }
}

// Start
init();
