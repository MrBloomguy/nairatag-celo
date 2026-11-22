/**
 * @file ChatVerificationCard.jsx
 * @description Interactive In-Chat Self Agent ID Verification & Rewards Widget.
 * 
 * Allows users chatting with ₦NAIRATAG or their own agents to:
 * 1. View live on-chain Self Agent ID verification status on Celo Mainnet.
 * 2. Launch instant zero-knowledge Self App passport verification right from the chat.
 * 3. Claim +500 Trust Points upon successful verification with celebration feedback.
 * 4. Inspect zero-knowledge nullifiers, registry addresses, and CeloScan transactions.
 */

import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Award, QrCode, ExternalLink, CheckCircle2, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import SelfAgentIdBadge from '../SelfAgentIdBadge.jsx';
import { awardVerificationPoints, getAgentPoints } from '../../services/agentPointsService.js';
import { getAgentVerificationStatus, VERIFICATION_STATUS } from '../../services/selfAgentIdService.js';

export default function ChatVerificationCard({
  widget,
  onLaunchSelfModal,
  onAddSystemMessage,
}) {
  const [isChecking, setIsChecking] = useState(false);
  const [localVerification, setLocalVerification] = useState({
    isVerified: widget.isVerified,
    status: widget.status,
    nullifier: widget.nullifier,
    pointsBalance: widget.pointsBalance || 0,
    bonusClaimed: widget.bonusClaimed || false,
  });
  const [statusMessage, setStatusMessage] = useState('');

  const isVerified = localVerification.isVerified;
  const agentTag = widget.agentTag || 'nairatag';
  const cleanTag = agentTag.replace(/^[₦$@#]/, '').toUpperCase();

  const handleClaimPointsOrCheck = async () => {
    setIsChecking(true);
    setStatusMessage('Checking on-chain Self Agent ID registry...');

    try {
      // 1. Fresh on-chain check
      const result = await getAgentVerificationStatus({
        agentAddress: widget.agentAddress,
        skipCache: true,
      });

      if (result.isVerified && result.hasHumanProof) {
        // Award points
        const awardResult = await awardVerificationPoints(agentTag, {
          nullifier: result.nullifier,
          agentId: result.agentId,
        });

        setLocalVerification({
          isVerified: true,
          status: VERIFICATION_STATUS.VERIFIED,
          nullifier: result.nullifier,
          pointsBalance: awardResult.totalPoints,
          bonusClaimed: true,
        });

        // Confetti celebration
        try {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.7 },
            colors: ['#35D07F', '#FBCC5C', '#10B981'],
          });
        } catch {}

        setStatusMessage(`🎉 Verified! +500 Trust Points credited to ₦${cleanTag}. Total: ${awardResult.totalPoints.toLocaleString()} Pts.`);

        if (onAddSystemMessage) {
          onAddSystemMessage({
            sender: 'agent',
            agentTag: widget.agentTag,
            agentName: widget.agentName,
            avatar: widget.avatar,
            text: `🎉 **Verification Confirmed on Celo Mainnet!**\n\nAgent **₦${cleanTag}** has been confirmed in the Self Agent ID Registry (\`0xaC3DF9ABf80d0F5c020C06B04Cced27763355944\`).\n\n**+500 Trust Points** have been awarded to your agent's sovereign ledger. Total balance: **${awardResult.totalPoints.toLocaleString()} Points** (${awardResult.badge}).`,
          });
        }
      } else {
        setStatusMessage(`⚠️ No active human proof found in Self registry for ₦${cleanTag}. Please complete verification using the Self App.`);
      }
    } catch (err) {
      setStatusMessage(`Check failed: ${err.message}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleStartVerification = () => {
    if (onLaunchSelfModal) {
      onLaunchSelfModal(agentTag);
    }
  };

  return (
    <div className="w-full mt-3 p-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-[#0b1219]/90 to-[#060a0e]/95 backdrop-blur-md shadow-xl text-white">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center space-x-2.5">
          <div className="relative">
            <img
              src={widget.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${agentTag}`}
              alt={agentTag}
              className="w-8 h-8 rounded-full border border-emerald-400/30 object-cover"
            />
            {isVerified ? (
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0b1219] flex items-center justify-center">
                <CheckCircle2 className="w-2.5 h-2.5 text-black" />
              </span>
            ) : (
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-[#0b1219]" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-sm text-white tracking-wide">₦{cleanTag}</span>
              <span className="text-[10px] text-gray-400 font-mono">Self Agent ID</span>
            </div>
            <p className="text-[11px] text-gray-400">Celo Mainnet (42220)</p>
          </div>
        </div>

        {/* Verification Status Badge */}
        <SelfAgentIdBadge isVerified={isVerified} size="sm" />
      </div>

      {/* Body: Proof Details & Points Incentive */}
      <div className="py-3 space-y-2">
        {isVerified ? (
          <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-emerald-300 font-medium">
              <span className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                <span>Verified Proof of Human</span>
              </span>
              <span className="font-mono text-[10px] text-emerald-400/80">ZK NFC Passport</span>
            </div>
            <p className="text-[11px] text-gray-300">
              Agent key is bound to a verified human nullifier in <code className="text-emerald-400 font-mono">0xaC3D...5944</code>.
            </p>
            {localVerification.nullifier && (
              <div className="text-[10px] text-gray-400 font-mono truncate">
                Nullifier: {localVerification.nullifier.slice(0, 18)}...{localVerification.nullifier.slice(-6)}
              </div>
            )}
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-amber-300 font-medium">
              <span className="flex items-center space-x-1.5">
                <Award className="w-3.5 h-3.5 text-yellow-400" />
                <span>Earn +500 Trust Points</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-300 font-bold">
                +500 PTS
              </span>
            </div>
            <p className="text-[11px] text-gray-300">
              Verify this agent using the Self App to prove human backing, prevent Sybil attacks, and unlock x402 payment rails.
            </p>
          </div>
        )}

        {/* Live Points Balance Pill */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-xs">
          <span className="text-gray-400 flex items-center space-x-1.5">
            <Award className="w-3.5 h-3.5 text-yellow-400" />
            <span>Agent Trust Points:</span>
          </span>
          <span className="font-bold text-yellow-300 tracking-wide">
            {localVerification.pointsBalance.toLocaleString()} Pts
          </span>
        </div>

        {statusMessage && (
          <div className="p-2 rounded-lg bg-black/40 text-[11px] text-emerald-300 border border-emerald-500/20">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex flex-wrap gap-2">
        {!isVerified ? (
          <>
            <button
              type="button"
              onClick={handleStartVerification}
              className="flex-1 min-w-[130px] inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-emerald-400 to-green-300 hover:from-emerald-300 hover:to-green-200 transition-all shadow-md active:scale-95"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Verify with Self</span>
            </button>
            <button
              type="button"
              onClick={handleClaimPointsOrCheck}
              disabled={isChecking}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/30 transition-all disabled:opacity-50"
            >
              {isChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Check & Claim +500</span>
            </button>
          </>
        ) : (
          <>
            {!localVerification.bonusClaimed && (
              <button
                type="button"
                onClick={handleClaimPointsOrCheck}
                disabled={isChecking}
                className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-yellow-400 to-amber-300 hover:from-yellow-300 hover:to-amber-200 transition-all shadow-md active:scale-95"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Claim +500 Bonus Points</span>
              </button>
            )}
            <a
              href="https://celoscan.io/address/0xaC3DF9ABf80d0F5c020C06B04Cced27763355944"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center space-x-1 px-3 py-2 rounded-xl text-xs font-medium text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              <span>View On CeloScan</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
          </>
        )}
      </div>
    </div>
  );
}
