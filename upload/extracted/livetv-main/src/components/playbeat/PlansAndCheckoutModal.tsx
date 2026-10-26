import React, { useState } from 'react';
import { SubscriptionPlan, PLANS } from '../../services/catalogData';
import { 
  X, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Copy, 
  Download, 
  CreditCard, 
  CheckCircle2, 
  Layers, 
  Clock, 
  Tv, 
  Smartphone,
  Tag
} from 'lucide-react';

interface PlansAndCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscriptionActivated: (plan: SubscriptionPlan, credentials: any) => void;
}

export const PlansAndCheckoutModal: React.FC<PlansAndCheckoutModalProps> = ({
  isOpen,
  onClose,
  onSubscriptionActivated
}) => {
  const [step, setStep] = useState<'CHOOSE_PLAN' | 'CHECKOUT' | 'SUCCESS'>('CHOOSE_PLAN');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(PLANS[1] || PLANS[0]);
  const [duration, setDuration] = useState<'1' | '3' | '6' | '12'>('1');
  const [connections, setConnections] = useState<number>(2);

  // Customer checkout inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'JazzCash' | 'EasyPaisa' | 'Bank Transfer' | 'Stripe' | 'PayFast'>('JazzCash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Activated credentials
  const [activatedCredentials, setActivatedCredentials] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  // Price calculations
  const basePrice =
    duration === '1'
      ? selectedPlan.monthlyPrice
      : duration === '3'
      ? selectedPlan.threeMonthPrice
      : duration === '6'
      ? selectedPlan.sixMonthPrice
      : selectedPlan.annualPrice;

  const connectionMultiplier = connections > 1 ? 1 + (connections - 1) * 0.45 : 1;
  const subtotal = basePrice * connectionMultiplier;
  const discountAmount = (subtotal * discountPercent) / 100;
  const finalPrice = Math.max(0, subtotal - discountAmount);

  const handleApplyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (code === 'PLAYBEAT20' || code === 'VIP20') {
      setDiscountPercent(20);
    } else if (code === 'VIP50') {
      setDiscountPercent(50);
    } else {
      alert('Invalid promo code. Try PLAYBEAT20');
    }
  };

  const handleExecutePayment = () => {
    setCheckoutError('Checkout is unavailable: payment verification and subscription provisioning are not configured. No payment was taken.');
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-[#0c1326] border border-white/15 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#050811]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs">
              PB
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-display">
                {step === 'CHOOSE_PLAN' && 'Select PlayBeat Subscription Plan'}
                {step === 'CHECKOUT' && 'Complete Subscription Activation'}
                {step === 'SUCCESS' && 'Subscription Activated Successfully!'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Instant delivery · 4K UHD Streams · Multi-Device Compatibility
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: CHOOSE PLAN */}
          {step === 'CHOOSE_PLAN' && (
            <div className="space-y-6">
              <div className="text-center max-w-lg mx-auto space-y-1">
                <h3 className="text-xl font-bold text-white font-display">
                  Entertainment Tailored for Every Screen
                </h3>
                <p className="text-xs text-slate-400">
                  Plan details, checkout, and live-channel availability are unavailable until provider and payment services are configured.
                </p>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {PLANS.map((plan) => {
                  const isSelected = selectedPlan.id === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`relative p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-gradient-to-b from-cyan-950/40 to-[#0c1326] border-cyan-400 shadow-xl shadow-cyan-500/10'
                          : 'bg-[#050811]/60 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {plan.badge && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-600 px-2.5 py-0.5 rounded-full text-[9px] font-black text-slate-950 tracking-wider uppercase">
                          {plan.badge}
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="text-sm font-bold text-white font-display">
                          {plan.name}
                        </div>
                        <div className="text-2xl font-black text-slate-400 font-display">
                          Unavailable
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Checkout and provider availability are not configured.
                        </p>

                        <ul className="space-y-2 text-xs text-slate-300 pt-2 border-t border-white/10">
                          <li className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>Channel catalog unavailable</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>Playback quality depends on the provider stream</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>Provider access is not configured</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>Program guide is not configured</span>
                          </li>
                        </ul>
                      </div>

                      <div className="pt-4">
                        <button
                          type="button"
                          className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-cyan-500 text-slate-950'
                              : 'bg-white/10 text-white hover:bg-white/20'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Choose Plan'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Next Button */}
              <div className="flex justify-end pt-4 border-t border-white/10">
                <div className="space-y-3 text-right">
                  <p className="text-xs text-amber-300">
                    Purchases are unavailable until real payment verification and provider provisioning are configured.
                  </p>
                  <button
                    type="button"
                    disabled
                    className="px-8 py-3 bg-white/10 text-slate-400 font-black rounded-xl text-xs tracking-wide uppercase cursor-not-allowed"
                  >
                    Checkout unavailable
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CHECKOUT */}
          {step === 'CHECKOUT' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-xs">
              {/* Left Column (7 cols): Order Config & Account Info */}
              <div className="md:col-span-7 space-y-4">
                <div className="p-4 bg-[#050811]/60 border border-white/10 rounded-2xl space-y-3">
                  <div className="font-bold text-white text-sm">
                    1. Account &amp; Delivery Details
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Subscriber Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Mercer"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#0c1326] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Email (For IPTV Credentials)</label>
                    <input
                      type="email"
                      required
                      placeholder="alex.mercer@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#0c1326] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Duration & Connections */}
                <div className="p-4 bg-[#050811]/60 border border-white/10 rounded-2xl space-y-3">
                  <div className="font-bold text-white text-sm">
                    2. Duration &amp; Multi-Screen Setup
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: '1', label: '1 Month' },
                      { id: '3', label: '3 Months (Save 15%)' },
                      { id: '6', label: '6 Months (Save 25%)' },
                      { id: '12', label: '1 Year (Best Value)' }
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDuration(d.id as any)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          duration === d.id
                            ? 'bg-cyan-500/20 border-cyan-400 text-white font-bold'
                            : 'bg-[#0c1326] border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="font-bold">{d.label.split(' ')[0]} {d.label.split(' ')[1]}</div>
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Simultaneous Screens (Connections)</label>
                    <select
                      value={connections}
                      onChange={(e) => setConnections(Number(e.target.value))}
                      className="w-full bg-[#0c1326] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value={1}>1 Screen (Single TV or Mobile)</option>
                      <option value={2}>2 Screens Simultaneous</option>
                      <option value={3}>3 Screens Simultaneous</option>
                      <option value={4}>4 Screens Simultaneous (Full Household)</option>
                    </select>
                  </div>
                </div>

                {/* Payment Gateway */}
                <div className="p-4 bg-[#050811]/60 border border-white/10 rounded-2xl space-y-3">
                  <div className="font-bold text-white text-sm">
                    3. Payment Method
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['JazzCash', 'EasyPaisa', 'Bank Transfer', 'Stripe', 'PayFast'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m as any)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          paymentMethod === m
                            ? 'bg-blue-600/20 border-blue-400 text-white font-bold'
                            : 'bg-[#0c1326] border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column (5 cols): Order Summary */}
              <div className="md:col-span-5 space-y-4">
                <div className="p-5 bg-[#050811]/80 border border-white/10 rounded-2xl space-y-4 sticky top-4">
                  <div className="text-sm font-bold text-white">Order Summary</div>

                  <div className="space-y-2 pt-2 border-t border-white/10 text-slate-300">
                    <div className="flex justify-between">
                      <span>Plan:</span>
                      <strong className="text-white">{selectedPlan.name}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span>{duration} Month(s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Screens:</span>
                      <span>{connections} Device(s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Base Subtotal:</span>
                      <span className="font-mono">${subtotal.toFixed(2)}</span>
                    </div>

                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-400 font-semibold">
                        <span>Promo Discount ({discountPercent}%):</span>
                        <span className="font-mono">-${discountAmount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-white/10">
                      <span>Total Amount:</span>
                      <span className="font-mono text-cyan-400">${finalPrice.toFixed(2)} USD</span>
                    </div>
                  </div>

                  {/* Promo Code Input */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] text-slate-400">Have a promo code? (Try PLAYBEAT20)</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="PLAYBEAT20"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className="w-full bg-[#0c1326] border border-white/10 rounded-xl px-2.5 py-1.5 text-white uppercase font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold shrink-0"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  {/* Submit Payment button */}
                  {checkoutError && (
                    <div role="alert" className="text-xs text-rose-300">
                      {checkoutError}
                    </div>
                  )}
                  <button
                    onClick={handleExecutePayment}
                    disabled
                    className="w-full py-3 bg-white/10 text-slate-400 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                        <span>Activating Subscription...</span>
                      </>
                    ) : (
                      <span>Checkout unavailable</span>
                    )}
                  </button>

                  <button
                    onClick={() => setStep('CHOOSE_PLAN')}
                    className="w-full text-center text-[11px] text-slate-400 hover:text-white"
                  >
                    &larr; Back to change plan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS & CREDENTIALS ISSUED */}
          {step === 'SUCCESS' && activatedCredentials && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-300">
                    Subscription Activated Successfully!
                  </h3>
                  <p className="text-xs text-slate-300">
                    Your credentials have been securely provisioned. Use the login details below on any supported device.
                  </p>
                </div>
              </div>

              {/* Credentials Card */}
              <div className="p-5 bg-[#050811] border border-white/15 rounded-2xl space-y-4 text-xs">
                <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-white/10 font-mono text-[11px]">
                  <span>Order Ref: {activatedCredentials.subscriptionId}</span>
                  <span className="text-emerald-400">STATUS: ACTIVE</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-[#0c1326] border border-white/10 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[11px] block">Server Portal URL</span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-white text-xs truncate mr-2">
                        {activatedCredentials.serverUrl}
                      </span>
                      <button
                        onClick={() => handleCopy(activatedCredentials.serverUrl, 'srv')}
                        className="text-slate-400 hover:text-white"
                      >
                        {copiedKey === 'srv' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-[#0c1326] border border-white/10 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[11px] block">Username</span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-cyan-300 text-xs truncate mr-2">
                        {activatedCredentials.username}
                      </span>
                      <button
                        onClick={() => handleCopy(activatedCredentials.username, 'usr')}
                        className="text-slate-400 hover:text-white"
                      >
                        {copiedKey === 'usr' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-[#0c1326] border border-white/10 rounded-xl space-y-1 sm:col-span-2">
                    <span className="text-slate-400 text-[11px] block">Password</span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-white text-xs">
                        {activatedCredentials.password}
                      </span>
                      <button
                        onClick={() => handleCopy(activatedCredentials.password, 'pwd')}
                        className="text-slate-400 hover:text-white"
                      >
                        {copiedKey === 'pwd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-[#0c1326] border border-white/10 rounded-xl space-y-1 sm:col-span-2">
                    <span className="text-slate-400 text-[11px] block">M3U Plus Playlist Link</span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-300 text-[11px] truncate mr-2">
                        {activatedCredentials.playlistUrl}
                      </span>
                      <button
                        onClick={() => handleCopy(activatedCredentials.playlistUrl, 'm3u')}
                        className="text-slate-400 hover:text-white"
                      >
                        {copiedKey === 'm3u' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px] text-slate-400">
                  <span>Expires: {activatedCredentials.expiryDate}</span>
                  <span>Connections: {activatedCredentials.connections} Screen(s)</span>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs uppercase"
                >
                  Done &amp; Start Streaming
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
