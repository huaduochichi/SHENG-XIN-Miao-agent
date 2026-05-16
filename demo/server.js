import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

loadEnv(path.join(__dirname, ".env"));
loadEnv(path.join(__dirname, "..", ".env"));

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const AI_PROVIDER = process.env.AI_PROVIDER || "deepseek";

const stateBySession = new Map();

const AGENTS = {
  profile: {
    name: "画像采集 Agent",
    description: "追问生活费、固定支出、消费习惯和风险偏好，形成用户财务画像。"
  },
  budget: {
    name: "预算规划 Agent",
    description: "生成生活费分类预算、周额度、预警线和省钱建议。"
  },
  goal: {
    name: "攒钱陪伴 Agent",
    description: "拆解攒钱目标，给出每周任务、里程碑和补救方案。"
  },
  ledger: {
    name: "记账 Agent",
    description: "解析自然语言消费记录，自动拆分金额并分类。"
  },
  review: {
    name: "消费复盘 Agent",
    description: "结合账单和预算，判断超支风险并输出调整建议。"
  },
  risk: {
    name: "理财风控问答 Agent",
    description: "解释理财知识，识别高风险话术，给出安全边界建议。"
  },
  safety: {
    name: "安全守卫 Agent",
    description: "拦截收益承诺、具体交易建议、借贷投资和敏感信息存储。"
  }
};

const CATEGORY_KEYWORDS = [
  ["饮食", ["饭", "食堂", "外卖", "奶茶", "咖啡", "早餐", "午饭", "晚饭", "夜宵", "水果"]],
  ["交通", ["公交", "地铁", "打车", "出租", "高铁", "火车", "共享单车", "通勤"]],
  ["学习", ["教材", "书", "文具", "考试", "报名", "课程", "打印", "资料"]],
  ["社交娱乐", ["聚餐", "电影", "游戏", "演出", "ktv", "KTV", "桌游", "酒吧"]],
  ["购物", ["衣服", "鞋", "数码", "耳机", "购物", "淘宝", "京东", "拼多多"]],
  ["生活必要", ["话费", "会员", "日用品", "洗衣", "医疗", "药", "水电", "房租"]]
];

const HIGH_RISK_PATTERNS = [
  /保本.*(高收益|收益|稳赚)/,
  /(稳赚|稳赚不赔|稳赚不亏|保赚)/,
  /(内部渠道|内幕|带单|老师喊单)/,
  /(拉人|返佣|发展下线)/,
  /(借钱|贷款|校园贷).*(炒币|投资|理财|股票|基金)/,
  /(学费|生活费).*(炒币|股票|基金|理财)/,
  /(翻倍|暴富|月化|月收益|日收益)/
];

async function requestHandler(req, res) {
  try {
    if (req.method === "POST" && req.url === "/api/chat") {
      const body = await readJson(req);
      const result = await handleChat(body);
      return sendJson(res, 200, result);
    }

    if (req.method === "GET" && req.url === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        provider: AI_PROVIDER,
        baseUrl: maskBaseUrl(DEEPSEEK_BASE_URL),
        model: DEEPSEEK_MODEL,
        hasApiKey: Boolean(process.env.DEEPSEEK_API_KEY),
        mode: process.env.DEEPSEEK_API_KEY ? "ai" : "fallback"
      });
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

const server = http.createServer(requestHandler);

if (!process.env.VERCEL) {
  server.listen(PORT, HOST, () => {
    console.log(`省心喵 H5 demo running at http://${HOST}:${PORT}`);
  });
}

export default requestHandler;

async function handleChat(body) {
  const message = String(body?.message || "").trim();
  const sessionId = String(body?.sessionId || "demo");
  const requestedIntent = String(body?.intent || "").trim();

  if (!message) {
    return {
      ok: false,
      error: "empty_message",
      reply: "省心喵在等你开口呢。可以先告诉我：你这个月生活费多少，想攒多少钱？"
    };
  }

  const userState = getSessionState(sessionId);
  const intent = normalizeIntent(requestedIntent) || detectIntent(message);
  const route = buildRoute(intent, message);
  const agent = AGENTS[intent] || AGENTS.review;
  const deterministic = buildDeterministicResult(intent, message, userState);

  const ai = await callAgent({
    intent,
    agent,
    route,
    message,
    userState,
    deterministic
  });

  const guarded = applySafetyGuard(intent, message, ai);
  updateState(userState, guarded);

  return {
    ok: true,
    intent,
    agent: agent.name,
    route,
    reply: guarded.reply,
    cards: guarded.cards || [],
    records: guarded.records || [],
    state: publicState(userState),
    usedFallback: guarded.usedFallback || false,
    source: guarded.usedFallback ? "fallback" : "ai",
    fallbackReason: guarded.fallbackReason || ""
  };
}

function normalizeIntent(value) {
  return ["ledger", "budget", "goal", "risk", "profile", "review"].includes(value) ? value : "";
}

function detectIntent(message) {
  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(message))) return "risk";
  if (/(股票|基金|货币基金|余额宝|理财|收益|风险|保本|炒币|校园贷|贷款|银行卡密码|密码)/.test(message)) return "risk";
  if (/(生活费|预算|怎么分|还剩|超支|能不能|还能|月底|本周|这周)/.test(message)) return "budget";
  if (/(攒|存|目标|旅行|电脑|考试费|报名费|应急金|暑假)/.test(message)) return "goal";
  if (/(记|花了|消费|买了|午饭|晚饭|奶茶|外卖|打车|教材|转我|报销)/.test(message) && /\d/.test(message)) return "ledger";
  if (/(我每月|我的情况|风险偏好|固定支出|画像)/.test(message)) return "profile";
  return "review";
}

function buildRoute(intent, message) {
  const route = ["主控编排 Agent"];
  if (intent === "budget") route.push("画像采集 Agent", "预算规划 Agent");
  if (intent === "goal") route.push("攒钱陪伴 Agent", "预算规划 Agent");
  if (intent === "ledger") route.push("记账 Agent", "消费复盘 Agent");
  if (intent === "risk") route.push("理财风控问答 Agent");
  if (intent === "profile") route.push("画像采集 Agent");
  if (intent === "review") route.push("消费复盘 Agent");
  route.push("安全守卫 Agent");
  return route;
}

function buildDeterministicResult(intent, message, userState) {
  if (intent === "ledger") return buildLedgerResult(message, userState);
  if (intent === "budget") return buildBudgetResult(message, userState);
  if (intent === "goal") return buildGoalResult(message, userState);
  if (intent === "risk") return buildRiskResult(message);
  return buildReviewResult(message, userState);
}

async function callAgent({ intent, agent, route, message, userState, deterministic }) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return {
      ...deterministic,
      reply: `当前还没有配置 DeepSeek API Key，所以这条回复是本地规则兜底结果。\n\n${deterministic.reply}`,
      usedFallback: true,
      fallbackReason: "missing_api_key"
    };
  }

  const systemPrompt = buildSystemPrompt(intent, agent, route);
  const userPrompt = JSON.stringify({
    user_message: message,
    user_state: publicState(userState),
    deterministic_result: deterministic,
    instruction: "优先回答 user_message 的真实语义。deterministic_result 只作为金额计算、账单解析和卡片结构参考，不要把它当成固定话术照抄。若用户只是闲聊或追问，可以不给 cards。",
    output_contract: {
      reply: "面向用户的一段中文回复，保持省心喵语气",
      cards: "用于前端展示的卡片数组；闲聊或不需要结构化展示时返回 []",
      records: "若是记账任务，返回账单数组"
    }
  });

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DeepSeek API ${response.status}: ${text.slice(0, 180)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = safeJson(content);
    return normalizeAiResult(parsed, deterministic);
  } catch (error) {
    return {
      ...deterministic,
      reply: `${deterministic.reply}\n\n小提示：当前 AI 接口暂时不可用，已先用本地规则给你生成演示结果。`,
      usedFallback: true,
      fallbackReason: error instanceof Error ? error.message : "api_error"
    };
  }
}

function buildSystemPrompt(intent, agent, route) {
  return `你是“省心喵”的${agent.name}，一个面向大学生的校园理财陪伴 AI 子 Agent。

产品定位：陪你攒钱、帮你管钱、教你懂钱的校园理财搭子。

当前路由链路：${route.join(" -> ")}
当前任务：${agent.description}
当前意图：${intent}

你必须遵守：
1. 只输出 JSON，不输出 Markdown 代码块。
2. 回复要温和、具体、可执行，带一点轻松陪伴感，但不要过度卖萌。
3. 用户最新输入 user_message 是最高优先级；不要只套用 deterministic_result 的固定回复。
4. 金额计算、账单拆分、预算状态优先相信 deterministic_result，不要随意改动数字。
5. 如果用户是在闲聊、追问、吐槽或表达情绪，先自然回应，再轻轻引导到记账/预算/攒钱/风控能力；这类场景 cards 可以返回 []。
6. 涉及投资理财时，不推荐具体买卖，不承诺收益，不诱导交易。
7. 涉及借钱投资、学费投资、银行卡密码等敏感场景，必须明确拒绝或强提醒。
8. 若信息不足，可以追问，但本轮也要给一个保守可执行建议。

JSON 字段：
{
  "reply": "给用户看的中文回复",
  "cards": [],
  "records": []
}`;
}

function normalizeAiResult(parsed, deterministic) {
  if (!parsed || typeof parsed !== "object") return deterministic;
  return {
    reply: typeof parsed.reply === "string" ? parsed.reply : deterministic.reply,
    cards: Array.isArray(parsed.cards) && parsed.cards.length ? parsed.cards : deterministic.cards,
    records: Array.isArray(parsed.records) && parsed.records.length ? parsed.records : deterministic.records,
    usedFallback: false
  };
}

function maskBaseUrl(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return value;
  }
}

function buildLedgerResult(message, userState) {
  const records = extractExpenseRecords(message);
  const recordedTotal = records.reduce((sum, record) => sum + record.amount, 0);
  const total = records.reduce((sum, record) => sum + (record.countAsExpense === false ? 0 : record.amount), 0);
  const weekBudget = userState.weekBudget || 0;
  const previousSpent = userState.weekSpent || 0;
  const weekSpent = previousSpent + total;
  const remaining = weekBudget ? Math.max(weekBudget - weekSpent, 0) : 0;
  const status = weekBudget && weekSpent >= weekBudget ? "已超支" : weekBudget && weekSpent >= weekBudget * 0.85 ? "接近上限" : "正常";

  return {
    reply: records.length
      ? `已帮你记好 ${records.length} 笔，记录总额 ${recordedTotal} 元，实际计入支出 ${total} 元。${weekBudget ? `本周预算 ${weekBudget} 元，当前已用 ${weekSpent} 元，还剩 ${remaining} 元。` : "你还没有设置本周预算，先记录账单，之后可以去预算页生成预算。"}省心喵提醒：${status === "正常" ? "节奏还不错，继续稳住。" : status === "接近上限" ? "这周已经接近上限，接下来适合进入轻省模式。" : "这周预算已经超了，先别自责，我们把后几天计划收一收。"}`
      : "这句里我没识别到明确金额。你可以像这样记：今天午饭 26，奶茶 18。",
    cards: [
      {
        type: "ledger",
        title: "今日小喵账单",
        total,
        recordedTotal,
        weekBudget,
        weekSpent,
        remaining,
        status
      }
    ],
    records
  };
}

function buildBudgetResult(message, userState) {
  const numbers = extractNumbers(message);
  const income = findNumberNear(message, ["生活费", "收入", "每月", "月"]) || userState.monthlyIncome || numbers[0] || 0;
  const fixedCost = findNumberNear(message, ["固定", "话费", "会员", "房租"]) || userState.fixedCost || 0;
  const savingGoal = findNumberNear(message, ["攒", "存", "想先存", "先存", "目标"]) || userState.monthlySaving || 0;
  const happyBuffer = findNumberNear(message, ["快乐buffer", "快乐 buffer", "快乐"]) || 0;
  const emergencyBuffer = findNumberNear(message, ["应急buffer", "应急 buffer", "应急"]) || 0;
  const spendable = Math.max(income - fixedCost - savingGoal - happyBuffer - emergencyBuffer, 0);
  const weekBudget = Math.round(spendable / 4);
  const warningLine = Math.round(weekBudget * 0.85);
  const categories = [
    ["饮食", Math.round(spendable * 0.42)],
    ["交通", Math.round(spendable * 0.1)],
    ["学习", Math.round(spendable * 0.12)],
    ["社交娱乐", Math.round(spendable * 0.14)],
    ["购物", Math.round(spendable * 0.1)],
    ["弹性支出", Math.max(spendable - Math.round(spendable * 0.88), 0)]
  ];

  return {
    reply: `按你现在的情况，本月建议先锁定 ${savingGoal} 元储蓄，固定支出预留 ${fixedCost} 元，剩下 ${spendable} 元用于日常消费。换成周预算是 ${weekBudget} 元，花到 ${warningLine} 元时省心喵会提醒你收一收。`,
    cards: [
      {
        type: "budget",
        title: "生活费预算卡",
        income,
        fixedCost,
        savingGoal,
        spendable,
        weekBudget,
        warningLine,
        categories: categories.map(([name, amount]) => ({ name, amount }))
      }
    ],
    records: []
  };
}

function buildGoalResult(message, userState) {
  const target = findNumberNear(message, ["攒", "存", "目标", "旅行", "电脑"]) || extractNumbers(message)[0] || 3000;
  const current = findNumberNear(message, ["已有", "现在有", "已经有"]) || userState.savedAmount || 0;
  const months = inferMonths(message) || 3;
  const weeks = Math.max(months * 4, 1);
  const gap = Math.max(target - current, 0);
  const weekly = Math.ceil(gap / weeks);
  const pressure = weekly > 250 ? "偏高" : weekly > 120 ? "适中" : "轻松";

  return {
    reply: `目标收到：你想攒到 ${target} 元，目前还差 ${gap} 元。按 ${months} 个月来算，每周需要攒约 ${weekly} 元，压力等级是${pressure}。建议先把这笔钱当成“先存后花”的固定项目，不靠高风险投资硬冲。`,
    cards: [
      {
        type: "goal",
        title: "攒钱目标卡",
        target,
        current,
        gap,
        months,
        weeks,
        weekly,
        pressure,
        milestones: [
          { label: "第 1 阶段", value: Math.ceil(target * 0.25) },
          { label: "第 2 阶段", value: Math.ceil(target * 0.5) },
          { label: "第 3 阶段", value: Math.ceil(target * 0.75) },
          { label: "完成目标", value: target }
        ]
      }
    ],
    records: []
  };
}

function buildRiskResult(message) {
  const highRisk = HIGH_RISK_PATTERNS.some((pattern) => pattern.test(message));
  const asksPassword = /(密码|银行卡密码|支付密码|验证码)/.test(message);
  const riskLevel = asksPassword || highRisk ? "高" : /(基金|股票|炒币|收益)/.test(message) ? "中" : "低";
  const reply = asksPassword
    ? "这个我不能帮你记录。银行卡密码、支付密码、验证码都属于敏感信息，不应该交给任何应用或 AI 保存。省心喵可以帮你记预算和账单，但不会碰你的密码。"
    : riskLevel === "高"
      ? "这个说法风险很高，尤其是“保本高收益”“月化收益”“借钱投资”这类组合，对大学生非常不友好。我不能推荐你参与，更建议先确认资质、资金去向和最坏亏损情况，把应急金放在第一位。"
      : "可以聊，但我会先帮你把风险说清楚：理财产品收益不等于确定收入，历史收益也不代表未来。更适合先建立应急金，再学习低风险产品的基本概念。";

  return {
    reply,
    cards: [
      {
        type: "risk",
        title: "风险识别卡",
        riskLevel,
        suitable: riskLevel === "低" ? "可作为知识了解" : "不建议直接参与",
        redFlags: detectRedFlags(message),
        nextQuestions: ["钱具体投向哪里？", "是否有正规资质？", "最坏会亏多少？", "能否随时赎回？"]
      }
    ],
    records: []
  };
}

function buildReviewResult(message, userState) {
  const weekBudget = userState.weekBudget || 0;
  const weekSpent = userState.weekSpent || findNumberNear(message, ["花了", "已花", "用了"]) || 0;
  const remaining = weekBudget ? Math.max(weekBudget - weekSpent, 0) : 0;
  return {
    reply: weekBudget
      ? `我先按本周预算 ${weekBudget} 元帮你看：目前已用 ${weekSpent} 元，还剩 ${remaining} 元。要是你愿意，可以继续发“今天午饭 26，奶茶 18”这种格式，我会帮你自动记账并复盘。`
      : "你还没有设置预算。可以先去预算页填生活费和固定支出，或者直接发“今天午饭 26，奶茶 18”让我先帮你记账。",
    cards: [
      {
        type: "review",
        title: "消费复盘卡",
        weekBudget,
        weekSpent,
        remaining,
        suggestion: remaining <= 80 ? "接下来适合进入轻省模式，优先食堂和必要支出。" : "预算还有空间，但奶茶外卖可以设个小上限。"
      }
    ],
    records: []
  };
}

function applySafetyGuard(intent, message, ai) {
  const unsafe = /(推荐.*(股票|基金|币)|翻倍|借钱.*(炒币|投资)|银行卡密码|支付密码|验证码)/.test(message);
  if (!unsafe) return ai;

  const safetyCard = {
    type: "safety",
    title: "安全守卫提醒",
    rule: "不承诺收益、不推荐具体交易、不记录敏感信息",
    passed: true
  };

  if (/(银行卡密码|支付密码|验证码)/.test(message)) {
    return {
      ...ai,
      reply: "这个请求我不能帮你做。银行卡密码、支付密码、验证码都属于敏感信息，不能交给任何 AI 或应用保存。省心喵可以陪你记账、做预算、识别风险，但不会存储这类信息。",
      cards: [...(ai.cards || []), safetyCard]
    };
  }

  if (/(借钱|贷款|校园贷).*(炒币|投资|理财|股票|基金)/.test(message)) {
    return {
      ...ai,
      reply: "这个方向省心喵要强烈劝阻：不要借钱投资，更不要用校园贷、学费或生活费去炒币、炒股。投资亏损会放大债务压力，建议先停止这个计划，必要时找辅导员、家人或学校资助中心求助。",
      cards: [...(ai.cards || []), safetyCard]
    };
  }

  return {
    ...ai,
    cards: [...(ai.cards || []), safetyCard]
  };
}

function updateState(userState, result) {
  for (const record of result.records || []) {
    userState.records.push(record);
    if (record.countAsExpense !== false) {
      userState.weekSpent += record.amount;
    }
  }
  for (const card of result.cards || []) {
    if (card.type === "budget") {
      userState.monthlyIncome = card.income;
      userState.fixedCost = card.fixedCost;
      userState.monthlySaving = card.savingGoal;
      userState.weekBudget = card.weekBudget;
    }
    if (card.type === "goal") {
      userState.savedAmount = card.current;
    }
  }
}

function getSessionState(sessionId) {
  if (!stateBySession.has(sessionId)) {
    stateBySession.set(sessionId, {
      monthlyIncome: 0,
      fixedCost: 0,
      monthlySaving: 0,
      weekBudget: 0,
      weekSpent: 0,
      savedAmount: 0,
      records: []
    });
  }
  return stateBySession.get(sessionId);
}

function publicState(userState) {
  return {
    monthlyIncome: userState.monthlyIncome,
    fixedCost: userState.fixedCost,
    monthlySaving: userState.monthlySaving,
    weekBudget: userState.weekBudget,
    weekSpent: userState.weekSpent,
    savedAmount: userState.savedAmount,
    recordsCount: userState.records.length
  };
}

function extractExpenseRecords(message) {
  const records = [];
  const clauses = message
    .replace(/，/g, ",")
    .replace(/。/g, ",")
    .replace(/、/g, ",")
    .split(/[,；;和]/)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    const amountMatch = clause.match(/(\d+(?:\.\d+)?)\s*(?:元|块|rmb|RMB)?/);
    if (!amountMatch) continue;
    const amount = Number(amountMatch[1]);
    if (!amount || amount > 100000) continue;
    const nameText = clause
      .replace(amountMatch[0], "")
      .replace(/今天|昨天|刚刚|帮我|记账|花了|用了|消费|买了|支出|但.*$/g, "")
      .trim();
    const name = cleanName(nameText) || inferExpenseName(clause) || "消费";
    const context = clause;
    const countAsExpense = !/(转我|报销|AA|室友还|还我)/.test(context);
    records.push({
      id: `${Date.now()}-${records.length}`,
      name,
      amount,
      category: inferCategory(`${name}${context}`),
      time: /昨天/.test(context) ? "yesterday" : "today",
      countAsExpense,
      note: countAsExpense ? "" : "代付或已转回，不计入实际支出"
    });
  }
  return records.slice(0, 8);
}

function cleanName(value) {
  return String(value || "")
    .replace(/今天|昨天|刚刚|帮|室友|给|我|了|的|和|，|。|、|但她转我|但他转我/g, "")
    .trim();
}

function inferExpenseName(context) {
  for (const [, keywords] of CATEGORY_KEYWORDS) {
    const keyword = keywords.find((item) => context.includes(item));
    if (keyword) return keyword;
  }
  return "";
}

function getContext(message, index) {
  return message.slice(Math.max(0, index - 16), Math.min(message.length, index + 24));
}

function inferCategory(text) {
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => text.includes(keyword))) return category;
  }
  return "其他";
}

function extractNumbers(message) {
  return [...message.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0])).filter(Boolean);
}

function findNumberNear(message, keywords) {
  const numbers = [...message.matchAll(/\d+(?:\.\d+)?/g)];
  let best = null;
  let bestDistance = Infinity;
  for (const match of numbers) {
    const index = match.index || 0;
    for (const keyword of keywords) {
      const keywordIndex = message.indexOf(keyword);
      if (keywordIndex === -1) continue;
      const distance = Math.abs(index - keywordIndex);
      if (distance < bestDistance && distance < 18) {
        bestDistance = distance;
        best = Number(match[0]);
      }
    }
  }
  return best;
}

function inferMonths(message) {
  const monthMatch = message.match(/(\d+)\s*个?月/);
  if (monthMatch) return Number(monthMatch[1]);
  if (/暑假/.test(message)) return 3;
  if (/半年/.test(message)) return 6;
  if (/一年/.test(message)) return 12;
  return null;
}

function detectRedFlags(message) {
  const flags = [];
  if (/保本|稳赚/.test(message)) flags.push("保本稳赚话术");
  if (/月化|月收益|日收益|翻倍/.test(message)) flags.push("异常高收益表达");
  if (/借钱|贷款|校园贷/.test(message)) flags.push("借贷投资风险");
  if (/内部|内幕|带单/.test(message)) flags.push("非公开渠道风险");
  if (/密码|验证码/.test(message)) flags.push("敏感信息风险");
  return flags.length ? flags : ["需核实产品资质与风险等级"];
}

function safeJson(content) {
  const text = String(content || "").trim();
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        return null;
      }
    }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const safePath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(publicDir, safePath));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

function getContentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}
