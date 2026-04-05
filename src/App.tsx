import { useState } from 'react'

type RepaymentType = 'equal-principal' | 'equal-payment'
type LoanType = 'no-grace' | 'interest-only' | 'partial-grace'

interface RentalPropertyInfo {
  rentIncome: number
  annualRate: number
  remainingPrincipal: number
  remainingYears: number
}

// 計算出租房屋每月還款（本息平均攤還）
function calculateRentalMortgage(principal: number, annualRate: number, years: number): number {
  const monthlyRate = annualRate / 100 / 12
  const totalMonths = years * 12
  if (monthlyRate === 0) return principal / totalMonths
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / 
                  (Math.pow(1 + monthlyRate, totalMonths) - 1)
  return payment
}

interface CalculationResult {
  monthlyPayment: number
  totalInterest: number
  totalPayment: number
  schedule: { month: number; principal: number; interest: number; balance: number }[]
  graceSchedule?: { month: number; interest: number; principal: number; balance: number }[]
}

function calculateMortgage(
  loanAmount: number,
  annualRate: number,
  years: number,
  repaymentType: RepaymentType,
  loanType: LoanType,
  gracePeriodYears: number = 0
): CalculationResult {
  const monthlyRate = annualRate / 100 / 12
  const totalMonths = years * 12
  const graceMonths = gracePeriodYears * 12

  let monthlyPayment: number
  let totalInterest: number
  let totalPayment: number
  let schedule: { month: number; principal: number; interest: number; balance: number }[] = []
  let graceSchedule: { month: number; interest: number; principal: number; balance: number }[] = []

  const originalPrincipal = loanAmount

  if (repaymentType === 'equal-payment') {
    monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / 
                     (Math.pow(1 + monthlyRate, totalMonths) - 1)
  } else {
    const monthlyPrincipal = loanAmount / totalMonths
    const firstInterest = loanAmount * monthlyRate
    monthlyPayment = monthlyPrincipal + firstInterest
  }

  let balance = loanAmount
  totalInterest = 0

  if (loanType === 'interest-only' || loanType === 'partial-grace') {
    for (let month = 1; month <= graceMonths; month++) {
      const interest = balance * monthlyRate
      let principal = 0
      if (loanType === 'partial-grace') {
        principal = loanAmount / totalMonths
        balance -= principal
      }
      totalInterest += interest
      graceSchedule.push({ month, interest, principal, balance })
    }
  }

  for (let month = 1; month <= totalMonths; month++) {
    const interest = balance * monthlyRate
    let principal: number
    let payment: number

    if (repaymentType === 'equal-payment') {
      payment = monthlyPayment
      principal = payment - interest
    } else {
      principal = loanAmount / totalMonths
      payment = principal + interest
    }

    balance -= principal
    if (balance < 0) balance = 0

    totalInterest += interest
    totalPayment = originalPrincipal + totalInterest

    schedule.push({ month, principal, interest, balance })
  }

  if (repaymentType === 'equal-payment') {
    totalPayment = monthlyPayment * totalMonths
  } else {
    totalPayment = originalPrincipal + totalInterest
  }

  return {
    monthlyPayment: repaymentType === 'equal-payment' ? monthlyPayment : schedule[0].principal + schedule[0].interest,
    totalInterest,
    totalPayment,
    schedule,
    graceSchedule
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW', { 
    style: 'currency', 
    currency: 'TWD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

function formatNumber(amount: number): string {
  return new Intl.NumberFormat('zh-TW').format(Math.round(amount))
}

export default function App() {
  const [housePrice, setHousePrice] = useState(2600)
  const [loanPercent, setLoanPercent] = useState(80)
  const [annualRate, setAnnualRate] = useState(2.185)
  const [years, setYears] = useState(30)
  const [repaymentType, setRepaymentType] = useState<RepaymentType>('equal-payment')
  const [loanType, setLoanType] = useState<LoanType>('no-grace')
  const [graceYears, setGraceYears] = useState(2)
  const [showSchedule, setShowSchedule] = useState(false)
  const [activeTab, setActiveTab] = useState<'calculator' | 'timeline'>('calculator')
  const [monthlySalary, setMonthlySalary] = useState(150000)
  const [secondSalary, setSecondSalary] = useState(0)
  const [rentalProperty, setRentalProperty] = useState<RentalPropertyInfo>({
    rentIncome: 0,
    annualRate: 2.5,
    remainingPrincipal: 0,
    remainingYears: 20
  })
  const [newHouseManagementFee, setNewHouseManagementFee] = useState(0)

  const loanAmount = housePrice * 10000 * (loanPercent / 100)
  const result = calculateMortgage(loanAmount, annualRate, years, repaymentType, loanType, graceYears)

  const monthlyRate = annualRate / 100 / 12
  const firstMonthInterest = loanAmount * monthlyRate
  const firstMonthPrincipal = repaymentType === 'equal-payment' 
    ? result.monthlyPayment - firstMonthInterest 
    : loanAmount / (years * 12)

  // 出租房屋相關計算
  const rentalMonthlyPayment = rentalProperty.remainingPrincipal > 0 && rentalProperty.remainingYears > 0
    ? calculateRentalMortgage(rentalProperty.remainingPrincipal, rentalProperty.annualRate, rentalProperty.remainingYears)
    : 0
  const netRentalIncome = rentalProperty.rentIncome - rentalMonthlyPayment
  const totalIncome = monthlySalary + secondSalary + netRentalIncome

  return (
    <div className="min-h-screen text-white py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-2">🏦 房屋貸款試算</h1>
          <p className="text-gray-400">專業房貸分析工具</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/10 backdrop-blur rounded-xl p-1 flex gap-1 border border-white/20">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'calculator'
                  ? 'bg-cyan-500 text-white'
                  : 'text-gray-300 hover:bg-white/10'
              }`}
            >
              🧮 房貸試算
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'timeline'
                  ? 'bg-cyan-500 text-white'
                  : 'text-gray-300 hover:bg-white/10'
              }`}
            >
              📈 收支分析
            </button>
          </div>
        </div>

        {activeTab === 'calculator' ? (
          <>
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Input Panel */}
              <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
                <h2 className="text-xl font-semibold mb-6 text-cyan-300">📝 輸入條件</h2>

                <div className="space-y-5">
                  {/* 房屋總價 */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">房屋總價</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={housePrice}
                        onChange={(e) => setHousePrice(Number(e.target.value))}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-cyan-400"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">萬元</span>
                    </div>
                    <input
                      type="range"
                      min="500"
                      max="10000"
                      step="100"
                      value={housePrice}
                      onChange={(e) => setHousePrice(Number(e.target.value))}
                      className="w-full mt-2 accent-cyan-400"
                    />
                  </div>

                  {/* 貸款成數 */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">貸款成數</label>
                    <div className="flex gap-2">
                      {[60, 70, 80, 85, 90].map((p) => (
                        <button
                          key={p}
                          onClick={() => setLoanPercent(p)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                            loanPercent === p
                              ? 'bg-cyan-500 text-white'
                              : 'bg-white/10 text-gray-300 hover:bg-white/20'
                          }`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 贷款利率 */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">年利率</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.001"
                        value={annualRate}
                        onChange={(e) => setAnnualRate(Number(e.target.value))}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-cyan-400"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {[2.185, 2.5, 2.88, 3.0].map((r) => (
                        <button
                          key={r}
                          onClick={() => setAnnualRate(r)}
                          className={`flex-1 py-1.5 rounded text-sm transition-all ${
                            annualRate === r
                              ? 'bg-cyan-500 text-white'
                              : 'bg-white/10 text-gray-300 hover:bg-white/20'
                          }`}
                        >
                          {r}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 貸款年限 */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">貸款年限</label>
                    <div className="flex gap-2">
                      {[20, 30].map((y) => (
                        <button
                          key={y}
                          onClick={() => setYears(y)}
                          className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                            years === y
                              ? 'bg-cyan-500 text-white'
                              : 'bg-white/10 text-gray-300 hover:bg-white/20'
                          }`}
                        >
                          {y}年
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 還款方式 */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">還款方式</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-all">
                        <input
                          type="radio"
                          name="repayment"
                          checked={repaymentType === 'equal-payment'}
                          onChange={() => setRepaymentType('equal-payment')}
                          className="accent-cyan-400"
                        />
                        <div>
                          <div className="text-sm font-medium">本息平均攤還</div>
                          <div className="text-xs text-gray-400">每月還款固定，前期利息較多</div>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-all">
                        <input
                          type="radio"
                          name="repayment"
                          checked={repaymentType === 'equal-principal'}
                          onChange={() => setRepaymentType('equal-principal')}
                          className="accent-cyan-400"
                        />
                        <div>
                          <div className="text-sm font-medium">本金平均攤還</div>
                          <div className="text-xs text-gray-400">每月本金固定，利息越還越少</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* 寬限期 */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">寬限期</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'no-grace', label: '無寬限期' },
                        { value: 'interest-only', label: '只繳利息' },
                        { value: 'partial-grace', label: '利息+本金' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setLoanType(opt.value as LoanType)}
                          className={`flex-1 py-2 rounded text-sm transition-all ${
                            loanType === opt.value
                              ? 'bg-purple-500 text-white'
                              : 'bg-white/10 text-gray-300 hover:bg-white/20'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {loanType !== 'no-grace' && (
                      <div className="mt-3">
                        <label className="block text-xs text-gray-400 mb-1">寬限期年數</label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={graceYears}
                          onChange={(e) => setGraceYears(Number(e.target.value))}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Results Panel */}
              <div className="space-y-6">
                {/* 主要結果 */}
                <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur rounded-2xl p-6 border border-cyan-400/30">
                  <h2 className="text-xl font-semibold mb-4 text-cyan-300">📊 試算結果</h2>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-sm text-gray-300 mb-1">貸款金額</div>
                      <div className="text-2xl font-bold text-white">{formatNumber(loanAmount)}</div>
                      <div className="text-xs text-gray-400">元</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-sm text-gray-300 mb-1">每月還款</div>
                      <div className="text-2xl font-bold text-yellow-400">{formatCurrency(result.monthlyPayment)}</div>
                      <div className="text-xs text-gray-400">元</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-sm text-gray-300 mb-1">總利息</div>
                      <div className="text-2xl font-bold text-orange-400">{formatCurrency(result.totalInterest)}</div>
                      <div className="text-xs text-gray-400">元</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-sm text-gray-300 mb-1">總還款額</div>
                      <div className="text-2xl font-bold text-green-400">{formatCurrency(result.totalPayment)}</div>
                      <div className="text-xs text-gray-400">元</div>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-white/5 rounded-xl">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">利息佔貸款比例</span>
                      <span className="text-white font-medium">
                        {((result.totalInterest / loanAmount) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* 第一期明細 */}
                <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
                  <h2 className="text-lg font-semibold mb-4 text-purple-300">📋 第一期繳款明細</h2>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-300">本金</span>
                      <span className="text-white font-medium">{formatCurrency(firstMonthPrincipal)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-300">利息</span>
                      <span className="text-orange-400">{formatCurrency(firstMonthInterest)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-300">合計</span>
                      <span className="text-white font-bold text-lg">{formatCurrency(result.monthlyPayment)}</span>
                    </div>
                  </div>

                  {loanType !== 'no-grace' && result.graceSchedule && (
                    <div className="mt-4 p-4 bg-purple-500/20 rounded-xl">
                      <div className="text-sm text-purple-300 mb-2">寬限期內只繳利息：</div>
                      <div className="text-xl font-bold text-purple-200">
                        每月 {formatCurrency(result.graceSchedule[0].interest)} 元
                      </div>
                    </div>
                  )}
                </div>

                {/* 利率比較 */}
                <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
                  <h2 className="text-lg font-semibold mb-4 text-green-300">🔍 利率比較</h2>
                  
                  <div className="space-y-2">
                    {[
                      { rate: 2.185, label: '優質客戶' },
                      { rate: 2.5, label: '一般客戶' },
                      { rate: 2.888, label: '一般房貸' },
                      { rate: 3.0, label: '偏高利率' },
                    ].map(({ rate, label }) => {
                      const r = calculateMortgage(loanAmount, rate, years, repaymentType, 'no-grace')
                      return (
                        <div key={rate} className="flex justify-between items-center py-2 px-3 bg-white/5 rounded-lg">
                          <div>
                            <span className="text-white font-medium">{rate}%</span>
                            <span className="text-gray-400 text-sm ml-2">({label})</span>
                          </div>
                          <div className="text-right">
                            <div className="text-yellow-400 text-sm">{formatCurrency(r.monthlyPayment)}/月</div>
                            <div className="text-gray-400 text-xs">總利息 {formatNumber(r.totalInterest)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 攤還表按鈕 */}
                <button
                  onClick={() => setShowSchedule(!showSchedule)}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-all"
                >
                  {showSchedule ? '🔼 隱藏攤還表' : '🔽 顯示完整攤還表'}
                </button>

                {showSchedule && (
                  <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20 max-h-96 overflow-y-auto">
                    <h3 className="text-lg font-semibold mb-4 text-cyan-300">📑 攤還表（前24期）</h3>
                    <table className="w-full text-sm">
                      <thead className="text-gray-400 border-b border-white/20">
                        <tr>
                          <th className="py-2 text-left">期數</th>
                          <th className="py-2 text-right">本金</th>
                          <th className="py-2 text-right">利息</th>
                          <th className="py-2 text-right">餘額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.schedule.slice(0, 24).map((row) => (
                          <tr key={row.month} className="border-b border-white/10">
                            <td className="py-2 text-gray-300">第{row.month}期</td>
                            <td className="py-2 text-right text-green-400">{formatNumber(row.principal)}</td>
                            <td className="py-2 text-right text-orange-400">{formatNumber(row.interest)}</td>
                            <td className="py-2 text-right text-white">{formatNumber(row.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {result.schedule.length > 24 && (
                      <div className="text-center text-gray-400 text-sm mt-4">
                        ... 共 {result.schedule.length} 期
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Timeline Tab - 全新三欄式版面 */
          <>
            {/* 桌面版：三欄橫向排列 | 手機版：上下三欄 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* ===== 左欄：收入（綠色系）===== */}
              <div className="bg-gradient-to-br from-emerald-900/40 to-green-800/20 backdrop-blur rounded-2xl p-5 border border-emerald-500/30">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-2xl">💰</span>
                  <h2 className="text-xl font-bold text-emerald-300">收入</h2>
                </div>

                <div className="space-y-4">
                  {/* 月薪輸入 */}
                  <div>
                    <label className="block text-sm text-emerald-200/70 mb-1.5">月薪</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={monthlySalary}
                        onChange={(e) => setMonthlySalary(Number(e.target.value))}
                        className="w-full bg-emerald-950/50 border border-emerald-500/30 rounded-lg px-3 py-2.5 text-white text-lg focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400/60 text-sm">元</span>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {[100000, 150000, 200000, 300000].map((s) => (
                        <button
                          key={s}
                          onClick={() => setMonthlySalary(s)}
                          className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                            monthlySalary === s
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                              : 'bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/50'
                          }`}
                        >
                          {s / 10000}萬
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 第二人月薪 */}
                  <div>
                    <label className="block text-sm text-emerald-200/70 mb-1.5">第二人月薪</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={secondSalary}
                        onChange={(e) => setSecondSalary(Number(e.target.value))}
                        className="w-full bg-emerald-950/50 border border-emerald-500/30 rounded-lg px-3 py-2.5 text-white text-lg focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400/60 text-sm">元</span>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {[0, 30000, 50000, 80000].map((s) => (
                        <button
                          key={s}
                          onClick={() => setSecondSalary(s)}
                          className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                            secondSalary === s
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                              : 'bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/50'
                          }`}
                        >
                          {s === 0 ? '無' : `${s / 10000}萬`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 分隔線 */}
                  <div className="border-t border-emerald-500/20 pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-emerald-300/80 mb-3 flex items-center gap-2">
                      <span>🏠</span>出租房屋資訊
                    </h3>
                    
                    {/* 月租金 */}
                    <div className="mb-3">
                      <label className="block text-xs text-emerald-200/60 mb-1">月租金收入</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={rentalProperty.rentIncome}
                          onChange={(e) => setRentalProperty({ ...rentalProperty, rentIncome: Number(e.target.value) })}
                          className="w-full bg-emerald-950/50 border border-emerald-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-400"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400/60 text-sm">元</span>
                      </div>
                      <div className="flex gap-1.5 mt-1.5">
                        {[0, 20000, 30000, 50000].map((r) => (
                          <button
                            key={r}
                            onClick={() => setRentalProperty({ ...rentalProperty, rentIncome: r })}
                            className={`flex-1 py-1 rounded text-xs transition-all ${
                              rentalProperty.rentIncome === r
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-900/30 text-emerald-300/70 hover:bg-emerald-800/40'
                            }`}
                          >
                            {r === 0 ? '無' : `${r / 10000}萬`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 出租房貸資訊 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-emerald-200/60 mb-1">房貸利率</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.001"
                            value={rentalProperty.annualRate}
                            onChange={(e) => setRentalProperty({ ...rentalProperty, annualRate: Number(e.target.value) })}
                            className="w-full bg-emerald-950/50 border border-emerald-500/30 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-400"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-400/60 text-xs">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-emerald-200/60 mb-1">剩餘年限</label>
                        <select
                          value={rentalProperty.remainingYears}
                          onChange={(e) => setRentalProperty({ ...rentalProperty, remainingYears: Number(e.target.value) })}
                          className="w-full bg-emerald-950/50 border border-emerald-500/30 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-400"
                        >
                          {[5, 10, 15, 20, 25, 30].map((y) => (
                            <option key={y} value={y}>{y}年</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="block text-xs text-emerald-200/60 mb-1">剩餘本金</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={rentalProperty.remainingPrincipal}
                          onChange={(e) => setRentalProperty({ ...rentalProperty, remainingPrincipal: Number(e.target.value) })}
                          className="w-full bg-emerald-950/50 border border-emerald-500/30 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-400"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-400/60 text-xs">元</span>
                      </div>
                    </div>
                  </div>

                  {/* 淨租金收入計算結果 */}
                  {rentalProperty.rentIncome > 0 && (
                    <div className={`p-3 rounded-xl mt-3 ${
                      netRentalIncome >= 0 
                        ? 'bg-emerald-500/20 border border-emerald-400/30' 
                        : 'bg-red-500/20 border border-red-400/30'
                    }`}>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-300">租金收入</span>
                        <span className="text-emerald-400">+{formatNumber(rentalProperty.rentIncome)}</span>
                      </div>
                      {rentalMonthlyPayment > 0 && (
                        <div className="flex justify-between items-center text-sm mt-1">
                          <span className="text-gray-300">出租房貸還款</span>
                          <span className="text-red-400">-{formatNumber(rentalMonthlyPayment)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/10">
                        <span className={`font-semibold ${netRentalIncome >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                          淨租金收入
                        </span>
                        <span className={`font-bold text-lg ${netRentalIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {netRentalIncome >= 0 ? '+' : ''}{formatNumber(netRentalIncome)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ===== 中欄：支出（紅色系）===== */}
              <div className="bg-gradient-to-br from-rose-900/40 to-red-800/20 backdrop-blur rounded-2xl p-5 border border-rose-500/30">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-2xl">💸</span>
                  <h2 className="text-xl font-bold text-rose-300">支出</h2>
                </div>

                <div className="space-y-4">
                  {/* 主房貸資訊（來自房貸試算 Tab） */}
                  <div className="bg-rose-950/40 rounded-xl p-4 border border-rose-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-rose-200/70 text-sm">主房貸（新房）</span>
                      <span className="text-rose-400/60 text-xs">來自房貸試算</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">貸款金額</span>
                        <span className="text-white font-medium">{formatNumber(loanAmount)} 元</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">年利率</span>
                        <span className="text-white">{annualRate}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">貸款年限</span>
                        <span className="text-white">{years} 年</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-rose-500/20">
                        <span className="text-rose-200 font-semibold">每月還款</span>
                        <span className="text-rose-400 font-bold text-xl">{formatNumber(result.monthlyPayment)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 出租房每月還款 */}
                  {rentalMonthlyPayment > 0 && (
                    <div className="bg-rose-950/40 rounded-xl p-4 border border-rose-500/20">
                      <div className="flex justify-between items-center">
                        <span className="text-rose-200/70 text-sm">出租房每月還款</span>
                        <span className="text-rose-400 font-bold">{formatNumber(rentalMonthlyPayment)}</span>
                      </div>
                    </div>
                  )}

                  {/* 新房子管理費 */}
                  <div>
                    <label className="block text-sm text-rose-200/70 mb-1.5">新房子管理費</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={newHouseManagementFee}
                        onChange={(e) => setNewHouseManagementFee(Number(e.target.value))}
                        className="w-full bg-rose-950/50 border border-rose-500/30 rounded-lg px-3 py-2.5 text-white text-lg focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-400/60 text-sm">元</span>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {[0, 3000, 5000, 8000].map((f) => (
                        <button
                          key={f}
                          onClick={() => setNewHouseManagementFee(f)}
                          className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                            newHouseManagementFee === f
                              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                              : 'bg-rose-900/40 text-rose-300 hover:bg-rose-800/50'
                          }`}
                        >
                          {f === 0 ? '無' : f.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 總支出計算 */}
                  <div className="bg-rose-500/20 border border-rose-400/30 rounded-xl p-4 mt-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">主房貸還款</span>
                        <span className="text-rose-400">{formatNumber(result.monthlyPayment)}</span>
                      </div>
                      {rentalMonthlyPayment > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">出租房還款</span>
                          <span className="text-rose-400">{formatNumber(rentalMonthlyPayment)}</span>
                        </div>
                      )}
                      {newHouseManagementFee > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">管理費</span>
                          <span className="text-rose-400">{formatNumber(newHouseManagementFee)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-rose-400/20">
                        <span className="text-rose-200 font-semibold text-base">總支出</span>
                        <span className="text-rose-300 font-bold text-2xl">
                          {formatNumber(result.monthlyPayment + rentalMonthlyPayment + newHouseManagementFee)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ===== 右欄：結果（藍紫色系）===== */}
              <div className="bg-gradient-to-br from-violet-900/40 to-indigo-800/20 backdrop-blur rounded-2xl p-5 border border-violet-500/30">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-2xl">📊</span>
                  <h2 className="text-xl font-bold text-violet-300">分析結果</h2>
                </div>

                {(() => {
                  const totalExpenseCalc = result.monthlyPayment + rentalMonthlyPayment + newHouseManagementFee
                  const disposableCalc = totalIncome - totalExpenseCalc
                  const mortgageRatio = totalIncome > 0 ? (result.monthlyPayment / totalIncome) * 100 : 0
                  const disposableRatio = totalIncome > 0 ? (disposableCalc / totalIncome) * 100 : 0

                  // 三級警示判斷
                  let alertLevel: 'green' | 'yellow' | 'red' = 'green'
                  if (mortgageRatio > 50 || disposableCalc < 0) alertLevel = 'red'
                  else if (mortgageRatio > 30) alertLevel = 'yellow'

                  return (
                    <div className="space-y-4">
                      {/* 收支摘要 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                          <div className="text-emerald-300/70 text-xs mb-1">總收入</div>
                          <div className="text-emerald-400 font-bold text-lg">{formatNumber(totalIncome)}</div>
                        </div>
                        <div className="bg-rose-500/10 rounded-xl p-3 border border-rose-500/20">
                          <div className="text-rose-300/70 text-xs mb-1">總支出</div>
                          <div className="text-rose-400 font-bold text-lg">{formatNumber(totalExpenseCalc)}</div>
                        </div>
                      </div>

                      {/* 可支配金額 - 大數字顯示 */}
                      <div className={`rounded-xl p-4 text-center ${
                        disposableCalc >= 0 
                          ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/30' 
                          : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-400/30'
                      }`}>
                        <div className="text-gray-300 text-sm mb-1">可支配金額</div>
                        <div className={`font-bold text-3xl ${disposableCalc >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {disposableCalc >= 0 ? '+' : ''}{formatNumber(disposableCalc)}
                        </div>
                        <div className="text-gray-400 text-xs mt-1">元/月</div>
                      </div>

                      {/* 還款能力分析環形圖 */}
                      <div className="bg-violet-950/40 rounded-xl p-4 border border-violet-500/20">
                        <div className="text-violet-300/70 text-sm mb-3 text-center">可支配佔比分析</div>
                        <div className="flex justify-center">
                          <div className="relative">
                            <svg width="140" height="140" className="transform -rotate-90">
                              {/* 背景圓 */}
                              <circle
                                cx="70" cy="70" r="55"
                                fill="none"
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth="20"
                              />
                              {/* 支出佔比（紅色） */}
                              <circle
                                cx="70" cy="70" r="55"
                                fill="none"
                                stroke="#f43f5e"
                                strokeWidth="20"
                                strokeDasharray={`${Math.min(100 - disposableRatio, 100) * 3.45} 345`}
                                strokeLinecap="round"
                              />
                              {/* 可支配佔比（綠色，如果是正的） */}
                              {disposableCalc > 0 && (
                                <circle
                                  cx="70" cy="70" r="55"
                                  fill="none"
                                  stroke="#10b981"
                                  strokeWidth="20"
                                  strokeDasharray={`${Math.min(disposableRatio, 100) * 3.45} 345`}
                                  strokeDashoffset={`-${Math.min(100 - disposableRatio, 100) * 3.45}`}
                                  strokeLinecap="round"
                                />
                              )}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <div className={`text-2xl font-bold ${disposableCalc >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {disposableRatio.toFixed(0)}%
                              </div>
                              <div className="text-xs text-gray-400">可支配</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-center gap-4 mt-3 text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                            <span className="text-gray-400">支出</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                            <span className="text-gray-400">可支配</span>
                          </div>
                        </div>
                      </div>

                      {/* 還款佔收入比 */}
                      <div className="bg-violet-950/40 rounded-xl p-4 border border-violet-500/20">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-violet-300/70 text-sm">主房貸佔收入比</span>
                          <span className={`font-bold ${
                            mortgageRatio > 50 ? 'text-red-400' : mortgageRatio > 30 ? 'text-yellow-400' : 'text-emerald-400'
                          }`}>
                            {mortgageRatio.toFixed(1)}%
                          </span>
                        </div>
                        {/* 進度條 */}
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              mortgageRatio > 50 ? 'bg-red-500' : mortgageRatio > 30 ? 'bg-yellow-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(mortgageRatio, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>0%</span>
                          <span className="text-yellow-500/70">30%</span>
                          <span className="text-red-500/70">50%</span>
                          <span>100%</span>
                        </div>
                      </div>

                      {/* 三級警示 */}
                      <div className={`rounded-xl p-4 text-center ${
                        alertLevel === 'green' 
                          ? 'bg-emerald-500/20 border border-emerald-400/30' 
                          : alertLevel === 'yellow'
                          ? 'bg-yellow-500/20 border border-yellow-400/30'
                          : 'bg-red-500/20 border border-red-400/30'
                      }`}>
                        {alertLevel === 'green' && (
                          <>
                            <div className="text-emerald-400 font-bold text-lg">✅ 財務健康</div>
                            <div className="text-emerald-300/70 text-sm mt-1">還款負擔在合理範圍內</div>
                          </>
                        )}
                        {alertLevel === 'yellow' && (
                          <>
                            <div className="text-yellow-400 font-bold text-lg">⚠️ 黃色警示</div>
                            <div className="text-yellow-300/70 text-sm mt-1">還款佔比偏高，需謹慎評估</div>
                          </>
                        )}
                        {alertLevel === 'red' && (
                          <>
                            <div className="text-red-400 font-bold text-lg">🚨 紅色警示</div>
                            <div className="text-red-300/70 text-sm mt-1">
                              {disposableCalc < 0 ? '收入不足以支應支出' : '還款負擔過重，建議調整'}
                            </div>
                          </>
                        )}
                      </div>

                      {/* 詳細數據 */}
                      <div className="bg-violet-950/30 rounded-xl p-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">月薪</span>
                          <span className="text-emerald-400">{formatNumber(monthlySalary)}</span>
                        </div>
                        {secondSalary > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">第二人月薪</span>
                            <span className="text-emerald-400">+{formatNumber(secondSalary)}</span>
                          </div>
                        )}
                        {netRentalIncome !== 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">淨租金收入</span>
                            <span className={netRentalIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {netRentalIncome >= 0 ? '+' : ''}{formatNumber(netRentalIncome)}
                            </span>
                          </div>
                        )}
                        <div className="border-t border-violet-500/20 pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">主房貸還款</span>
                            <span className="text-rose-400">-{formatNumber(result.monthlyPayment)}</span>
                          </div>
                          {rentalMonthlyPayment > 0 && (
                            <div className="flex justify-between mt-1">
                              <span className="text-gray-400">出租房還款</span>
                              <span className="text-rose-400">-{formatNumber(rentalMonthlyPayment)}</span>
                            </div>
                          )}
                          {newHouseManagementFee > 0 && (
                            <div className="flex justify-between mt-1">
                              <span className="text-gray-400">管理費</span>
                              <span className="text-rose-400">-{formatNumber(newHouseManagementFee)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="text-center mt-10 text-gray-500 text-sm">
          <p>僅供參考，實際利率以銀行核定為準</p>
        </div>
      </div>
    </div>
  )
}
