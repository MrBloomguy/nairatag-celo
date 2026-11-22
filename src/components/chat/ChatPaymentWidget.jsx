import React, { useState } from 'react';
import {
  Zap,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  Check,
  Copy,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export default function ChatPaymentWidget({
  widget,
  onNavigateToTab,
  onExecutePayment,
  onAddSystemMessage,
}) {
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedTx, setCompletedTx] = useState(null);

  if (!widget) return null;

  const copyText = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── 1. PAYMENT INTENT CARD ──
  if (widget.type === 'payment_intent_card') {
    return (
      <div
        className="chat-payment-widget"
        style={{
          marginTop: '10px',
          padding: '14px',
          borderRadius: '16px',
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '380px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <Zap size={14} />
            </div>
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--privy-color-foreground, #111111)' }}>
              {widget.title}
            </span>
          </div>
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '9999px',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#059669',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            {widget.badge}
          </span>
        </div>

        {/* Currency Conversion Grid */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '12px',
            background: 'var(--input-bg, #f8fafc)',
            border: '1px solid var(--border-color, #e5e7eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', color: 'var(--privy-color-foreground-3, #888)', fontWeight: 600 }}>YOU PAY</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--privy-color-foreground, #111)' }}>
              {widget.amountSent} <span style={{ fontSize: '12px', fontWeight: 600 }}>{widget.sourceToken}</span>
            </div>
          </div>
          <ArrowRight size={16} color="#059669" />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: 'var(--privy-color-foreground-3, #888)', fontWeight: 600 }}>RECIPIENT GETS</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}>
              ~ {widget.estimatedDelivery} <span style={{ fontSize: '12px', fontWeight: 600 }}>{widget.targetToken}</span>
            </div>
          </div>
        </div>

        {/* Details Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--privy-color-foreground-2, #6b7280)' }}>
          {widget.effectiveRate && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Textile Rate:</span>
              <span style={{ fontWeight: 600, color: 'var(--privy-color-foreground, #111)' }}>
                1 {widget.sourceToken} ≈ {widget.effectiveRate} {widget.targetToken}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Settlement:</span>
            <span style={{ fontWeight: 600, color: '#059669' }}>Celo Mainnet (&lt; 1,000ms)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Attribution:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '10px' }}>celo_9f7deabd99a6</span>
          </div>
        </div>

        {/* Action Button */}
        {completedTx ? (
          <a
            href={`https://celoscan.io/tx/${completedTx}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '8px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#059669',
              fontWeight: 700,
              fontSize: '12px',
              textAlign: 'center',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Check size={14} /> Settlement Confirmed (View CeloScan ↗)
          </a>
        ) : (
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              if (typeof onNavigateToTab === 'function') {
                onNavigateToTab('swap');
              }
            }}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
            }}
          >
            <Zap size={14} /> {widget.actionText || 'Authorize Payment'}
          </button>
        )}
      </div>
    );
  }

  // ── 2. PAYMENT QUOTE CARD ──
  if (widget.type === 'payment_quote_card') {
    return (
      <div
        className="chat-payment-widget"
        style={{
          marginTop: '10px',
          padding: '14px',
          borderRadius: '16px',
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '380px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={16} color="#10b981" />
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--privy-color-foreground, #111)' }}>
              {widget.title}
            </span>
          </div>
          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
            {widget.badge}
          </span>
        </div>

        <div style={{ padding: '10px', background: 'var(--input-bg, #f8fafc)', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--privy-color-foreground-3)' }}>1 {widget.sourceToken} ≈</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669' }}>
            {Number(widget.effectiveRate).toLocaleString()} {widget.targetToken}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--privy-color-foreground-3)', marginTop: '2px' }}>
            {widget.amountIn} {widget.sourceToken} delivers approx. {widget.amountOut} {widget.targetToken}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (typeof onNavigateToTab === 'function') {
              onNavigateToTab('swap');
            }
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '10px',
            background: 'var(--input-bg, #f1f3f5)',
            border: '1px solid var(--border-color, #e5e7eb)',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
            color: 'var(--privy-color-foreground, #111)',
          }}
        >
          {widget.actionText || 'Open Swap Widget'}
        </button>
      </div>
    );
  }

  // ── 3. PAYMENT REQUEST CARD ──
  if (widget.type === 'payment_request_card') {
    return (
      <div
        className="chat-payment-widget"
        style={{
          marginTop: '10px',
          padding: '14px',
          borderRadius: '16px',
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '380px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="#3b82f6" />
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--privy-color-foreground, #111)' }}>
              {widget.title}
            </span>
          </div>
          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }}>
            {widget.badge}
          </span>
        </div>

        <div style={{ padding: '8px 10px', background: 'var(--input-bg, #f8fafc)', borderRadius: '10px', fontSize: '12px' }}>
          <div style={{ fontWeight: 800, fontSize: '16px', color: '#1e40af' }}>
            {widget.amount} {widget.token}
          </div>
          <div style={{ color: 'var(--privy-color-foreground-2)', marginTop: '2px', fontSize: '11px' }}>
            "{widget.description}"
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--privy-color-foreground-3)' }}>
          <span>Request ID:</span>
          <span style={{ fontFamily: 'monospace' }}>{widget.requestId}</span>
        </div>
      </div>
    );
  }

  // ── 4. PAYMENT RECEIPT CARD ──
  if (widget.type === 'payment_receipt_card' && widget.receipt) {
    const rcpt = widget.receipt;
    return (
      <div
        className="chat-payment-widget"
        style={{
          marginTop: '10px',
          padding: '14px',
          borderRadius: '16px',
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '380px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="#10b981" />
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--privy-color-foreground, #111)' }}>
              {widget.title}
            </span>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
            {widget.badge}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', color: 'var(--privy-color-foreground-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Recipient:</span>
            <span style={{ fontWeight: 600 }}>{rcpt.recipientTag || rcpt.recipientAddress}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Delivered:</span>
            <span style={{ fontWeight: 700, color: '#059669' }}>{rcpt.amountDelivered} {rcpt.tokenDelivered}</span>
          </div>
          {rcpt.payoutTxHash && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Settlement Tx:</span>
              <a
                href={`https://celoscan.io/tx/${rcpt.payoutTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: 'monospace', color: '#10b981', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                {rcpt.payoutTxHash.slice(0, 8)}... <ExternalLink size={11} />
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
