import { useState } from 'react'

type RepaymentType = 'equal-principal' | 'equal-payment'
type LoanType = 'no-grace' | 'interest-only' | 'partial-grace'
type TimelineView = 'principal-interest' | 'balance' | 'salary-ratio'

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

// Timeline Chart Component
function TimelineChart({ 
  schedule, 
  monthlyPayment, 
  view, 
  monthlySalary,
  monthlyRent,
  totalMonths,
  graceMonths,
  loanType 
}: { 
  schedule: CalculationResult['schedule']
  monthlyPayment: number
  view: TimelineView
  monthlySalary: number
  monthlyRent: number
  totalMonths: number
  graceMonths: number
  loanType: LoanType
}) {
  const hasGrace = graceMonths > 0 && (loanType === 'interest-only' || loanType === 'partial-grace')
  const displaySchedule = hasGrace && schedule.length < totalMonths
    ? schedule
    : schedule

  const maxItems = Math.min(displaySchedule.length, totalMonths)
  const step = maxItems > 120 ? Math.ceil(maxItems / 120) : 1
  const sampled = displaySchedule.filter((_, i) => i % step === 0 || i === displaySchedule.length - 1)

  if (view === 'salary-ratio') {
    const totalIncome = monthlySalary + monthlyRent
    if (!totalIncome) return null

    return (
      <div className="w-full">
        <svg viewBox="0 0 800 300" className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line
                x1="60" y1={260 - tick * 200}
                x2="780" y2={260 - tick * 200}
                stroke="rgba(255,255,255,0.1)" strokeWidth="1"
              />
              <text x="55" y={264 - tick * 200} fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="end">
                {(tick * 100).toFixed(0)}%
              </text>
            </g>
          ))}

          {/* Danger zone (>50%) */}
          <rect x="60" y="60" width="720" height="40" fill="rgba(239,68,68,0.1)" />
          <text x="770" y="82" fill="rgba(239,68,68,0.7)" fontSize="10" textAnchor="end">⚠️ 過高</text>

          {/* Salary ratio line */}
          <polyline
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2"
            points={sampled.map((_, i) => {
              const ratio = monthlyPayment / totalIncome
              const clampedRatio = Math.min(ratio, 1)
              return `${60 + (i / (sampled.length - 1)) * 720},${260 - clampedRatio * 200}`
            }).join(' ')}
          />

          {/* 50% threshold line */}
          <line x1="60" y1={160} x2="780" y2={160} stroke="rgba(239,68,68,0.5)" strokeWidth="1" strokeDasharray="4" />
          <text x="65" y={155} fill="rgba(239,68,68,0.7)" fontSize="9">50% 警戒線</text>

          {/* X axis */}
          <line x1="60" y1="260" x2="780" y2="260" stroke="rgba(255,255,255,0.3)" />
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <text x={60 + t * 720} y="278" fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="middle">
                {Math.round(t * totalMonths)}月
              </text>
            </g>
          ))}

          {/* Y axis */}
          <line x1="60" y1="60" x2="60" y2="260" stroke="rgba(255,255,255,0.3)" />
        </svg>
        <div className="flex items-center justify-center gap-6 mt-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-yellow-400"></div>
            <span className="text-gray-300">還款/收入比例</span>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'balance') {
    const maxBalance = displaySchedule[0]?.balance || 1

    return (
      <div className="w-full">
        <svg viewBox="0 0 800 300" className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line
                x1="60" y1={260 - tick * 200}
                x2="780" y2={260 - tick * 200}
                stroke="rgba(255,255,255,0.1)" strokeWidth="1"
              />
              <text x="55" y={264 - tick * 200} fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="end">
                {formatNumber(maxBalance * (1 - tick))}
              </text>
            </g>
          ))}

          {/* Balance area */}
          <polygon
            fill="rgba(34,211,238,0.15)"
            stroke="none"
            points={`60,260 ${sampled.map((d, i) => `${60 + (i / (sampled.length - 1)) * 720},${260 - (d.balance / maxBalance) * 200}`).join(' ')} 780,260`}
          />

          {/* Balance line */}
          <polyline
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2"
            points={sampled.map((d, i) => 
              `${60 + (i / (sampled.length - 1)) * 720},${260 - (d.balance / maxBalance) * 200}`
            ).join(' ')}
          />

          {/* X axis */}
          <line x1="60" y1="260" x2="780" y2="260" stroke="rgba(255,255,255,0.3)" />
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <text key={t} x={60 + t * 720} y="278" fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="middle">
              {Math.round(t * totalMonths)}月
            </text>
          ))}

          {/* Y axis */}
          <line x1="60" y1="60" x2="60" y2="260" stroke="rgba(255,255,255,0.3)" />
          <text x="20" y="160" fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="middle" transform={`rotate(-90, 20, 160)`}>元</text>
        </svg>
        <div className="flex items-center justify-center gap-6 mt-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-cyan-400"></div>
            <span className="text-gray-300">剩餘本金</span>
          </div>
        </div>
      </div>
    )
  }

  // principal-interest view (default)
  const maxPayment = Math.max(monthlyPayment, displaySchedule[0]?.principal + displaySchedule[0]?.interest || 1)

  return (
    <div className="w-full">
      <svg viewBox="0 0 800 300" className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line
              x1="60" y1={260 - tick * 200}
              x2="780" y2={260 - tick * 200}
              stroke="rgba(255,255,255,0.1)" strokeWidth="1"
            />
            <text x="55" y={264 - tick * 200} fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="end">
              {formatNumber(maxPayment * (1 - tick))}
            </text>
          </g>
        ))}

        {/* Interest area */}
        <polygon
          fill="rgba(251,146,60,0.15)"
          stroke="none"
          points={`60,260 ${sampled.map((d, i) => `${60 + (i / (sampled.length - 1)) * 720},${260 - (d.interest / maxPayment) * 200}`).join(' ')} 780,260`}
        />

        {/* Principal area */}
        <polygon
          fill="rgba(34,197,94,0.15)"
          stroke="none"
          points={`60,260 ${sampled.map((d, i) => `${60 + (i / (sampled.length - 1)) * 720},${260 - ((d.principal + d.interest) / maxPayment) * 200}`).join(' ')} ${sampled.map((d, i) => `${60 + (i / (sampled.length - 1)) * 720},${260 - (d.interest / maxPayment) * 200}`).reverse().join(' ')}`}
        />

        {/* Interest line */}
        <polyline
          fill="none"
          stroke="#fb923c"
          strokeWidth="2"
          points={sampled.map((d, i) => 
            `${60 + (i / (sampled.length - 1)) * 720},${260 - (d.interest / maxPayment) * 200}`
          ).join(' ')}
        />

        {/* Principal + Interest line */}
        <polyline
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
          points={sampled.map((d, i) => 
            `${60 + (i / (sampled.length - 1)) * 720},${260 - ((d.principal + d.interest) / maxPayment) * 200}`
          ).join(' ')}
        />

        {/* X axis */}
        <line x1="60" y1="260" x2="780" y2="260" stroke="rgba(255,255,255,0.3)" />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <text key={t} x={60 + t * 720} y="278" fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="middle">
            {Math.round(t * totalMonths)}月
          </text>
        ))}

        {/* Y axis */}
        <line x1="60" y1="60" x2="60" y2="260" stroke="rgba(255,255,255,0.3)" />
        <text x="20" y="160" fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="middle" transform={`rotate(-90, 20, 160)`}>元</text>
      </svg>
      <div className="flex items-center justify-center gap-6 mt-2 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-green-500"></div>
          <span className="text-gray-300">本金 + 利息</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-orange-400"></div>
          <span className="text-gray-300">利息</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-green-400 opacity-40"></div>
          <span className="text-gray-300">本金</span>
        </div>
      </div>
    </div>
  )
}

// Progress Ring Component
function ProgressRing({ progress, size = 120, strokeWidth = 12 }: { progress: number, size?: number, strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - progress * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke="#22d3ee"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  )
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
  const [monthlyRent, setMonthlyRent] = useState(0)
  const [timelineView, setTimelineView] = useState<TimelineView>('principal-interest')
  const [rentalProperty, setRentalProperty] = useState<RentalPropertyInfo>({
    rentIncome: 0,
    annualRate: 2.5,
    remainingPrincipal: 0,
    remainingYears: 20
  })

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
  const totalIncome = monthlySalary + (netRentalIncome > 0 ? netRentalIncome : 0)
  const disposableIncome = totalIncome - result.monthlyPayment
  const salaryRatio = totalIncome > 0 ? (result.monthlyPayment / totalIncome) * 100 : 0
  const paidAmount = loanAmount - (result.schedule[result.schedule.length - 1]?.balance || 0)
  const repaymentProgress = loanAmount > 0 ? paidAmount / loanAmount : 0
  const totalMonths = years * 12
  const graceMonths = graceYears * 12

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
              📈 薪水與還款時間軸
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
          /* Timeline Tab */
          <>
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left: Salary Input & Key Stats */}
              <div className="space-y-6">
                {/* 月薪與租金輸入 */}
                <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
                  <h2 className="text-xl font-semibold mb-4 text-yellow-300">💰 月薪與租金收入</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">月薪</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={monthlySalary}
                          onChange={(e) => setMonthlySalary(Number(e.target.value))}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-yellow-400"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">元/月</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {[100000, 150000, 200000, 300000].map((s) => (
                          <button
                            key={s}
                            onClick={() => setMonthlySalary(s)}
                            className={`flex-1 py-1.5 rounded text-sm transition-all ${
                              monthlySalary === s
                                ? 'bg-yellow-500 text-white'
                                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                            }`}
                          >
                            {s >= 100000 ? `${s / 10000}萬` : s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">租金收入</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={monthlyRent}
                          onChange={(e) => setMonthlyRent(Number(e.target.value))}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-green-400"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">元/月</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {[0, 20000, 30000, 50000].map((r) => (
                          <button
                            key={r}
                            onClick={() => setMonthlyRent(r)}
                            className={`flex-1 py-1.5 rounded text-sm transition-all ${
                              monthlyRent === r
                                ? 'bg-green-500 text-white'
                                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                            }`}
                          >
                            {r === 0 ? '無' : `${r / 10000}萬`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 出租房屋房貸資訊 */}
                    <div className="mt-6 pt-4 border-t border-white/20">
                      <h3 className="text-lg font-semibold mb-4 text-purple-300">🏠 出租房屋資訊</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">月租金收入</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={rentalProperty.rentIncome}
                              onChange={(e) => setRentalProperty({ ...rentalProperty, rentIncome: Number(e.target.value) })}
                              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-purple-400"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">元/月</span>
                          </div>
                          <div className="flex gap-2 mt-2">
                            {[0, 20000, 30000, 50000].map((r) => (
                              <button
                                key={r}
                                onClick={() => setRentalProperty({ ...rentalProperty, rentIncome: r })}
                                className={`flex-1 py-1.5 rounded text-sm transition-all ${
                                  rentalProperty.rentIncome === r
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                }`}
                              >
                                {r === 0 ? '無' : `${r / 10000}萬`}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">該房貸利率</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.001"
                              value={rentalProperty.annualRate}
                              onChange={(e) => setRentalProperty({ ...rentalProperty, annualRate: Number(e.target.value) })}
                              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-400"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">剩餘本金</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={rentalProperty.remainingPrincipal}
                              onChange={(e) => setRentalProperty({ ...rentalProperty, remainingPrincipal: Number(e.target.value) })}
                              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-400"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">元</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">剩餘年限</label>
                          <div className="flex gap-2">
                            {[10, 15, 20, 25, 30].map((y) => (
                              <button
                                key={y}
                                onClick={() => setRentalProperty({ ...rentalProperty, remainingYears: y })}
                                className={`flex-1 py-1.5 rounded text-sm transition-all ${
                                  rentalProperty.remainingYears === y
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                }`}
                              >
                                {y}年
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 還款能力分析 */}
                <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur rounded-2xl p-6 border border-yellow-400/30">
                  <h2 className="text-xl font-semibold mb-4 text-yellow-300">💼 還款能力分析</h2>
                  
                  <div className="flex items-center justify-center mb-4">
                    <div className="relative flex items-center justify-center">
                      <ProgressRing progress={Math.min(salaryRatio / 100, 1)} size={140} strokeWidth={14} />
                      <div className="absolute text-center">
                        <div className="text-3xl font-bold text-yellow-400">{salaryRatio.toFixed(1)}%</div>
                        <div className="text-xs text-gray-400">還款佔比</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 px-3 bg-white/5 rounded-lg">
                      <span className="text-gray-300">月薪</span>
                      <span className="text-white font-medium">{formatCurrency(monthlySalary)}</span>
                    </div>
                    {rentalProperty.rentIncome > 0 && (
                      <>
                        <div className="flex justify-between items-center py-2 px-3 bg-white/5 rounded-lg">
                          <span className="text-gray-300">租金收入</span>
                          <span className="text-green-400 font-medium">+{formatCurrency(rentalProperty.rentIncome)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 px-3 bg-white/5 rounded-lg">
                          <span className="text-gray-300">出租房貸還款</span>
                          <span className={rentalMonthlyPayment > rentalProperty.rentIncome ? 'text-red-400' : 'text-orange-400'}>
                            -{formatCurrency(rentalMonthlyPayment)}
                          </span>
                        </div>
                        <div className={`flex justify-between items-center py-2 px-3 rounded-lg border ${
                          netRentalIncome < 0 
                            ? 'bg-red-500/20 border-red-500/40' 
                            : 'bg-green-500/10 border-green-500/30'
                        }`}>
                          <span className="text-gray-300">淨租金收入</span>
                          <span className={`font-bold ${netRentalIncome < 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {netRentalIncome >= 0 ? '+' : ''}{formatCurrency(netRentalIncome)}
                          </span>
                        </div>
                      </>
                    )}
                    {rentalProperty.rentIncome > 0 && netRentalIncome > 0 && (
                      <div className="flex justify-between items-center py-2 px-3 bg-white/5 rounded-lg border border-green-500/30">
                        <span className="text-gray-300">總收入</span>
                        <span className="text-green-400 font-bold">{formatCurrency(totalIncome)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-2 px-3 bg-white/5 rounded-lg">
                      <span className="text-gray-300">每月還款</span>
                      <span className="text-yellow-400 font-medium">{formatCurrency(result.monthlyPayment)}</span>
                    </div>
                    <div className={`flex justify-between items-center py-2 px-3 rounded-lg border ${
                      disposableIncome < 0 
                        ? 'bg-red-500/20 border-red-500/40' 
                        : 'bg-white/5 border-green-500/30'
                    }`}>
                      <span className="text-gray-300">每月可支配</span>
                      <span className={`font-bold ${disposableIncome < 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {formatCurrency(disposableIncome)}
                      </span>
                    </div>
                  </div>

                  {/* 還款負擔警示 */}
                  <div className="mt-4 p-3 rounded-xl text-center">
                    {netRentalIncome < 0 && (
                      <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-3 mb-3">
                        <div className="text-red-400 font-bold text-lg">⚠️ 淨租金為負</div>
                        <div className="text-red-300 text-sm mt-1">出租房屋的租金收入不足以支應該房貸還款</div>
                      </div>
                    )}
                    {salaryRatio > 50 ? (
                      <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-3">
                        <div className="text-red-400 font-bold text-lg">⚠️ 還款負擔過重</div>
                        <div className="text-red-300 text-sm mt-1">建議降低貸款金額或延長還款年限</div>
                      </div>
                    ) : salaryRatio > 30 ? (
                      <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-lg p-3">
                        <div className="text-yellow-400 font-bold text-lg">⚡ 黃色警示</div>
                        <div className="text-yellow-300 text-sm mt-1">還款佔比偏高，需謹慎評估</div>
                      </div>
                    ) : (
                      <div className="bg-green-500/20 border border-green-500/40 rounded-lg p-3">
                        <div className="text-green-400 font-bold text-lg">✅ 正常範圍</div>
                        <div className="text-green-300 text-sm mt-1">還款負擔在合理範圍內</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 還款進度 */}
                <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
                  <h2 className="text-xl font-semibold mb-4 text-cyan-300">📊 還款進度</h2>
                  
                  <div className="flex items-center justify-center mb-4">
                    <div className="relative flex items-center justify-center">
                      <ProgressRing progress={repaymentProgress} size={120} strokeWidth={12} />
                      <div className="absolute text-center">
                        <div className="text-2xl font-bold text-cyan-400">{(repaymentProgress * 100).toFixed(1)}%</div>
                        <div className="text-xs text-gray-400">已還</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-xl p-4 text-center">
                      <div className="text-sm text-gray-300">已還本金</div>
                      <div className="text-xl font-bold text-green-400">{formatNumber(paidAmount)}</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4 text-center">
                      <div className="text-sm text-gray-300">剩餘本金</div>
                      <div className="text-xl font-bold text-orange-400">{formatNumber(result.schedule[result.schedule.length - 1]?.balance || loanAmount)}</div>
                    </div>
                  </div>

                  <div className="mt-4 text-center text-gray-400 text-sm">
                    預計 {years} 年 ({totalMonths} 期) 還完
                  </div>
                </div>
              </div>

              {/* Right: Timeline Chart */}
              <div className="space-y-6">
                {/* 圖表切換 */}
                <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-cyan-300">📈 還款時間軸</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTimelineView('principal-interest')}
                        className={`px-3 py-1.5 rounded text-sm transition-all ${
                          timelineView === 'principal-interest'
                            ? 'bg-cyan-500 text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        本金/利息
                      </button>
                      <button
                        onClick={() => setTimelineView('balance')}
                        className={`px-3 py-1.5 rounded text-sm transition-all ${
                          timelineView === 'balance'
                            ? 'bg-cyan-500 text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        餘額
                      </button>
                      <button
                        onClick={() => setTimelineView('salary-ratio')}
                        className={`px-3 py-1.5 rounded text-sm transition-all ${
                          timelineView === 'salary-ratio'
                            ? 'bg-cyan-500 text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        薪水佔比
                      </button>
                    </div>
                  </div>

                  {/* Chart */}
                  <TimelineChart
                    schedule={result.schedule}
                    monthlyPayment={result.monthlyPayment}
                    view={timelineView}
                    monthlySalary={monthlySalary}
                    monthlyRent={monthlyRent}
                    totalMonths={totalMonths}
                    graceMonths={graceMonths}
                    loanType={loanType}
                  />
                </div>

                {/* 關鍵時間點 */}
                <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
                  <h2 className="text-lg font-semibold mb-4 text-purple-300">⏰ 關鍵時間點</h2>
                  
                  <div className="space-y-3">
                    {/* 找到利息=本金的時間點（等額本息） */}
                    {(() => {
                      if (repaymentType === 'equal-payment' && result.schedule) {
                        const midPoint = result.schedule.findIndex(
                          (d) => d.principal >= d.interest
                        )
                        if (midPoint > 0) {
                          const year = Math.ceil((midPoint + 1) / 12)
                          const month = (midPoint + 1) % 12 || 12
                          return (
                            <div className="flex justify-between items-center py-2 px-3 bg-white/5 rounded-lg">
                              <span className="text-gray-300">本金超越利息</span>
                              <span className="text-purple-400 font-medium">
                                約第 {year} 年 {month > 1 ? `${month}月` : ''}
                              </span>
                            </div>
                          )
                        }
                      }
                      return null
                    })()}

                    {/* 還款一半 */}
                    <div className="flex justify-between items-center py-2 px-3 bg-white/5 rounded-lg">
                      <span className="text-gray-300">還款完成 50%</span>
                      <span className="text-cyan-400 font-medium">
                        約第 {Math.ceil(totalMonths * 0.5 / 12)} 年 ({Math.ceil(totalMonths * 0.5)} 期)
                      </span>
                    </div>

                    {/* 還款完成 */}
                    <div className="flex justify-between items-center py-2 px-3 bg-white/5 rounded-lg">
                      <span className="text-gray-300">貸款期滿</span>
                      <span className="text-green-400 font-medium">
                        第 {years} 年 ({totalMonths} 期)
                      </span>
                    </div>

                    {/* 總還款時間 */}
                    <div className="flex justify-between items-center py-2 px-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <span className="text-purple-300">🏠 完整還款時間</span>
                      <span className="text-purple-200 font-bold">
                        {years} 年 ({totalMonths} 期)
                      </span>
                    </div>
                  </div>
                </div>

                {/* 每月詳細數據表 */}
                <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
                  <h2 className="text-lg font-semibold mb-4 text-green-300">📋 每年還款摘要</h2>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="text-gray-400 border-b border-white/20 sticky top-0 bg-gray-900/80">
                        <tr>
                          <th className="py-2 text-left">年度</th>
                          <th className="py-2 text-right">年還本金</th>
                          <th className="py-2 text-right">年付利息</th>
                          <th className="py-2 text-right">年底餘額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: years }, (_, i) => {
                          const yearStart = i * 12
                          const yearEnd = Math.min(yearStart + 12, totalMonths)
                          const yearData = result.schedule.slice(yearStart, yearEnd)
                          const yearPrincipal = yearData.reduce((sum, d) => sum + d.principal, 0)
                          const yearInterest = yearData.reduce((sum, d) => sum + d.interest, 0)
                          const yearBalance = yearData[yearData.length - 1]?.balance || 0

                          return (
                            <tr key={i} className="border-b border-white/10">
                              <td className="py-2 text-gray-300">第 {i + 1} 年</td>
                              <td className="py-2 text-right text-green-400">{formatNumber(yearPrincipal)}</td>
                              <td className="py-2 text-right text-orange-400">{formatNumber(yearInterest)}</td>
                              <td className="py-2 text-right text-white">{formatNumber(yearBalance)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
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
