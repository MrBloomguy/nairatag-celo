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
  ArrowLeft,
  Share2,
  Check,
  CheckSquare,
  MessageSquare,
  Shield,
  Wallet,
  MoreVertical,
  Send,
  AlertTriangle,
  Fingerprint,
  FileText,
  Key,
} from 'lucide-react';
import PanoramicWalkthroughView from './PanoramicWalkthroughView.jsx';
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
  // Navigation Tabs: 'discover' | 'agent_chat' | 'my_bookings' | 'provider_dashboard'
  const [activeSubTab, setActiveSubTab] = useState('discover');

  // Booking Flow Steps: 'discover' | 'details' | 'schedule' | 'review' | 'created' | 'confirmed_details'
  const [currentStep, setCurrentStep] = useState('discover');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Selected Service for Details / Booking
  const [selectedService, setSelectedService] = useState(null);

  // Scheduling State
  const [selectedDate, setSelectedDate] = useState('2026-11-23');
  const [selectedSlotTime, setSelectedSlotTime] = useState('10:00 AM');
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Review & Notes State
  const [customerName, setCustomerName] = useState('JD');
  const [customerNotes, setCustomerNotes] = useState('I need a two-hour recording and mixing session.');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('vault'); // 'vault' | 'direct'
  const [vaultScenario, setVaultScenario] = useState('active'); // 'active' | 'exceeded' | 'expired' | 'revoked'
  const [isPasskeyApproved, setIsPasskeyApproved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [activeBookingRecord, setActiveBookingRecord] = useState(null);

  // My Bookings & Provider Bookings Lists
  const [myBookings, setMyBookings] = useState([]);
  const [providerBookings, setProviderBookings] = useState([]);

  // Create Service Modal
  const [isCreateServiceOpen, setIsCreateServiceOpen] = useState(false);
  const [newServiceForm, setNewServiceForm] = useState({
    title: '',
    description: '',
    category: 'development',
    pricingModel: PRICING_MODELS.FIXED,
    price: '50000',
    currency: 'cNGN',
    durationMinutes: 60,
    bookingMode: BOOKING_MODES.INSTANT,
    requiresSelfVerification: false,
  });

  // Interactive Booking Agent Chat Messages
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'msg_1',
      sender: 'user',
      text: 'Find me a music producer. I need a two-hour session next Monday.',
      timestamp: '10:02 AM',
    },
    {
      id: 'msg_2',
      sender: 'agent',
      text: 'I found 3 agents offering music production. Here are the available services and prices. Would you like to compare them or view the available time slots?',
      timestamp: '10:02 AM',
    },
    {
      id: 'msg_3',
      sender: 'user',
      text: 'Show me ₦MUSIC. Book the 10 AM slot.',
      timestamp: '10:03 AM',
    },
    {
      id: 'msg_4',
      sender: 'agent',
      text: "₦MUSIC has a two-hour session at ₦50,000. I've prepared your booking for Mon, Nov 23 at 10 AM. Would you like to authorize payment through Agent Vault or pay directly?",
      timestamp: '10:03 AM',
      actions: ['Authorize via Agent Vault', 'Pay directly'],
    },
  ]);
  const [chatInput, setChatInput] = useState('');

  const effectiveCustomerTag = activeAgentTag || (walletAddress ? `celo_${walletAddress.slice(2, 8)}` : 'jd');

  // Load services
  const servicesList = useMemo(() => {
    return searchServices({
      query: searchQuery,
      category: selectedCategory,
      activeOnly: true,
    });
  }, [searchQuery, selectedCategory]);

  // Load default selected service (₦MUSIC)
  useEffect(() => {
    if (!selectedService && servicesList.length > 0) {
      const musicService = servicesList.find((s) => s.agentTag === 'music') || servicesList[0];
      setSelectedService(musicService);
    }
  }, [servicesList]);

  // Load bookings
  const refreshBookings = () => {
    setMyBookings(listCustomerBookings(effectiveCustomerTag));
    if (activeAgentTag) {
      setProviderBookings(listProviderBookings(activeAgentTag));
    }
  };

  useEffect(() => {
    refreshBookings();
  }, [walletAddress, activeAgentTag]);

  // Generate Available Slots for Selected Service
  const availableSlots = useMemo(() => {
    if (!selectedService || !selectedDate) return [];
    const existing = listProviderBookings(selectedService.agentTag);
    return getAvailableSlots(selectedService, selectedDate, existing);
  }, [selectedService, selectedDate]);

  // Mock Calendar Dates for Pill Bar
  const datePills = [
    { label: 'Mon', sub: 'Nov 23', dateStr: '2026-11-23' },
    { label: 'Tue', sub: 'Nov 24', dateStr: '2026-11-24' },
    { label: 'Wed', sub: 'Nov 25', dateStr: '2026-11-25' },
    { label: 'Thu', sub: 'Nov 26', dateStr: '2026-11-26' },
    { label: 'Fri', sub: 'Nov 27', dateStr: '2026-11-27' },
    { label: 'Sat', sub: 'Nov 28', dateStr: '2026-11-28' },
  ];

  const timeSlotButtons = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM'];

  // Handle Request Booking
  const handleRequestBooking = async () => {
    setIsSubmitting(true);
    setBookingError('');

    try {
      const isAgentPayment = selectedPaymentMethod === 'vault';
      const slotStart = `${selectedDate}T10:00:00.000Z`;
      const slotEnd = `${selectedDate}T12:00:00.000Z`;

      const booking = await createBookingRequest({
        serviceId: selectedService.id,
        customerTag: effectiveCustomerTag,
        customerAddress: walletAddress || '0x653f773C9062e71A6554b42a9525fcD47fCC1693',
        customerName: customerName || 'JD',
        slotStartTime: slotStart,
        slotEndTime: slotEnd,
        customerNotes,
        isAgent: isAgentPayment,
        agentSession: altanaSession,
      });

      // If Agent Vault or instant, confirm payment
      if (booking.status === BOOKING_STATUS.PENDING_PAYMENT) {
        const confirmed = await confirmBookingPayment({
          bookingId: booking.id,
          paymentDetails: {},
          altanaSession: isAgentPayment ? {
            spendLimit: 100000,
            remainingBudget: 100000,
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            revoked: false,
          } : null,
          humanSelfProof,
          isSimulation: true,
        });
        setActiveBookingRecord(confirmed);
      } else {
        setActiveBookingRecord(booking);
      }

      setCurrentStep('created');
      refreshBookings();
    } catch (err) {
      setBookingError(err.message || 'Failed to create booking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Provider Actions
  const handleProviderAccept = async (bookingId) => {
    try {
      providerAcceptBooking(bookingId, { tag: activeAgentTag || 'music', role: 'admin' });
      refreshBookings();
    } catch (err) {
      alert(`Accept failed: ${err.message}`);
    }
  };

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

  // Handle Chat Send
  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');

    setTimeout(() => {
      const agentMsg = {
        id: `msg_resp_${Date.now()}`,
        sender: 'agent',
        text: `I've prepared your request for ₦${selectedService?.agentTag?.toUpperCase() || 'MUSIC'}. Ready to reserve your session at 10:00 AM.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: ['Authorize via Agent Vault', 'Pay directly'],
      };
      setChatMessages((prev) => [...prev, agentMsg]);
    }, 600);
  };

  return (
    <div style={{ maxWidth: currentStep === 'walkthrough' ? '1440px' : '1040px', margin: '0 auto', width: '100%', fontFamily: 'inherit' }}>
      {/* ── Sub Navigation Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
            <Calendar size={22} color="#059669" />
            <span>NairaTag Bookings</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Native booking engine & agent service marketplace on Celo Mainnet.
          </p>
        </div>

        {/* View Switcher Pills */}
        <div
          style={{
            display: 'inline-flex',
            background: '#f1f5f9',
            padding: '3px',
            borderRadius: '9999px',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <button
            type="button"
            onClick={() => { setActiveSubTab('discover'); setCurrentStep('discover'); }}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              border: 'none',
              background: (activeSubTab === 'discover' && currentStep !== 'walkthrough') ? '#fff' : 'transparent',
              color: (activeSubTab === 'discover' && currentStep !== 'walkthrough') ? '#059669' : '#475569',
              fontWeight: (activeSubTab === 'discover' && currentStep !== 'walkthrough') ? 700 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              boxShadow: (activeSubTab === 'discover' && currentStep !== 'walkthrough') ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Discover Services
          </button>
          <button
            type="button"
            onClick={() => { setActiveSubTab('discover'); setCurrentStep('walkthrough'); }}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              border: 'none',
              background: (activeSubTab === 'discover' && currentStep === 'walkthrough') ? '#fff' : 'transparent',
              color: (activeSubTab === 'discover' && currentStep === 'walkthrough') ? '#059669' : '#475569',
              fontWeight: (activeSubTab === 'discover' && currentStep === 'walkthrough') ? 700 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              boxShadow: (activeSubTab === 'discover' && currentStep === 'walkthrough') ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Sparkles size={13} color={(activeSubTab === 'discover' && currentStep === 'walkthrough') ? '#059669' : '#64748b'} />
            <span>Walkthrough Grid (7 Views)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('agent_chat')}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              border: 'none',
              background: activeSubTab === 'agent_chat' ? '#fff' : 'transparent',
              color: activeSubTab === 'agent_chat' ? '#059669' : '#475569',
              fontWeight: activeSubTab === 'agent_chat' ? 700 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              boxShadow: activeSubTab === 'agent_chat' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Bot size={13} />
            <span>Booking Agent</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('my_bookings')}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              border: 'none',
              background: activeSubTab === 'my_bookings' ? '#fff' : 'transparent',
              color: activeSubTab === 'my_bookings' ? '#059669' : '#475569',
              fontWeight: activeSubTab === 'my_bookings' ? 700 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              boxShadow: activeSubTab === 'my_bookings' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <span>My Bookings</span>
            {myBookings.length > 0 && (
              <span style={{ marginLeft: 5, fontSize: '10px', background: '#059669', color: '#fff', padding: '1px 5px', borderRadius: '8px' }}>
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
              color: activeSubTab === 'provider_dashboard' ? '#059669' : '#475569',
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

      {/* ─────────────────────────────────────────────────────────────
          FLOW VIEW 0: PANORAMIC WALKTHROUGH (ALL 7 VIEWS)
          ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'discover' && currentStep === 'walkthrough' && (
        <PanoramicWalkthroughView
          servicesList={servicesList}
          selectedService={selectedService}
          setSelectedService={setSelectedService}
          setCurrentStep={setCurrentStep}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedSlotTime={selectedSlotTime}
          setSelectedSlotTime={setSelectedSlotTime}
          customerNotes={customerNotes}
          setCustomerNotes={setCustomerNotes}
          selectedPaymentMethod={selectedPaymentMethod}
          setSelectedPaymentMethod={setSelectedPaymentMethod}
          vaultScenario={vaultScenario}
          setVaultScenario={setVaultScenario}
          isPasskeyApproved={isPasskeyApproved}
          setIsPasskeyApproved={setIsPasskeyApproved}
          handleRequestBooking={handleRequestBooking}
          isSubmitting={isSubmitting}
          bookingError={bookingError}
          activeBookingRecord={activeBookingRecord}
          chatMessages={chatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          handleSendChatMessage={handleSendChatMessage}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          FLOW VIEW 1: DISCOVER SERVICES
          ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'discover' && currentStep === 'discover' && (
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0f172a', padding: 0 }}
                >
                  <ArrowLeft size={18} />
                </button>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Discover Services</h2>
              </div>
              <p style={{ margin: '4px 0 0 26px', fontSize: '13px', color: '#64748b' }}>
                Book services from agents across NairaTag
              </p>
            </div>

            {/* Search Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '10px 14px',
                marginBottom: '16px',
              }}
            >
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search services, agents or categories"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  background: 'none',
                  outline: 'none',
                  width: '100%',
                  fontSize: '13.5px',
                  color: '#0f172a',
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

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '9999px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  border: 'none',
                  background: selectedCategory === null ? '#059669' : '#f1f5f9',
                  color: selectedCategory === null ? '#fff' : '#475569',
                  cursor: 'pointer',
                }}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('music')}
                style={{
                  padding: '6px 16px',
                  borderRadius: '9999px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  border: 'none',
                  background: selectedCategory === 'music' ? '#059669' : '#f1f5f9',
                  color: selectedCategory === 'music' ? '#fff' : '#475569',
                  cursor: 'pointer',
                }}
              >
                Music
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('video')}
                style={{
                  padding: '6px 16px',
                  borderRadius: '9999px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  border: 'none',
                  background: selectedCategory === 'video' ? '#059669' : '#f1f5f9',
                  color: selectedCategory === 'video' ? '#fff' : '#475569',
                  cursor: 'pointer',
                }}
              >
                Video
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('design')}
                style={{
                  padding: '6px 16px',
                  borderRadius: '9999px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  border: 'none',
                  background: selectedCategory === 'design' ? '#059669' : '#f1f5f9',
                  color: selectedCategory === 'design' ? '#fff' : '#475569',
                  cursor: 'pointer',
                }}
              >
                Design
              </button>
            </div>

            {/* Service Cards Stack */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {servicesList.map((service) => (
                <div
                  key={service.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '16px',
                    background: '#fff',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'center',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  <img
                    src={service.image || 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=400&q=80'}
                    alt={service.title}
                    style={{
                      width: '84px',
                      height: '84px',
                      borderRadius: '12px',
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                        ₦{service.agentTag.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '10.5px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>
                        Bookable
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '2px' }}>
                      {service.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '8px' }}>
                      {service.description}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          <span>{Math.round(service.durationMinutes / 60)} hours</span>
                        </span>
                        <span style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                          ₦{Number(service.price).toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedService(service);
                          setCurrentStep('details');
                        }}
                        style={{
                          background: '#059669',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>View Service</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FLOW VIEW 2: SERVICE DETAILS
          ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'discover' && currentStep === 'details' && selectedService && (
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setCurrentStep('discover')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0f172a', padding: 0 }}
              >
                <ArrowLeft size={18} />
              </button>
              <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Service Details</h2>
            </div>

            {/* Studio Hero Image */}
            <div style={{ borderRadius: '14px', overflow: 'hidden', height: '180px', marginBottom: '16px', background: '#000' }}>
              <img
                src={selectedService.image || 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80'}
                alt={selectedService.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {/* Title & Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                ₦{selectedService.agentTag.toUpperCase()}
              </span>
              <span style={{ fontSize: '10.5px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>
                Bookable
              </span>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>
              {selectedService.title}
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.4 }}>
              {selectedService.description}
            </p>

            {/* Specs List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <Clock size={15} color="#64748b" />
                <span>{Math.round(selectedService.durationMinutes / 60)} hours</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <Tag size={15} color="#64748b" />
                <span style={{ fontWeight: 700 }}>₦{Number(selectedService.price).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <Calendar size={15} color="#64748b" />
                <span>Scheduled session</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <Wallet size={15} color="#64748b" />
                <span>{selectedService.currency}</span>
              </div>
            </div>

            {/* Info Callout */}
            <div
              style={{
                background: '#eff6ff',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                marginBottom: '20px',
                border: '1px solid #dbeafe',
              }}
            >
              <ShieldCheck size={18} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ margin: 0, fontSize: '12px', color: '#1e40af', lineHeight: 1.4 }}>
                This service is offered by an independent NairaTag agent. Availability will be checked before confirmation.
              </p>
            </div>

            {/* CTA Button */}
            <button
              type="button"
              onClick={() => setCurrentStep('schedule')}
              style={{
                width: '100%',
                background: '#059669',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span>Choose date & time</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FLOW VIEW 3: CHOOSE A TIME
          ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'discover' && currentStep === 'schedule' && selectedService && (
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setCurrentStep('details')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0f172a', padding: 0 }}
              >
                <ArrowLeft size={18} />
              </button>
              <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Choose a Time</h2>
            </div>

            {/* Select a date */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '10px' }}>
                Select a date
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {datePills.map((d) => {
                  const isSelected = selectedDate === d.dateStr;
                  return (
                    <button
                      key={d.dateStr}
                      type="button"
                      onClick={() => setSelectedDate(d.dateStr)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid #059669' : '1px solid #e2e8f0',
                        background: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{d.label}</span>
                        {isSelected && (
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#059669' }} />
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{d.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Available times */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '10px' }}>
                Available times
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {timeSlotButtons.map((timeStr) => {
                  const isSelected = selectedSlotTime === timeStr;
                  return (
                    <button
                      key={timeStr}
                      type="button"
                      onClick={() => setSelectedSlotTime(timeStr)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '10px',
                        border: isSelected ? 'none' : '1px solid #e2e8f0',
                        background: isSelected ? '#059669' : '#fff',
                        color: isSelected ? '#fff' : '#0f172a',
                        fontWeight: 700,
                        fontSize: '12.5px',
                        cursor: 'pointer',
                      }}
                    >
                      {timeStr}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Summary Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: '#f8fafc',
                }}
              >
                <Calendar size={16} color="#059669" />
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Selected date</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Mon, Nov 23</div>
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: '#f8fafc',
                }}
              >
                <Clock size={16} color="#059669" />
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Selected time</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{selectedSlotTime}</div>
                </div>
              </div>
            </div>

            {/* CTA Continue */}
            <button
              type="button"
              onClick={() => setCurrentStep('review')}
              style={{
                width: '100%',
                background: '#059669',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span>Continue</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FLOW VIEW 4: REVIEW BOOKING
          ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'discover' && currentStep === 'review' && selectedService && (
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setCurrentStep('schedule')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0f172a', padding: 0 }}
              >
                <ArrowLeft size={18} />
              </button>
              <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Review Booking</h2>
            </div>

            {/* Provider Card */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#15803d',
                  flexShrink: 0,
                }}
              >
                <Headphones size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                    ₦{selectedService.agentTag.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '9999px', fontWeight: 600 }}>
                    Selected
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {selectedService.title}
                </div>
              </div>
            </div>

            {/* Summary Key-Values */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> Date</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>Mon, Nov 23</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> Time</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{selectedSlotTime}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> Duration</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>2 hours</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Tag size={14} /> Service price</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>₦50,000</span>
              </div>
            </div>

            <div style={{ height: '1px', background: '#e2e8f0', margin: '14px 0' }} />

            {/* Total Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Total</span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>₦50,000</span>
            </div>

            {/* Notes for the provider */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                Notes for the provider
              </label>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                rows={2}
                style={{
                  width: '100%',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  padding: '9px 12px',
                  fontSize: '12.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0f172a',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Payment Method Selector */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                Payment method
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Option 1: Agent Vault */}
                <div
                  onClick={() => setSelectedPaymentMethod('vault')}
                  style={{
                    border: selectedPaymentMethod === 'vault' ? '2px solid #059669' : '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: selectedPaymentMethod === 'vault' ? 'rgba(5, 150, 105, 0.03)' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selectedPaymentMethod === 'vault' && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>Agent Vault</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Allow an authorized agent to pay.</div>
                    </div>
                  </div>
                  <ArrowRight size={14} color="#94a3b8" />
                </div>

                {/* Option 2: Pay directly */}
                <div
                  onClick={() => setSelectedPaymentMethod('direct')}
                  style={{
                    border: selectedPaymentMethod === 'direct' ? '2px solid #059669' : '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: selectedPaymentMethod === 'direct' ? 'rgba(5, 150, 105, 0.03)' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selectedPaymentMethod === 'direct' && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>Pay directly</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Authorize payment yourself.</div>
                    </div>
                  </div>
                  <ArrowRight size={14} color="#94a3b8" />
                </div>
              </div>
            </div>

            {/* Embedded Agent Vault Authorization Panel */}
            {selectedPaymentMethod === 'vault' && (
              <div
                style={{
                  marginTop: '16px',
                  marginBottom: '18px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '14px',
                  padding: '16px',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} color="#059669" />
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Agent payment authorization</span>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      background: '#e0e7ff',
                      color: '#4338ca',
                      padding: '3px 8px',
                      borderRadius: '9999px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Key size={11} />
                    <span>Altana wallet</span>
                  </span>
                </div>

                {/* Provider & Service Row */}
                <div
                  style={{
                    background: '#fff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '10px 12px',
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                      ₦{selectedService.agentTag?.toUpperCase() || 'MUSIC'}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      {selectedService.title || 'Two-hour production session'}
                    </div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                    ₦50,000
                  </div>
                </div>

                {/* Authorization Detail Table */}
                <div
                  style={{
                    background: '#fff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    marginBottom: '12px',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Agent wallet</span>
                    <span style={{ fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />
                      <span>Connected (0x71C2...b1D)</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Spending limit</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>
                      {vaultScenario === 'exceeded' && !isPasskeyApproved ? '₦40,000' : '₦60,000'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Requested payment</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>₦50,000</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Recipient</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>₦MUSIC provider (0x653f...1693)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px' }}>
                    <span style={{ color: '#64748b' }}>Session status</span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: (vaultScenario === 'expired' || vaultScenario === 'revoked') ? '#dc2626' : '#059669',
                      }}
                    >
                      {vaultScenario === 'expired' ? 'Expired' : vaultScenario === 'revoked' ? 'Revoked' : 'Active'}
                    </span>
                  </div>
                </div>

                {/* Status Callout Box */}
                {vaultScenario === 'active' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#059669',
                      background: '#dcfce7',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      marginBottom: '12px',
                    }}
                  >
                    <Check size={14} strokeWidth={3} />
                    <span>Within authorized spending limit</span>
                  </div>
                )}

                {vaultScenario === 'exceeded' && !isPasskeyApproved && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '6px',
                      color: '#b45309',
                      background: '#fef3c7',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      marginBottom: '12px',
                    }}
                  >
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>Requested payment (₦50,000) exceeds session limit (₦40,000). Biometric passkey required.</span>
                  </div>
                )}

                {vaultScenario === 'exceeded' && isPasskeyApproved && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#059669',
                      background: '#dcfce7',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      marginBottom: '12px',
                    }}
                  >
                    <Check size={14} strokeWidth={3} />
                    <span>Biometric passkey verified · One-time limit increased to ₦60,000</span>
                  </div>
                )}

                {vaultScenario === 'expired' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#dc2626',
                      background: '#fee2e2',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      marginBottom: '12px',
                    }}
                  >
                    <AlertTriangle size={14} />
                    <span>Altana session expired. Please renew your session in Wallets tab.</span>
                  </div>
                )}

                {vaultScenario === 'revoked' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#dc2626',
                      background: '#fee2e2',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      marginBottom: '12px',
                    }}
                  >
                    <AlertTriangle size={14} />
                    <span>Altana session key was revoked by user. Autonomous spending blocked.</span>
                  </div>
                )}

                {/* Explainer */}
                <div
                  style={{
                    padding: '10px 12px',
                    background: '#f1f5f9',
                    borderRadius: '8px',
                    borderLeft: '3px solid #059669',
                    marginBottom: '12px',
                  }}
                >
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>
                    Protected agent spending
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                    The agent can only execute transactions permitted by the user's active authorization. Recipient, amount, token and booking must be validated before execution.
                  </div>
                </div>

                {/* Edge State Simulator for Hackathon Judges */}
                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '10px', marginTop: '6px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Demo Edge-Case Simulator (Judge Testing)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => { setVaultScenario('active'); setIsPasskeyApproved(false); }}
                      style={{
                        fontSize: '11px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: vaultScenario === 'active' ? '1px solid #059669' : '1px solid #cbd5e1',
                        background: vaultScenario === 'active' ? '#ecfdf5' : '#fff',
                        color: vaultScenario === 'active' ? '#059669' : '#475569',
                        cursor: 'pointer',
                        fontWeight: vaultScenario === 'active' ? 700 : 500,
                      }}
                    >
                      ✓ Active (Within Limit)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setVaultScenario('exceeded'); setIsPasskeyApproved(false); }}
                      style={{
                        fontSize: '11px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: vaultScenario === 'exceeded' ? '1px solid #b45309' : '1px solid #cbd5e1',
                        background: vaultScenario === 'exceeded' ? '#fef3c7' : '#fff',
                        color: vaultScenario === 'exceeded' ? '#b45309' : '#475569',
                        cursor: 'pointer',
                        fontWeight: vaultScenario === 'exceeded' ? 700 : 500,
                      }}
                    >
                      ⚠️ Over-Limit (Passkey)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setVaultScenario('expired'); setIsPasskeyApproved(false); }}
                      style={{
                        fontSize: '11px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: vaultScenario === 'expired' ? '1px solid #dc2626' : '1px solid #cbd5e1',
                        background: vaultScenario === 'expired' ? '#fee2e2' : '#fff',
                        color: vaultScenario === 'expired' ? '#dc2626' : '#475569',
                        cursor: 'pointer',
                        fontWeight: vaultScenario === 'expired' ? 700 : 500,
                      }}
                    >
                      ⌛ Expired Session
                    </button>
                    <button
                      type="button"
                      onClick={() => { setVaultScenario('revoked'); setIsPasskeyApproved(false); }}
                      style={{
                        fontSize: '11px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: vaultScenario === 'revoked' ? '1px solid #dc2626' : '1px solid #cbd5e1',
                        background: vaultScenario === 'revoked' ? '#fee2e2' : '#fff',
                        color: vaultScenario === 'revoked' ? '#dc2626' : '#475569',
                        cursor: 'pointer',
                        fontWeight: vaultScenario === 'revoked' ? 700 : 500,
                      }}
                    >
                      🚫 Revoked
                    </button>
                  </div>
                </div>
              </div>
            )}

            {bookingError && (
              <div style={{ padding: '8px 12px', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c', fontSize: '12px', marginBottom: '12px' }}>
                {bookingError}
              </div>
            )}

            {/* CTA Request Booking / Step-up */}
            {selectedPaymentMethod === 'vault' && vaultScenario === 'exceeded' && !isPasskeyApproved ? (
              <button
                type="button"
                onClick={() => setIsPasskeyApproved(true)}
                style={{
                  width: '100%',
                  background: '#d97706',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 6px -1px rgba(217, 119, 6, 0.2)',
                }}
              >
                <Fingerprint size={16} />
                <span>Approve with Biometric Passkey →</span>
              </button>
            ) : selectedPaymentMethod === 'vault' && (vaultScenario === 'expired' || vaultScenario === 'revoked') ? (
              <button
                type="button"
                disabled
                style={{
                  width: '100%',
                  background: '#94a3b8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>Session Inactive — Use Direct Pay</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleRequestBooking}
                style={{
                  width: '100%',
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                <span>{isSubmitting ? 'Requesting...' : 'Request Booking'}</span>
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FLOW VIEW 5: BOOKING REQUEST CREATED
          ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'discover' && currentStep === 'created' && (
        <div style={{ maxWidth: '440px', margin: '0 auto' }}>
          <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '32px 24px', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
            {/* Green Radiating Checkmark Icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#059669',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 0 0 8px rgba(5, 150, 105, 0.15)',
              }}
            >
              <Check size={32} strokeWidth={3} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>
              Booking Request Created
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
              Your request is ready for provider and payment checks.
            </p>

            {/* Details Table */}
            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px', fontSize: '12.5px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748b' }}>
                <span>Reference</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {activeBookingRecord?.id ? activeBookingRecord.id.replace('book_', 'NT-BOOK-').slice(0, 12).toUpperCase() : 'NT-BOOK-4829'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748b' }}>
                <span>Service</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>₦{selectedService?.agentTag?.toUpperCase() || 'MUSIC'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748b' }}>
                <span>Date</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>Mon, Nov 23</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748b' }}>
                <span>Time</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{selectedSlotTime}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748b' }}>
                <span>Payment Route</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {selectedPaymentMethod === 'vault' ? 'Agent Vault' : 'Direct'}
                </span>
              </div>
            </div>

            {/* Status Pill */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fef3c7', color: '#b45309', padding: '6px 14px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 600, marginBottom: '20px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#b45309' }} />
              <span>Pending provider / authorization checks</span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setCurrentStep('confirmed_details')}
                style={{
                  width: '100%',
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                View Confirmed Details
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep('discover')}
                style={{
                  width: '100%',
                  background: 'none',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Explore More Services
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FLOW VIEW 6: BOOKING DETAILS (CONFIRMED)
          ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'discover' && currentStep === 'confirmed_details' && (
        <div style={{ maxWidth: '540px', margin: '0 auto' }}>
          <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setCurrentStep('discover')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0f172a', padding: 0 }}
                >
                  <ArrowLeft size={18} />
                </button>
                <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Booking Details</h2>
              </div>
              <button
                type="button"
                onClick={() => alert('Booking link copied to clipboard!')}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                }}
              >
                <Share2 size={13} />
                <span>Share</span>
              </button>
            </div>

            {/* Provider Card */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#15803d',
                  }}
                >
                  <Headphones size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                    ₦{selectedService?.agentTag?.toUpperCase() || 'MUSIC'}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                    {selectedService?.title || 'Music production session'}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: '9999px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={12} strokeWidth={3} />
                <span>Confirmed</span>
              </span>
            </div>

            {/* 5-Stage Stepper */}
            <div style={{ marginBottom: '24px', padding: '0 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', height: '2px', background: '#e2e8f0', zIndex: 1 }} />
                <div style={{ position: 'absolute', top: '10px', left: '10px', width: '75%', height: '2px', background: '#059669', zIndex: 1 }} />

                {/* Stage 1 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                    <Check size={11} strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600 }}>Requested</span>
                </div>

                {/* Stage 2 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                    <Check size={11} strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600 }}>Provider accepted</span>
                </div>

                {/* Stage 3 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                    <Check size={11} strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600 }}>Awaiting payment</span>
                </div>

                {/* Stage 4 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                    <Check size={11} strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: '10px', color: '#059669', fontWeight: 700 }}>Confirmed</span>
                </div>

                {/* Stage 5 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', border: '2px solid #cbd5e1', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#cbd5e1' }} />
                  </div>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>In progress</span>
                </div>
              </div>
            </div>

            {/* Date & Meta Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                  <Calendar size={14} color="#64748b" />
                  <span>Mon, Nov 23, 2026 · {selectedSlotTime}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#64748b' }}>
                  <Clock size={13} color="#64748b" />
                  <span>2 hours</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Total</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>₦50,000</div>
              </div>
            </div>

            {/* Paid via Agent Vault Banner */}
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <ShieldCheck size={24} color="#059669" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#065f46' }}>
                  Paid via Agent Vault
                </div>
                <div style={{ fontSize: '12px', color: '#047857' }}>
                  Authorization complete. Your booking is confirmed.
                </div>
              </div>
            </div>

            {/* Agent Vault Settlement Receipt */}
            <div
              style={{
                marginTop: '16px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '14px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} color="#059669" />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Payment Settlement Receipt</span>
                </div>
                <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700 }}>
                  BOUND_AND_VERIFIED
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Altana Session Wallet</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>0x71C22998...b1D (EIP-7702)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Transaction Hash</span>
                  <a
                    href="https://celoscan.io/tx/0x250e11feca536de2e68722f82643be4dad3568bccc358d356dbf4b843c820436"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#059669', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <span>0x250e11fe...0436</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Settled Amount</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>₦50,000 cNGN (34.62 USD₮)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Recipient Gateway</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>0x653f773C...1693</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Protocol Attribution</span>
                  <span style={{ fontWeight: 600, color: '#475569' }}>celo_9f7deabd99a6 (ERC-8021)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Remaining Session Budget</span>
                  <span style={{ fontWeight: 700, color: '#059669' }}>₦10,000 cNGN</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FLOW VIEW 7: NAIRATAG BOOKING AGENT (INTERACTIVE CHAT)
          ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'agent_chat' && (
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
            {/* Chat Header */}
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: '#059669',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Bot size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                    NairaTag Booking Agent
                  </div>
                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                    Online · Ready to reserve slots
                  </div>
                </div>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <MoreVertical size={18} />
              </button>
            </div>

            {/* Chat Body */}
            <div style={{ padding: '20px', minHeight: '340px', maxHeight: '480px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {chatMessages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      gap: '8px',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                      alignItems: 'flex-start',
                    }}
                  >
                    {!isUser && (
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: '#dcfce7',
                          color: '#15803d',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      >
                        <Bot size={15} />
                      </div>
                    )}

                    <div style={{ maxWidth: '80%' }}>
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                          background: isUser ? '#eff6ff' : '#f8fafc',
                          border: isUser ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                          color: '#0f172a',
                          fontSize: '13px',
                          lineHeight: 1.4,
                        }}
                      >
                        {msg.text}
                      </div>

                      {msg.actions && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPaymentMethod('vault');
                              setActiveSubTab('discover');
                              setCurrentStep('review');
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: '#059669',
                              color: '#fff',
                              border: 'none',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Authorize via Agent Vault
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPaymentMethod('direct');
                              setActiveSubTab('discover');
                              setCurrentStep('review');
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: '#fff',
                              color: '#475569',
                              border: '1px solid #cbd5e1',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Pay directly
                          </button>
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: '#3b82f6',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      >
                        JD
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={handleSendChatMessage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                borderTop: '1px solid #e2e8f0',
                background: '#fff',
              }}
            >
              <input
                type="text"
                placeholder="Ask booking agent for services, dates, or prices..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  color: '#0f172a',
                }}
              />
              <button
                type="submit"
                style={{
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '9px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FLOW VIEW 8: MY BOOKINGS LIST
          ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'my_bookings' && (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#0f172a' }}>My Service Bookings</h2>

          {myBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <Calendar size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>No bookings yet.</p>
              <p style={{ fontSize: '12px', margin: '4px 0 16px' }}>Discover and reserve services offered by sovereign agents across NairaTag.</p>
              <button
                type="button"
                onClick={() => { setActiveSubTab('discover'); setCurrentStep('discover'); }}
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
                    border: '1px solid #e2e8f0',
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
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{b.serviceTitle}</span>
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>{b.providerCanonicalTag}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                      📅 {new Date(b.slotStartTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      {' · '}{b.durationMinutes} mins · ₦{Number(b.price).toLocaleString()} {b.currency}
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

      {/* ─────────────────────────────────────────────────────────────
          FLOW VIEW 9: PROVIDER PORTAL
          ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'provider_dashboard' && (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Agent Provider Management</h2>
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

          <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '20px 0 10px', color: '#0f172a' }}>Incoming Booking Requests</h3>
          {providerBookings.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#64748b' }}>No pending bookings for your agent.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {providerBookings.map((b) => (
                <div
                  key={b.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{b.serviceTitle}</div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      Customer: {b.customerName} · ₦{Number(b.price).toLocaleString()} {b.currency}
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
    </div>
  );
}
