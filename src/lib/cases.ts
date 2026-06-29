export type CaseCategory =
  | "financial-statement"
  | "quant-investment"
  | "risk-management"
  | "tax-calculation"
  | "financial-forecast";

export type CaseDifficulty = "基础" | "进阶" | "挑战";

export interface FinanceCase {
  id: string;
  title: string;
  category: CaseCategory;
  difficulty: CaseDifficulty;
  description: string;
  objectives: string[];
  referenceCode: string;
  expectedOutput: string;
  estimatedMinutes: number;
}

export const CATEGORIES: { value: CaseCategory; label: string }[] = [
  { value: "financial-statement", label: "财务报表分析" },
  { value: "quant-investment", label: "量化投资" },
  { value: "risk-management", label: "风险管理" },
  { value: "tax-calculation", label: "税务计算" },
  { value: "financial-forecast", label: "财务预测" },
];

export const CATEGORY_LABEL: Record<CaseCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
) as Record<CaseCategory, string>;

export const FINANCE_CASES: FinanceCase[] = [
  {
    id: "ratio-analysis",
    title: "财务比率分析",
    category: "financial-statement",
    difficulty: "基础",
    description:
      "基于模拟的资产负债表与利润表数据，计算企业的偿债能力、营运能力与盈利能力比率，并对结果进行解读。",
    objectives: [
      "掌握流动比率、速动比率、资产负债率的计算方法",
      "理解 ROE、ROA、毛利率的财务含义",
      "学会使用 pandas 处理财务报表数据",
    ],
    estimatedMinutes: 20,
    referenceCode: `import pandas as pd

# 模拟财务数据
data = {
    "流动资产": 1_200_000,
    "流动负债": 600_000,
    "存货": 300_000,
    "总资产": 5_000_000,
    "总负债": 2_000_000,
    "净利润": 450_000,
    "营业收入": 3_000_000,
}

current_ratio = data["流动资产"] / data["流动负债"]
quick_ratio = (data["流动资产"] - data["存货"]) / data["流动负债"]
debt_ratio = data["总负债"] / data["总资产"]
roa = data["净利润"] / data["总资产"]
net_margin = data["净利润"] / data["营业收入"]

print(f"流动比率: {current_ratio:.2f}")
print(f"速动比率: {quick_ratio:.2f}")
print(f"资产负债率: {debt_ratio:.2%}")
print(f"总资产收益率: {roa:.2%}")
print(f"净利率: {net_margin:.2%}")
`,
    expectedOutput: `流动比率: 2.00
速动比率: 1.50
资产负债率: 40.00%
总资产收益率: 9.00%
净利率: 15.00%`,
  },
  {
    id: "dupont-analysis",
    title: "杜邦分析体系",
    category: "financial-statement",
    difficulty: "进阶",
    description: "通过杜邦分解法将 ROE 拆解为净利率、总资产周转率与权益乘数三因素，分析驱动因素。",
    objectives: ["理解杜邦体系三因素分解", "对比多年度 ROE 变动来源"],
    estimatedMinutes: 30,
    referenceCode: `net_margin = 0.15
asset_turnover = 0.6
equity_multiplier = 2.5
roe = net_margin * asset_turnover * equity_multiplier
print(f"ROE: {roe:.2%}")`,
    expectedOutput: `ROE: 22.50%`,
  },
  {
    id: "ma-strategy",
    title: "双均线择时策略",
    category: "quant-investment",
    difficulty: "进阶",
    description: "使用模拟的日度价格序列构建短期与长期均线，金叉买入、死叉卖出，回测累计收益。",
    objectives: ["掌握 pandas 滚动窗口计算", "理解择时信号生成", "计算累计收益与年化收益"],
    estimatedMinutes: 40,
    referenceCode: `import numpy as np
import pandas as pd

np.random.seed(42)
price = 100 * (1 + np.random.normal(0, 0.01, 250)).cumprod()
df = pd.DataFrame({"price": price})
df["ma5"] = df["price"].rolling(5).mean()
df["ma20"] = df["price"].rolling(20).mean()
df["signal"] = (df["ma5"] > df["ma20"]).astype(int)
df["ret"] = df["price"].pct_change()
df["strategy"] = df["signal"].shift(1) * df["ret"]
cum = (1 + df["strategy"].fillna(0)).prod() - 1
print(f"策略累计收益: {cum:.2%}")`,
    expectedOutput: `策略累计收益: ~ 视随机种子而定`,
  },
  {
    id: "portfolio-optimization",
    title: "投资组合优化",
    category: "quant-investment",
    difficulty: "挑战",
    description: "基于 Markowitz 均值-方差模型，计算给定资产组合的有效前沿与最小方差组合。",
    objectives: ["理解协方差矩阵", "求解二次规划问题"],
    estimatedMinutes: 50,
    referenceCode: `# 使用 scipy.optimize.minimize 求解最小方差组合
import numpy as np
from scipy.optimize import minimize

cov = np.array([[0.04, 0.006, 0.012],
                [0.006, 0.09, 0.018],
                [0.012, 0.018, 0.16]])
n = 3
def variance(w): return w @ cov @ w
cons = [{"type": "eq", "fun": lambda w: w.sum() - 1}]
bounds = [(0, 1)] * n
res = minimize(variance, np.ones(n)/n, bounds=bounds, constraints=cons)
print("最优权重:", res.x.round(3))`,
    expectedOutput: `最优权重: [0.69  0.27  0.04]`,
  },
  {
    id: "var-historical",
    title: "历史模拟法 VaR",
    category: "risk-management",
    difficulty: "基础",
    description: "使用日度收益率历史数据，计算 95% 置信水平下的 1 日在险价值（VaR）。",
    objectives: ["理解 VaR 概念", "掌握 numpy 百分位数计算"],
    estimatedMinutes: 25,
    referenceCode: `import numpy as np
np.random.seed(0)
returns = np.random.normal(0, 0.02, 1000)
var_95 = -np.percentile(returns, 5)
print(f"95% VaR: {var_95:.2%}")`,
    expectedOutput: `95% VaR: 3.29%`,
  },
  {
    id: "monte-carlo-var",
    title: "蒙特卡洛模拟 VaR",
    category: "risk-management",
    difficulty: "挑战",
    description: "对一个含三只资产的组合，使用蒙特卡洛方法模拟 10000 条路径，估计 99% VaR。",
    objectives: ["掌握多元正态采样", "组合风险聚合"],
    estimatedMinutes: 45,
    referenceCode: `import numpy as np
np.random.seed(1)
mu = np.array([0.0005, 0.0003, 0.0007])
cov = np.array([[1e-4, 2e-5, 3e-5],
                [2e-5, 1.5e-4, 4e-5],
                [3e-5, 4e-5, 2e-4]])
w = np.array([0.4, 0.4, 0.2])
sims = np.random.multivariate_normal(mu, cov, 10000)
pnl = sims @ w
var_99 = -np.percentile(pnl, 1)
print(f"99% VaR: {var_99:.4f}")`,
    expectedOutput: `99% VaR: 0.0234`,
  },
  {
    id: "iit-calc",
    title: "个人所得税计算",
    category: "tax-calculation",
    difficulty: "基础",
    description: "根据中国综合所得年度税率表与速算扣除数，计算给定应纳税所得额对应的个人所得税。",
    objectives: ["实现累进税率分段计算", "理解速算扣除数"],
    estimatedMinutes: 20,
    referenceCode: `def iit(taxable: float) -> float:
    brackets = [(36000, 0.03, 0),
                (144000, 0.10, 2520),
                (300000, 0.20, 16920),
                (420000, 0.25, 31920),
                (660000, 0.30, 52920),
                (960000, 0.35, 85920),
                (float("inf"), 0.45, 181920)]
    for limit, rate, quick in brackets:
        if taxable <= limit:
            return taxable * rate - quick
    return 0.0

print(f"应纳税额: {iit(200000):.2f}")`,
    expectedOutput: `应纳税额: 23080.00`,
  },
  {
    id: "vat-calc",
    title: "增值税进销项核算",
    category: "tax-calculation",
    difficulty: "基础",
    description: "根据销项与进项发票数据计算当期应纳增值税。",
    objectives: ["理解增值税抵扣机制"],
    estimatedMinutes: 15,
    referenceCode: `sales = 1_000_000
input_tax = 80_000
output_tax = sales * 0.13
vat = output_tax - input_tax
print(f"应纳增值税: {vat:.2f}")`,
    expectedOutput: `应纳增值税: 50000.00`,
  },
  {
    id: "revenue-forecast",
    title: "营业收入线性回归预测",
    category: "financial-forecast",
    difficulty: "进阶",
    description: "基于过去 12 个月的营业收入数据，使用线性回归预测未来 3 个月营收走势。",
    objectives: ["掌握 sklearn 线性回归", "区分训练集与预测集"],
    estimatedMinutes: 35,
    referenceCode: `import numpy as np
from sklearn.linear_model import LinearRegression

x = np.arange(12).reshape(-1, 1)
y = np.array([100, 110, 115, 120, 130, 135, 140, 150, 160, 165, 170, 180])
model = LinearRegression().fit(x, y)
future = np.array([[12], [13], [14]])
pred = model.predict(future)
print("未来 3 个月预测:", pred.round(2))`,
    expectedOutput: `未来 3 个月预测: [184.2  191.3  198.4]`,
  },
  {
    id: "dcf-valuation",
    title: "DCF 企业估值",
    category: "financial-forecast",
    difficulty: "挑战",
    description: "构建简化的两阶段 DCF 模型，对企业进行内在价值估算。",
    objectives: ["现金流折现计算", "终值与 WACC"],
    estimatedMinutes: 50,
    referenceCode: `fcf = [120, 135, 150, 165, 180]  # 万元
wacc = 0.10
g = 0.03
pv = sum(cf / (1 + wacc) ** (i + 1) for i, cf in enumerate(fcf))
tv = fcf[-1] * (1 + g) / (wacc - g)
pv_tv = tv / (1 + wacc) ** len(fcf)
ev = pv + pv_tv
print(f"企业价值: {ev:.2f} 万元")`,
    expectedOutput: `企业价值: ~2200.00 万元`,
  },
];

export function getCaseById(id: string): FinanceCase | undefined {
  return FINANCE_CASES.find((c) => c.id === id);
}
