import React, { useState } from 'react';
import { CreditTransaction } from '../types/iptv';
import { StorageService } from '../services/storage';
import { 
  Coins, 
  ArrowDownLeft, 
  ArrowUpRight, 
  PlusCircle, 
  ShieldCheck, 
  Check, 
  History, 
  Lock,
  Download
} from 'lucide-react';

interface CreditLedgerProps {
  transactions: CreditTransaction[];
  balanceCenti: number;
  providerCreditStr?: string;
  onBalanceUpdated: () => void;
}

export const CreditLedger: React.FC<CreditLedgerProps> = ({
  transactions,
  balanceCenti,
  providerCreditStr = '1088.73',
  onBalanceUpdated
}) => {
  const [showAddCreditModal, setShowAddCreditModal] = useState(false);
  const [amountToAdd, setAmountToAdd] = useState('100');
  const [refNote, setRefNote] = useState('Manual credit top-up via reseller portal');

  const currentBalance = (balanceCenti / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const providerBalanceFloat = parseFloat(providerCreditStr);
  const localBalanceFloat = balanceCenti / 100;
  const isDrifted = Math.abs(providerBalanceFloat - localBalanceFloat) > 0.05;

  const handleAddCredit = (e: React.FormEvent) => {
    e.preventDefault();
    const credits = parseFloat(amountToAdd);
    if (isNaN(credits) || credits <= 0) return;

    const deltaCenti = Math.round(credits * 100);
    const newBalCenti = balanceCenti + deltaCenti;

    StorageService.addTransaction({
      type: 'CREDIT_PURCHASE',
      amountCenti: deltaCenti,
      previousBalanceCenti: balanceCenti,
      newBalanceCenti: newBalCenti,
      reference: refNote.trim() || 'Manual top-up',
      idempotencyKey: `topup_${Date.now()}`
    });

    onBalanceUpdated();
    setShowAddCreditModal(false);
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Date', 'Type', 'Amount (Credits)', 'Prev Balance', 'New Balance', 'Reference', 'Idempotency Key'];
    const rows = transactions.map(t => [
      t.id,
      t.createdAt,
      t.type,
      (t.amountCenti / 100).toFixed(2),
      (t.previousBalanceCenti / 100).toFixed(2),
      (t.newBalanceCenti / 100).toFixed(2),
      `"${t.reference.replace(/"/g, '""')}"`,
      t.idempotencyKey || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `star-panel-credit-ledger-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Balance */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Local Reseller Balance</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            {currentBalance} <span className="text-xs font-normal text-slate-400">Credits</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-1">
            {balanceCenti} centi-credits (integer precision)
          </div>
        </div>

        {/* Card 2: Upstream Sync */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Upstream Provider Balance</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            {providerCreditStr} <span className="text-xs font-normal text-slate-400">Credits</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${isDrifted ? 'bg-amber-400' : 'bg-emerald-400'}`}
            />
            <span>{isDrifted ? 'Drift detected with provider' : 'Synchronized with upstream API'}</span>
          </div>
        </div>

        {/* Card 3: Top-up Action */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-400 mb-1">Ledger Integrity</div>
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Immutable Append-Only Ledger</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => setShowAddCreditModal(true)}
              className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Credits</span>
            </button>
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition-colors"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Credit Audit Journal</h3>
            <p className="text-xs text-slate-400">
              Complete history of line purchases, renewals, refunds, and balance adjustments
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {transactions.length} record(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4">Timestamp (UTC)</th>
                <th className="py-2.5 px-4">Event Type</th>
                <th className="py-2.5 px-4 text-right">Charge / Credit</th>
                <th className="py-2.5 px-4 text-right">Balance After</th>
                <th className="py-2.5 px-4">Reference &amp; Details</th>
                <th className="py-2.5 px-4 font-mono text-[10px]">Idempotency Key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {transactions.map((tx) => {
                const isPositive = tx.amountCenti > 0;
                const creditFloat = (tx.amountCenti / 100).toFixed(2);
                const newBalFloat = (tx.newBalanceCenti / 100).toFixed(2);

                return (
                  <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono text-slate-400 tabular-nums">
                      {tx.createdAt.replace('T', ' ').substring(0, 19)}
                    </td>

                    {/* Type */}
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] text-slate-300">
                        {tx.type}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                        {isPositive ? `+${creditFloat}` : creditFloat}
                      </span>
                    </td>

                    {/* New Balance */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                      {newBalFloat}
                    </td>

                    {/* Reference */}
                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                      {tx.reference}
                    </td>

                    {/* Idempotency Key */}
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                      {tx.idempotencyKey || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top-up Modal */}
      {showAddCreditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-semibold text-white">Credit Top-Up / Adjustment</h3>
            <p className="text-xs text-slate-400">
              Add reseller credits to this panel. Each credit allows 1 month standard single-screen subscription.
            </p>

            <form onSubmit={handleAddCredit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Credits to Add</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={amountToAdd}
                  onChange={(e) => setAmountToAdd(e.target.value)}
                  className="w-full font-mono bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Reference Description</label>
                <input
                  type="text"
                  required
                  value={refNote}
                  onChange={(e) => setRefNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCreditModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-md"
                >
                  Confirm Credit Top-Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
