// ====== State ======
let currentUser = localStorage.getItem('kiss_user') || null;
const partnerName = { partner1: '大宝', partner2: '小宝' };
let todayStr = new Date().toISOString().slice(0, 10);

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// ====== Time Check ======
function canSend(period) {
  const h = new Date().getHours();
  if (period === 'morning') return h >= 5 && h < 12;
  if (period === 'night') return h >= 21 || h < 3;
  return false;
}

function timeWarning(period) {
  const msg = '臭宝！这好像不是亲亲的正常时间，要诚心诚意哦。';
  showToast(msg);
}

// ====== Init ======
document.addEventListener('DOMContentLoaded', () => {
  if (currentUser) { enterMain(); } else { showLogin(); }
});

function showLogin() {
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('main-screen').classList.remove('active');
}

function selectPartner(role) {
  currentUser = role;
  localStorage.setItem('kiss_user', role);
  enterMain();
}

function switchPartner() {
  currentUser = null;
  localStorage.removeItem('kiss_user');
  showLogin();
}

function enterMain() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('main-screen').classList.add('active');
  document.getElementById('display-name').textContent = partnerName[currentUser];
  updateTodayDate();
  refreshStatus();
}

function updateTodayDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const wd = WEEKDAYS[now.getDay()];
  document.getElementById('today-display').textContent = `${y}年${m}月${d}日 星期${wd}`;
  todayStr = `${y}-${m}-${d}`;
}

// ====== Fetch & Refresh ======
async function refreshStatus() {
  const r = await fetch(`/api/kiss/status?date=${todayStr}`);
  const data = await r.json();
  renderKissCard('morning', data.morning, '⏰');
  renderKissCard('night', data.night, '🌙');
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) switchTab(activeTab.dataset.tab);
}

function renderKissCard(period, status, icon) {
  const me = status[currentUser];
  const them = currentUser === 'partner1' ? status.partner2 : status.partner1;
  const mySent = me && me.sent;
  const theirSent = them && them.sent;

  document.getElementById(`${period}-us-dot`).className = 'status-dot' + (mySent ? ' sent' : '');
  const themDot = document.getElementById(`${period}-them-dot`);
  themDot.className = 'status-dot' + (theirSent ? ' sent' : '');

  const btn = document.getElementById(`${period}-send`);
  const timeDiv = document.getElementById(`${period}-time`);

  if (mySent) {
    btn.disabled = true;
    btn.className = 'btn-kiss sent-btn';
    timeDiv.textContent = `已送达 ${me.at.slice(11, 16)}`;
  } else if (!canSend(period)) {
    btn.disabled = false;
    btn.className = 'btn-kiss';
    timeDiv.textContent = '现在不是亲亲时间哦 ⏳';
  } else {
    btn.disabled = false;
    btn.className = 'btn-kiss';
    timeDiv.textContent = '';
  }

  const card = document.getElementById(`${period}-card`);
  if (mySent) card.classList.add('kissed');
  else card.classList.remove('kissed');
}

// ====== Send Kiss ======
async function sendKiss(period) {
  if (!canSend(period)) { timeWarning(period); return; }

  const btn = document.getElementById(`${period}-send`);
  btn.disabled = true;

  try {
    const r = await fetch('/api/kiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: currentUser, date: todayStr, period })
    });
    if (!r.ok) {
      const err = await r.json();
      showToast(err.error || '发送失败');
      btn.disabled = false;
      return;
    }
    showToast('💋 Kiss 已送达！');
    refreshStatus();
  } catch (e) {
    showToast('网络错误，请重试');
    btn.disabled = false;
  }
}

// ====== Tab Switching ======
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
  if (tab === 'today') renderTodayView();
  else if (tab === 'week') renderWeekView();
  else if (tab === 'month') renderMonthView();
}

// ====== Today View ======
function renderTodayView() {
  const container = document.getElementById('history-view');

  fetch(`/api/kiss/status?date=${todayStr}`)
    .then(r => r.json())
    .then(status => {
      const p1m = status.morning.partner1;
      const p2m = status.morning.partner2;
      const p1n = status.night.partner1;
      const p2n = status.night.partner2;

      function lipHtml(name, sent, time) {
        const cls = sent ? 'sent' : 'miss';
        const tm = sent ? time.slice(11, 16) : '未送出';
        return `<div class="today-kiss-item">
          <span class="name">${name}</span>
          <span class="lip ${cls}">💋</span>
          <span class="lip-time">${tm}</span>
        </div>`;
      }

      container.innerHTML = `
        <div class="today-detail-block">
          <div class="today-detail-title"><span class="td-icon">⏰</span> 早安吻</div>
          <div class="today-kiss-row">
            ${lipHtml('大宝', p1m && p1m.sent, p1m ? p1m.at : '')}
            ${lipHtml('小宝', p2m && p2m.sent, p2m ? p2m.at : '')}
          </div>
        </div>
        <div class="today-detail-block">
          <div class="today-detail-title"><span class="td-icon">🌙</span> 晚安吻</div>
          <div class="today-kiss-row">
            ${lipHtml('大宝', p1n && p1n.sent, p1n ? p1n.at : '')}
            ${lipHtml('小宝', p2n && p2n.sent, p2n ? p2n.at : '')}
          </div>
        </div>`;
    });
}

// ====== Week View ======
function renderWeekView() {
  const container = document.getElementById('history-view');
  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow));

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }

  const startStr = days[0].toISOString().slice(0, 10);
  const endStr = days[6].toISOString().slice(0, 10);

  fetch(`/api/kiss/history?start=${startStr}&end=${endStr}`)
    .then(r => r.json())
    .then(kisses => {
      const lookup = {};
      for (const k of kisses) {
        if (!lookup[k.date]) lookup[k.date] = { morning: [], night: [] };
        lookup[k.date][k.period].push(k.sender);
      }

      let html = '<div class="week-grid">';
      for (const d of days) {
        const dateStr = d.toISOString().slice(0, 10);
        const dayNum = d.getDate();
        const wd = WEEKDAYS[d.getDay()];
        const isToday = dateStr === todayStr;
        const isFuture = dateStr > todayStr;
        const dayData = lookup[dateStr];

        const p1m = dayData && dayData.morning.includes('partner1');
        const p2m = dayData && dayData.morning.includes('partner2');
        const p1n = dayData && dayData.night.includes('partner1');
        const p2n = dayData && dayData.night.includes('partner2');

        const lip = (sent) => `<span class="week-lip${sent ? ' sent' : ''}">💋</span>`;

        let kissHtml = '';
        if (!isFuture) {
          kissHtml = `<div class="week-day-kisses">
            <div class="week-kiss-row"><span class="period-icon">⏰</span>
              <span class="week-kiss-pair">${lip(p1m)}${lip(p2m)}</span>
            </div>
            <div class="week-kiss-row"><span class="period-icon">🌙</span>
              <span class="week-kiss-pair">${lip(p1n)}${lip(p2n)}</span>
            </div>
          </div>`;
        }

        html += `<div class="week-day${isToday ? ' today' : ''}"${isFuture ? '' : ` onclick="showDayDetail('${dateStr}')"`}>
          <span class="week-day-date">${dayNum}</span>
          <span class="week-day-label">${wd}</span>
          ${kissHtml}
        </div>`;
      }
      html += '</div>';
      container.innerHTML = html;
    });
}

// ====== Month View ======
let monthViewDate = new Date();

function renderMonthView() {
  const container = document.getElementById('history-view');
  const year = monthViewDate.getFullYear();
  const month = monthViewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const startStr = `${year}-${String(month+1).padStart(2,'0')}-01`;
  const endStr = `${year}-${String(month+1).padStart(2,'0')}-${String(totalDays).padStart(2,'0')}`;

  const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];

  fetch(`/api/kiss/history?start=${startStr}&end=${endStr}`)
    .then(r => r.json())
    .then(kisses => {
      const lookup = {};
      for (const k of kisses) {
        if (!lookup[k.date]) lookup[k.date] = { morning: [], night: [] };
        lookup[k.date][k.period].push(k.sender);
      }

      let html = `<div class="month-header">
        <button class="month-nav" onclick="navigateMonth(-1)">‹</button>
        <h3>${year}年 ${monthNames[month]}</h3>
        <button class="month-nav" onclick="navigateMonth(1)">›</button>
      </div>`;

      html += '<div class="month-weekdays">';
      for (const wd of WEEKDAYS) html += `<span>${wd}</span>`;
      html += '</div>';

      html += '<div class="month-days">';
      for (let p = 0; p < startPad; p++) html += `<div class="month-day other-month"></div>`;

      for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const isToday = dateStr === todayStr;
        const isFuture = dateStr > todayStr;
        const dayData = lookup[dateStr];
        const p1m = dayData && dayData.morning.includes('partner1');
        const p2m = dayData && dayData.morning.includes('partner2');
        const p1n = dayData && dayData.night.includes('partner1');
        const p2n = dayData && dayData.night.includes('partner2');

        const bothComplete = p1m && p2m && p1n && p2n;
        const p1Complete = p1m && p1n;
        const p2Complete = p2m && p2n;

        let icon = '';
        if (!isFuture) {
          if (bothComplete) icon = '💕';
          else if (p1Complete || p2Complete) icon = '💗';
          else icon = '💔';
        }

        html += `<div class="month-day${isToday ? ' today' : ''}${isFuture ? ' future' : ''}"${isFuture ? '' : ` onclick="showDayDetail('${dateStr}')"`}>
          ${day}
          ${icon ? `<span class="day-icon">${icon}</span>` : ''}
        </div>`;
      }
      html += '</div>';
      container.innerHTML = html;
    });
}

function navigateMonth(delta) {
  monthViewDate.setMonth(monthViewDate.getMonth() + delta);
  renderMonthView();
}

// ====== Day Detail Modal ======
function showDayDetail(dateStr) {
  let overlay = document.getElementById('day-detail-overlay');
  if (!overlay) {
    const div = document.createElement('div');
    div.id = 'day-detail-overlay';
    div.className = 'day-detail-overlay';
    div.innerHTML = `<div class="day-detail-box">
      <h3 id="detail-title"></h3>
      <p class="detail-date" id="detail-date"></p>
      <div id="detail-body"></div>
      <button class="day-detail-close" onclick="closeDayDetail()">关闭</button>
    </div>`;
    div.addEventListener('click', (e) => { if (e.target === div) closeDayDetail(); });
    document.body.appendChild(div);
    overlay = div;
  }

  const d = new Date(dateStr + 'T12:00:00');
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  const wd = WEEKDAYS[d.getDay()];
  document.getElementById('detail-title').textContent = `${m}月${day}日 星期${wd}`;
  document.getElementById('detail-date').textContent = `${d.getFullYear()}年`;

  fetch(`/api/kiss/status?date=${dateStr}`)
    .then(r => r.json())
    .then(status => {
      function periodHtml(period, icon, p1, p2) {
        return `<div class="detail-period-block">
          <div class="detail-period-title">${icon} ${period === 'morning' ? '早安吻' : '晚安吻'}</div>
          <div class="detail-kiss-row">
            <div class="detail-kiss-item">
              <span class="name">大宝</span>
              <span class="lip ${p1 && p1.sent ? 'sent' : 'miss'}">💋</span>
              <span class="lip-time">${p1 && p1.sent ? p1.at.slice(11, 16) : '未送出'}</span>
            </div>
            <div class="detail-kiss-item">
              <span class="name">小宝</span>
              <span class="lip ${p2 && p2.sent ? 'sent' : 'miss'}">💋</span>
              <span class="lip-time">${p2 && p2.sent ? p2.at.slice(11, 16) : '未送出'}</span>
            </div>
          </div>
        </div>`;
      }
      document.getElementById('detail-body').innerHTML =
        periodHtml('morning', '⏰', status.morning.partner1, status.morning.partner2) +
        periodHtml('night', '🌙', status.night.partner1, status.night.partner2);
    });

  overlay.classList.add('active');
}

function closeDayDetail() {
  const overlay = document.getElementById('day-detail-overlay');
  if (overlay) overlay.classList.remove('active');
}

// ====== Toast ======
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ====== Auto-refresh ======
setInterval(refreshStatus, 30000);
