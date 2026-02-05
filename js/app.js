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
    tasksFilter: 'my',  // 'my' | 'ended' 獨立任務頁篩選
    taskView: 'daily',  // 'daily' | 'all' 任務側欄視圖
    selectedSubtask: null,  // 當前選中的任務（子任務）{okrId, krId, subtaskId}
    selectedKR: null,       // 當前選中的「KR 即任務」{okrId, krId}（該 KR 下無子任務，KR 本身即一項任務）
    showTaskDetail: false,  // 移動端是否顯示詳情視圖
    expandedObjectives: {},  // 記錄哪些 Objective 是展開的 {okrId: true/false}
    expandedKR: {},         // 記錄哪些 KR 區塊是展開的 {'okrId_krId': true}
    // 層級：Object 冒險章節 → Key Result 關鍵結果(KR) → Task 任務（= 子任務 subtasks，或 KR 本身當作一項任務）
    fontSize: 100,  // 字體大小百分比
    // 記帳
    accounts: [
        { id: 'acc_cash', name: '現金', type: 'cash' },
        { id: 'acc_bank', name: '銀行', type: 'bank' },
        { id: 'acc_credit', name: '信用卡', type: 'credit' }
    ],
    categories: [
        { id: 'cat_food', name: '飲食' },
        { id: 'cat_fun', name: '玩樂' },
        { id: 'cat_transport', name: '交通' },
        { id: 'cat_shop', name: '購物' },
        { id: 'cat_other', name: '其他' }
    ],
    transactions: [],  // { id, type: 'expense'|'income'|'transfer', accountId, categoryId?, amount, note?, date, transferToAccountId? }
    draftEdits: {}     // 聊天 OKR 初稿編輯 { [messageId]: { objective, krs: [{ title, confidence }] } }
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
    dailyTaskKrSelect: document.getElementById('daily-task-kr-select'),
    btnAddDailyTask: document.getElementById('btn-add-daily-task'),
    dailyTasksList: document.getElementById('daily-tasks-list'),
    dailyTasksEmpty: document.getElementById('daily-tasks-empty'),
    dailyTasksSection: document.getElementById('daily-tasks-section'),
    btnDailyTasks: document.getElementById('btn-daily-tasks'),
    btnAllTasks: document.getElementById('btn-all-tasks'),
    allTasksSection: document.getElementById('all-tasks-section'),
    allTasksList: document.getElementById('all-tasks-list'),
    allTasksEmpty: document.getElementById('all-tasks-empty'),
    viewChat: document.getElementById('view-chat'),
    viewTasks: document.getElementById('view-tasks'),
    viewObjectives: document.getElementById('view-objectives'),
    objectivesList: document.getElementById('objectives-list'),
    objectivesEmpty: document.getElementById('objectives-empty'),
    viewAccounting: document.getElementById('view-accounting'),
    accountingList: document.getElementById('accounting-list'),
    accountingEmpty: document.getElementById('accounting-empty'),
    btnTasksBack: document.getElementById('btn-tasks-back'),
    filterEndedTasks: document.getElementById('filter-ended-tasks'),
    taskListContent: document.getElementById('task-list-content'),
    taskListEmpty: document.getElementById('task-list-empty'),
    taskListSidebar: document.getElementById('task-list-sidebar'),
    taskDetailContent: document.getElementById('task-detail-content'),
    taskDetailEmpty: document.getElementById('task-detail-empty'),
    taskDetailPanel: document.getElementById('task-detail-panel'),
    btnMenuToggle: document.getElementById('btn-menu-toggle'),
    menuOverlay: document.getElementById('menu-overlay'),
    leftMenu: document.getElementById('left-menu'),
    menuItemToday: document.getElementById('menu-item-today'),
    menuItemObjectives: document.getElementById('menu-item-objectives'),
    menuItemAccounting: document.getElementById('menu-item-accounting'),
    menuItemAi: document.getElementById('menu-item-ai'),
    menuItemSettings: document.getElementById('menu-item-settings'),
    headerTitle: document.getElementById('header-title'),
    headerHistoryWrap: document.getElementById('header-history-wrap'),
    headerRightPlaceholder: document.getElementById('header-right-placeholder'),
    viewSettings: document.getElementById('view-settings'),
    btnSoundSettings: document.getElementById('btn-sound-settings'),
    btnApiSettings: document.getElementById('btn-api-settings'),
    btnResetAll: document.getElementById('btn-reset-all'),
    fontSizeSlider: document.getElementById('font-size-slider'),
    fontSizeDisplay: document.getElementById('font-size-display')
};

// --- Initialization ---
function init() {
    // 左側選單：最先綁定，避免後面程式拋錯導致選單無法開啟（含 file:// 直接開 html）
    (function setupLeftMenu() {
        var leftMenu = document.getElementById('left-menu');
        var overlay = document.getElementById('menu-overlay');
        var menuToday = document.getElementById('menu-item-today');
        var menuObjectives = document.getElementById('menu-item-objectives');
        var menuAi = document.getElementById('menu-item-ai');
        var menuSettings = document.getElementById('menu-item-settings');
        function openMenu() {
            if (leftMenu) leftMenu.classList.add('open');
            if (overlay) {
                overlay.classList.remove('hidden');
                overlay.setAttribute('aria-hidden', 'false');
            }
        }
        function closeMenu() {
            if (leftMenu) leftMenu.classList.remove('open');
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.setAttribute('aria-hidden', 'true');
            }
        }
        function toggleMenu() {
            var isOpen = leftMenu && leftMenu.classList.contains('open');
            if (isOpen) closeMenu();
            else openMenu();
            try { SoundFX.playType(); } catch (_) {}
        }
        document.addEventListener('click', function(e) {
            if (!e.target.closest('#btn-menu-toggle')) return;
            e.preventDefault();
            e.stopPropagation();
            toggleMenu();
        });
        if (overlay) overlay.addEventListener('click', function() {
            closeMenu();
            try { SoundFX.playType(); } catch (_) {}
        });
        if (menuToday) menuToday.addEventListener('click', function(e) {
            e.preventDefault();
            closeMenu();
            if (typeof showTasksPage === 'function') showTasksPage();
            try { SoundFX.playType(); } catch (_) {}
        });
        if (menuObjectives) menuObjectives.addEventListener('click', function(e) {
            e.preventDefault();
            closeMenu();
            if (typeof showObjectivesPage === 'function') showObjectivesPage();
            try { SoundFX.playType(); } catch (_) {}
        });
        var menuAccounting = document.getElementById('menu-item-accounting');
        if (menuAccounting) menuAccounting.addEventListener('click', function(e) {
            e.preventDefault();
            closeMenu();
            if (typeof showAccountingPage === 'function') showAccountingPage();
            try { SoundFX.playType(); } catch (_) {}
        });
        if (menuAi) menuAi.addEventListener('click', function(e) {
            e.preventDefault();
            closeMenu();
            if (typeof showChatPage === 'function') showChatPage();
            try { SoundFX.playType(); } catch (_) {}
        });
        if (menuSettings) menuSettings.addEventListener('click', function(e) {
            e.preventDefault();
            closeMenu();
            if (typeof showSettingsPage === 'function') showSettingsPage();
            try { SoundFX.playType(); } catch (_) {}
        });
    })();

    // 設定 API Key 按鈕：用事件委派確保點擊一定會打開 popup（與選單同原因）
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#btn-api-settings')) return;
        e.preventDefault();
        var modal = document.getElementById('modal-api-key');
        var input = document.getElementById('input-api-key');
        if (modal && input) {
            input.value = state.userApiKey || '';
            modal.classList.remove('hidden');
            try { SoundFX.playType(); } catch (_) {}
        }
    });

    if (els.btnResetAll) {
        els.btnResetAll.addEventListener('click', function() {
            if (!confirm('確定要清除所有數據嗎？\n\n將刪除：冒險章節、任務、記帳、聊天記錄、字體設定等。')) return;
            if (!confirm('此操作無法復原！\n\n請再次確認：確定要清除所有數據？')) return;
            resetAllData();
        });
    }

    const savedOkrs = localStorage.getItem('pixel_chat_okrs');
    if (savedOkrs) {
        state.okrs = JSON.parse(savedOkrs);
        // 確保每個 KR 都有 subtasks；無「KR 即任務」：若 KR 下無任務則自動補一個同名一次性任務
        state.okrs.forEach(okr => {
            okr.keyResults.forEach(kr => {
                if (!kr.subtasks) kr.subtasks = [];
                kr.subtasks.forEach(st => {
                    if (!st.type) st.type = 'one-time';
                    if (st.type === 'daily' && !Array.isArray(st.completedDates)) st.completedDates = [];
                });
                if (kr.subtasks.length === 0) {
                    kr.subtasks.push({
                        id: (kr.id || Date.now()) + '_t1',
                        title: kr.title,
                        type: 'one-time',
                        done: false,
                        completedAt: null
                    });
                }
            });
        });
        localStorage.setItem('pixel_chat_okrs', JSON.stringify(state.okrs));
    }

    const savedKey = localStorage.getItem('pixel_api_key');
    if (savedKey) state.userApiKey = savedKey;

    const savedDailyTasks = localStorage.getItem('pixel_daily_tasks');
    if (savedDailyTasks) state.dailyTasks = JSON.parse(savedDailyTasks);

    const savedAccounts = localStorage.getItem('pixel_accounts');
    if (savedAccounts) state.accounts = JSON.parse(savedAccounts);
    const savedCategories = localStorage.getItem('pixel_categories');
    if (savedCategories) state.categories = JSON.parse(savedCategories);
    const savedTransactions = localStorage.getItem('pixel_transactions');
    if (savedTransactions) state.transactions = JSON.parse(savedTransactions);

    // 加载保存的聊天记录
    const savedMessages = localStorage.getItem('pixel_chat_messages');
    if (savedMessages) {
        try {
            const parsed = JSON.parse(savedMessages);
            // 恢复时间戳为Date对象
            state.messages = parsed.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
            }));
        } catch (e) {
            console.error('Failed to load messages:', e);
        }
    }

    // 加载字体大小设置
    const savedFontSize = localStorage.getItem('pixel_font_size');
    if (savedFontSize) {
        state.fontSize = parseInt(savedFontSize, 10);
        applyFontSize(state.fontSize);
    }

    renderMessages();
    renderTotalQuestList();
    updateTaskViewUI();
    renderDailyTasks();
    
    // Onboarding：首次進入（尚無 OKR）全螢幕聊天設定 OKR，設好後再顯示正常 UI（含 Menu）
    if (state.okrs.length === 0) {
        document.body.classList.add('onboarding');
        showChatPage();
        updateHeaderTitle('冒險相談');
    } else {
        document.body.classList.remove('onboarding');
        showTasksPage();
        updateHeaderTitle('今日任務');
    }
    
    lucide.createIcons();

    els.btnSend.addEventListener('click', handleSendMessage);
    els.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });

    document.addEventListener('click', () => SoundFX.init(), { once: true });

    // OKR 初稿任務單：點擊 Edit KR 或難易度星星
    if (els.messagesContainer) {
        els.messagesContainer.addEventListener('click', function(e) {
            const paper = e.target.closest('.kraft-paper');
            if (!paper) return;
            const messageId = paper.getAttribute('data-message-id');
            if (messageId == null || messageId === '') return;

            const msg = state.messages.find(m => m.id != null && String(m.id) === messageId);
            if (!msg) return;
            const block = parseOKRDraftBlock(msg.text);
            if (!block) return;
            const draftData = state.draftEdits[messageId] || parseDraftLinesToData(block.draftLines);

            // 點擊編輯 KR 文字
            const editSpan = e.target.closest('.kraft-paper-kr-edit');
            if (editSpan) {
                const krIndex = parseInt(editSpan.getAttribute('data-kr-index'), 10);
                if (!Number.isFinite(krIndex) || !draftData.krs[krIndex]) return;
                const newTitle = prompt('編輯關鍵結果', draftData.krs[krIndex].title);
                if (newTitle == null || newTitle.trim() === '') return;
                state.draftEdits[messageId] = { objective: draftData.objective, krs: draftData.krs.map((kr, i) => i === krIndex ? { ...kr, title: newTitle.trim() } : kr) };
                rerenderMessage(messageId);
                try { SoundFX.playType(); } catch (_) {}
                return;
            }

            // 點擊難易度星星（1–5 星對應 confidence 2,4,6,8,10）
            const star = e.target.closest('.kraft-paper-star');
            if (star) {
                const krItem = star.closest('.kraft-paper-kr-item');
                if (!krItem) return;
                const krIndex = parseInt(krItem.getAttribute('data-kr-index'), 10);
                const starIndex = parseInt(star.getAttribute('data-star-index'), 10);
                if (!Number.isFinite(krIndex) || !Number.isFinite(starIndex) || !draftData.krs[krIndex]) return;
                const confidence = (starIndex + 1) * 2; // 1–5 -> 2,4,6,8,10
                state.draftEdits[messageId] = { objective: draftData.objective, krs: draftData.krs.map((kr, i) => i === krIndex ? { ...kr, confidence } : kr) };
                rerenderMessage(messageId);
                try { SoundFX.playType(); } catch (_) {}
            }
        });
    }

    // 设置页面的声音按钮
    if (els.btnSoundSettings) {
        els.btnSoundSettings.addEventListener('click', () => {
            SoundFX.isMuted = !SoundFX.isMuted;
            const icon = SoundFX.isMuted ? 'volume-x' : 'volume-2';
            els.btnSoundSettings.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5"></i>`;
            lucide.createIcons();
            SoundFX.playType();
        });
        // 初始化声音按钮图标
        const icon = SoundFX.isMuted ? 'volume-x' : 'volume-2';
        els.btnSoundSettings.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5"></i>`;
    }

    // 设置页面的API按钮
    if (els.btnApiSettings) {
        els.btnApiSettings.addEventListener('click', () => {
            els.inputApiKey.value = state.userApiKey;
            els.modalApiKey.classList.remove('hidden');
            SoundFX.playType();
        });
    }

    // 字体大小滑块
    if (els.fontSizeSlider && els.fontSizeDisplay) {
        els.fontSizeSlider.value = state.fontSize;
        els.fontSizeDisplay.textContent = state.fontSize + '%';
        els.fontSizeSlider.addEventListener('input', (e) => {
            const size = parseInt(e.target.value, 10);
            state.fontSize = size;
            els.fontSizeDisplay.textContent = size + '%';
            applyFontSize(size);
            localStorage.setItem('pixel_font_size', size.toString());
            SoundFX.playType();
        });
    }
    if (els.btnTasksBack) {
    els.btnTasksBack.addEventListener('click', () => {
        showChatPage();
        SoundFX.playType();
    });
    }
    els.filterEndedTasks.addEventListener('click', () => {
        state.tasksFilter = state.tasksFilter === 'ended' ? 'my' : 'ended';
        state.selectedSubtask = null; // 切换筛选时重置选中状态
        state.showTaskDetail = false; // 重置详情视图
        updateTaskView();
        renderTaskCards();
        updateTasksFilterUI();
        SoundFX.playType();
    });
    
    // 监听窗口大小变化，更新视图
    window.addEventListener('resize', () => {
        updateTaskView();
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
    
    if (els.btnDailyTasks) {
        els.btnDailyTasks.addEventListener('click', () => {
            state.taskView = 'daily';
            updateTaskViewUI();
            renderDailyTasks();
            SoundFX.playType();
        });
    }
    if (els.btnAllTasks) {
        els.btnAllTasks.addEventListener('click', () => {
            state.taskView = 'all';
            updateTaskViewUI();
            renderAllTasks();
            SoundFX.playType();
        });
    }

    const btnAddExpense = document.getElementById('btn-add-expense');
    const btnAddIncome = document.getElementById('btn-add-income');
    const btnAddTransfer = document.getElementById('btn-add-transfer');
    const btnCloseAccountingModal = document.getElementById('btn-close-accounting-modal');
    const btnSaveAccounting = document.getElementById('btn-save-accounting');
    const btnCancelAccounting = document.getElementById('btn-cancel-accounting');
    if (btnAddExpense) btnAddExpense.addEventListener('click', () => { openAccountingModal('expense'); });
    if (btnAddIncome) btnAddIncome.addEventListener('click', () => { openAccountingModal('income'); });
    if (btnAddTransfer) btnAddTransfer.addEventListener('click', () => { openAccountingModal('transfer'); });
    if (btnCloseAccountingModal) btnCloseAccountingModal.addEventListener('click', () => document.getElementById('modal-accounting').classList.add('hidden'));
    if (btnSaveAccounting) btnSaveAccounting.addEventListener('click', saveAccountingTransaction);
    if (btnCancelAccounting) btnCancelAccounting.addEventListener('click', () => document.getElementById('modal-accounting').classList.add('hidden'));
}

function getTodayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// --- Logic & Rendering ---
function showTasksPage() {
    if (els.viewChat) els.viewChat.classList.add('hidden');
    if (els.viewSettings) els.viewSettings.classList.add('hidden');
    if (els.viewObjectives) els.viewObjectives.classList.add('hidden');
    if (els.viewAccounting) els.viewAccounting.classList.add('hidden');
    if (els.viewTasks) els.viewTasks.classList.remove('hidden');
    state.tasksFilter = 'my';
    state.selectedSubtask = null;
    state.selectedKR = null;
    state.showTaskDetail = false;
    updateTasksFilterUI();
    updateTaskView();
    renderTaskCards();
    updateHeaderTitle('今日任務');
    lucide.createIcons();
    if (els.sidebarBadge) els.sidebarBadge.classList.add('hidden');
    if (els.headerHistoryWrap) els.headerHistoryWrap.classList.remove('hidden');
    if (els.headerRightPlaceholder) els.headerRightPlaceholder.classList.add('hidden');
}

function showObjectivesPage() {
    if (els.viewChat) els.viewChat.classList.add('hidden');
    if (els.viewSettings) els.viewSettings.classList.add('hidden');
    if (els.viewTasks) els.viewTasks.classList.add('hidden');
    if (els.viewAccounting) els.viewAccounting.classList.add('hidden');
    if (els.viewObjectives) els.viewObjectives.classList.remove('hidden');
    updateHeaderTitle('目標');
    renderObjectivesList();
    lucide.createIcons();
    if (els.headerHistoryWrap) els.headerHistoryWrap.classList.add('hidden');
    if (els.headerRightPlaceholder) els.headerRightPlaceholder.classList.remove('hidden');
}

function renderObjectivesList() {
    if (!els.objectivesList || !els.objectivesEmpty) return;
    els.objectivesList.innerHTML = '';
    if (state.okrs.length === 0) {
        els.objectivesList.classList.add('hidden');
        els.objectivesEmpty.classList.remove('hidden');
        lucide.createIcons();
        return;
    }
    els.objectivesEmpty.classList.add('hidden');
    els.objectivesList.classList.remove('hidden');
    state.okrs.forEach(okr => {
        const { done, total, pct } = getOKRProgress(okr);
        const card = document.createElement('div');
        card.className = 'bg-[#34495e] border-4 border-black p-4 shadow-[4px_4px_0_0_#000]';
        let krsHtml = '';
        okr.keyResults.forEach(kr => {
            const percentage = Math.min(100, Math.max(0, (kr.current / kr.target) * 100));
            let barColor = 'bg-[#3498db]';
            if (percentage >= 100) barColor = 'bg-[#f1c40f]';
            else if (percentage >= 70) barColor = 'bg-[#2ecc71]';
            else if (percentage < 30) barColor = 'bg-[#e74c3c]';
            krsHtml += `
                <div class="mb-3">
                    <div class="flex items-center gap-2 mb-1">
                        <i data-lucide="${kr.current >= kr.target ? 'check-circle-2' : 'circle'}" class="w-4 h-4 ${kr.current >= kr.target ? 'text-[#2ecc71]' : 'text-slate-400'}"></i>
                        <span class="text-sm font-bold ${kr.current >= kr.target ? 'text-slate-400 line-through' : 'text-white'}">${escapeHtml(kr.title)}</span>
                    </div>
                    <div class="w-full h-3 bg-[#2c3e50] border-2 border-black mt-1">
                        <div class="h-full ${barColor} transition-all duration-500" style="width: ${percentage}%"></div>
                    </div>
                    <div class="text-xs text-right mt-0.5 font-bold text-slate-400">${kr.current}/${kr.target} ${kr.unit || '%'}</div>
                    <input type="range" min="0" max="${kr.target}" step="${Math.max(1, kr.target/100)}" value="${kr.current}"
                        class="w-full h-2 mt-1 bg-slate-600 accent-[#f1c40f] cursor-pointer"
                        oninput="updateProgress(${okr.id}, ${kr.id}, this.value)">
                </div>
            `;
        });
        card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <span class="text-xs font-black bg-[#f1c40f] text-black px-2 py-0.5 border-2 border-black">冒險章節</span>
                <div class="flex items-center gap-1">
                    <button type="button" onclick="openEditOKRModal(${okr.id})" class="p-1 text-slate-400 hover:text-[#f1c40f] hover:bg-[#f1c40f]/20 transition-colors" title="編輯目標與關鍵結果">
                        <i data-lucide="pencil" class="w-4 h-4"></i>
                    </button>
                    <button type="button" onclick="deleteOKR(${okr.id})" class="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/20 transition-colors" title="刪除此冒險章節">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
            <h3 class="font-black text-white text-lg mb-2 leading-tight">${escapeHtml(okr.objective)}</h3>
            <div class="text-xs font-bold text-slate-400 mb-3">關鍵結果進度 ${done}/${total} · ${pct}%</div>
            <div class="text-[10px] font-bold text-slate-500 uppercase mb-2">關鍵結果 (KR)</div>
            <div class="space-y-3">${krsHtml}</div>
        `;
        els.objectivesList.appendChild(card);
    });
    lucide.createIcons();
}

// --- 目標頁：編輯冒險章節與關鍵結果 ---
window.openEditOKRModal = function(okrId) {
    const okr = state.okrs.find(o => o.id === okrId);
    if (!okr) return;
    const modal = document.getElementById('modal-edit-okr');
    const content = document.getElementById('edit-okr-content');
    if (!modal || !content) return;
    state._editingOKRId = okrId;
    content.innerHTML = `
        <div class="space-y-2">
            <label class="text-xs font-bold text-slate-300">冒險章節 (目標)</label>
            <input type="text" id="edit-okr-objective" value="${escapeHtml(okr.objective)}" class="w-full px-3 py-2 bg-[#2c3e50] border-2 border-black text-white font-bold focus:border-[#f1c40f] outline-none" />
        </div>
        <div class="text-[10px] font-bold text-slate-500 uppercase mt-4 mb-2">關鍵結果 (KR)</div>
        <div id="edit-okr-krs" class="space-y-3"></div>
    `;
    const krsContainer = document.getElementById('edit-okr-krs');
    (okr.keyResults || []).forEach(kr => {
        const row = document.createElement('div');
        row.className = 'edit-kr-row bg-[#2c3e50] border-2 border-black p-3';
        row.setAttribute('data-kr-id', kr.id);
        row.innerHTML = `
            <div class="flex justify-between items-start gap-2 mb-2">
                <span class="text-xs text-slate-400">KR</span>
                <button type="button" onclick="this.closest('.edit-kr-row').remove()" class="p-1 text-slate-400 hover:text-red-400" title="刪除此關鍵結果"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
            <input type="text" class="edit-kr-title w-full px-2 py-1.5 mb-2 bg-[#34495e] border border-slate-500 text-white text-sm font-bold focus:border-[#f1c40f] outline-none" value="${escapeHtml(kr.title)}" placeholder="關鍵結果標題" />
            <div class="flex gap-2">
                <div class="flex-1">
                    <label class="text-[10px] text-slate-500">目標值</label>
                    <input type="number" class="edit-kr-target w-full px-2 py-1 bg-[#34495e] border border-slate-500 text-white text-sm font-bold outline-none" value="${kr.target}" min="0" />
                </div>
                <div class="w-20">
                    <label class="text-[10px] text-slate-500">單位</label>
                    <input type="text" class="edit-kr-unit w-full px-2 py-1 bg-[#34495e] border border-slate-500 text-white text-sm font-bold outline-none" value="${escapeHtml(kr.unit || '%')}" placeholder="%" />
                </div>
            </div>
        `;
        krsContainer.appendChild(row);
    });
    modal.classList.remove('hidden');
    lucide.createIcons();
    try { SoundFX.playType(); } catch (_) {}
};

window.saveEditOKR = function() {
    const okrId = state._editingOKRId;
    if (okrId == null) return;
    const okr = state.okrs.find(o => o.id === okrId);
    if (!okr) return;
    const objectiveInput = document.getElementById('edit-okr-objective');
    const rows = document.querySelectorAll('.edit-kr-row');
    if (!objectiveInput || rows.length === 0) {
        alert('請至少保留一項關鍵結果');
        return;
    }
    const newObjective = objectiveInput.value.trim();
    if (!newObjective) {
        alert('請填寫冒險章節（目標）');
        return;
    }
    okr.objective = newObjective;
    const newKeyResults = [];
    rows.forEach(row => {
        const krId = Number(row.getAttribute('data-kr-id'));
        const kr = okr.keyResults.find(k => k.id === krId);
        if (!kr) return;
        const titleEl = row.querySelector('.edit-kr-title');
        const targetEl = row.querySelector('.edit-kr-target');
        const unitEl = row.querySelector('.edit-kr-unit');
        newKeyResults.push({
            ...kr,
            title: (titleEl && titleEl.value.trim()) ? titleEl.value.trim() : kr.title,
            target: (targetEl && Number(targetEl.value) >= 0) ? Number(targetEl.value) : kr.target,
            unit: (unitEl && unitEl.value.trim()) ? unitEl.value.trim() : (kr.unit || '%')
        });
    });
    okr.keyResults = newKeyResults;
    localStorage.setItem('pixel_chat_okrs', JSON.stringify(state.okrs));
    document.getElementById('modal-edit-okr').classList.add('hidden');
    state._editingOKRId = null;
    renderObjectivesList();
    renderTotalQuestList();
    renderTaskCards();
    try { SoundFX.playSuccess(); } catch (_) {}
};

window.closeEditOKRModal = function() {
    const modal = document.getElementById('modal-edit-okr');
    if (modal) modal.classList.add('hidden');
    state._editingOKRId = null;
};

// --- 記帳 ---
function getAccountBalances() {
    const balances = {};
    state.accounts.forEach(acc => { balances[acc.id] = 0; });
    state.transactions.forEach(t => {
        if (t.type === 'expense') {
            balances[t.accountId] = (balances[t.accountId] || 0) - Number(t.amount);
        } else if (t.type === 'income') {
            balances[t.accountId] = (balances[t.accountId] || 0) + Number(t.amount);
        } else if (t.type === 'transfer' && t.transferToAccountId) {
            balances[t.accountId] = (balances[t.accountId] || 0) - Number(t.amount);
            balances[t.transferToAccountId] = (balances[t.transferToAccountId] || 0) + Number(t.amount);
        }
    });
    return balances;
}

function saveAccountingData() {
    try {
        localStorage.setItem('pixel_accounts', JSON.stringify(state.accounts));
        localStorage.setItem('pixel_categories', JSON.stringify(state.categories));
        localStorage.setItem('pixel_transactions', JSON.stringify(state.transactions));
    } catch (e) { console.error('Save accounting failed', e); }
}

function renderAccountingList() {
    const balancesEl = document.getElementById('accounting-balances');
    const listEl = document.getElementById('accounting-list');
    const emptyEl = document.getElementById('accounting-empty');
    if (!listEl || !emptyEl) return;

    const balances = getAccountBalances();
    if (balancesEl) {
        balancesEl.innerHTML = '';
        state.accounts.forEach(acc => {
            const v = balances[acc.id] || 0;
            const card = document.createElement('div');
            card.className = 'bg-[#34495e] border-2 border-black p-2 text-center';
            card.innerHTML = `<div class="text-xs font-bold text-slate-400">${escapeHtml(acc.name)}</div><div class="text-sm font-black ${v >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}">${v >= 0 ? '' : '-'}${Math.abs(v).toLocaleString()} 元</div>`;
            balancesEl.appendChild(card);
        });
    }

    listEl.innerHTML = '';
    const sorted = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sorted.length === 0) {
        listEl.classList.add('hidden');
        emptyEl.classList.remove('hidden');
    } else {
        emptyEl.classList.add('hidden');
        listEl.classList.remove('hidden');
        sorted.forEach(t => {
            const acc = state.accounts.find(a => a.id === t.accountId);
            const cat = t.categoryId ? state.categories.find(c => c.id === t.categoryId) : null;
            const toAcc = t.transferToAccountId ? state.accounts.find(a => a.id === t.transferToAccountId) : null;
            let label = '';
            let amountClass = '';
            if (t.type === 'expense') {
                label = (acc ? acc.name : '') + ' · ' + (cat ? cat.name : '');
                amountClass = 'text-[#e74c3c]';
            } else if (t.type === 'income') {
                label = (acc ? acc.name : '') + (cat ? ' · ' + cat.name : '');
                amountClass = 'text-[#2ecc71]';
            } else {
                label = (acc ? acc.name : '') + ' → ' + (toAcc ? toAcc.name : '');
                amountClass = 'text-[#3498db]';
            }
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between gap-2 py-2 px-3 bg-[#34495e] border-2 border-black';
            row.innerHTML = `
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-white truncate">${escapeHtml(label)}</div>
                    <div class="text-xs text-slate-400">${(t.date || '').toString().slice(0, 10)}${t.note ? ' · ' + escapeHtml(t.note) : ''}</div>
                </div>
                <div class="font-black ${amountClass} shrink-0">
                    ${t.type === 'expense' ? '-' : t.type === 'transfer' ? '→' : '+'}${Number(t.amount).toLocaleString()} 元
                </div>
                <button type="button" class="p-1 text-slate-400 hover:text-red-400 delete-txn" data-id="${t.id}" title="刪除"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            `;
            listEl.appendChild(row);
        });
    }
    lucide.createIcons();
    listEl.querySelectorAll('.delete-txn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            if (id && confirm('確定刪除此筆紀錄？')) {
                state.transactions = state.transactions.filter(t => t.id !== id);
                saveAccountingData();
                renderAccountingList();
                try { SoundFX.playType(); } catch (_) {}
            }
        });
    });
}

function openAccountingModal(type) {
    state._accountingModalType = type;
    const modal = document.getElementById('modal-accounting');
    const titleEl = document.getElementById('modal-accounting-title');
    const typeInput = document.getElementById('accounting-txn-type');
    const accountSelect = document.getElementById('accounting-account');
    const categorySelect = document.getElementById('accounting-category');
    const toAccountSelect = document.getElementById('accounting-to-account');
    const fieldCategory = document.getElementById('accounting-field-category');
    const fieldToAccount = document.getElementById('accounting-field-to-account');
    const amountInput = document.getElementById('accounting-amount');
    const dateInput = document.getElementById('accounting-date');
    const noteInput = document.getElementById('accounting-note');
    if (!modal || !accountSelect) return;

    typeInput.value = type;
    if (titleEl) titleEl.textContent = type === 'expense' ? '新增支出' : type === 'income' ? '新增收入' : '帳戶轉帳';
    accountSelect.innerHTML = '<option value="">請選擇</option>';
    state.accounts.forEach(a => {
        accountSelect.innerHTML += `<option value="${a.id}">${escapeHtml(a.name)}</option>`;
    });
    categorySelect.innerHTML = '<option value="">請選擇</option>';
    state.categories.forEach(c => {
        categorySelect.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
    });
    toAccountSelect.innerHTML = '<option value="">請選擇</option>';
    state.accounts.forEach(a => {
        toAccountSelect.innerHTML += `<option value="${a.id}">${escapeHtml(a.name)}</option>`;
    });

    if (type === 'transfer') {
        fieldCategory.classList.add('hidden');
        fieldToAccount.classList.remove('hidden');
    } else {
        fieldCategory.classList.remove('hidden');
        fieldToAccount.classList.add('hidden');
    }

    amountInput.value = '';
    const today = new Date().toISOString().slice(0, 10);
    dateInput.value = today;
    noteInput.value = '';
    modal.classList.remove('hidden');
    try { SoundFX.playType(); } catch (_) {}
}

function saveAccountingTransaction() {
    const typeInput = document.getElementById('accounting-txn-type');
    const accountSelect = document.getElementById('accounting-account');
    const categorySelect = document.getElementById('accounting-category');
    const toAccountSelect = document.getElementById('accounting-to-account');
    const amountInput = document.getElementById('accounting-amount');
    const dateInput = document.getElementById('accounting-date');
    const noteInput = document.getElementById('accounting-note');
    const type = (typeInput && typeInput.value) || 'expense';
    const accountId = accountSelect && accountSelect.value;
    const amount = amountInput && Number(amountInput.value);
    const date = dateInput && dateInput.value;
    const note = noteInput && noteInput.value ? noteInput.value.trim() : '';

    if (!accountId || amount == null || amount <= 0) {
        alert('請選擇帳戶並輸入有效金額');
        return;
    }
    if (type === 'transfer') {
        const toId = toAccountSelect && toAccountSelect.value;
        if (!toId || toId === accountId) {
            alert('請選擇不同的轉入帳戶');
            return;
        }
    } else {
        const categoryId = categorySelect && categorySelect.value;
        if (!categoryId) {
            alert('請選擇分類');
            return;
        }
    }

    const txn = {
        id: 'txn_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        type: type,
        accountId: accountId,
        amount: amount,
        date: date || new Date().toISOString().slice(0, 10),
        note: note
    };
    if (type === 'transfer') {
        txn.transferToAccountId = toAccountSelect && toAccountSelect.value;
    } else {
        txn.categoryId = categorySelect && categorySelect.value;
    }
    state.transactions.push(txn);
    saveAccountingData();
    renderAccountingList();
    document.getElementById('modal-accounting').classList.add('hidden');
    try { SoundFX.playSuccess(); } catch (_) {}
}

function showChatPage() {
    if (els.viewTasks) els.viewTasks.classList.add('hidden');
    if (els.viewObjectives) els.viewObjectives.classList.add('hidden');
    if (els.viewAccounting) els.viewAccounting.classList.add('hidden');
    if (els.viewSettings) els.viewSettings.classList.add('hidden');
    if (els.viewChat) els.viewChat.classList.remove('hidden');
    updateHeaderTitle('冒險相談');
    lucide.createIcons();
    if (els.headerHistoryWrap) els.headerHistoryWrap.classList.add('hidden');
    if (els.headerRightPlaceholder) els.headerRightPlaceholder.classList.remove('hidden');
}

function showSettingsPage() {
    if (els.viewChat) els.viewChat.classList.add('hidden');
    if (els.viewTasks) els.viewTasks.classList.add('hidden');
    if (els.viewObjectives) els.viewObjectives.classList.add('hidden');
    if (els.viewAccounting) els.viewAccounting.classList.add('hidden');
    if (els.viewSettings) els.viewSettings.classList.remove('hidden');
    updateHeaderTitle('設置');
    lucide.createIcons();
    if (els.headerHistoryWrap) els.headerHistoryWrap.classList.add('hidden');
    if (els.headerRightPlaceholder) els.headerRightPlaceholder.classList.remove('hidden');
}

function resetAllData() {
    const keys = [
        'pixel_chat_okrs',
        'pixel_api_key',
        'pixel_daily_tasks',
        'pixel_accounts',
        'pixel_categories',
        'pixel_transactions',
        'pixel_chat_messages',
        'pixel_font_size'
    ];
    keys.forEach(k => localStorage.removeItem(k));
    location.reload();
}

function showAccountingPage() {
    if (els.viewChat) els.viewChat.classList.add('hidden');
    if (els.viewTasks) els.viewTasks.classList.add('hidden');
    if (els.viewObjectives) els.viewObjectives.classList.add('hidden');
    if (els.viewSettings) els.viewSettings.classList.add('hidden');
    if (els.viewAccounting) els.viewAccounting.classList.remove('hidden');
    updateHeaderTitle('記帳');
    renderAccountingList();
    lucide.createIcons();
    if (els.headerHistoryWrap) els.headerHistoryWrap.classList.add('hidden');
    if (els.headerRightPlaceholder) els.headerRightPlaceholder.classList.remove('hidden');
}

function updateHeaderTitle(title) {
    var el = document.getElementById('header-title');
    if (el) el.textContent = title;
}

function updateTasksFilterUI() {
    if (!els.filterEndedTasks) return;
    if (state.tasksFilter === 'ended') {
        // 显示已结束任务时，按钮高亮
        els.filterEndedTasks.classList.add('bg-[#3498db]', 'border-[#f1c40f]');
        els.filterEndedTasks.classList.remove('bg-[#2c3e50]', 'border-white');
    } else {
        // 显示我的任务时，按钮恢复默认样式
        els.filterEndedTasks.classList.remove('bg-[#3498db]', 'border-[#f1c40f]');
        els.filterEndedTasks.classList.add('bg-[#2c3e50]', 'border-white');
    }
}

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}
function isSubtaskDone(subtask) {
    if (!subtask) return false;
    if ((subtask.type || 'one-time') === 'daily') {
        return (subtask.completedDates || []).includes(todayISO());
    }
    return !!subtask.done;
}
function getSubtaskCompletionEntries(kr) {
    const entries = [];
    if (!kr.subtasks) return entries;
    kr.subtasks.forEach(st => {
        const type = st.type || 'one-time';
        if (type === 'one-time' && st.done && st.completedAt) {
            entries.push({ title: st.title, date: st.completedAt });
        }
        if (type === 'daily' && st.completedDates) {
            st.completedDates.forEach(d => entries.push({ title: st.title, date: d }));
        }
    });
    entries.sort((a, b) => (b.date < a.date ? -1 : 1));
    return entries;
}

// 挑戰冒險圖示庫（每個 KR 依 id 穩定分配一個，皆為 Lucide 圖示名）
const CHALLENGE_ICONS = [
    'target',       // 靶心
    'sword',        // 劍
    'shield',       // 盾
    'trophy',       // 獎盃
    'flame',        // 火焰
    'book-open',    // 書
    'gem',          // 寶石
    'crown',        // 皇冠
    'scroll-text',  // 卷軸
    'crosshair',    // 準心
    'zap',          // 閃電
    'star',         // 星星
    'medal',        // 獎牌
    'flag',         // 旗幟
    'compass',      // 羅盤
    'mountain',     // 山
    'tent',         // 帳篷
    'key',          // 鑰匙
    'wallet',       // 錢包
    'piggy-bank',   // 存錢筒
    'dollar-sign',  // 金錢
    'sparkles',     // 閃光
    'trending-up',  // 上升
    'award',        // 獎項
];
function getKRIcon(okr, kr) {
    if (!kr || kr.id == null) return CHALLENGE_ICONS[0];
    const seed = (typeof okr?.id === 'number' ? okr.id : 0) * 31 + (typeof kr.id === 'number' ? kr.id : String(kr.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0));
    return CHALLENGE_ICONS[Math.abs(seed) % CHALLENGE_ICONS.length];
}
// 保留舊名以相容其他呼叫（如需要可改為 getKRIcon(okr, kr)）
function getOKRIcon(okr) {
    return CHALLENGE_ICONS[Math.abs(okr?.id ?? 0) % CHALLENGE_ICONS.length];
}

function isOKRCompleted(okr) {
    return okr.keyResults.every(kr => kr.current >= kr.target);
}

// 今日任務頁：扁平化為「一個一個任務」。沒有「KR 即任務」— 每個 KR 下至少有一個任務（若無則 migration 已補同名任務）
function getFlatTasksFromOKRList(okrList) {
    const tasks = [];
    okrList.forEach(okr => {
        okr.keyResults.forEach(kr => {
            if (!kr.subtasks || kr.subtasks.length === 0) return;
            kr.subtasks.forEach(st => {
                const isDaily = (st.type || 'one-time') === 'daily';
                const completed = isDaily ? (st.completedDates || []).includes(todayISO()) : !!st.done;
                tasks.push({ type: 'subtask', okr, kr, subtask: st, title: st.title, isDaily, completed });
            });
        });
    });
    return tasks;
}

function getOKRProgress(okr) {
    const total = okr.keyResults.length;
    const done = okr.keyResults.filter(kr => kr.current >= kr.target).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { done, total, pct };
}

function renderTaskCards() {
    if (!els.taskListContent || !els.taskListEmpty) return;
    const isEnded = state.tasksFilter === 'ended';
    const list = state.okrs.filter(okr => isOKRCompleted(okr) === isEnded);
    els.taskListContent.innerHTML = '';
    
    if (list.length === 0) {
        els.taskListContent.classList.add('hidden');
        els.taskListEmpty.classList.remove('hidden');
        els.taskListEmpty.innerHTML = isEnded
            ? '<p class="font-bold">尚無已結束的任務</p><p class="mt-1">完成關鍵結果 (KR) 後會出現在這裡。</p>'
            : '<p class="font-bold">尚無任務</p><p class="mt-1">前往冒險相談與露米娜制定冒險章節 (Object) 與關鍵結果 (KR)，任務會出現在這裡。</p>';
        renderTaskDetail(null);
        return;
    }
    
    els.taskListEmpty.classList.add('hidden');
    els.taskListContent.classList.remove('hidden');
    
    const flatTasks = getFlatTasksFromOKRList(list);
    if (flatTasks.length === 0) {
        els.taskListContent.classList.add('hidden');
        els.taskListEmpty.classList.remove('hidden');
        els.taskListEmpty.innerHTML = isEnded
            ? '<p class="font-bold">尚無已結束的任務</p>'
            : '<p class="font-bold">尚無任務</p><p class="mt-1">前往冒險相談制定冒險章節與關鍵結果，並為 KR 新增任務後會出現在這裡。</p>';
        renderTaskDetail(null);
        updateTaskView();
        return;
    }
    
    flatTasks.forEach(task => {
        const { okr, kr } = task;
        if (!kr.subtasks || kr.subtasks.length === 0) return;
        const iconName = getKRIcon(okr, kr);
        const safeIconName = (iconName && CHALLENGE_ICONS.includes(iconName)) ? iconName : CHALLENGE_ICONS[0];
        const iconIdx = Math.max(0, CHALLENGE_ICONS.indexOf(safeIconName)) % 8;
        const fallbackEmoji = ['🎯', '⚔️', '🛡️', '🏆', '📚', '💎', '⭐', '🔑'][iconIdx];
        const subtitle = `${escapeHtml(okr.objective)} · ${escapeHtml(kr.title)}`;
        let progressText = '';
        let pct = 0;
        if (task.type === 'kr') {
            progressText = (kr.target != null && kr.target !== '' && Number.isFinite(Number(kr.target))) ? `${kr.current ?? 0}/${kr.target}` : '—';
            pct = (kr.target != null && Number(kr.target) > 0) ? Math.min(100, Math.round(((kr.current ?? 0) / Number(kr.target)) * 100)) : 0;
        } else if (task.isDaily) {
            const n = (task.subtask.completedDates || []).length;
            progressText = `已完成 ${n} 天`;
            pct = 0;
        } else {
            progressText = task.completed ? '已完成' : '未完成';
            pct = task.completed ? 100 : 0;
        }
        const isSelected = (task.type === 'kr' && state.selectedKR && state.selectedKR.okrId === okr.id && state.selectedKR.krId === kr.id) ||
            (task.type === 'subtask' && state.selectedSubtask && state.selectedSubtask.okrId === okr.id && state.selectedSubtask.krId === kr.id && state.selectedSubtask.subtaskId === task.subtask.id);
        const row = document.createElement('div');
        row.className = `flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${isSelected ? 'bg-[#2a2a3f] border-amber-500/60' : 'bg-[#1e2233] border-slate-600/50 hover:bg-[#252840]'}`;
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
        row.setAttribute('title', subtitle);
        row.addEventListener('click', () => {
            state.selectedKR = null;
            state.selectedSubtask = { okrId: okr.id, krId: kr.id, subtaskId: task.subtask.id };
            state.showTaskDetail = true;
            updateTaskView();
            renderTaskCards();
            SoundFX.playType();
        });
        row.innerHTML = `
            <div class="shrink-0 relative w-12 h-12 rounded-full border-2 border-amber-500/90 flex items-center justify-center bg-gradient-to-br from-amber-900/50 to-slate-800 shadow-inner" aria-hidden="true">
                <i data-lucide="${safeIconName}" class="w-6 h-6 text-amber-400 lucide-icon"></i>
                <span class="lucide-fallback absolute text-xl leading-none pointer-events-none">${fallbackEmoji}</span>
            </div>
            <div class="flex-1 min-w-0">
                <div class="font-bold text-white truncate ${task.completed ? 'line-through' : ''}">${escapeHtml(task.title)}</div>
                <div class="text-xs text-slate-400 truncate mt-0.5">${subtitle}</div>
                <div class="h-2 w-full bg-slate-600 rounded-full overflow-hidden mt-2">
                    <div class="h-full bg-amber-500 rounded-full transition-all" style="width:${pct}%"></div>
                </div>
                        </div>
                    `;
        els.taskListContent.appendChild(row);
    });
    
    if (!state.selectedSubtask && !state.selectedKR) {
        renderTaskDetail(null);
    } else if (state.selectedSubtask) {
        renderTaskDetail(state.selectedSubtask);
    } else {
        renderTaskDetail(null);
    }
    
    // 更新视图（确保移动端正确显示）
    updateTaskView();
    
    const lucideLib = typeof lucide !== 'undefined' ? lucide : typeof Lucide !== 'undefined' ? Lucide : null;
    if (lucideLib && typeof lucideLib.createIcons === 'function') {
        try {
            lucideLib.createIcons({ root: els.taskListContent });
        } catch (_) {
            lucideLib.createIcons();
        }
        els.taskListContent.querySelectorAll('.lucide-fallback').forEach(el => {
            if (el.parentElement && el.parentElement.querySelector('svg')) el.style.display = 'none';
        });
    }
}

function renderTaskDetail(subtaskInfo) {
    if (!els.taskDetailContent || !els.taskDetailEmpty) return;
    
    // 若選中的是 KR（無子任務 = 一個按鈕「完成任務」+「新增任務」；有子任務 = 此 KR 的任務列表 + 新增 + 完成記錄）
    if (state.selectedKR) {
        const okr = state.okrs.find(o => o.id === state.selectedKR.okrId);
        const kr = okr && okr.keyResults.find(k => k.id === state.selectedKR.krId);
        if (!okr || !kr) {
            state.selectedKR = null;
            renderTaskDetail(null);
            return;
        }
        if (!kr.subtasks) kr.subtasks = [];
        els.taskDetailEmpty.classList.add('hidden');
        const krDone = kr.current >= kr.target;

        if (kr.subtasks.length === 0) {
            els.taskDetailContent.innerHTML = `
                <div class="max-w-3xl mx-auto pb-8">
                    <button type="button" onclick="backToTaskList()" class="mb-4 flex items-center gap-1.5 py-2 px-0 text-slate-400 hover:text-white text-sm font-bold transition-colors">
                        <i data-lucide="arrow-left" class="w-5 h-5"></i> 返回
                    </button>
                    <div class="mb-4">
                        <div class="text-xs text-slate-500 font-medium mb-1">冒險章節 · ${escapeHtml(okr.objective)}</div>
                        <div class="text-sm text-slate-400 mb-1">關鍵結果 · ${escapeHtml(kr.title)}</div>
                        <h1 class="text-xl md:text-2xl font-black text-white leading-tight">${escapeHtml(kr.title)}</h1>
                    </div>
                    <div class="mt-8 space-y-3">
                        <button type="button" onclick="completeKRAsTask(${okr.id}, ${kr.id}); backToTaskList(); renderTaskCards();" 
                            class="w-full py-4 px-6 rounded-lg font-black text-lg transition-all ${krDone ? 'bg-slate-600 text-slate-400 cursor-default' : 'bg-amber-500 hover:bg-amber-400 text-black border-2 border-amber-400'}">
                            ${krDone ? '已完成' : '完成任務'}
                        </button>
                        <p class="text-xs text-slate-500 text-center">或將此關鍵結果拆成多個任務（例如一次性「選擇一款記帳軟體」、每日「記帳」）</p>
                        <button type="button" onclick="addSubtaskToKR(${okr.id}, ${kr.id}); renderTaskDetail(null);" 
                            class="w-full py-3 px-4 rounded-lg font-bold text-sm border-2 border-slate-500 text-slate-300 hover:bg-slate-600 transition-colors">
                            + 新增任務
                        </button>
                    </div>
                </div>
            `;
        } else {
            const today = todayISO();
            const dailyTasks = kr.subtasks.filter(st => (st.type || 'one-time') === 'daily');
            const allCompletedDates = dailyTasks.reduce((arr, st) => arr.concat(st.completedDates || []), []);
            const logEntries = getSubtaskCompletionEntries(kr);
            const logHtml = logEntries.length ? logEntries.map(e => {
                const d = e.date.replace(/-/g, '/');
                return `<div class="flex justify-between items-center py-2 border-b border-slate-600/30 text-sm"><span class="text-white font-medium">${escapeHtml(e.title)}</span><span class="text-slate-400">${d}</span></div>`;
            }).join('') : '<p class="text-slate-500 text-sm py-4">尚無完成記錄</p>';
            const taskRows = kr.subtasks.map(st => {
                const isDaily = (st.type || 'one-time') === 'daily';
                const done = isDaily ? (st.completedDates || []).includes(today) : !!st.done;
                const title = escapeHtml(st.title);
                return `<div class="flex items-center gap-3 py-3 border-b border-slate-600/50 last:border-b-0">
                    <span class="text-lg">${isDaily ? '📅' : '✓'}</span>
                    <span class="flex-1 font-bold ${done ? 'text-slate-400 line-through' : 'text-white'}">${title}</span>
                    <button type="button" onclick="state.selectedKR=null; state.selectedSubtask={okrId:${okr.id},krId:${kr.id},subtaskId:${typeof st.id === 'string' ? JSON.stringify(st.id) : st.id}}; renderTaskCards(); renderTaskDetail(state.selectedSubtask);" class="text-xs text-amber-400 hover:underline">查看</button>
                </div>`;
            }).join('');
            els.taskDetailContent.innerHTML = `
                <div class="max-w-3xl mx-auto pb-8">
                    <button type="button" onclick="backToTaskList()" class="mb-4 flex items-center gap-1.5 py-2 px-0 text-slate-400 hover:text-white text-sm font-bold transition-colors">
                        <i data-lucide="arrow-left" class="w-5 h-5"></i> 返回
                    </button>
                    <div class="mb-4">
                        <div class="text-xs text-slate-500 font-medium mb-1">冒險章節 · ${escapeHtml(okr.objective)}</div>
                        <h1 class="text-xl font-black text-white">${escapeHtml(kr.title)}</h1>
                    </div>
                    <div class="mb-6">
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="text-sm font-bold text-slate-400 uppercase">任務</h3>
                            <button type="button" onclick="addSubtaskToKR(${okr.id}, ${kr.id}); renderTaskDetail(null);" class="text-xs font-bold text-amber-400 hover:text-amber-300">+ 新增任務</button>
                        </div>
                        <div class="bg-[#34495e] border-2 border-slate-600 rounded-lg p-3">${taskRows}</div>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-slate-400 uppercase mb-2">任務完成記錄</h3>
                        <div class="bg-[#34495e] border-2 border-slate-600 rounded-lg p-3 max-h-48 overflow-y-auto">${logHtml}</div>
                    </div>
                </div>
            `;
        }
        const lucideLib = typeof lucide !== 'undefined' ? lucide : typeof Lucide !== 'undefined' ? Lucide : null;
        if (lucideLib && typeof lucideLib.createIcons === 'function') {
            try { lucideLib.createIcons({ root: els.taskDetailContent }); } catch (_) { lucideLib.createIcons(); }
        }
        return;
    }
    
    if (!subtaskInfo) {
        els.taskDetailContent.innerHTML = '';
        els.taskDetailEmpty.classList.remove('hidden');
        if (window.innerWidth < 768) {
            state.showTaskDetail = false;
            updateTaskView();
        }
        return;
    }
    
    els.taskDetailEmpty.classList.add('hidden');
    
    const okr = state.okrs.find(o => o.id === subtaskInfo.okrId);
    if (!okr) return;
    const kr = okr.keyResults.find(k => k.id === subtaskInfo.krId);
    if (!kr || !kr.subtasks) return;
    const subtask = kr.subtasks.find(s => s.id === subtaskInfo.subtaskId);
    if (!subtask) return;
    
    const isDaily = (subtask.type || 'one-time') === 'daily';
    
    if (isDaily) {
        // 每日任務：挑戰 UI（標記今日完成、每日圓點、完成記錄）
        const today = todayISO();
        const completedDates = (subtask.completedDates || []).slice().sort();
        const doneToday = completedDates.includes(today);
        const completedCount = completedDates.length;
        const now = new Date();
        const daysToShow = [];
        for (let offset = -14; offset <= 7; offset++) {
            const d = new Date(now);
            d.setDate(d.getDate() + offset);
            daysToShow.push(d.toISOString().slice(0, 10));
        }
        const dayCircles = daysToShow.map(dateStr => {
            const isToday = dateStr === today;
            const isDone = completedDates.includes(dateStr);
            const label = isToday ? '今' : dateStr.slice(5).replace(/-/, '/');
            const circleClass = isDone ? 'bg-amber-500 text-white border-amber-500' : isToday ? 'bg-slate-600 text-white border-slate-500' : 'bg-transparent text-slate-400 border-slate-600';
            return `<div class="shrink-0 w-9 h-9 rounded-full border-2 ${circleClass} flex items-center justify-center text-xs font-bold" title="${dateStr}">${isDone && !isToday ? '<i data-lucide="check" class="w-4 h-4"></i>' : label}</div>`;
        }).join('');
        const logEntries = completedDates.map(d => ({ title: subtask.title, date: d })).reverse();
        const logHtml = logEntries.length ? logEntries.map(e => {
            const d = e.date.replace(/-/g, '/');
            return `<div class="flex justify-between items-center py-2 border-b border-slate-600/30 text-sm"><span class="text-white font-medium">${escapeHtml(e.title)}</span><span class="text-slate-400">${d}</span></div>`;
        }).join('') : '<p class="text-slate-500 text-sm py-4">尚無完成記錄</p>';
    els.taskDetailContent.innerHTML = `
            <div class="max-w-3xl mx-auto pb-8">
                <button type="button" onclick="backToTaskList()" class="mb-4 flex items-center gap-1.5 py-2 px-0 text-slate-400 hover:text-white text-sm font-bold transition-colors">
                    <i data-lucide="arrow-left" class="w-5 h-5"></i> 返回
            </button>
                <div class="mb-4">
                    <div class="text-xs text-slate-500 font-medium mb-1">冒險章節 · ${escapeHtml(okr.objective)}</div>
                    <div class="text-sm text-slate-400 mb-1">關鍵結果 · ${escapeHtml(kr.title)}</div>
                    <h1 class="text-xl md:text-2xl font-black text-white leading-tight">${escapeHtml(subtask.title)}</h1>
                </div>
                <div class="bg-[#34495e] border-2 border-slate-600 rounded-lg p-4 mb-6">
                    <h2 class="text-sm font-black text-white mb-3">你的挑戰進度</h2>
                    <p class="text-sm text-slate-400 mb-3">完成 ${completedCount} 天</p>
                    <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-retro">${dayCircles}</div>
                    ${doneToday ? '<p class="mt-3 text-sm font-bold text-amber-400">恭喜！你已完成今日挑戰</p>' : ''}
                    <div class="mt-4">
                        <button type="button" onclick="toggleSubtask(${okr.id}, ${kr.id}, ${subtask.id}); renderTaskDetail(state.selectedSubtask); renderTaskCards();" 
                            class="w-full py-3 px-4 rounded-lg font-black ${doneToday ? 'bg-slate-600 text-slate-400' : 'bg-amber-500 hover:bg-amber-400 text-black'} transition-all">
                            ${doneToday ? '今日已完成' : '標記今日完成'}
                    </button>
                </div>
            </div>
                <div>
                    <h3 class="text-sm font-bold text-slate-400 uppercase mb-2">任務完成記錄</h3>
                    <div class="bg-[#34495e] border-2 border-slate-600 rounded-lg p-3 max-h-64 overflow-y-auto">${logHtml}</div>
                    </div>
            </div>
        `;
    } else {
        // 一次性任務：只有一個按鈕「完成任務」
        const done = !!subtask.done;
        els.taskDetailContent.innerHTML = `
            <div class="max-w-3xl mx-auto pb-8">
                <button type="button" onclick="backToTaskList()" class="mb-4 flex items-center gap-1.5 py-2 px-0 text-slate-400 hover:text-white text-sm font-bold transition-colors">
                    <i data-lucide="arrow-left" class="w-5 h-5"></i> 返回
                    </button>
                <div class="mb-4">
                    <div class="text-xs text-slate-500 font-medium mb-1">冒險章節 · ${escapeHtml(okr.objective)}</div>
                    <div class="text-sm text-slate-400 mb-1">關鍵結果 · ${escapeHtml(kr.title)}</div>
                    <h1 class="text-xl md:text-2xl font-black text-white leading-tight ${done ? 'line-through text-slate-400' : ''}">${escapeHtml(subtask.title)}</h1>
                </div>
                <div class="mt-8">
                    <button type="button" onclick="toggleSubtask(${okr.id}, ${kr.id}, ${subtask.id}); renderTaskDetail(state.selectedSubtask); renderTaskCards();" 
                        class="w-full py-4 px-6 rounded-lg font-black text-lg transition-all ${done ? 'bg-slate-600 text-slate-400 cursor-default' : 'bg-amber-500 hover:bg-amber-400 text-black border-2 border-amber-400'}">
                        ${done ? '已完成' : '完成任務'}
                        </button>
            </div>
        </div>
    `;
    }
    
    const lucideLib = typeof lucide !== 'undefined' ? lucide : typeof Lucide !== 'undefined' ? Lucide : null;
    if (lucideLib && typeof lucideLib.createIcons === 'function') {
        try { lucideLib.createIcons({ root: els.taskDetailContent }); } catch (_) { lucideLib.createIcons(); }
    }
}

window.selectSubtask = function(okrId, krId, subtaskId) {
    state.selectedSubtask = { okrId, krId, subtaskId };
    state.selectedKR = null;
    state.showTaskDetail = true;
    state.expandedObjectives[okrId] = true;
    updateTaskView();
    renderTaskCards();
    SoundFX.playType();
};

window.selectKRAsTask = function(okrId, krId) {
    state.selectedKR = { okrId, krId };
    state.selectedSubtask = null;
    state.showTaskDetail = true;
    state.expandedObjectives[okrId] = true;
    state.expandedKR[`${okrId}_${krId}`] = true;
    updateTaskView();
    renderTaskCards();
    SoundFX.playType();
};

window.toggleObjective = function(okrId) {
    // 切换Objective的展开/收起状态
    state.expandedObjectives[okrId] = !state.expandedObjectives[okrId];
    renderTaskCards();
    SoundFX.playType();
};

window.toggleKR = function(okrId, krId) {
    const key = `${okrId}_${krId}`;
    state.expandedKR[key] = !state.expandedKR[key];
    renderTaskCards();
    SoundFX.playType();
};

function updateTaskView() {
    if (!els.taskListSidebar || !els.taskDetailPanel) return;
    
    // 移动端：根据 showTaskDetail 切换视图
    if (window.innerWidth < 768) { // md breakpoint
        if (state.showTaskDetail) {
            // 显示详情，隐藏列表
            els.taskListSidebar.style.transform = 'translateX(-100%)';
            els.taskDetailPanel.style.transform = 'translateX(0)';
        } else {
            // 显示列表，隐藏详情
            els.taskListSidebar.style.transform = 'translateX(0)';
            els.taskDetailPanel.style.transform = 'translateX(100%)';
        }
    } else {
        // 桌面端：始终显示两者
        els.taskListSidebar.style.transform = 'translateX(0)';
        els.taskDetailPanel.style.transform = 'translateX(0)';
    }
}

window.backToTaskList = function() {
    state.showTaskDetail = false;
    updateTaskView();
    SoundFX.playType();
};

function toggleSidebar() {
    state.isSidebarOpen = !state.isSidebarOpen;
    if (state.isSidebarOpen) {
        els.sidebar.classList.remove('translate-x-full');
        els.sidebar.classList.add('translate-x-0');
        els.sidebarBadge.classList.add('hidden');
        renderTotalQuestList();
        updateTaskViewUI();
        if (state.taskView === 'daily') {
            renderDailyTasks();
        } else {
            renderAllTasks();
        }
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
    
    // 保存聊天记录到 localStorage
    try {
        localStorage.setItem('pixel_chat_messages', JSON.stringify(state.messages));
    } catch (e) {
        console.error('Failed to save messages:', e);
    }

    if (animate) {
        renderSingleMessage(msgObj, true);
    } else {
        renderMessages();
    }
}

// 解析 [OKR-DRAFT]...[/OKR-DRAFT] 區塊，回傳 { before, draftLines, after } 或 null
function parseOKRDraftBlock(text) {
    const open = '[OKR-DRAFT]';
    const close = '[/OKR-DRAFT]';
    const i = text.indexOf(open);
    const j = text.indexOf(close, i);
    if (i === -1 || j === -1 || j <= i) return null;
    const before = text.slice(0, i).trim();
    const after = text.slice(j + close.length).trim();
    const draftRaw = text.slice(i + open.length, j).trim();
    const draftLines = draftRaw.split('\n').map(l => l.trim()).filter(Boolean);
    return { before, draftLines, after };
}

// 從一行 KR 文字取出信心指數，例如 "xxx (7/10)" -> 7
function getConfidenceFromLine(line) {
    const m = line.match(/\((\d+)\s*\/\s*10\)/);
    return m ? parseInt(m[1], 10) : null;
}

// 從標題移除句尾的信心標註，例如 "xxx (7/10)" -> "xxx"，"(待你填寫信心)" 等一併移除
function stripConfidenceFromTitle(title) {
    if (!title || typeof title !== 'string') return title;
    return title
        .replace(/\s*\(\d+\s*\/\s*10\)\s*$/g, '')
        .replace(/\s*（\d+\s*／\s*10）\s*$/g, '')
        .replace(/\s*\((?:待你填寫信心|待填寫)\)\s*$/gi, '')
        .trim();
}

// 將 draftLines 解析為 { objective, krs: [{ title, confidence }] }；title 不包含 (7/10)
function parseDraftLinesToData(draftLines) {
    let objective = '';
    const krs = [];
    for (const line of draftLines) {
        const oMatch = line.match(/^(?:目標\s*[（(]?O[）)]?\s*[：:]\s*|O\s*[：:]\s*)(.+)$/i);
        if (oMatch) {
            objective = oMatch[1].trim();
            continue;
        }
        const krMatch = line.match(/^(?:KR\s*)?(\d+)[.．、：:]\s*(.+)$/);
        if (krMatch) {
            const rawTitle = krMatch[2].trim();
            const confidence = getConfidenceFromLine(rawTitle) || 7;
            const title = stripConfidenceFromTitle(rawTitle);
            krs.push({ title, confidence });
        }
    }
    return { objective, krs };
}

// 渲染牛皮紙任務單 HTML（可點擊 Edit KR 與難易度）；draftData = { objective, krs }，messageId 用於事件
function renderKraftPaperDraft(draftData, messageId) {
    const { objective, krs } = draftData;
    if (!objective && krs.length === 0) return '';

    let krHtml = krs.map((kr, i) => {
        const filled = Math.round((kr.confidence / 10) * 5);
        let stars = '';
        for (let s = 0; s < 5; s++) {
            stars += `<span class="kraft-paper-star ${s < filled ? '' : 'empty'}" data-star-index="${s}" role="button" title="難易度 ${s + 1} 顆星">★</span>`;
        }
        const titleDisplay = escapeHtml(stripConfidenceFromTitle(kr.title));
        return `<div class="kraft-paper-kr-item" data-kr-index="${i}">
            <span class="kraft-paper-kr-num">${i + 1}.</span>
            <span class="kraft-paper-kr-edit cursor-pointer hover:underline" data-kr-index="${i}" role="button" title="點擊編輯 KR">${titleDisplay}</span>
            <span class="kraft-paper-kr-meta">
                <span class="kraft-paper-stars">${stars}</span>
                <span class="kraft-paper-confidence">信心指數 ${kr.confidence}/10</span>
            </span>
        </div>`;
    }).join('');

    const dataAttr = messageId != null ? ` data-message-id="${String(messageId)}"` : '';
    return `
        <div class="kraft-paper kraft-paper-message-box"${dataAttr}>
            <div class="kraft-paper-title">📜 OKR 初稿</div>
            ${objective ? `<div class="kraft-paper-o">目標 (O)</div><div class="kraft-paper-o-value">${escapeHtml(objective)}</div>` : ''}
            ${krHtml ? `<div class="kraft-paper-kr-label">關鍵結果 (KR) 暫定</div>${krHtml}` : ''}
        </div>
    `;
}

// 將一段文字依段落（雙換行或 |||）拆成多個氣泡內容，每個段落一個氣泡
function splitParagraphsToBubbles(text) {
    if (!text || !text.trim()) return [formatText('')];
    const paragraphs = text.split(/\n\s*\n|\|\|\|/).map(p => p.trim()).filter(p => p);
    return paragraphs.length ? paragraphs.map(p => formatText(p)) : [formatText(text)];
}

// 若訊息含 [OKR-DRAFT]，拆成「前段多氣泡」+「任務單」+「後段多氣泡」；前/後段依 ||| 再拆成多個 bubble；無 draft 時依段落拆成多氣泡
function getMessageContentParts(text, messageId) {
    const block = parseOKRDraftBlock(text);
    if (!block) {
        const bubbles = splitParagraphsToBubbles(text);
        return { beforeBubbles: bubbles, outside: '', afterBubbles: [] };
    }
    const draftData = state.draftEdits[messageId] || parseDraftLinesToData(block.draftLines);
    const beforeBubbles = (block.before || '')
        .split('|||')
        .map(p => p.trim())
        .filter(p => p)
        .map(p => formatText(p));
    const afterBubbles = (block.after || '')
        .split('|||')
        .map(p => p.trim())
        .filter(p => p)
        .map(p => formatText(p));
    return {
        beforeBubbles,
        outside: renderKraftPaperDraft(draftData, messageId),
        afterBubbles
    };
}

// 僅氣泡內內容（供其他處使用；無 [OKR-DRAFT] 時為完整格式內文，單一氣泡）
function formatMessageContent(text, messageId) {
    const parts = getMessageContentParts(text, messageId);
    const all = (parts.beforeBubbles || []).concat(parts.afterBubbles || []);
    return all.length ? all[0] : formatText(text);
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

    const parts = getMessageContentParts(msg.text, msg.id);
    const beforeBubbles = parts.beforeBubbles || [];
    const afterBubbles = parts.afterBubbles || [];
    const taskListOutside = parts.outside
        ? `<div class="mt-2 w-full max-w-3xl kraft-paper-outside" data-message-id="${msg.id != null ? String(msg.id) : ''}">${parts.outside}</div>`
        : '';

    const bubbleHtml = (html) => html ? `<div class="${bubbleClass}" data-message-id="${msg.id != null ? String(msg.id) : ''}">${html}</div>` : '';
    const beforeHtml = beforeBubbles.map(bubbleHtml).join('');
    const afterHtml = afterBubbles.map(bubbleHtml).join('');

    return `
        <div class="shrink-0 w-10 h-10 sm:w-12 sm:h-12 border-2 border-black flex items-center justify-center overflow-hidden shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] ${avatarBg}">
            ${avatarHTML}
        </div>
        <div class="max-w-[85%] flex flex-col gap-3 ${isUser ? 'items-end' : 'items-start'}">
            ${!isUser ? `<span class="${senderColor} text-xs font-bold uppercase tracking-wider block">${senderName}</span>` : ''}
            ${beforeHtml}
            ${taskListOutside}
            ${afterHtml}
        </div>
    `;
}

function renderMessages() {
    const container = els.messagesContainer;
    container.innerHTML = '';
    state.messages.forEach(msg => {
        const wrapper = document.createElement('div');
        wrapper.className = `flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`;
        wrapper.dataset.messageId = msg.id != null ? String(msg.id) : '';
        wrapper.innerHTML = createMessageHTML(msg);
        container.appendChild(wrapper);
    });
    container.appendChild(els.loadingIndicator);
    lucide.createIcons();
    container.scrollTop = container.scrollHeight;
}

// 重繪單則訊息（用於 OKR 初稿編輯後更新該則氣泡）
function rerenderMessage(messageId) {
    const container = els.messagesContainer;
    const wrapper = container.querySelector(`[data-message-id="${messageId}"]`);
    if (!wrapper) return;
    const msg = state.messages.find(m => m.id != null && String(m.id) === String(messageId));
    if (!msg) return;
    wrapper.innerHTML = createMessageHTML(msg);
    lucide.createIcons();
}

function renderSingleMessage(msg, animate = false) {
    const container = els.messagesContainer;
    const wrapper = document.createElement('div');
    wrapper.className = `flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''} ${animate ? 'animate-pop' : ''}`;
    wrapper.dataset.messageId = msg.id != null ? String(msg.id) : '';
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

// --- 任務視圖切換 UI ---
function updateTaskViewUI() {
    if (!els.btnDailyTasks || !els.btnAllTasks || !els.dailyTasksSection || !els.allTasksSection) return;
    if (state.taskView === 'daily') {
        els.btnDailyTasks.classList.add('bg-[#f1c40f]', 'text-[#5d4037]', 'border-black', 'font-black');
        els.btnDailyTasks.classList.remove('bg-white', 'text-slate-600', 'border-[#d2b48c]', 'font-bold');
        els.btnAllTasks.classList.remove('bg-[#f1c40f]', 'text-[#5d4037]', 'border-black', 'font-black');
        els.btnAllTasks.classList.add('bg-white', 'text-slate-600', 'border-[#d2b48c]', 'font-bold');
        els.dailyTasksSection.classList.remove('hidden');
        els.allTasksSection.classList.add('hidden');
    } else {
        els.btnAllTasks.classList.add('bg-[#f1c40f]', 'text-[#5d4037]', 'border-black', 'font-black');
        els.btnAllTasks.classList.remove('bg-white', 'text-slate-600', 'border-[#d2b48c]', 'font-bold');
        els.btnDailyTasks.classList.remove('bg-[#f1c40f]', 'text-[#5d4037]', 'border-black', 'font-black');
        els.btnDailyTasks.classList.add('bg-white', 'text-slate-600', 'border-[#d2b48c]', 'font-bold');
        els.allTasksSection.classList.remove('hidden');
        els.dailyTasksSection.classList.add('hidden');
    }
}

// --- 更新 KR 選擇器 ---
function updateKrSelect() {
    if (!els.dailyTaskKrSelect) return;
    els.dailyTaskKrSelect.innerHTML = '<option value="">選擇 KR...</option>';
    state.okrs.forEach(okr => {
        okr.keyResults.forEach(kr => {
            if (kr.current < kr.target) { // 只显示未完成的KR
                const option = document.createElement('option');
                option.value = `${okr.id}_${kr.id}`;
                const oText = okr.objective.length > 20 ? okr.objective.substring(0, 20) + '...' : okr.objective;
                const krText = kr.title.length > 25 ? kr.title.substring(0, 25) + '...' : kr.title;
                option.textContent = `${oText} - ${krText}`;
                els.dailyTaskKrSelect.appendChild(option);
            }
        });
    });
}

// --- 任務頁：每日任務（顯示 KR 的 subtasks）---
function renderDailyTasks() {
    if (!els.dailyTasksList || !els.dailyTasksEmpty) return;
    
    // 收集所有未完成KR的subtasks
    const allSubtasks = [];
    state.okrs.forEach(okr => {
        okr.keyResults.forEach(kr => {
            if (kr.current < kr.target && kr.subtasks && kr.subtasks.length > 0) {
                kr.subtasks.forEach(subtask => {
                    allSubtasks.push({
                        ...subtask,
                        okrId: okr.id,
                        krId: kr.id,
                        okrTitle: okr.objective,
                        krTitle: kr.title
                    });
                });
            }
        });
    });
    
    if (allSubtasks.length === 0) {
        els.dailyTasksList.innerHTML = '';
        els.dailyTasksList.classList.add('hidden');
        els.dailyTasksEmpty.classList.remove('hidden');
        updateKrSelect();
        return;
    }
    
    els.dailyTasksEmpty.classList.add('hidden');
    els.dailyTasksList.classList.remove('hidden');
    els.dailyTasksList.innerHTML = '';
    
    allSubtasks.forEach(subtask => {
        const done = isSubtaskDone(subtask);
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 py-2 px-3 bg-white border-2 border-[#d2b48c]';
        row.innerHTML = `
            <button type="button" onclick="toggleSubtask(${subtask.okrId}, ${subtask.krId}, ${subtask.id})" class="shrink-0 p-0.5 rounded border-2 border-black ${done ? 'bg-[#2ecc71] text-white' : 'bg-white text-slate-400'}">
                <i data-lucide="${done ? 'check' : 'circle'}" class="w-4 h-4"></i>
            </button>
            <div class="flex-1 min-w-0">
                <span class="text-xs text-slate-500 font-bold block mb-0.5">${escapeHtml(subtask.krTitle)}</span>
                <span class="text-sm font-bold ${done ? 'text-slate-400 line-through' : 'text-slate-800'}">${escapeHtml(subtask.title)}</span>
            </div>
            <button type="button" onclick="deleteSubtask(${subtask.okrId}, ${subtask.krId}, ${subtask.id})" class="text-slate-400 hover:text-red-500 p-1">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        `;
        els.dailyTasksList.appendChild(row);
    });
    
    updateKrSelect();
    lucide.createIcons();
}

// --- 任務頁：全部任務 ---
function renderAllTasks() {
    if (!els.allTasksList || !els.allTasksEmpty) return;
    
    // 收集所有KR的subtasks
    const allSubtasks = [];
    state.okrs.forEach(okr => {
        okr.keyResults.forEach(kr => {
            if (kr.subtasks && kr.subtasks.length > 0) {
                kr.subtasks.forEach(subtask => {
                    allSubtasks.push({
                        ...subtask,
                        okrId: okr.id,
                        krId: kr.id,
                        okrTitle: okr.objective,
                        krTitle: kr.title,
                        krCompleted: kr.current >= kr.target
                    });
                });
            }
        });
    });
    
    if (allSubtasks.length === 0) {
        els.allTasksList.innerHTML = '';
        els.allTasksList.classList.add('hidden');
        els.allTasksEmpty.classList.remove('hidden');
        return;
    }
    
    els.allTasksEmpty.classList.add('hidden');
    els.allTasksList.classList.remove('hidden');
    els.allTasksList.innerHTML = '';
    
    // 按OKR分组显示
    const groupedByOkr = {};
    allSubtasks.forEach(subtask => {
        const key = `${subtask.okrId}_${subtask.okrTitle}`;
        if (!groupedByOkr[key]) {
            groupedByOkr[key] = {
                okrTitle: subtask.okrTitle,
                subtasks: []
            };
        }
        groupedByOkr[key].subtasks.push(subtask);
    });
    
    Object.values(groupedByOkr).forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.className = 'mb-4 bg-[#f5f5f5] border-2 border-[#d2b48c] p-3';
        groupEl.innerHTML = `
            <h4 class="text-xs font-black text-[#5d4037] mb-2 uppercase">${escapeHtml(group.okrTitle)}</h4>
            <div class="space-y-1.5">
                ${group.subtasks.map(subtask => {
                    const done = isSubtaskDone(subtask);
                    return `
                    <div class="flex items-center gap-2 py-1.5 px-2 bg-white border border-[#d2b48c]">
                        <button type="button" onclick="toggleSubtask(${subtask.okrId}, ${subtask.krId}, ${subtask.id})" class="shrink-0 p-0.5 rounded border-2 border-black ${done ? 'bg-[#2ecc71] text-white' : 'bg-white text-slate-400'}">
                            <i data-lucide="${done ? 'check' : 'circle'}" class="w-3.5 h-3.5"></i>
                        </button>
                        <div class="flex-1 min-w-0">
                            <span class="text-[10px] text-slate-500 font-bold block">${escapeHtml(subtask.krTitle)}</span>
                            <span class="text-xs font-bold ${done ? 'text-slate-400 line-through' : 'text-slate-800'}">${escapeHtml(subtask.title)}</span>
                        </div>
                        <button type="button" onclick="deleteSubtask(${subtask.okrId}, ${subtask.krId}, ${subtask.id})" class="text-slate-400 hover:text-red-500 p-0.5">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                `; }).join('')}
            </div>
        `;
        els.allTasksList.appendChild(groupEl);
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
    const krSelect = els.dailyTaskKrSelect.value;
    if (!title || !krSelect) return;
    
    const [okrId, krId] = krSelect.split('_').map(Number);
    const okr = state.okrs.find(o => o.id === okrId);
    if (!okr) return;
    
    const kr = okr.keyResults.find(k => k.id === krId);
    if (!kr) return;
    
    if (!kr.subtasks) kr.subtasks = [];
    
    const subtask = {
        id: Date.now() + Math.random(),
        title,
        done: false
    };
    
    kr.subtasks.push(subtask);
    localStorage.setItem('pixel_chat_okrs', JSON.stringify(state.okrs));
    els.dailyTaskInput.value = '';
    els.dailyTaskKrSelect.value = '';
    renderDailyTasks();
    renderAllTasks();
    lucide.createIcons();
    SoundFX.playPop();
}

window.addSubtaskToKR = function(okrId, krId) {
    const title = prompt('任務名稱：', '');
    if (!title || !title.trim()) return;
    const isDaily = confirm('是否為「每日任務」？\n（每日可標記完成，如：記帳）\n\n取消 = 一次性任務（如：選擇一款記帳軟體）');
    const okr = state.okrs.find(o => o.id === okrId);
    if (!okr) return;
    const kr = okr.keyResults.find(k => k.id === krId);
    if (!kr) return;
    if (!kr.subtasks) kr.subtasks = [];
    const subtask = isDaily
        ? { id: Date.now() + Math.random(), title: title.trim(), type: 'daily', completedDates: [] }
        : { id: Date.now() + Math.random(), title: title.trim(), type: 'one-time', done: false, completedAt: null };
    kr.subtasks.push(subtask);
    localStorage.setItem('pixel_chat_okrs', JSON.stringify(state.okrs));
    renderTaskCards();
    if (state.selectedKR) renderTaskDetail(null);
    SoundFX.playType();
};

window.toggleSubtask = function(okrId, krId, subtaskId) {
    const okr = state.okrs.find(o => o.id === okrId);
    if (!okr) return;
    const kr = okr.keyResults.find(k => k.id === krId);
    if (!kr || !kr.subtasks) return;
    const subtask = kr.subtasks.find(s => s.id === subtaskId);
    if (!subtask) return;
    const type = subtask.type || 'one-time';
    if (type === 'daily') {
        const today = todayISO();
        if (!subtask.completedDates) subtask.completedDates = [];
        const idx = subtask.completedDates.indexOf(today);
        if (idx >= 0) subtask.completedDates.splice(idx, 1);
        else subtask.completedDates.push(today);
        subtask.completedDates.sort();
    } else {
    subtask.done = !subtask.done;
        subtask.completedAt = subtask.done ? todayISO() : null;
    }
    localStorage.setItem('pixel_chat_okrs', JSON.stringify(state.okrs));
    if (state.taskView === 'daily') {
        renderDailyTasks();
    } else {
        renderAllTasks();
    }
    renderTaskCards(); // 更新任务页面显示
    // 如果当前选中的是这个任务，更新详情面板
    if (state.selectedSubtask && 
        state.selectedSubtask.okrId === okrId && 
        state.selectedSubtask.krId === krId && 
        state.selectedSubtask.subtaskId === subtaskId) {
        renderTaskDetail(state.selectedSubtask);
    }
    lucide.createIcons();
    SoundFX.playType();
};

window.deleteSubtask = function(okrId, krId, subtaskId) {
    if (!confirm("確定要刪除這個子任務嗎？")) return;
    
    const okr = state.okrs.find(o => o.id === okrId);
    if (!okr) return;
    const kr = okr.keyResults.find(k => k.id === krId);
    if (!kr || !kr.subtasks) return;
    kr.subtasks = kr.subtasks.filter(s => s.id !== subtaskId);
    localStorage.setItem('pixel_chat_okrs', JSON.stringify(state.okrs));
    
    // 如果删除的是当前选中的任务，重置选中状态
    if (state.selectedSubtask && 
        state.selectedSubtask.okrId === okrId && 
        state.selectedSubtask.krId === krId && 
        state.selectedSubtask.subtaskId === subtaskId) {
        state.selectedSubtask = null;
        state.showTaskDetail = false;
    }
    
    if (state.taskView === 'daily') {
        renderDailyTasks();
    } else {
        renderAllTasks();
    }
    renderTaskCards();
    updateTaskView();
    lucide.createIcons();
    SoundFX.playType();
};

window.uploadSubtaskImage = function(okrId, krId, subtaskId, input) {
    const file = input.files[0];
    if (!file) return;
    
    // 检查文件大小（限制为 5MB）
    if (file.size > 5 * 1024 * 1024) {
        alert('圖片大小不能超過 5MB');
        input.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const okr = state.okrs.find(o => o.id === okrId);
        if (!okr) return;
        const kr = okr.keyResults.find(k => k.id === krId);
        if (!kr || !kr.subtasks) return;
        const subtask = kr.subtasks.find(s => s.id === subtaskId);
        if (!subtask) return;
        
        subtask.image = e.target.result; // 存储 base64 图片
        localStorage.setItem('pixel_chat_okrs', JSON.stringify(state.okrs));
        renderTaskCards();
        // 如果当前选中的是这个任务，更新详情面板
        if (state.selectedSubtask && 
            state.selectedSubtask.okrId === okrId && 
            state.selectedSubtask.krId === krId && 
            state.selectedSubtask.subtaskId === subtaskId) {
            renderTaskDetail(state.selectedSubtask);
        }
        lucide.createIcons();
        SoundFX.playSuccess();
    };
    reader.onerror = function() {
        alert('圖片讀取失敗，請重試');
        input.value = '';
    };
    reader.readAsDataURL(file);
};

window.deleteSubtaskImage = function(okrId, krId, subtaskId) {
    if (!confirm('確定要刪除這張圖片嗎？')) return;
    
    const okr = state.okrs.find(o => o.id === okrId);
    if (!okr) return;
    const kr = okr.keyResults.find(k => k.id === krId);
    if (!kr || !kr.subtasks) return;
    const subtask = kr.subtasks.find(s => s.id === subtaskId);
    if (!subtask) return;
    
    subtask.image = null;
    localStorage.setItem('pixel_chat_okrs', JSON.stringify(state.okrs));
    renderTaskCards();
    // 如果当前选中的是这个任务，更新详情面板
    if (state.selectedSubtask && 
        state.selectedSubtask.okrId === okrId && 
        state.selectedSubtask.krId === krId && 
        state.selectedSubtask.subtaskId === subtaskId) {
        renderTaskDetail(state.selectedSubtask);
    }
    lucide.createIcons();
    SoundFX.playType();
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
    renderObjectivesList();
};

window.completeKRAsTask = function(okrId, krId) {
    const okr = state.okrs.find(o => o.id === okrId);
    const kr = okr && okr.keyResults.find(k => k.id === krId);
    if (!okr || !kr) return;
    const target = (kr.target != null && kr.target !== '') ? Number(kr.target) : 1;
    updateProgress(okrId, krId, target);
    renderTaskCards();
    if (typeof SoundFX !== 'undefined' && SoundFX.playSuccess) SoundFX.playSuccess();
};

window.deleteOKR = function(id) {
    if (confirm("確定要放棄這個任務嗎？")) {
        state.okrs = state.okrs.filter(o => o.id !== id);
        localStorage.setItem('pixel_chat_okrs', JSON.stringify(state.okrs));
        renderObjectivesList();
        // 如果删除的是当前选中的任务，重置选中状态
        if (state.selectedSubtask && state.selectedSubtask.okrId === id) {
            state.selectedSubtask = null;
            state.showTaskDetail = false;
        }
        renderTotalQuestList();
        renderTaskCards();
        updateTaskView();
        lucide.createIcons();
        SoundFX.playType();
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

        // 一律從顯示內容中移除 ```json ... ``` 區塊，不讓 JSON 直接出現在對話裡
        const jsonBlockRegex = /```json\s*[\s\S]*?```/;
        const jsonMatch = aiText.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) {
            const jsonStr = jsonMatch[1].trim();
            try {
                let parsedStr = jsonStr
                    .replace(/"confidence":\s*"[^"]*",\s*\]\s*"unit":\s*"([^"]*)"\s*\}(\s*\})?/g,
                        (_, unit) => '"unit": "' + unit + '" } ] }')
                    .replace(/,(\s*[\]}])/g, '$1');
                let questData;
                try {
                    questData = JSON.parse(parsedStr);
                } catch (parseErr) {
                    questData = JSON.parse(parsedStr.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''));
                }
                const newOkr = {
                    id: Date.now() + Math.random(),
                    objective: questData.objective,
                    keyResults: questData.keyResults.map((kr, idx) => {
                        const krId = Date.now() + Math.random() + idx;
                        const defaultTask = {
                            id: krId + '_t1',
                            title: kr.title,
                            type: 'one-time',
                            done: false,
                            completedAt: null
                        };
                        const subtasks = Array.isArray(kr.subtasks) && kr.subtasks.length > 0
                            ? kr.subtasks.map(st => ({
                                id: st.id || Date.now() + Math.random(),
                                title: st.title || kr.title,
                                type: (st.type === 'daily' ? 'daily' : (st.type === 'weekly' ? 'weekly' : 'one-time')),
                                done: !!st.done,
                                completedAt: st.completedAt || null,
                                completedDates: (st.type === 'daily' || st.type === 'weekly') ? (st.completedDates || []) : undefined
                            }))
                            : [defaultTask];
                        return {
                            id: krId,
                            title: kr.title,
                            current: 0,
                            target: Number(kr.target) || 100,
                            unit: kr.unit || "%",
                            subtasks
                        };
                    })
                };
                state.okrs.unshift(newOkr);
                localStorage.setItem('pixel_chat_okrs', JSON.stringify(state.okrs));
                renderTotalQuestList();
                renderTaskCards();

                if (state.okrs.length === 1) {
                    document.body.classList.remove('onboarding');
                    showTasksPage();
                }

                els.sidebarBadge.classList.remove('hidden');
                SoundFX.playSuccess();
                fireConfetti();

                aiText += "|||(✨ 任務已登錄！點擊右上角「任務」查看。)";
            } catch (e) {
                console.error("JSON Parse Error", e);
            }
            // 無論解析成功與否，對話中都不顯示原始 JSON
            aiText = aiText.replace(jsonBlockRegex, '').trim();
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
