import {
  LEDGER_QUICK_AMOUNTS,
  formatLedgerAmountInput,
  parseLedgerAmountInput,
  toLedgerAmountNumber,
} from '../../constants/ledger.js'

/**
 * 금액 입력 (쉼표 표시 + 만원 단위 빠른 추가)
 * @param {{
 *   label?: string,
 *   value: string|number,
 *   onChange: (digitString: string) => void,
 *   placeholder?: string,
 *   required?: boolean,
 *   autoFocus?: boolean,
 *   inputClassName?: string,
 *   showQuickAdd?: boolean
 * }} props
 */
export default function LedgerAmountInput({
  label,
  value,
  onChange,
  placeholder = '0',
  required = false,
  autoFocus = false,
  inputClassName = 'w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-green-500',
  showQuickAdd = true,
}) {
  const displayValue = formatLedgerAmountInput(value)

  const handleChange = (event) => {
    onChange(parseLedgerAmountInput(event.target.value))
  }

  const handleQuickAdd = (amount) => {
    const next = toLedgerAmountNumber(value) + amount
    onChange(String(next))
  }

  return (
    <div>
      {label && (
        <label className="block text-sm text-gray-500 mb-1">
          {label}
          {required ? ' *' : ''}
        </label>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={inputClassName}
      />
      {showQuickAdd && (
        <div className="flex flex-wrap gap-2 mt-2">
          {LEDGER_QUICK_AMOUNTS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleQuickAdd(item.value)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
            >
              +{item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
