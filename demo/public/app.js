const sessionId = getSessionId();

const appState = {
  budget: null,
  records: [],
  ledgerPeriod: "day",
  ledgerCategory: "全部",
  goal: null,
  xp: 0,
  checkedIn: false,
  tasks: {
    ledger: false,
    goal: false,
    learn: false
  }
};

const refs = {
  deviceFrame: document.querySelector(".device-frame"),
  apiStatus: document.querySelector("#apiStatus"),
  levelPill: document.querySelector("#levelPill"),
  levelBadge: document.querySelector("#levelBadge"),
  xpLabel: document.querySelector("#xpLabel"),
  xpProgress: document.querySelector("#xpProgress"),
  xpHint: document.querySelector("#xpHint"),
  checkinButton: document.querySelector("#checkinButton"),
  homeMascot: document.querySelector("#homeMascot"),
  cat3d: document.querySelector(".cat-3d"),
  mascotSpeech: document.querySelector("#mascotSpeech"),
  homeGreeting: document.querySelector("#homeGreeting"),
  budgetEmpty: document.querySelector("#budgetEmpty"),
  homeMetrics: document.querySelector("#homeMetrics"),
  todaySpend: document.querySelector("#todaySpend"),
  weekRemain: document.querySelector("#weekRemain"),
  budgetSpent: document.querySelector("#budgetSpent"),
  budgetStatus: document.querySelector("#budgetStatus"),
  budgetProgress: document.querySelector("#budgetProgress"),
  ledgerSpent: document.querySelector("#ledgerSpent"),
  ledgerCount: document.querySelector("#ledgerCount"),
  ledgerChart: document.querySelector("#ledgerChart"),
  recordList: document.querySelector("#recordList"),
  incomeInput: document.querySelector("#incomeInput"),
  fixedInput: document.querySelector("#fixedInput"),
  savingInput: document.querySelector("#savingInput"),
  daysInput: document.querySelector("#daysInput"),
  happyBufferInput: document.querySelector("#happyBufferInput"),
  emergencyBufferInput: document.querySelector("#emergencyBufferInput"),
  dailyBudget: document.querySelector("#dailyBudget"),
  weeklyBudget: document.querySelector("#weeklyBudget"),
  dailyBudgetResult: document.querySelector("#dailyBudgetResult"),
  weeklyBudgetResult: document.querySelector("#weeklyBudgetResult"),
  budgetResultCard: document.querySelector("#budgetResultCard"),
  budgetFormCard: document.querySelector("#budgetFormCard"),
  toggleBudgetFormBtn: document.querySelector("#toggleBudgetFormBtn"),
  budgetBars: document.querySelector("#budgetBars"),
  goalUseInput: document.querySelector("#goalUseInput"),
  goalTargetInput: document.querySelector("#goalTargetInput"),
  goalCurrentInput: document.querySelector("#goalCurrentInput"),
  goalDeadlineInput: document.querySelector("#goalDeadlineInput"),
  goalPlanCard: document.querySelector("#goalPlanCard"),
  goalFormCard: document.querySelector("#goalFormCard"),
  toggleGoalFormBtn: document.querySelector("#toggleGoalFormBtn"),
  milestoneCard: document.querySelector("#milestoneCard"),
  milestones: document.querySelector("#milestones"),
  riskDetector: document.querySelector("#riskDetector")
};

const greetings = [
  "我在，今天从哪件小事开始？",
  "先记一笔，预算就会更准。",
  "小金库不用硬撑，我们一起算。",
  "点下面的喵帮手，马上开工。"
];

document.querySelectorAll("[data-nav]").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.nav));
});

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    switchTab(button.dataset.tab);
    if (button.dataset.instantPrompt) {
      sendToAgent("risk", button.dataset.instantPrompt, document.querySelector("#riskChat"));
    }
  });
});

document.querySelectorAll(".agent-composer").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = form.elements.message.value.trim();
    if (!message) return;
    form.elements.message.value = "";
    sendToAgent(form.dataset.intent, message, document.querySelector(`#${form.dataset.chatTarget}`));
  });
});

document.querySelectorAll("[data-period]").forEach((button) => {
  button.addEventListener("click", () => {
    appState.ledgerPeriod = button.dataset.period;
    button.parentElement.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderLedger();
  });
});

document.querySelectorAll("[data-category]").forEach((button) => {
  button.addEventListener("click", () => {
    appState.ledgerCategory = button.dataset.category;
    button.parentElement.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderLedger();
  });
});

document.querySelectorAll("[data-learn]").forEach((button) => {
  button.addEventListener("click", () => {
    switchTab("risk");
    sendToAgent("risk", button.dataset.learn, document.querySelector("#riskChat"));
  });
});

document.querySelector("#generateBudgetBtn").addEventListener("click", () => {
  const message = buildBudgetMessage();
  sendToAgent("budget", message, document.querySelector("#budgetChat"));
});

document.querySelector("#generateGoalBtn").addEventListener("click", () => {
  const message = buildGoalMessage();
  sendToAgent("goal", message, document.querySelector("#goalChat"));
});

refs.toggleBudgetFormBtn.addEventListener("click", () => {
  refs.budgetFormCard.classList.toggle("collapsed");
  refs.toggleBudgetFormBtn.textContent = refs.budgetFormCard.classList.contains("collapsed") ? "调整预算" : "收起";
});

refs.toggleGoalFormBtn.addEventListener("click", () => {
  refs.goalFormCard.classList.toggle("collapsed");
  refs.toggleGoalFormBtn.textContent = refs.goalFormCard.classList.contains("collapsed") ? "调整目标" : "收起";
});

refs.checkinButton.addEventListener("click", () => {
  if (!allTasksDone() || appState.checkedIn) return;
  appState.checkedIn = true;
  addXp(20, "今日打卡完成，省心喵升级能量满满。");
  renderTasks();
});

[
  refs.incomeInput,
  refs.fixedInput,
  refs.savingInput,
  refs.daysInput,
  refs.happyBufferInput,
  refs.emergencyBufferInput
].forEach((field) => field.addEventListener("input", updateBudgetPreview));

refs.homeMascot.addEventListener("mousemove", (event) => {
  const rect = refs.homeMascot.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  refs.homeMascot.style.setProperty("--ry", `${x * 8}deg`);
  refs.homeMascot.style.setProperty("--rx", `${-y * 8}deg`);
});

refs.homeMascot.addEventListener("mouseleave", () => {
  refs.homeMascot.style.setProperty("--rx", "0deg");
  refs.homeMascot.style.setProperty("--ry", "0deg");
});

refs.homeMascot.addEventListener("click", rotateGreeting);
refs.homeMascot.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    rotateGreeting();
  }
});

checkHealth();
renderLedger();
updateBudgetPreview();
renderXp();
renderTasks();
switchTab("home");

async function sendToAgent(intent, message, chat) {
  addMessage(chat, "user", message);
  const pending = addMessage(chat, "assistant", `${agentName(intent)}正在思考...`);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, intent, message })
    });
    const data = await response.json();
    pending.remove();
    addAssistantResult(chat, data);
    applyResponse(data);
    updateApiStatus(data.usedFallback ? "fallback" : "ai");
  } catch {
    pending.remove();
    addMessage(chat, "assistant", "网络有点不稳，省心喵刚刚没接住。你可以再发一次。");
    updateApiStatus("offline");
  }
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    updateApiStatus(data.mode || (data.hasApiKey ? "ai" : "fallback"));
  } catch {
    updateApiStatus("offline");
  }
}

function applyResponse(data) {
  const cards = data.cards || [];
  const budget = cards.find((card) => card.type === "budget");
  const goal = cards.find((card) => card.type === "goal");
  const risk = cards.find((card) => card.type === "risk");

  if (Array.isArray(data.records) && data.records.length) {
    for (const record of data.records) {
      appState.records.push({
        ...record,
        createdAt: new Date().toISOString()
      });
    }
    completeTask("ledger", 10);
    renderLedger();
    renderHome();
  }

  if (budget) {
    appState.budget = budget;
    addXp(15, "预算方案已生成，小金库路线更清楚了。");
    renderBudget(budget);
    renderHome();
  }

  if (goal) {
    appState.goal = goal;
    completeTask("goal", 15);
    renderGoal(goal);
  }

  if (risk) {
    if (data.intent === "risk") completeTask("learn", 10);
    renderRisk(risk);
  }
}

function switchTab(tabId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    const isActive = screen.id === `${tabId}-screen`;
    screen.classList.toggle("active", isActive);
    if (isActive) {
      const scroll = screen.querySelector(".screen-scroll");
      if (scroll) scroll.scrollTop = 0;
    }
  });

  document.querySelectorAll("[data-nav]").forEach((item) => {
    item.classList.toggle("active", item.dataset.nav === tabId);
  });

  refs.deviceFrame.dataset.activeTab = tabId;
}

function rotateGreeting() {
  const next = greetings[Math.floor(Math.random() * greetings.length)];
  refs.mascotSpeech.textContent = "喵，收到";
  refs.homeGreeting.textContent = next;
}

function renderHome() {
  const budget = appState.budget;
  if (!budget) {
    refs.budgetEmpty.hidden = false;
    refs.homeMetrics.hidden = true;
    return;
  }

  const weekBudget = Number(budget.weekBudget || 0);
  const spent = appState.records.reduce((sum, record) => sum + (record.countAsExpense === false ? 0 : Number(record.amount || 0)), 0);
  const remaining = Math.max(weekBudget - spent, 0);
  const usedPercent = weekBudget ? Math.min(100, Math.round((spent / weekBudget) * 100)) : 0;

  refs.budgetEmpty.hidden = true;
  refs.homeMetrics.hidden = false;
  refs.todaySpend.textContent = yuan(Math.max(Math.round(remaining / 4), 0));
  refs.weekRemain.textContent = yuan(remaining);
  refs.budgetStatus.textContent = !weekBudget ? "未设置" : remaining < weekBudget * 0.2 ? "偏紧" : "健康";
  refs.budgetSpent.textContent = `已用 ${yuan(spent)} / 本周预算 ${yuan(weekBudget)}`;
  refs.budgetProgress.style.width = `${usedPercent}%`;
}

function completeTask(name, xp) {
  if (!appState.tasks[name]) {
    appState.tasks[name] = true;
    addXp(xp);
    renderTasks();
  }
}

function addXp(amount, hint = "") {
  appState.xp += amount;
  if (hint) refs.xpHint.textContent = hint;
  renderXp();
}

function renderXp() {
  const level = Math.max(1, Math.floor(appState.xp / 60) + 1);
  const current = appState.xp % 60;
  const label = `Lv.${level}`;
  refs.levelPill.textContent = label;
  refs.levelBadge.textContent = label;
  refs.xpLabel.textContent = `${current} / 60 XP`;
  refs.xpProgress.style.width = `${Math.round((current / 60) * 100)}%`;

  refs.cat3d.classList.toggle("happy", appState.xp > 0);
  refs.cat3d.classList.toggle("excited", allTasksDone());
  if (!appState.checkedIn && allTasksDone()) {
    refs.xpHint.textContent = "今日待办完成，可以打卡啦。";
  }
}

function renderTasks() {
  document.querySelectorAll("[data-task]").forEach((button) => {
    const done = Boolean(appState.tasks[button.dataset.task]);
    button.classList.toggle("done", done);
    const check = button.querySelector(".task-check");
    if (check) check.textContent = done ? "✓" : "□";
  });

  refs.checkinButton.disabled = !allTasksDone() || appState.checkedIn;
  refs.checkinButton.textContent = appState.checkedIn ? "今日已打卡" : allTasksDone() ? "今日打卡 +20 XP" : "完成 3 项后可打卡";
}

function allTasksDone() {
  return Object.values(appState.tasks).every(Boolean);
}

function renderLedger() {
  const records = filteredRecords();
  const total = records.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  refs.ledgerSpent.textContent = yuan(total);
  refs.ledgerCount.textContent = String(records.length);
  renderChart(records);
  renderRecordList(records);
}

function renderChart(records) {
  const buckets = buildChartBuckets(appState.ledgerPeriod);
  for (const record of records) {
    const index = bucketIndex(record, appState.ledgerPeriod, buckets.length);
    buckets[index].value += Number(record.amount || 0);
  }
  const max = Math.max(...buckets.map((item) => item.value), 1);
  refs.ledgerChart.innerHTML = buckets
    .map((item) => {
      const height = item.value ? Math.max(12, Math.round((item.value / max) * 92)) : 6;
      return `<i style="--height:${height}%"><em>${item.value ? yuanShort(item.value) : ""}</em><span>${escapeHtml(item.label)}</span></i>`;
    })
    .join("");
}

function renderRecordList(records) {
  if (!records.length) {
    refs.recordList.innerHTML = `<div class="empty-list">还没有符合条件的账单。用底部输入框记一笔吧。</div>`;
    return;
  }

  refs.recordList.innerHTML = records
    .slice()
    .reverse()
    .map(
      (record) => `
        <div class="record-item">
          <div class="r-info">
            <div class="r-icon">${categoryIcon(record.category)}</div>
            <div>
              <div class="r-title">${escapeHtml(record.name)} (${escapeHtml(record.category || "其他")})</div>
              <div class="r-time">${formatRecordTime(record)}</div>
            </div>
          </div>
          <div class="r-amount expense">-${Number(record.amount || 0).toFixed(2)}</div>
        </div>
      `
    )
    .join("");
}

function filteredRecords() {
  if (appState.ledgerCategory === "全部") return appState.records;
  return appState.records.filter((record) => record.category === appState.ledgerCategory);
}

function buildChartBuckets(period) {
  if (period === "day") return ["早", "午", "晚", "其他"].map((label) => ({ label, value: 0 }));
  if (period === "week") return ["一", "二", "三", "四", "五", "六", "日"].map((label) => ({ label, value: 0 }));
  if (period === "month") return ["第1周", "第2周", "第3周", "第4周"].map((label) => ({ label, value: 0 }));
  return ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"].map((label) => ({
    label,
    value: 0
  }));
}

function bucketIndex(record, period, length) {
  const date = new Date(record.createdAt || Date.now());
  if (period === "day") {
    const hour = date.getHours();
    if (hour < 11) return 0;
    if (hour < 16) return 1;
    if (hour < 21) return 2;
    return 3;
  }
  if (period === "week") return (date.getDay() + 6) % 7;
  if (period === "month") return Math.min(Math.floor((date.getDate() - 1) / 7), 3);
  return Math.min(date.getMonth(), length - 1);
}

function renderBudget(card) {
  const categories = card.categories || [];
  refs.budgetResultCard.hidden = false;
  refs.budgetBars.innerHTML = `
    <h3>分类预算</h3>
    ${categories.map((item) => budgetBar(item, Math.max(...categories.map((cat) => cat.amount), 1))).join("")}
  `;
  refs.weeklyBudget.textContent = yuan(card.weekBudget);
  refs.weeklyBudgetResult.textContent = yuan(card.weekBudget);
  const days = Number(refs.daysInput.value || 30);
  const daily = yuan(Math.floor(Number(card.spendable || 0) / Math.max(days, 1)));
  refs.dailyBudget.textContent = daily;
  refs.dailyBudgetResult.textContent = daily;
  refs.budgetResultCard.querySelector("h3").textContent = `${yuan(card.spendable)} 可支配`;
  refs.budgetFormCard.classList.add("collapsed");
  refs.toggleBudgetFormBtn.textContent = "调整预算";
}

function budgetBar(item, max) {
  const width = Math.max(5, Math.round((Number(item.amount || 0) / max) * 100));
  return `<div class="bar-row"><span>${escapeHtml(item.name)}</span><div class="bar"><i style="--value:${width}%"></i></div><strong>${yuanShort(item.amount)}</strong></div>`;
}

function updateBudgetPreview() {
  const income = Number(refs.incomeInput.value || 0);
  const fixed = Number(refs.fixedInput.value || 0);
  const saving = Number(refs.savingInput.value || 0);
  const happy = Number(refs.happyBufferInput.value || 0);
  const emergency = Number(refs.emergencyBufferInput.value || 0);
  const days = Number(refs.daysInput.value || 0);
  if (!income || !days) {
    refs.dailyBudget.textContent = "--";
    refs.weeklyBudget.textContent = "--";
    return;
  }
  const spendable = Math.max(income - fixed - saving - happy - emergency, 0);
  refs.dailyBudget.textContent = yuan(Math.floor(spendable / days));
  refs.weeklyBudget.textContent = yuan(Math.round(spendable / 4));
}

function renderGoal(card) {
  const progress = card.target ? Math.round(((card.current || 0) / card.target) * 100) : 0;
  refs.goalPlanCard.hidden = false;
  refs.goalPlanCard.innerHTML = `
    <div class="goal-title-row">
      <div>
        <span>当前目标</span>
        <h3>${escapeHtml(card.title || refs.goalUseInput.value || "攒钱目标")}</h3>
      </div>
      <strong>${Math.max(0, Math.min(progress, 100))}%</strong>
    </div>
    <div class="goal-amount">${yuan(card.current)} <span>/ ${Number(card.target || 0).toLocaleString("zh-CN")}</span></div>
    <div class="progress-bar-container large"><div class="progress-bar gradient" style="width:${Math.max(0, Math.min(progress, 100))}%"></div></div>
    <p>每天需攒：<strong>${yuan(Math.ceil((card.weekly || 0) / 7))}</strong>　每周需攒：<strong>${yuan(card.weekly)}</strong></p>
  `;
  refs.goalPlanCard.style.order = "-2";
  refs.goalFormCard.classList.add("collapsed");
  refs.toggleGoalFormBtn.hidden = false;
  refs.toggleGoalFormBtn.textContent = "调整目标";

  refs.milestoneCard.hidden = false;
  const milestones = card.milestones?.length ? card.milestones : [
    { label: "25%", value: Math.ceil((card.target || 0) * 0.25) },
    { label: "50%", value: Math.ceil((card.target || 0) * 0.5) },
    { label: "75%", value: Math.ceil((card.target || 0) * 0.75) },
    { label: "完成", value: card.target || 0 }
  ];
  refs.milestones.innerHTML = milestones
    .map((item) => `<span class="${Number(card.current || 0) >= Number(item.value || 0) ? "done" : ""}">${escapeHtml(item.label)}<br>${yuanShort(item.value)}</span>`)
    .join("");
}

function renderRisk(card) {
  refs.riskDetector.innerHTML = `
    <h3>避坑扫描器</h3>
    <div class="risk-result ${card.riskLevel === "高" ? "high" : card.riskLevel === "中" ? "medium" : "low"}">
      <span>风险等级</span>
      <strong>${escapeHtml(card.riskLevel || "待判断")}</strong>
    </div>
    <div class="tag-list">
      ${(card.redFlags || []).map((flag) => `<span class="tag">${escapeHtml(flag)}</span>`).join("")}
    </div>
    <p>${escapeHtml(card.suitable || "我会根据产品描述给出适配建议。")}</p>
  `;
}

function buildBudgetMessage() {
  return [
    `我的生活费是${refs.incomeInput.value || "未填写"}元`,
    `固定支出${refs.fixedInput.value || 0}元`,
    `想先存${refs.savingInput.value || 0}元`,
    `周期${refs.daysInput.value || 30}天`,
    `快乐buffer ${refs.happyBufferInput.value || 0}元`,
    `应急buffer ${refs.emergencyBufferInput.value || 0}元`,
    "请帮我生成生活费预算、每日可花、每周预算、分类预算和buffer建议"
  ].join("，");
}

function buildGoalMessage() {
  return [
    `我想攒钱${refs.goalUseInput.value || "完成一个目标"}`,
    `目标金额${refs.goalTargetInput.value || "未填写"}元`,
    `当前已攒${refs.goalCurrentInput.value || 0}元`,
    `周期是${refs.goalDeadlineInput.value || "未填写"}`,
    "请帮我生成每天要攒多少钱、每周要攒多少钱、阶段里程碑和打卡任务"
  ].join("，");
}

function addAssistantResult(chat, data) {
  const article = document.createElement("article");
  article.className = "message assistant";
  article.innerHTML = `
    <img src="/assets/shengxin_miao_logo_1778865585677.png" class="msg-avatar" alt="">
    <div class="msg-bubble">
      ${escapeHtml(data.reply || "省心喵处理完啦。")}
      ${(data.cards || []).map(renderCard).join("")}
    </div>
  `;
  chat.appendChild(article);
  chat.scrollIntoView({ block: "end", behavior: "smooth" });
}

function addMessage(chat, role, text) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  article.innerHTML = `
    ${
      role === "user"
        ? `<div class="msg-avatar user-avatar">U</div>`
        : `<img src="/assets/shengxin_miao_logo_1778865585677.png" class="msg-avatar" alt="">`
    }
    <div class="msg-bubble">${escapeHtml(text)}</div>
  `;
  chat.appendChild(article);
  chat.scrollIntoView({ block: "end", behavior: "smooth" });
  return article;
}

function renderCard(card) {
  if (!card || !card.type) return "";
  if (card.type === "budget") return renderBudgetCard(card);
  if (card.type === "ledger") return renderLedgerCard(card);
  if (card.type === "goal") return renderGoalCard(card);
  if (card.type === "risk") return renderRiskCard(card);
  if (card.type === "safety") return renderSafetyCard(card);
  if (card.type === "review") return renderReviewCard(card);
  return "";
}

function renderBudgetCard(card) {
  const max = Math.max(...(card.categories || []).map((item) => item.amount), 1);
  return `
    <section class="ai-card">
      <h3>${escapeHtml(card.title || "生活费预算卡")}</h3>
      <div class="card-grid">
        ${metric("月收入", yuan(card.income))}
        ${metric("先存下", yuan(card.savingGoal))}
        ${metric("可消费", yuan(card.spendable))}
        ${metric("周预算", yuan(card.weekBudget))}
      </div>
      <div class="bars">
        ${(card.categories || []).map((item) => bar(item.name, item.amount, max)).join("")}
      </div>
    </section>
  `;
}

function renderLedgerCard(card) {
  return `
    <section class="ai-card">
      <h3>${escapeHtml(card.title || "今日小喵账单")}</h3>
      <div class="card-grid">
        ${metric("本次记录", yuan(card.total))}
        ${metric("本周预算", yuan(card.weekBudget))}
        ${metric("本周已用", yuan(card.weekSpent))}
        ${metric("剩余额度", yuan(card.remaining))}
      </div>
    </section>
  `;
}

function renderGoalCard(card) {
  const progress = card.target ? Math.round(((card.current || 0) / card.target) * 100) : 0;
  return `
    <section class="ai-card">
      <h3>${escapeHtml(card.title || "攒钱目标卡")}</h3>
      <div class="card-grid">
        ${metric("目标金额", yuan(card.target))}
        ${metric("还差", yuan(card.gap))}
        ${metric("每周需攒", yuan(card.weekly))}
        ${metric("压力", escapeHtml(card.pressure || "适中"))}
      </div>
      <div class="bars">
        ${bar("当前进度", progress, 100, "%")}
      </div>
    </section>
  `;
}

function renderRiskCard(card) {
  const riskClass = card.riskLevel === "高" ? "risk-high" : card.riskLevel === "中" ? "risk-medium" : "";
  return `
    <section class="ai-card">
      <h3>${escapeHtml(card.title || "风险识别卡")}</h3>
      <div class="card-grid">
        ${metric("风险等级", `<span class="${riskClass}">${escapeHtml(card.riskLevel || "中")}</span>`)}
        ${metric("适配判断", escapeHtml(card.suitable || "需谨慎"))}
      </div>
      <div class="tag-list">
        ${(card.redFlags || []).map((flag) => `<span class="tag">${escapeHtml(flag)}</span>`).join("")}
      </div>
    </section>
  `;
}

function renderSafetyCard(card) {
  return `
    <section class="ai-card">
      <h3>${escapeHtml(card.title || "安全守卫提醒")}</h3>
      <div class="tag-list">
        <span class="tag">${escapeHtml(card.rule || "安全边界已检查")}</span>
      </div>
    </section>
  `;
}

function renderReviewCard(card) {
  return `
    <section class="ai-card">
      <h3>${escapeHtml(card.title || "消费复盘卡")}</h3>
      <div class="card-grid">
        ${metric("本周预算", yuan(card.weekBudget))}
        ${metric("已用", yuan(card.weekSpent))}
        ${metric("剩余", yuan(card.remaining))}
        ${metric("建议", escapeHtml(card.suggestion || "继续保持"))}
      </div>
    </section>
  `;
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function bar(label, value, max, suffix = "元") {
  const width = Math.max(4, Math.min(100, Math.round((Number(value || 0) / max) * 100)));
  return `
    <div class="bar-row">
      <span>${escapeHtml(label)}</span>
      <div class="bar"><i style="--value:${width}%"></i></div>
      <strong>${escapeHtml(String(value ?? 0))}${suffix}</strong>
    </div>
  `;
}

function updateApiStatus(mode) {
  const isAi = mode === "ai";
  if (!refs.apiStatus) return;
  refs.apiStatus.textContent = isAi ? "AI" : mode === "offline" ? "离线" : "未连接";
  refs.apiStatus.classList.toggle("warning", !isAi);
}

function agentName(intent) {
  return {
    ledger: "记账省心喵",
    budget: "预算省心喵",
    goal: "目标省心喵",
    risk: "风控省心喵"
  }[intent] || "省心喵";
}

function categoryIcon(category) {
  return {
    饮食: "🍜",
    交通: "🚇",
    学习: "📚",
    社交娱乐: "🎬",
    购物: "🛍",
    生活必要: "🧺"
  }[category] || "¥";
}

function formatRecordTime(record) {
  const date = new Date(record.createdAt || Date.now());
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function yuan(value) {
  return `¥ ${Number(value || 0).toLocaleString("zh-CN")}`;
}

function yuanShort(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSessionId() {
  const key = "shengxinmiao-session-id";
  let value = localStorage.getItem(key);
  if (!value) {
    value = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, value);
  }
  return value;
}
