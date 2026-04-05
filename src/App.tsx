import { useState } from 'react'

type RepaymentType = 'equal-principal' | 'equal-payment'
type LoanType = 'no-grace' | 'interest-only' | 'partial-grace'

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
    // 本息平均攤還
    monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / 
                     (Math.pow(1 + monthlyRate, totalMonths) - 1)
  } else {
    // 本金平均攤還 - 第一期最高
    const monthlyPrincipal = loanAmount / totalMonths
    const firstInterest = loanAmount * monthlyRate
    monthlyPayment = monthlyPrincipal + firstInterest
  }

  let balance = loanAmount
  totalInterest = 0

  // 寬限期計算
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

  // 本金利息攤還
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

  const loanAmount = housePrice * 10000 * (loanPercent / 100)
  const result = calculateMortgage(loanAmount, annualRate, years, repaymentType, loanType, graceYears)

  const monthlyRate = annualRate / 100 / 12
  const firstMonthInterest = loanAmount * monthlyRate
  const firstMonthPrincipal = repaymentType === 'equal-payment' 
    ? result.monthlyPayment - firstMonthInterest 
    : loanAmount / (years * 12)

  return (
    <div className="min-h-screen text-white py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-2">🏦 房屋貸款試算</h1>
          <p className="text-gray-400">專業房貸分析工具</p>
        </div>

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

        {/* Footer */}
        <div className="text-center mt-10 text-gray-500 text-sm">
          <p>僅供參考，實際利率以銀行核定為準</p>
        </div>
      </div>
    </div>
  )
}