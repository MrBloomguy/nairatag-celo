import React from 'react';
import {
  Calendar,
  Clock,
  Search,
  X,
  ArrowRight,
  ShieldCheck,
  Headphones,
  Tag,
  Wallet,
  Check,
  Share2,
  Bot,
  MoreVertical,
  Send,
  AlertTriangle,
  Fingerprint,
  FileText,
  Key,
  ExternalLink,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

export default function PanoramicWalkthroughView({
  servicesList = [],
  selectedService,
  setSelectedService,
  setCurrentStep,
  selectedDate,
  setSelectedDate,
  selectedSlotTime,
  setSelectedSlotTime,
  customerNotes,
  setCustomerNotes,
  selectedPaymentMethod,
  setSelectedPaymentMethod,
  vaultScenario,
  setVaultScenario,
  isPasskeyApproved,
  setIsPasskeyApproved,
  handleRequestBooking,
  isSubmitting,
  bookingError,
  activeBookingRecord,
  chatMessages,
  chatInput,
  setChatInput,
  handleSendChatMessage,
}) {
  const effectiveService = selectedService || servicesList.find((s) => s.agentTag === 'music') || servicesList[0] || {
    id: 'srv_music_prod',
    agentTag: 'music',
    title: 'Music production session',
    description: 'Recording, production and mixing with a professional producer.',
    durationMinutes: 120,
    price: '50000',
    currency: 'cNGN',
  };

  const datePills = [
    { label: 'Mon', sub: 'Nov 23', dateStr: '2026-11-23' },
    { label: 'Tue', sub: 'Nov 24', dateStr: '2026-11-24' },
    { label: 'Wed', sub: 'Nov 25', dateStr: '2026-11-25' },
    { label: 'Thu', sub: 'Nov 26', dateStr: '2026-11-26' },
    { label: 'Fri', sub: 'Nov 27', dateStr: '2026-11-27' },
    { label: 'Sat', sub: 'Nov 28', dateStr: '2026-11-28' },
  ];

  const timeSlotButtons = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* ── Top Notice Bar ── */}
      <div
        style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          padding: '12px 18px',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={18} color="#059669" />
          <div>
            <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#065f46' }}>
              Panoramic Walkthrough Mode (All 7 Screens at a Glance)
            </span>
            <span style={{ fontSize: '12px', color: '#047857', marginLeft: '8px' }}>
              Discovery · Service Details · Scheduling · Agent Vault Authorization · Booking Request · Booking Agent · Settlement
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCurrentStep('discover')}
          style={{
            background: '#059669',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Switch to Step-by-Step Flow →
        </button>
      </div>

      {/* ── ROW 1: 4 PANELS ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        {/* PANEL 1: Discover Services */}
        <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={16} color="#0f172a" />
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Discover Services</h2>
            </div>
            <p style={{ margin: '2px 0 0 22px', fontSize: '11.5px', color: '#64748b' }}>
              Book services from agents across NairaTag
            </p>
          </div>

          {/* Search Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '7px 10px', marginBottom: '12px' }}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              readOnly
              placeholder="Search services, agents or categories"
              style={{ border: 'none', background: 'none', outline: 'none', width: '100%', fontSize: '12px', color: '#0f172a' }}
            />
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            {['All', 'Music', 'Video', 'Design'].map((cat, i) => (
              <span
                key={cat}
                style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: i === 0 ? '#059669' : '#f1f5f9',
                  color: i === 0 ? '#fff' : '#475569',
                }}
              >
                {cat}
              </span>
            ))}
          </div>

          {/* Service Cards Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Card 1: NMUSIC */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#fff' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                <img
                  src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=400&q=80"
                  alt="Music"
                  style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontWeight: 800, fontSize: '12.5px', color: '#0f172a' }}>₦MUSIC</span>
                    <span style={{ fontSize: '9px', background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '9999px', fontWeight: 600 }}>Bookable</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>Music production session</div>
                  <div style={{ fontSize: '10.5px', color: '#64748b' }}>Recording, production and mixing with a professional producer.</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>⏱ 2 hours</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>₦50,000</span>
                <button
                  type="button"
                  onClick={() => { setSelectedService(effectiveService); setCurrentStep('details'); }}
                  style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', padding: '3px 8px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  View Service →
                </button>
              </div>
            </div>

            {/* Card 2: NVIDEO */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#fff' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                <img
                  src="https://images.unsplash.com/photo-1579632652768-6cb9dcf85912?auto=format&fit=crop&w=400&q=80"
                  alt="Video"
                  style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontWeight: 800, fontSize: '12.5px', color: '#0f172a' }}>₦VIDEO</span>
                    <span style={{ fontSize: '9px', background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '9999px', fontWeight: 600 }}>Bookable</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>Video production</div>
                  <div style={{ fontSize: '10.5px', color: '#64748b' }}>Shoot planning and production.</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>⏱ 3 hours</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>₦80,000</span>
                <button
                  type="button"
                  onClick={() => { setSelectedService(effectiveService); setCurrentStep('details'); }}
                  style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', padding: '3px 8px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  View Service →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 2: Service Details */}
        <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <ArrowLeft size={16} color="#0f172a" />
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Service Details</h2>
          </div>

          <div style={{ borderRadius: '12px', overflow: 'hidden', height: '130px', marginBottom: '12px', background: '#000' }}>
            <img
              src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80"
              alt="Studio"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#0f172a' }}>₦MUSIC</span>
            <span style={{ fontSize: '9.5px', background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '9999px', fontWeight: 600 }}>Bookable</span>
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 4px 0', color: '#0f172a' }}>Music production session</h3>
          <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.35 }}>
            Recording, production and mixing with a professional producer.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', fontSize: '11.5px', color: '#334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={13} color="#64748b" /> 2 hours</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Tag size={13} color="#64748b" /><span style={{ fontWeight: 700 }}>₦50,000</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={13} color="#64748b" /> Scheduled session</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Wallet size={13} color="#64748b" /> cNGN</div>
          </div>

          <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '8px 10px', display: 'flex', gap: '6px', alignItems: 'flex-start', marginBottom: '14px', border: '1px solid #dbeafe' }}>
            <ShieldCheck size={14} color="#2563eb" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ margin: 0, fontSize: '10.5px', color: '#1e40af', lineHeight: 1.35 }}>
              This service is offered by an independent NairaTag agent. Availability will be checked before confirmation.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCurrentStep('schedule')}
            style={{ width: '100%', background: '#059669', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          >
            <span>Choose date & time</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* PANEL 3: Choose a Time */}
        <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <ArrowLeft size={16} color="#0f172a" />
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Choose a Time</h2>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>Select a date</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {datePills.map((d) => {
                const isSel = selectedDate === d.dateStr;
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setSelectedDate(d.dateStr)}
                    style={{
                      padding: '6px 4px',
                      borderRadius: '8px',
                      border: isSel ? '2px solid #059669' : '1px solid #e2e8f0',
                      background: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '1px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>{d.label}</span>
                      {isSel && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#059669' }} />}
                    </div>
                    <span style={{ fontSize: '9.5px', color: '#64748b' }}>{d.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>Available times</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {timeSlotButtons.map((timeStr) => {
                const isSel = selectedSlotTime === timeStr;
                return (
                  <button
                    key={timeStr}
                    type="button"
                    onClick={() => setSelectedSlotTime(timeStr)}
                    style={{
                      padding: '7px 4px',
                      borderRadius: '8px',
                      border: isSel ? 'none' : '1px solid #e2e8f0',
                      background: isSel ? '#059669' : '#fff',
                      color: isSel ? '#fff' : '#0f172a',
                      fontWeight: 700,
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    {timeStr}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc' }}>
              <Calendar size={13} color="#059669" />
              <div>
                <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Selected date</div>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>Mon, Nov 23</div>
              </div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc' }}>
              <Clock size={13} color="#059669" />
              <div>
                <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Selected time</div>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>{selectedSlotTime}</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCurrentStep('review')}
            style={{ width: '100%', background: '#059669', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          >
            <span>Continue</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* PANEL 4: Review Booking + Agent Vault Authorization */}
        <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <ArrowLeft size={16} color="#0f172a" />
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Review Booking</h2>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d' }}>
              <Headphones size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontWeight: 800, fontSize: '12px', color: '#0f172a' }}>₦MUSIC</span>
                <span style={{ fontSize: '9px', background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '9999px', fontWeight: 600 }}>Selected</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Music production session</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', fontSize: '11.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}><span>📅 Date</span><span style={{ fontWeight: 700, color: '#0f172a' }}>Mon, Nov 23</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}><span>🕒 Time</span><span style={{ fontWeight: 700, color: '#0f172a' }}>{selectedSlotTime}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}><span>⏳ Duration</span><span style={{ fontWeight: 700, color: '#0f172a' }}>2 hours</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}><span>🏷 Service price</span><span style={{ fontWeight: 700, color: '#0f172a' }}>₦50,000</span></div>
          </div>

          <div style={{ height: '1px', background: '#e2e8f0', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Total</span>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>₦50,000</span>
          </div>

          {/* Payment Method Selector */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>Payment method</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                onClick={() => setSelectedPaymentMethod('vault')}
                style={{
                  border: selectedPaymentMethod === 'vault' ? '2px solid #059669' : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: selectedPaymentMethod === 'vault' ? 'rgba(5, 150, 105, 0.04)' : '#fff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedPaymentMethod === 'vault' && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '11.5px', color: '#0f172a' }}>Agent Vault</div>
                    <div style={{ fontSize: '9.5px', color: '#64748b' }}>Allow an authorized agent to pay.</div>
                  </div>
                </div>
                <ArrowRight size={12} color="#94a3b8" />
              </div>

              <div
                onClick={() => setSelectedPaymentMethod('direct')}
                style={{
                  border: selectedPaymentMethod === 'direct' ? '2px solid #059669' : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: selectedPaymentMethod === 'direct' ? 'rgba(5, 150, 105, 0.04)' : '#fff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedPaymentMethod === 'direct' && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '11.5px', color: '#0f172a' }}>Pay directly</div>
                    <div style={{ fontSize: '9.5px', color: '#64748b' }}>Authorize payment yourself.</div>
                  </div>
                </div>
                <ArrowRight size={12} color="#94a3b8" />
              </div>
            </div>
          </div>

          {/* Embedded Agent Vault Panel */}
          {selectedPaymentMethod === 'vault' && (
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>Agent payment authorization</span>
                <span style={{ fontSize: '9px', background: '#e0e7ff', color: '#4338ca', padding: '2px 6px', borderRadius: '9999px', fontWeight: 700 }}>Altana wallet</span>
              </div>

              <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '6px 8px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>₦MUSIC (Session)</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>₦50,000</span>
              </div>

              <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '10.5px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Agent wallet</span>
                  <span style={{ fontWeight: 700, color: '#059669' }}>Connected</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Spending limit</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{vaultScenario === 'exceeded' && !isPasskeyApproved ? '₦40,000' : '₦60,000'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Requested payment</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>₦50,000</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Recipient</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>₦MUSIC provider</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px' }}>
                  <span style={{ color: '#64748b' }}>Session status</span>
                  <span style={{ fontWeight: 700, color: (vaultScenario === 'expired' || vaultScenario === 'revoked') ? '#dc2626' : '#059669' }}>
                    {vaultScenario === 'expired' ? 'Expired' : vaultScenario === 'revoked' ? 'Revoked' : 'Active'}
                  </span>
                </div>
              </div>

              {vaultScenario === 'active' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', background: '#dcfce7', padding: '6px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 700, marginBottom: '6px' }}>
                  <Check size={12} strokeWidth={3} />
                  <span>Within authorized spending limit</span>
                </div>
              )}

              {vaultScenario === 'exceeded' && !isPasskeyApproved && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b45309', background: '#fef3c7', padding: '6px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 600, marginBottom: '6px' }}>
                  <AlertTriangle size={12} />
                  <span>Exceeds limit (₦40,000). Passkey step-up required.</span>
                </div>
              )}

              <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.3 }}>
                <strong>Protected agent spending:</strong> Executed only within user authorization.
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleRequestBooking}
            style={{ width: '100%', background: '#059669', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          >
            <span>{isSubmitting ? 'Requesting...' : 'Request Booking'}</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* ── ROW 2: 3 PANELS ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        {/* PANEL 5: Booking Request Created */}
        <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '24px 18px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: '#059669',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              boxShadow: '0 0 0 6px rgba(5, 150, 105, 0.15)',
            }}
          >
            <Check size={26} strokeWidth={3} />
          </div>

          <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 4px 0', color: '#0f172a' }}>
            Booking Request Created
          </h3>
          <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0 0 14px 0' }}>
            Your request is ready for provider and payment checks.
          </p>

          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '10px 12px', marginBottom: '14px', fontSize: '11.5px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#64748b' }}>
              <span>Reference</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>
                {activeBookingRecord?.id ? activeBookingRecord.id.replace('book_', 'NT-BOOK-').slice(0, 12).toUpperCase() : 'NT-BOOK-4829'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#64748b' }}>
              <span>Service</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>₦MUSIC</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#64748b' }}>
              <span>Date</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>Mon, Nov 23</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#64748b' }}>
              <span>Time</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>10:00 AM</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#64748b' }}>
              <span>Payment Route</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>Agent Vault</span>
            </div>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '9999px', fontSize: '10.5px', fontWeight: 600, marginBottom: '16px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#b45309' }} />
            <span>Pending provider / authorization checks</span>
          </div>

          <button
            type="button"
            onClick={() => setCurrentStep('confirmed_details')}
            style={{ width: '100%', background: '#059669', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
          >
            Explore More Services
          </button>
        </div>

        {/* PANEL 6: NairaTag Booking Agent */}
        <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={15} />
              </div>
              <span style={{ fontWeight: 800, fontSize: '12.5px', color: '#0f172a' }}>NairaTag Booking Agent</span>
            </div>
            <MoreVertical size={14} color="#94a3b8" />
          </div>

          <div style={{ padding: '14px', maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
            {/* User message 1 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '8px 10px', color: '#0f172a', maxWidth: '85%' }}>
                Find me a music producer. I need a two-hour session next Monday.
              </div>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#059669', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>JD</div>
            </div>

            {/* Agent message 1 */}
            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '6px' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bot size={12} /></div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '8px 10px', color: '#0f172a', maxWidth: '85%' }}>
                I found 3 agents offering music production. Here are the available services and prices. Would you like to compare them or view the available time slots?
              </div>
            </div>

            {/* User message 2 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '8px 10px', color: '#0f172a', maxWidth: '85%' }}>
                Show me <strong>₦MUSIC</strong>. Book the 10 AM slot.
              </div>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#059669', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>JD</div>
            </div>

            {/* Agent message 2 */}
            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '6px' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bot size={12} /></div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '8px 10px', color: '#0f172a', maxWidth: '85%' }}>
                <div>₦MUSIC has a two-hour session at ₦50,000. I've prepared your booking for Mon, Nov 23 at 10 AM. Would you like to authorize payment through Agent Vault or pay directly?</div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => { setSelectedPaymentMethod('vault'); setCurrentStep('review'); }}
                    style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Authorize via Agent Vault
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedPaymentMethod('direct'); setCurrentStep('review'); }}
                    style={{ background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 8px', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Pay directly
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 7: Booking Details + Payment Receipt */}
        <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={16} color="#0f172a" />
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Booking Details</h2>
            </div>
            <button
              type="button"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <Share2 size={11} /> Share
            </button>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d' }}>
                <Headphones size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '12.5px', color: '#0f172a' }}>₦MUSIC</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Music production session</div>
              </div>
            </div>
            <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Check size={10} strokeWidth={3} /> Confirmed
            </span>
          </div>

          {/* Stepper */}
          <div style={{ marginBottom: '14px', padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '8px', left: '8px', right: '8px', height: '2px', background: '#e2e8f0', zIndex: 1 }} />
              <div style={{ position: 'absolute', top: '8px', left: '8px', width: '75%', height: '2px', background: '#059669', zIndex: 1 }} />
              {['Requested', 'Provider accepted', 'Awaiting payment', 'Confirmed', 'In progress'].map((step, idx) => (
                <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: idx < 4 ? '#059669' : '#fff', border: idx < 4 ? 'none' : '2px solid #cbd5e1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                    {idx < 4 && <Check size={9} strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: '8.5px', color: idx === 3 ? '#059669' : '#64748b', fontWeight: idx === 3 ? 700 : 500 }}>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Info & Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>📅 Mon, Nov 23, 2026 · 10:00 AM</div>
              <div style={{ fontSize: '10.5px', color: '#64748b' }}>⏳ 2 hours</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9.5px', color: '#64748b' }}>TOTAL</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>₦50,000</div>
            </div>
          </div>

          {/* Paid Banner */}
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <ShieldCheck size={18} color="#059669" />
            <div>
              <div style={{ fontWeight: 800, fontSize: '11.5px', color: '#065f46' }}>Paid via Agent Vault</div>
              <div style={{ fontSize: '10.5px', color: '#047857' }}>Authorization complete. Your booking is confirmed.</div>
            </div>
          </div>

          {/* Payment Receipt */}
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px', fontSize: '10.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>Payment Settlement Receipt</span>
              <span style={{ background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, fontSize: '9px' }}>BOUND_AND_VERIFIED</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#64748b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Altana Session Wallet</span><span style={{ fontFamily: 'monospace', color: '#0f172a' }}>0x71C2...b1D</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Transaction Hash</span>
                <a href="https://celoscan.io/tx/0x250e11feca536de2e68722f82643be4dad3568bccc358d356dbf4b843c820436" target="_blank" rel="noopener noreferrer" style={{ color: '#059669', textDecoration: 'none' }}>0x250e...0436</a>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Settled Amount</span><span style={{ fontWeight: 700, color: '#0f172a' }}>₦50,000 cNGN (34.62 USD₮)</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Remaining Budget</span><span style={{ fontWeight: 700, color: '#059669' }}>₦10,000 cNGN</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
