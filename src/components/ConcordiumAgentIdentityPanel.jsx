import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, ShieldCheck, Wallet } from 'lucide-react';
import { buildConcordiumAgentCard, buildConcordiumAgentRegistration, buildConcordiumCis8Binding, buildConcordiumSetAgentUri, CONCORDIUM_TESTNET, findConcordiumAgentByCis8Binding, publishConcordiumAgentCard, submitConcordiumAgentRegistration, submitConcordiumCis8Binding, submitConcordiumSetAgentUri, verifyConcordiumBadge, verifyConcordiumCis8Binding, verifyHostedConcordiumAgentCard } from '../services/concordiumAgentRegistry.js';
import { connectConcordiumTestnetWallet } from '../services/concordiumWallet.js';

const panelStyle = {
  margin: '12px 0',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
  background: 'var(--surface-2, #f8fafc)',
};

export default function ConcordiumAgentIdentityPanel({ agent, activeEvmAddress, profileOwnerAddress, evmProvider }) {
  const initialBadge = agent?.concordium?.badge || agent?.concordiumBadge || '';
  const [badgeInput, setBadgeInput] = useState(initialBadge);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [agentUri, setAgentUri] = useState('');
  const [cardDraft, setCardDraft] = useState(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState('');
  const [hostedCard, setHostedCard] = useState(null);
  const [hostingLoading, setHostingLoading] = useState(false);
  const [cis8Binding, setCis8Binding] = useState(null);
  const [cis8Loading, setCis8Loading] = useState(false);
  const [cis8Error, setCis8Error] = useState('');
  const [cis8Tx, setCis8Tx] = useState('');
  const [cis8Verified, setCis8Verified] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [registrationTx, setRegistrationTx] = useState('');
  const [registeredAgent, setRegisteredAgent] = useState(null);
  const [copiedCard, setCopiedCard] = useState(false);
  const [setUriPayload, setSetUriPayload] = useState(null);
  const [setUriLoading, setSetUriLoading] = useState(false);
  const [setUriError, setSetUriError] = useState('');
  const [setUriTx, setSetUriTx] = useState('');

  useEffect(() => () => {
    wallet?.connection?.disconnect?.();
  }, [wallet?.connection]);

  useEffect(() => {
    const badge = agent?.concordium?.badge || agent?.concordiumBadge || '';
    setBadgeInput(badge);
    setResult(null);
    setError('');
    setCardDraft(null);
    const cleanTag = String(agent?.tag || '').replace(/^[₦$@#]/, '').toLowerCase();
    setAgentUri(cleanTag && typeof window !== 'undefined'
      ? `${window.location.origin}/api/concordium-agent-card/${encodeURIComponent(cleanTag)}`
      : '');
    setCardError('');
    setHostedCard(null);
    setCis8Binding(null);
    setCis8Error('');
    setCis8Tx('');
    setCis8Verified(null);
    setRegistration(null);
    setRegistrationError('');
    setRegistrationTx('');
    setRegisteredAgent(null);

    if (badge) {
      setLoading(true);
      verifyConcordiumBadge(badge)
        .then((res) => setResult(res))
        .catch((err) => setError(err?.message || 'Could not verify this Concordium badge.'))
        .finally(() => setLoading(false));
    }
  }, [agent?.tag, agent?.concordium?.badge, agent?.concordiumBadge]);

  useEffect(() => {
    setCis8Binding(null);
    setCis8Error('');
    setCis8Tx('');
    setCis8Verified(null);
    setRegistration(null);
    setRegistrationError('');
    setRegistrationTx('');
    setRegisteredAgent(null);
  }, [activeEvmAddress, profileOwnerAddress]);

  const checkBadge = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await verifyConcordiumBadge(badgeInput));
    } catch (verificationError) {
      setError(verificationError?.message || 'Could not verify this Concordium badge.');
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    setWalletLoading(true);
    setWalletError('');
    try {
      const connected = await connectConcordiumTestnetWallet({
        onAccountChanged: (account) => {
          setCardDraft(null);
          setHostedCard(null);
          setCis8Binding(null);
          setCis8Verified(null);
          setCis8Error('');
          setCis8Tx('');
          setRegistration(null);
          setRegistrationError('');
          setRegistrationTx('');
          setRegisteredAgent(null);
          setWallet((current) => current ? { ...current, account } : current);
        },
        onChainChanged: (genesisHash) => {
          setCardDraft(null);
          setHostedCard(null);
          setCis8Binding(null);
          setCis8Verified(null);
          setCis8Error('');
          setCis8Tx('');
          setRegistration(null);
          setRegistrationError('');
          setRegistrationTx('');
          setRegisteredAgent(null);
          if (genesisHash?.toLowerCase() !== CONCORDIUM_TESTNET.genesisHash) {
            setWalletError(`Wallet network changed. Switch back to ${CONCORDIUM_TESTNET.name} to continue.`);
          } else {
            setWalletError('');
          }
        },
      });
      setWallet(connected);
    } catch (connectionError) {
      setWalletError(connectionError?.message || 'Could not connect the Concordium wallet.');
    } finally {
      setWalletLoading(false);
    }
  };

  const disconnectWallet = async () => {
    await wallet?.connection?.disconnect?.();
    setWallet(null);
    setWalletError('');
    setCis8Binding(null);
    setCis8Verified(null);
    setCis8Tx('');
    setCardDraft(null);
    setHostedCard(null);
    setRegistration(null);
    setRegistrationTx('');
    setRegisteredAgent(null);
  };

  const prepareCard = async (event) => {
    event.preventDefault();
    if (!wallet?.account || walletError || !cis8Verified?.ownedByConnectedAccount || !cis8Binding) return;
    setCardLoading(true);
    setCardError('');
    setCardDraft(null);
    setHostedCard(null);
    setRegistration(null);
    setRegistrationError('');
    setRegistrationTx('');
    setRegisteredAgent(null);
    try {
      const tag = String(agent?.tag || 'nairatag').replace(/^[₦$@#]/, '').toUpperCase();
      const profileName = String(agent?.name || '').trim();
      setCardDraft(await buildConcordiumAgentCard({
        name: profileName && profileName.toUpperCase() !== tag ? `₦${tag} · ${profileName}` : `₦${tag} · NairaTag Agent`,
        description: `NairaTag agent identity for ₦${tag}. This card anchors the public agent identity to its Concordium Testnet registry entry; it does not grant account permissions.`,
        agentUri,
        ownerAccount: wallet.account,
        externalReference: {
          kind: 'Cis8',
          namespace: cis8Binding.evmNamespace,
          identifier: tag.toLowerCase(),
        },
      }));
    } catch (buildError) {
      setCardError(buildError?.message || 'Could not prepare the Concordium Agent Card.');
    } finally {
      setCardLoading(false);
    }
  };

  const copyCard = async () => {
    if (!cardDraft?.cardJson || !navigator.clipboard?.writeText) {
      setCardError('Clipboard access is unavailable. Expand the card preview and copy its JSON manually.');
      return;
    }
    try {
      await navigator.clipboard.writeText(cardDraft.cardJson);
      setCopiedCard(true);
      window.setTimeout(() => setCopiedCard(false), 1800);
    } catch {
      setCardError('Could not copy the Agent Card. Expand the preview and copy its JSON manually.');
    }
  };

  const publishCard = async () => {
    setHostingLoading(true);
    setCardError('');
    setHostedCard(null);
    setRegistration(null);
    setRegistrationError('');
    setRegistrationTx('');
    setRegisteredAgent(null);
    try {
      const published = await publishConcordiumAgentCard({
        provider: evmProvider,
        activeEvmAddress,
        profileOwnerAddress,
        cardDraft,
        concordiumAccount: wallet?.account,
        cis8Binding,
        tag: agent?.tag,
      });
      const integrity = await verifyHostedConcordiumAgentCard(cardDraft);
      setHostedCard({ ...integrity, version: published.version });
    } catch (publishError) {
      setCardError(publishError?.message || 'Could not publish the Agent Card to NairaTag.');
    } finally {
      setHostingLoading(false);
    }
  };

  const prepareRegistration = async () => {
    if (!wallet?.account || walletError || !cis8Verified?.ownedByConnectedAccount || !cis8Binding || !hostedCard) return;
    setRegistrationLoading(true);
    setRegistrationError('');
    setRegistration(null);
    setRegistrationTx('');
    setRegisteredAgent(null);
    try {
      setRegistration(await buildConcordiumAgentRegistration({
        cardDraft,
        ownerAccount: wallet.account,
        cis8Binding,
      }));
    } catch (error) {
      setRegistrationError(error?.message || 'Could not prepare the Concordium agent registration.');
    } finally {
      setRegistrationLoading(false);
    }
  };

  const submitRegistration = async () => {
    if (!wallet?.connection || !registration || walletError || registrationLoading || registrationTx) return;
    setRegistrationLoading(true);
    setRegistrationError('');
    try {
      setRegistrationTx(await submitConcordiumAgentRegistration(wallet.connection, wallet.account, registration));
    } catch (error) {
      setRegistrationError(error?.message || 'The Concordium wallet did not submit the agent registration.');
    } finally {
      setRegistrationLoading(false);
    }
  };

  const checkRegisteredAgent = async () => {
    if (!cis8Binding) return;
    setRegistrationLoading(true);
    setRegistrationError('');
    setRegisteredAgent(null);
    try {
      const found = await findConcordiumAgentByCis8Binding(cis8Binding);
      if (!found) {
        setRegistrationError('The agent is not visible in the Testnet registry yet. Wait for transaction finality and check again.');
        return;
      }
      const record = found.agent || found.registration || found;
      const owner = record.owner_account || record.owner || found.owner_account || found.owner || null;
      if (!owner) {
        setRegistrationError('The registry response did not include an owner, so this agent cannot be verified safely.');
        return;
      }
      if (owner && owner !== wallet?.account) {
        setRegistrationError('The CIS-8 key resolves to an agent owned by a different Concordium account.');
        return;
      }
      const resolvedUri = record.agent_uri || record.agentUri || null;
      if (resolvedUri && resolvedUri !== cardDraft?.agentUri) {
        setRegistrationError('The registry entry points to a different Agent Card URL than the one prepared here.');
        return;
      }
      const resolvedHash = String(record.metadata_hash_hex || record.metadata_hash || record.metadataHash || '').replace(/^0x/i, '').toLowerCase();
      if (resolvedHash && resolvedHash !== cardDraft?.metadataHash?.toLowerCase()) {
        setRegistrationError('The registry entry is anchored to a different Agent Card hash than the one prepared here.');
        return;
      }
      setRegisteredAgent(found);
    } catch (error) {
      setRegistrationError(error?.message || 'Could not query the Concordium Testnet registry.');
    } finally {
      setRegistrationLoading(false);
    }
  };

  const prepareCis8Binding = async () => {
    setCis8Loading(true);
    setCis8Error('');
    setCis8Binding(null);
    setCis8Tx('');
    setCis8Verified(null);
    try {
      if (!wallet?.account || walletError) throw new Error(`Connect a ${CONCORDIUM_TESTNET.name} account first.`);
      setCis8Binding(await buildConcordiumCis8Binding({
        provider: evmProvider,
        activeEvmAddress,
        profileOwnerAddress,
        concordiumAccount: wallet.account,
        tag: agent?.tag,
      }));
    } catch (error) {
      setCis8Error(error?.message || 'Could not prepare the CIS-8 owner binding.');
    } finally {
      setCis8Loading(false);
    }
  };

  const submitCis8Binding = async () => {
    if (!wallet?.connection || !cis8Binding || walletError || cis8Loading || cis8Tx) return;
    setCis8Loading(true);
    setCis8Error('');
    try {
      setCis8Tx(await submitConcordiumCis8Binding(wallet.connection, wallet.account, cis8Binding, {
        provider: evmProvider,
        activeEvmAddress,
        profileOwnerAddress,
      }));
    } catch (error) {
      setCis8Error(error?.message || 'The Concordium wallet did not submit the CIS-8 binding.');
    } finally {
      setCis8Loading(false);
    }
  };

  const checkCis8Binding = async () => {
    if (!cis8Binding) return;
    setCis8Loading(true);
    setCis8Error('');
    setCis8Verified(null);
    try {
      const state = await verifyConcordiumCis8Binding(cis8Binding);
      setCis8Verified(state);
      if (state.registered && !state.ownedByConnectedAccount) {
        setCis8Error('This NairaTag owner key is already bound to a different Concordium account on Testnet.');
      } else if (!state.registered) {
        setCis8Error('CIS-8 binding is not visible on Testnet yet. Wait for transaction finality and check again.');
      }
    } catch (error) {
      setCis8Error(error?.message || 'Could not verify the CIS-8 binding on Testnet.');
    } finally {
      setCis8Loading(false);
    }
  };

  const prepareSetAgentUri = async () => {
    if (!result?.tokenId || !wallet?.account) return;
    setSetUriLoading(true);
    setSetUriError('');
    setSetUriPayload(null);
    setSetUriTx('');
    try {
      const uriToAnchor = agentUri || (typeof window !== 'undefined' ? `${window.location.origin}/nairatag-agent-card.json` : 'https://concordium.nairatag.ng/nairatag-agent-card.json');
      const hashToAnchor = cardDraft?.metadataHash || '476e62ee7727509499dddf66ffc506eb331ef00674c5a4498b25a6c487de9bb4';
      const payload = await buildConcordiumSetAgentUri({
        tokenId: result.tokenId,
        agentUri: uriToAnchor,
        metadataHashHex: hashToAnchor,
        sender: wallet.account,
      });
      setSetUriPayload(payload);
    } catch (err) {
      setSetUriError(err?.message || 'Could not prepare setAgentURI transaction.');
    } finally {
      setSetUriLoading(false);
    }
  };

  const submitSetAgentUri = async () => {
    if (!wallet?.connection || !setUriPayload || !wallet?.account) return;
    setSetUriLoading(true);
    setSetUriError('');
    try {
      const tx = await submitConcordiumSetAgentUri(wallet.connection, wallet.account, setUriPayload);
      setSetUriTx(tx);
    } catch (err) {
      setSetUriError(err?.message || 'The Concordium wallet did not submit the setAgentURI transaction.');
    } finally {
      setSetUriLoading(false);
    }
  };

  return (
    <section style={panelStyle} aria-label="Concordium agent identity">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={17} color={result?.valid ? '#15803d' : 'var(--text-secondary, #64748b)'} />
          <strong style={{ fontSize: 13 }}>Concordium agent identity</strong>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)' }}>Testnet</span>
      </div>

      <p style={{ margin: '7px 0 10px', fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary, #64748b)' }}>
        Check a CIS-8004 badge and Agent Card on Concordium Testnet. Human ID proof is separate.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          className="agent-tool-chip"
          onClick={wallet ? disconnectWallet : connectWallet}
          disabled={walletLoading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: walletLoading ? 0.6 : 1 }}
        >
          <Wallet size={13} />
          {walletLoading ? 'Connecting…' : wallet ? 'Disconnect' : 'Connect Concordium wallet'}
        </button>
        {wallet?.account && !walletError && (
          <span style={{ minWidth: 0, fontSize: 11, color: '#15803d', overflowWrap: 'anywhere' }}>
            Testnet · {wallet.account}
          </span>
        )}
      </div>

      {walletError && <p role="alert" style={{ margin: '6px 0 9px', color: '#b91c1c', fontSize: 11 }}>{walletError}</p>}

      <aside style={{ margin: '8px 0 12px', padding: 10, borderRadius: 8, background: 'var(--surface-1, #fff)', fontSize: 11, lineHeight: 1.55 }}>
        <strong>Need test CCD for a Concordium transaction?</strong>
        <p style={{ margin: '5px 0', color: 'var(--text-secondary, #64748b)' }}>
          In the Concordium Testnet Browser Wallet, open your account’s Activity page and choose <b>Request CCD</b>. Eligible accounts receive 20,000 test CCD once. The account must have no incoming transactions yet, so request it before funding that account from another source.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <a href="https://docs.concordium.com/en/mainnet/tutorials/plt/request-ccd.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link, #2563eb)', fontWeight: 650 }}>Faucet steps <ExternalLink size={11} style={{ verticalAlign: 'middle' }} /></a>
          <a href="https://docs.concordium.com/en/mainnet/docs/browser-wallet/setup-browser-wallet.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link, #2563eb)', fontWeight: 650 }}>Wallet setup <ExternalLink size={11} style={{ verticalAlign: 'middle' }} /></a>
        </div>
      </aside>

      <div style={{ margin: '8px 0 12px', padding: 9, borderRadius: 8, background: 'var(--surface-1, #fff)', fontSize: 11, lineHeight: 1.5 }}>
        <strong>Link this tag owner with CIS-8</strong>
        <p style={{ margin: '5px 0', color: 'var(--text-secondary, #64748b)' }}>
          The connected NairaTag owner wallet must control this tag. Two message signatures prove its public key; then Concordium Wallet asks separately to register the link on Testnet.
        </p>
        {!activeEvmAddress && <div style={{ color: '#b45309' }}>Sign in with the wallet that owns this NairaTag.</div>}
        {activeEvmAddress && profileOwnerAddress && String(activeEvmAddress).toLowerCase() !== String(profileOwnerAddress).toLowerCase() && (
          <div style={{ color: '#b45309' }}>The connected wallet does not own this NairaTag.</div>
        )}
        {activeEvmAddress && !profileOwnerAddress && <div style={{ color: '#b45309' }}>The tag owner could not be verified from the profile.</div>}
        <button
          type="button"
          className="agent-tool-chip"
          onClick={prepareCis8Binding}
          disabled={!wallet?.account || Boolean(walletError) || !evmProvider || !activeEvmAddress || String(activeEvmAddress).toLowerCase() !== String(profileOwnerAddress || '').toLowerCase() || cis8Loading || Boolean(cis8Tx)}
          style={{ marginTop: 3, opacity: !wallet?.account || Boolean(walletError) || !evmProvider || !activeEvmAddress || String(activeEvmAddress).toLowerCase() !== String(profileOwnerAddress || '').toLowerCase() || cis8Loading || Boolean(cis8Tx) ? 0.6 : 1 }}
        >
          {cis8Loading && !cis8Binding ? 'Requesting owner signatures…' : 'Prove NairaTag owner key'}
        </button>
        {cis8Binding && !cis8Tx && (
          <div style={{ marginTop: 7, padding: 8, border: '1px solid var(--border-color, #d1d5db)', borderRadius: 8 }}>
            <div>NairaTag owner: <span style={{ overflowWrap: 'anywhere' }}>{cis8Binding.evmAddress}</span></div>
            <div>Concordium account: <span style={{ overflowWrap: 'anywhere' }}>{cis8Binding.concordiumAccount}</span></div>
            <div>Testnet registry: {cis8Binding.contractAddress.index}.{cis8Binding.contractAddress.subindex} · {cis8Binding.receiveName}</div>
            <p style={{ margin: '5px 0', color: 'var(--text-secondary, #64748b)' }}>
              These ownership signatures do not spend funds. Concordium Wallet will separately ask you to review the Testnet transaction; test CCD may be required.
            </p>
            <button type="button" className="agent-tool-chip" onClick={submitCis8Binding} disabled={cis8Loading || Boolean(walletError)}>
              {cis8Loading ? 'Waiting for Concordium Wallet…' : 'Review CIS-8 registration'}
            </button>
          </div>
        )}
        {cis8Tx && <div style={{ marginTop: 6 }}>CIS-8 transaction submitted: <span style={{ overflowWrap: 'anywhere' }}>{cis8Tx}</span></div>}
        {cis8Binding && (
          <button type="button" className="agent-tool-chip" onClick={checkCis8Binding} disabled={cis8Loading} style={{ marginTop: 6 }}>
            {cis8Loading && cis8Tx ? 'Checking Testnet…' : 'Check CIS-8 binding on Testnet'}
          </button>
        )}
        {cis8Verified?.registered && cis8Verified.ownedByConnectedAccount && (
          <div role="status" style={{ marginTop: 5, color: '#15803d' }}>
            NairaTag owner key binding verified on Concordium Testnet for this account.
          </div>
        )}
        {cis8Error && <p role="alert" style={{ margin: '6px 0 0', color: '#b91c1c' }}>{cis8Error}</p>}
      </div>

      <form onSubmit={prepareCard} style={{ display: 'grid', gap: 7, margin: '8px 0 12px' }}>
        <label htmlFor="concordium-agent-uri" style={{ fontSize: 11, fontWeight: 600 }}>NairaTag Agent Card URL</label>
        {!cis8Verified?.ownedByConnectedAccount && (
          <span style={{ fontSize: 10, lineHeight: 1.45, color: 'var(--text-secondary, #64748b)' }}>
            Verify the CIS-8 owner link above before preparing a card for this NairaTag.
          </span>
        )}
        <input
          id="concordium-agent-uri"
          type="url"
          inputMode="url"
          autoComplete="url"
          value={agentUri}
          readOnly
          placeholder="The stable NairaTag card URL will appear here."
          required
          style={{
            minWidth: 0,
            padding: '9px 10px',
            borderRadius: 8,
            border: '1px solid var(--border-color, #d1d5db)',
            color: 'var(--text-primary, #111827)',
            background: 'var(--surface-1, #fff)',
            fontSize: 12,
          }}
        />
        <button
          type="submit"
          className="agent-tool-chip"
          disabled={!wallet?.account || Boolean(walletError) || !cis8Verified?.ownedByConnectedAccount || cardLoading || !agentUri.trim()}
          style={{ justifySelf: 'start', opacity: !wallet?.account || Boolean(walletError) || !cis8Verified?.ownedByConnectedAccount || cardLoading || !agentUri.trim() ? 0.6 : 1 }}
        >
          {cardLoading ? 'Preparing…' : 'Prepare Concordium Agent Card'}
        </button>
        <span style={{ fontSize: 10, lineHeight: 1.45, color: 'var(--text-secondary, #64748b)' }}>
          The card will be stored in Supabase and served by NairaTag. It stays in component memory until you publish; no browser storage is used.
        </span>
      </form>

      {cardError && <p role="alert" style={{ margin: '6px 0 9px', color: '#b91c1c', fontSize: 11 }}>{cardError}</p>}

      {cardDraft && (
        <div role="status" style={{ margin: '8px 0 12px', padding: 9, borderRadius: 8, background: 'var(--surface-1, #fff)', fontSize: 11, lineHeight: 1.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <strong style={{ color: '#15803d' }}>Testnet Agent Card prepared</strong>
            <button type="button" className="agent-tool-chip" onClick={copyCard} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {copiedCard ? <Check size={12} /> : <Copy size={12} />}{copiedCard ? 'Copied' : 'Copy JSON'}
            </button>
          </div>
          <div style={{ marginTop: 5, overflowWrap: 'anywhere' }}>URL: {cardDraft.agentUri}</div>
          <div style={{ overflowWrap: 'anywhere' }}>SHA-256: {cardDraft.metadataHash}</div>
          <button
            type="button"
            className="agent-tool-chip"
            onClick={publishCard}
            disabled={hostingLoading || !evmProvider || !activeEvmAddress || String(activeEvmAddress).toLowerCase() !== String(profileOwnerAddress || '').toLowerCase()}
            style={{ marginTop: 6, opacity: hostingLoading ? 0.6 : 1 }}
          >
            {hostingLoading ? 'Signing and publishing…' : 'Publish exact card bytes'}
          </button>
          {hostedCard && (
            <div style={{ marginTop: 5, color: '#15803d' }}>
              <Check size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Published to Supabase; public URL serves the exact card hash (version {hostedCard.version}).
            </div>
          )}
          {hostedCard && (
            <div style={{ display: 'grid', gap: 6, marginTop: 7 }}>
              <p style={{ margin: 0, color: 'var(--text-secondary, #64748b)' }}>
                Card bytes and the CIS-8 owner link are confirmed. Prepare the Testnet registration, then approve it in Concordium Wallet.
              </p>
              <button type="button" className="agent-tool-chip" onClick={prepareRegistration} disabled={registrationLoading || Boolean(walletError)}>
                {registrationLoading && !registration ? 'Preparing registration…' : 'Prepare CIS-8004 registration'}
              </button>
              <button type="button" className="agent-tool-chip" onClick={checkRegisteredAgent} disabled={registrationLoading || Boolean(walletError)}>
                {registrationLoading ? 'Checking registry…' : 'Check for an existing agent first'}
              </button>
            </div>
          )}
          {registration && (
            <div style={{ display: 'grid', gap: 6, marginTop: 7, padding: 8, border: '1px solid var(--border-color, #d1d5db)', borderRadius: 8 }}>
              <strong>Concordium Testnet registration preview</strong>
              <div>Owner: <span style={{ overflowWrap: 'anywhere' }}>{registration.ownerAccount}</span></div>
              <div>Registry: {registration.contractAddress.index}.{registration.contractAddress.subindex} · {registration.receiveName}</div>
              <div>Agent Card SHA-256: <span style={{ overflowWrap: 'anywhere' }}>{registration.metadataHash}</span></div>
              <div>Energy estimate: {registration.energy}</div>
              <p style={{ margin: 0, color: 'var(--text-secondary, #64748b)' }}>
                This mints a Concordium Testnet agent identity and anchors the card URL/hash. The wallet will show the transaction and fee before submission.
              </p>
              <button type="button" className="agent-tool-chip" onClick={submitRegistration} disabled={registrationLoading || Boolean(walletError) || Boolean(registrationTx)}>
                {registrationLoading ? 'Waiting for Concordium Wallet…' : 'Review and register agent'}
              </button>
            </div>
          )}
          {registrationTx && (
            <div style={{ display: 'grid', gap: 5, marginTop: 7 }}>
              <div>Registration submitted: <span style={{ overflowWrap: 'anywhere' }}>{registrationTx}</span></div>
              <button type="button" className="agent-tool-chip" onClick={checkRegisteredAgent} disabled={registrationLoading}>
                {registrationLoading ? 'Checking registry…' : 'Verify agent in Testnet registry'}
              </button>
            </div>
          )}
          {registeredAgent && (
            <div role="status" style={{ marginTop: 6, color: '#15803d' }}>
              Agent registration is visible on Concordium Testnet{registeredAgent.token_id !== undefined ? ` · Agent ID ${registeredAgent.token_id}` : ''}.
            </div>
          )}
          {registrationError && <p role="alert" style={{ margin: '6px 0 0', color: '#b91c1c' }}>{registrationError}</p>}
          <details style={{ marginTop: 6 }}>
            <summary style={{ cursor: 'pointer' }}>Preview exact card JSON</summary>
            <pre style={{ maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 10 }}>{cardDraft.cardJson}</pre>
          </details>
          {cardDraft.notes.map((note, index) => <p key={index} style={{ margin: '6px 0 0', color: 'var(--text-secondary, #64748b)' }}>{note}</p>)}
        </div>
      )}

      <form onSubmit={checkBadge} style={{ display: 'flex', gap: 8 }}>
        <input
          aria-label="Concordium agent badge"
          autoComplete="off"
          spellCheck={false}
          value={badgeInput}
          onChange={(event) => setBadgeInput(event.target.value)}
          placeholder="Paste Base58 CIS-2 badge"
          style={{
            minWidth: 0,
            flex: 1,
            padding: '9px 10px',
            borderRadius: 8,
            border: '1px solid var(--border-color, #d1d5db)',
            color: 'var(--text-primary, #111827)',
            background: 'var(--surface-1, #fff)',
            fontSize: 12,
          }}
        />
        <button
          type="submit"
          className="agent-tool-chip"
          disabled={loading || !badgeInput.trim()}
          style={{ whiteSpace: 'nowrap', opacity: loading || !badgeInput.trim() ? 0.6 : 1 }}
        >
          {loading ? 'Checking…' : 'Verify'}
        </button>
      </form>

      {error && <p role="alert" style={{ margin: '9px 0 0', color: '#b91c1c', fontSize: 11 }}>{error}</p>}

      {result && (
        <div role="status" style={{ marginTop: 10, fontSize: 11, lineHeight: 1.55 }}>
          <strong style={{ color: result.valid ? '#15803d' : '#b45309' }}>
            {result.valid ? 'Concordium registry badge verified' : 'Badge not verified'}
          </strong>
          <div>Registry network: {result.network || 'Unknown'}</div>
          <div>Active registry entry: {result.active ? 'Yes' : 'No'}</div>
          <div>Agent Card hash matches: {result.cardHashMatches ? 'Yes' : 'No'}</div>
          {result.tokenId && <div>Concordium agent ID: {result.tokenId}</div>}
          {result.owner && <div style={{ overflowWrap: 'anywhere' }}>Concordium owner: {result.owner}</div>}
          {result.issues.length > 0 && <div>Registry checks: {result.issues.join('; ')}</div>}
          {result.active && !result.valid && (
            <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: '#fff', border: '1px solid var(--border-color, #d1d5db)' }}>
              <strong>Anchor Agent Card on-chain (CIS-8004.setAgentURI)</strong>
              <p style={{ margin: '4px 0 8px', color: 'var(--text-secondary, #64748b)' }}>
                Agent #{result.tokenId} is active on Testnet, but its public Agent Card URI is not yet anchored.
              </p>
              {wallet?.account?.toLowerCase() === result.owner?.toLowerCase() ? (
                <>
                  {!setUriPayload && !setUriTx && (
                    <button type="button" className="agent-tool-chip" onClick={prepareSetAgentUri} disabled={setUriLoading}>
                      {setUriLoading ? 'Preparing setAgentURI…' : 'Prepare setAgentURI transaction'}
                    </button>
                  )}
                  {setUriPayload && !setUriTx && (
                    <div style={{ display: 'grid', gap: 5 }}>
                      <div>Card URI: <span style={{ overflowWrap: 'anywhere' }}>{setUriPayload.agentUri}</span></div>
                      <div>Card SHA-256: <span style={{ overflowWrap: 'anywhere' }}>{setUriPayload.metadataHash}</span></div>
                      <div>Suggested Energy: {setUriPayload.energy}</div>
                      <button type="button" className="agent-tool-chip" onClick={submitSetAgentUri} disabled={setUriLoading}>
                        {setUriLoading ? 'Waiting for Concordium Wallet…' : 'Review and submit in Concordium Wallet'}
                      </button>
                    </div>
                  )}
                  {setUriTx && (
                    <div style={{ marginTop: 5, color: '#15803d' }}>
                      setAgentURI submitted: <span style={{ overflowWrap: 'anywhere' }}>{setUriTx}</span>
                      <div style={{ marginTop: 4 }}>
                        <button type="button" className="agent-tool-chip" onClick={checkBadge} disabled={loading}>
                          Re-verify badge on Testnet
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: '#b45309' }}>Connect Concordium Wallet with account {result.owner} to anchor the card URI.</div>
              )}
              {setUriError && <p role="alert" style={{ margin: '5px 0 0', color: '#b91c1c' }}>{setUriError}</p>}
            </div>
          )}
          <a
            href={CONCORDIUM_TESTNET.explorer}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5 }}
          >Open Concordium Testnet explorer <ExternalLink size={11} /></a>
        </div>
      )}
    </section>
  );
}
