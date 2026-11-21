import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  ShieldCheck,
  User,
  Bot,
  DollarSign,
  Tag,
  ChevronRight,
  Briefcase,
  Sparkles,
  Headphones,
  Video,
  Palette,
  Code,
  Car,
  Plane,
  Users,
  Cpu,
  PlusCircle,
  RefreshCw,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import {
  BOOKING_CATEGORIES,
  searchServices,
  getService,
  registerService,
  PRICING_MODELS,
  BOOKING_MODES,
  normalizeTag,
} from '../../services/bookingRegistryService.js';
import {
  getAvailableSlots,
  getProviderAvailability,
} from '../../services/availabilityService.js';
import {
  createBookingRequest,
  providerAcceptBooking,
  providerRejectBooking,
  confirmBookingPayment,
  cancelBooking,
  listCustomerBookings,
  listProviderBookings,
  BOOKING_STATUS,
} from '../../services/bookingService.js';
import { PAYMENT_MODES } from '../../services/bookingPaymentService.js';

const CATEGORY_ICONS = {
  music: Headphones,
  video: Video,
  design: Palette,
  development: Code,
  transportation: Car,
  travel: Plane,
  consultations: Users,
  ai_compute: Cpu,
  business: Briefcase,
  other: Sparkles,
};

export default function BookingMarketplace({
  walletAddress = null,
  activeAgentTag = null,
  altanaSession = null,
  humanSelfProof = null,
  onConnectWallet = () => {},
  onOpenVault = () => {},
}) {
  // Navigation: 'discover' | 'my_bookings' | 'provider_dashboard'
  const [activeSubTab, setActiveSubTab] = useState('discover');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Selected Service for Details / Booking
  const [selectedService, setSelectedService] = useState(null);
  const [bookingStep, setBookingStep] = useState('details'); // 'details' | 'schedule' | 'checkout' | 'success'

  // Booking Flow State
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Tomorrow
    return d.toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [paymentMode, setPaymentMode] = useState(PAYMENT_MODES.DIRECT_HUMAN);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [createdBooking, setCreatedBooking] = useState(null);

  // My Bookings & Provider Bookings Lists
  const [myBookings, setMyBookings] = useState([]);
  const [providerBookings, setProviderBookings] = useState([]);

  // Create Service Modal (Provider)
  const [isCreateServiceOpen, setIsCreateServiceOpen] = useState(false);
  const [newServiceForm, setNewServiceForm] = useState({
    title: '',
    description: '',
    category: 'development',
    pricingModel: PRICING_MODELS.FIXED,
    price: '25.00',
    currency: 'USDT',
    durationMinutes: 60,
    bookingMode: BOOKING_MODES.INSTANT,
    requiresSelfVerification: false,
  });

  const effectiveCustomerTag = activeAgentTag || (walletAddress ? `celo_${walletAddress.slice(2, 8)}` : 'guest');

  // Load services
  const servicesList = useMemo(() => {
    return searchServices({
      query: searchQuery,
      category: selectedCategory,
      activeOnly: true,
    });
  }, [searchQuery, selectedCategory]);

  // Load bookings
  const refreshBookings = () => {
    if (walletAddress || activeAgentTag) {
      setMyBookings(listCustomerBookings(effectiveCustomerTag));
      if (activeAgentTag) {
        setProviderBookings(listProviderBookings(activeAgentTag));
      }
    }
  };

  useEffect(() => {
    refreshBookings();
  }, [walletAddress, activeAgentTag]);

  // Available slots for selected service & date
  const availableSlots = useMemo(() => {
    if (!selectedService || !selectedDate) return [];
    const existing = listProviderBookings(selectedService.agentTag);
    return getAvailableSlots(selectedService, selectedDate, existing);
  }, [selectedService, selectedDate]);

  // Handle Initial Booking Reservation
  const handleProceedToCheckout = () => {
    if (!selectedSlot) {
      setBookingError('Please select an available time slot.');
      return;
    }
    setBookingError('');
    setBookingStep('checkout');
  };

  // Submit Booking & Execute Payment
  const handleConfirmBooking = async () => {
    if (!walletAddress && paymentMode === PAYMENT_MODES.DIRECT_HUMAN) {
      onConnectWallet();
      return;
    }
    setIsSubmitting(true);
    setBookingError('');

    try {
      const isAgentActor = paymentMode === PAYMENT_MODES.AGENT_VAULT;
      const booking = await createBookingRequest({
        serviceId: selectedService.id,
        customerTag: effectiveCustomerTag,
        customerAddress: walletAddress,
        customerName: customerName || `₦${effectiveCustomerTag.toUpperCase()}`,
        slotStartTime: selectedSlot.startTime,
        slotEndTime: selectedSlot.endTime,
        customerNotes,
        isAgent: isAgentActor,
        agentSession: altanaSession,
      });

      // If instant booking, proceed immediately to payment settlement
      if (booking.status === BOOKING_STATUS.PENDING_PAYMENT) {
        const confirmed = await confirmBookingPayment({
          bookingId: booking.id,
          paymentDetails: { txHash: null }, // Trigger simulation settlement
          altanaSession: isAgentActor ? altanaSession : null,
          humanSelfProof: isAgentActor ? humanSelfProof : null,
          isSimulation: true,
        });
        setCreatedBooking(confirmed);
      } else {
        setCreatedBooking(booking);
      }

      setBookingStep('success');
      refreshBookings();
    } catch (err) {
      setBookingError(err.message || 'Booking reservation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Provider Accept
  const handleProviderAccept = async (bookingId) => {
    try {
      providerAcceptBooking(bookingId, { tag: activeAgentTag || 'music', role: 'admin' });
      refreshBookings();
    } catch (err) {
      alert(`Accept failed: ${err.message}`);
    }
  };

  // Provider Reject
  const handleProviderReject = async (bookingId) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    try {
      providerRejectBooking(bookingId, reason, { tag: activeAgentTag || 'music', role: 'admin' });
      refreshBookings();
    } catch (err) {
      alert(`Reject failed: ${err.message}`);
    }
  };

  // Customer Cancel
  const handleCancelBooking = (bookingId) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      cancelBooking(bookingId, 'Customer requested cancellation', {
        tag: effectiveCustomerTag,
        address: walletAddress,
      });
      refreshBookings();
    } catch (err) {
      alert(`Cancellation failed: ${err.message}`);
    }
  };

  // Create Service Handler
  const handleCreateServiceSubmit = (e) => {
    e.preventDefault();
    try {
      const id = `srv_${newServiceForm.category}_${Date.now()}`;
      registerService({
        id,
        agentTag: activeAgentTag || 'nairatag',
        title: newServiceForm.title,
        description: newServiceForm.description,
        category: newServiceForm.category,
        pricingModel: newServiceForm.pricingModel,
        price: newServiceForm.price,
        currency: newServiceForm.currency,
        durationMinutes: Number(newServiceForm.durationMinutes),
        bookingMode: newServiceForm.bookingMode,
        requiresSelfVerification: newServiceForm.requiresSelfVerification,
        active: true,
      }, { role: 'admin' });

      setIsCreateServiceOpen(false);
      setNewServiceForm({
        title: '',
        description: '',
        category: 'development',
        pricingModel: PRICING_MODELS.FIXED,
        price: '25.00',
        currency: 'USDT',
        durationMinutes: 60,
        bookingMode: BOOKING_MODES.INSTANT,
        requiresSelfVerification: false,
      });
    } catch (err) {
      alert(`Failed to create service: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', width: '100%' }}>
      {/* ── Sub Navigation Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={22} color="#059669" />
            <span>Discover Services</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary, #64748b)' }}>
            Book services from sovereign AI agents and specialists across NairaTag on Celo.
          </p>
        </div>

        {/* View Switcher Pills */}
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--surface-2, #f1f5f9)',
            padding: '3px',
            borderRadius: '9999px',
            border: '1px solid var(--border-color, rgba(0,0,0,0.06))',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveSubTab('discover')}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              border: 'none',
              background: activeSubTab === 'discover' ? '#fff' : 'transparent',
              color: activeSubTab === 'discover' ? '#059669' : 'inherit',
              fontWeight: activeSubTab === 'discover' ? 700 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              boxShadow: activeSubTab === 'discover' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Services Catalog
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('my_bookings')}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              border: 'none',
              background: activeSubTab === 'my_bookings' ? '#fff' : 'transparent',
              color: activeSubTab === 'my_bookings' ? '#059669' : 'inherit',
              fontWeight: activeSubTab === 'my_bookings' ? 700 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              boxShadow: activeSubTab === 'my_bookings' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span>My Bookings</span>
            {myBookings.length > 0 && (
              <span style={{ fontSize: '10px', background: '#059669', color: '#fff', padding: '1px 5px', borderRadius: '8px' }}>
                {myBookings.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('provider_dashboard')}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              border: 'none',
              background: activeSubTab === 'provider_dashboard' ? '#fff' : 'transparent',
              color: activeSubTab === 'provider_dashboard' ? '#059669' : 'inherit',
              fontWeight: activeSubTab === 'provider_dashboard' ? 700 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              boxShadow: activeSubTab === 'provider_dashboard' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Provider Portal
          </button>
        </div>
      </div>

      {/* ── SUB-TAB 1: DISCOVER SERVICES ── */}
      {activeSubTab === 'discover' && (
        <>
          {/* Search Bar & Category Scroller */}
          <div style={{ marginBottom: '18px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--card-bg, #fff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                padding: '9px 14px',
                borderRadius: '12px',
                marginBottom: '12px',
              }}
            >
              <Search size={16} color="var(--text-secondary, #94a3b8)" />
              <input
                type="text"
                placeholder="Search services, agents, or capabilities (e.g. Mixing, Smart Contract, GPU)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  background: 'none',
                  width: '100%',
                  fontSize: '13.5px',
                  outline: 'none',
                  color: 'inherit',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category Chips */}
            <div
              style={{
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                paddingBottom: '6px',
                scrollbarWidth: 'none',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: selectedCategory === null ? 700 : 500,
                  border: selectedCategory === null ? '1px solid #059669' : '1px solid var(--border-color, #e2e8f0)',
                  background: selectedCategory === null ? 'rgba(5, 150, 105, 0.08)' : 'var(--card-bg, #fff)',
                  color: selectedCategory === null ? '#059669' : 'inherit',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                All Categories
              </button>
              {BOOKING_CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.id] || Sparkles;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      border: isSelected ? '1px solid #059669' : '1px solid var(--border-color, #e2e8f0)',
                      background: isSelected ? 'rgba(5, 150, 105, 0.08)' : 'var(--card-bg, #fff)',
                      color: isSelected ? '#059669' : 'inherit',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Icon size={12} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
              gap: '16px',
            }}
          >
            {servicesList.map((service) => {
              const CategoryIcon = CATEGORY_ICONS[service.category] || Sparkles;
              return (
                <article
                  key={service.id}
                  style={{
                    background: 'var(--card-bg, #fff)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '16px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  <div>
                    {/* Provider Tag & Mode Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#059669',
                            background: 'rgba(5, 150, 105, 0.08)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          {service.canonicalTag}
                        </span>
                        {service.requiresSelfVerification && (
                          <span
                            title="Requires Self Protocol Zero-Knowledge Human Verification"
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#0D9488',
                              background: 'rgba(13, 148, 136, 0.1)',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <ShieldCheck size={11} />
                            <span>Self ZK</span>
                          </span>
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 600,
                          color: service.bookingMode === BOOKING_MODES.INSTANT ? '#059669' : '#d97706',
                          background: service.bookingMode === BOOKING_MODES.INSTANT ? 'rgba(5, 150, 105, 0.06)' : 'rgba(217, 119, 6, 0.08)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {service.bookingMode === BOOKING_MODES.INSTANT ? '⚡ Instant' : '⏳ Approval'}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px 0', lineHeight: 1.3 }}>
                      {service.title}
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', margin: '0 0 14px 0', lineHeight: 1.45 }}>
                      {service.description}
                    </p>
                  </div>

                  {/* Pricing & Booking CTA Footer */}
                  <div
                    style={{
                      borderTop: '1px solid var(--border-color, #f1f5f9)',
                      paddingTop: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>
                        {service.price} {service.currency}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                        {service.durationMinutes} min session
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedService(service);
                        setSelectedSlot(null);
                        setBookingStep('schedule');
                        setBookingError('');
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                        color: '#fff',
                        border: 'none',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <span>Book Slot</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {!servicesList.length && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <p>No services matched your query. Try broadening your search or select another category.</p>
            </div>
          )}
        </>
      )}

      {/* ── SUB-TAB 2: MY BOOKINGS ── */}
      {activeSubTab === 'my_bookings' && (
        <div style={{ background: 'var(--card-bg, #fff)', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)', padding: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>My Service Bookings</h2>

          {myBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <Calendar size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>No bookings yet.</p>
              <p style={{ fontSize: '12px', margin: '4px 0 16px' }}>Discover and reserve services offered by sovereign agents across NairaTag.</p>
              <button
                type="button"
                onClick={() => setActiveSubTab('discover')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Browse Services
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {myBookings.map((b) => (
                <div
                  key={b.id}
                  style={{
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{b.serviceTitle}</span>
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>{b.providerCanonicalTag}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                      📅 {new Date(b.slotStartTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      {' · '}{b.durationMinutes} mins · {b.price} {b.currency}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        textTransform: 'uppercase',
                        background:
                          b.status === BOOKING_STATUS.CONFIRMED ? 'rgba(5, 150, 105, 0.1)' :
                          b.status === BOOKING_STATUS.PENDING_PROVIDER_APPROVAL ? 'rgba(217, 119, 6, 0.1)' :
                          b.status === BOOKING_STATUS.CANCELLED ? 'rgba(220, 38, 38, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                        color:
                          b.status === BOOKING_STATUS.CONFIRMED ? '#059669' :
                          b.status === BOOKING_STATUS.PENDING_PROVIDER_APPROVAL ? '#d97706' :
                          b.status === BOOKING_STATUS.CANCELLED ? '#dc2626' : '#64748b',
                      }}
                    >
                      {b.status.replace(/_/g, ' ')}
                    </span>

                    {![BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED].includes(b.status) && (
                      <button
                        type="button"
                        onClick={() => handleCancelBooking(b.id)}
                        style={{
                          background: 'none',
                          border: '1px solid #e2e8f0',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          color: '#dc2626',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SUB-TAB 3: PROVIDER DASHBOARD ── */}
      {activeSubTab === 'provider_dashboard' && (
        <div style={{ background: 'var(--card-bg, #fff)', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Agent Provider Management</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                Manage bookable services and approve incoming reservations for ₦{(activeAgentTag || 'nairatag').toUpperCase()}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateServiceOpen(true)}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                background: '#059669',
                color: '#fff',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <PlusCircle size={13} />
              <span>Publish Service</span>
            </button>
          </div>

          <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '20px 0 10px' }}>Incoming Booking Requests</h3>
          {providerBookings.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#64748b' }}>No pending bookings for your agent.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {providerBookings.map((b) => (
                <div
                  key={b.id}
                  style={{
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{b.serviceTitle}</div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      Customer: {b.customerName} · {b.price} {b.currency}
                    </div>
                  </div>

                  {b.status === BOOKING_STATUS.PENDING_PROVIDER_APPROVAL ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleProviderAccept(b.id)}
                        style={{ padding: '5px 12px', borderRadius: '6px', background: '#059669', color: '#fff', border: 'none', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleProviderReject(b.id)}
                        style={{ padding: '5px 12px', borderRadius: '6px', background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', border: 'none', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669' }}>
                      {b.status.toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BOOKING MODAL & CHECKOUT ── */}
      {selectedService && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            style={{
              background: 'var(--card-bg, #fff)',
              borderRadius: '20px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                  {selectedService.canonicalTag}
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0' }}>{selectedService.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedService(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {bookingError && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(220, 38, 38, 0.08)', color: '#dc2626', fontSize: '12px', marginBottom: '14px', display: 'flex', gap: '6px' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{bookingError}</span>
              </div>
            )}

            {/* STEP 1: SCHEDULE PICKER */}
            {bookingStep === 'schedule' && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Select Session Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedSlot(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'var(--surface-1, #f8fafc)',
                    fontSize: '13px',
                    marginBottom: '16px',
                    outline: 'none',
                  }}
                />

                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '8px' }}>
                  Available Working Hour Slots (Preserving Provider Timezone)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', maxHeight: '180px', overflowY: 'auto', marginBottom: '20px' }}>
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.startTime}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => setSelectedSlot(slot)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: selectedSlot?.startTime === slot.startTime ? '2px solid #059669' : '1px solid var(--border-color, #e2e8f0)',
                        background: selectedSlot?.startTime === slot.startTime ? 'rgba(5, 150, 105, 0.1)' : slot.available ? 'var(--card-bg, #fff)' : '#f1f5f9',
                        color: slot.available ? 'inherit' : '#94a3b8',
                        fontSize: '12px',
                        fontWeight: selectedSlot?.startTime === slot.startTime ? 700 : 500,
                        cursor: slot.available ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {slot.timeLabel}
                    </button>
                  ))}
                  {!availableSlots.length && (
                    <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '16px' }}>
                      No available slots on this date. Please pick another date.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!selectedSlot}
                  onClick={handleProceedToCheckout}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: selectedSlot ? '#059669' : '#94a3b8',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    cursor: selectedSlot ? 'pointer' : 'not-allowed',
                  }}
                >
                  Proceed to Checkout
                </button>
              </div>
            )}

            {/* STEP 2: CHECKOUT & PAYMENT SELECTION */}
            {bookingStep === 'checkout' && (
              <div>
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Date & Time</span>
                    <span style={{ fontWeight: 600 }}>{selectedSlot?.timeLabel} ({selectedDate})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Duration</span>
                    <span style={{ fontWeight: 600 }}>{selectedService.durationMinutes} minutes</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Total Fee</span>
                    <span style={{ fontWeight: 800, color: '#059669' }}>{selectedService.price} {selectedService.currency}</span>
                  </div>
                </div>

                {/* Payment Route Selector */}
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '8px' }}>
                  Payment Authorization Route
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setPaymentMode(PAYMENT_MODES.DIRECT_HUMAN)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: paymentMode === PAYMENT_MODES.DIRECT_HUMAN ? '2px solid #059669' : '1px solid #cbd5e1',
                      background: paymentMode === PAYMENT_MODES.DIRECT_HUMAN ? 'rgba(5, 150, 105, 0.08)' : 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, fontSize: '12.5px' }}>
                      <User size={13} color="#059669" />
                      <span>Direct Wallet</span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                      Human EVM signature
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode(PAYMENT_MODES.AGENT_VAULT)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: paymentMode === PAYMENT_MODES.AGENT_VAULT ? '2px solid #2563EB' : '1px solid #cbd5e1',
                      background: paymentMode === PAYMENT_MODES.AGENT_VAULT ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, fontSize: '12.5px', color: '#2563EB' }}>
                      <Bot size={13} />
                      <span>Agent Vault</span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                      Altana Session + Self ZK
                    </div>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmBooking}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: '#059669',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    cursor: isSubmitting ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Settling on Celo Mainnet...</span>
                    </>
                  ) : (
                    <span>Authorize & Confirm Booking</span>
                  )}
                </button>
              </div>
            )}

            {/* STEP 3: SUCCESS */}
            {bookingStep === 'success' && createdBooking && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <CheckCircle2 size={42} color="#059669" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0' }}>Booking Reserved!</h4>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
                  Reference ID: <code style={{ fontWeight: 700, color: '#059669' }}>{createdBooking.id}</code>
                </p>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', fontSize: '12px', textAlign: 'left', marginBottom: '18px' }}>
                  <div>Status: <strong>{createdBooking.status.toUpperCase()}</strong></div>
                  <div>Provider: <strong>{createdBooking.providerCanonicalTag}</strong></div>
                  <div>Settlement: <strong>{createdBooking.price} {createdBooking.currency}</strong></div>
                  {createdBooking.paymentTxHash && (
                    <div style={{ fontSize: '10.5px', color: '#059669', wordBreak: 'break-all', marginTop: '4px' }}>
                      Tx: {createdBooking.paymentTxHash}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedService(null);
                    setActiveSubTab('my_bookings');
                  }}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '10px',
                    background: '#059669',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  View in My Bookings
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CREATE SERVICE MODAL (PROVIDER) ── */}
      {isCreateServiceOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
            backdropFilter: 'blur(3px)',
          }}
        >
          <form
            onSubmit={handleCreateServiceSubmit}
            style={{
              background: 'var(--card-bg, #fff)',
              borderRadius: '20px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>Publish Bookable Service</h3>
              <button
                type="button"
                onClick={() => setIsCreateServiceOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Service Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Masterclass Consultation"
                  value={newServiceForm.title}
                  onChange={(e) => setNewServiceForm({ ...newServiceForm, title: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea
                  rows={2}
                  required
                  placeholder="What will the customer or agent receive?"
                  value={newServiceForm.description}
                  onChange={(e) => setNewServiceForm({ ...newServiceForm, description: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Category</label>
                  <select
                    value={newServiceForm.category}
                    onChange={(e) => setNewServiceForm({ ...newServiceForm, category: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  >
                    {BOOKING_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Price (USDT)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newServiceForm.price}
                    onChange={(e) => setNewServiceForm({ ...newServiceForm, price: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Duration (Mins)</label>
                  <input
                    type="number"
                    step="15"
                    value={newServiceForm.durationMinutes}
                    onChange={(e) => setNewServiceForm({ ...newServiceForm, durationMinutes: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Booking Mode</label>
                  <select
                    value={newServiceForm.bookingMode}
                    onChange={(e) => setNewServiceForm({ ...newServiceForm, bookingMode: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  >
                    <option value={BOOKING_MODES.INSTANT}>⚡ Instant Booking</option>
                    <option value={BOOKING_MODES.APPROVAL_REQUIRED}>⏳ Approval Required</option>
                  </select>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={newServiceForm.requiresSelfVerification}
                  onChange={(e) => setNewServiceForm({ ...newServiceForm, requiresSelfVerification: e.target.checked })}
                />
                <span>Require Self Protocol ZK Human Verification</span>
              </label>

              <button
                type="submit"
                style={{
                  marginTop: '8px',
                  width: '100%',
                  padding: '11px',
                  borderRadius: '10px',
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Publish to NairaTag Marketplace
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
