import React, { useState, useEffect, useRef } from 'react';
import { WORKER_TRANSLATIONS } from '../i18n/workerTranslations.js';
import CollegeLogo from './CollegeLogo.jsx';

const API_BASE = typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80')
  ? ''
  : 'http://localhost:5000';

export default function WorkerPortal() {
  // Authentication & Session State
  const [authStatus, setAuthStatus] = useState('loading'); // 'loading' | 'authenticated' | 'unauthenticated'
  const [authenticatedWorker, setAuthenticatedWorker] = useState(null); // { id, name, role }

  // Login Form State
  const [loginWorkerId, setLoginWorkerId] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // App & Workflow State
  const [lang, setLang] = useState(() => localStorage.getItem('mrf_worker_lang') || 'en');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'all' | 'completed' | 'escalated'
  const [speakingTicketId, setSpeakingTicketId] = useState(null);

  // Modals state
  const [completeModalTicket, setCompleteModalTicket] = useState(null);
  const [cannotModalTicket, setCannotModalTicket] = useState(null);

  // Completion Form Inputs
  const [completePhoto, setCompletePhoto] = useState(null);
  const [completeNote, setCompleteNote] = useState('');
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voiceUrl, setVoiceUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Cannot Complete Form Inputs
  const [cannotReason, setCannotReason] = useState('Need Spare Part / Material');
  const [cannotDetails, setCannotDetails] = useState('');

  // Toast / Alert Notification State
  const [toastMessage, setToastMessage] = useState(null);

  const t = WORKER_TRANSLATIONS[lang] || WORKER_TRANSLATIONS.en;

  // Persist UI language preference
  useEffect(() => {
    localStorage.setItem('mrf_worker_lang', lang);
  }, [lang]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Check Active Worker Session (/api/worker/me)
  const checkSession = async () => {
    try {
      setAuthStatus('loading');
      const res = await fetch(`${API_BASE}/api/worker/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.worker) {
          setAuthenticatedWorker(data.worker);
          setAuthStatus('authenticated');
          fetchTickets();
          return;
        }
      }
      setAuthStatus('unauthenticated');
    } catch (err) {
      console.error('[WorkerPortal] Session check error:', err);
      setAuthStatus('unauthenticated');
    }
  };

  // Fetch Worker Assigned Tickets (/api/worker/tickets)
  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/worker/tickets`, { credentials: 'include' });
      if (res.status === 401) {
        setAuthStatus('unauthenticated');
        setAuthenticatedWorker(null);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setTickets(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('[WorkerPortal] Failed to fetch tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  // Polling assigned tickets every 10s when authenticated
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    const interval = setInterval(fetchTickets, 10000);
    return () => clearInterval(interval);
  }, [authStatus]);

  // Handle Worker Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginWorkerId.trim() || !loginPin.trim()) {
      setLoginError('Please enter both Worker ID and PIN.');
      return;
    }

    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await fetch(`${API_BASE}/api/worker/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workerId: loginWorkerId.trim(),
          pin: loginPin.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.authenticated && data.worker) {
        setAuthenticatedWorker(data.worker);
        setAuthStatus('authenticated');
        setLoginPin('');
        setLoginError(null);
        showToast(`Welcome, ${data.worker.name}!`);
        fetchTickets();
      } else {
        setLoginError(data.error || 'Invalid Worker ID or PIN.');
      }
    } catch (err) {
      setLoginError('Failed to connect to authentication server.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Worker Logout
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/worker/logout`, { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('[WorkerPortal] Logout error:', err);
    }
    setAuthenticatedWorker(null);
    setTickets([]);
    setAuthStatus('unauthenticated');
    showToast('Logged out successfully.');
  };

  // Text-To-Speech (Listen to Complaint)
  const handleListenComplaint = (ticket) => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-Speech is not supported in this browser.');
      return;
    }

    if (speakingTicketId === ticket.ticketNo) {
      window.speechSynthesis.cancel();
      setSpeakingTicketId(null);
      return;
    }

    window.speechSynthesis.cancel();

    const textToRead = `Complaint for ${ticket.issueCategory} at Block ${ticket.block || 'Campus'}, Room ${ticket.roomNo || 'N/A'}. ${ticket.description || ''}`;
    const utterance = new SpeechSynthesisUtterance(textToRead);

    if (lang === 'ta') utterance.lang = 'ta-IN';
    else if (lang === 'hi') utterance.lang = 'hi-IN';
    else utterance.lang = 'en-US';

    utterance.rate = 0.9;
    utterance.onend = () => setSpeakingTicketId(null);
    utterance.onerror = () => setSpeakingTicketId(null);

    setSpeakingTicketId(ticket.ticketNo);
    window.speechSynthesis.speak(utterance);
  };

  // Workflow Actions
  const handleStartWork = async (ticket) => {
    try {
      const res = await fetch(`${API_BASE}/api/worker/start-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ticketNo: ticket.ticketNo,
        }),
      });

      if (res.status === 401) {
        setAuthStatus('unauthenticated');
        alert('Session expired. Please log in again.');
        return;
      }

      if (res.status === 403) {
        alert('Forbidden: This ticket is not assigned to your account.');
        return;
      }

      if (res.ok) {
        showToast(t.workStartedSuccess);
        fetchTickets();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error || 'Failed to start work'}`);
      }
    } catch (err) {
      alert(`Error starting work: ${err.message}`);
    }
  };

  // Photo Upload Handler (Base64)
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompletePhoto(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Voice Note Recorder (MediaRecorder API)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setVoiceBlob(reader.result);
        };
        reader.readAsDataURL(audioBlob);
        setVoiceUrl(URL.createObjectURL(audioBlob));
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert(`Microphone access error: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  // Submit Work Completed
  const handleSubmitWorkCompleted = async (e) => {
    e.preventDefault();
    if (!completeModalTicket) return;

    try {
      const res = await fetch(`${API_BASE}/api/worker/complete-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ticketNo: completeModalTicket.ticketNo,
          photo: completePhoto,
          note: completeNote,
          voiceNote: voiceBlob,
        }),
      });

      if (res.status === 401) {
        setAuthStatus('unauthenticated');
        alert('Session expired. Please log in again.');
        return;
      }

      if (res.status === 403) {
        alert('Forbidden: This ticket is not assigned to your account.');
        return;
      }

      if (res.ok) {
        showToast(t.workCompletedSuccess);
        setCompleteModalTicket(null);
        setCompletePhoto(null);
        setCompleteNote('');
        setVoiceBlob(null);
        setVoiceUrl(null);
        fetchTickets();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error || 'Failed to complete work'}`);
      }
    } catch (err) {
      alert(`Error submitting work: ${err.message}`);
    }
  };

  // Submit Cannot Complete Escalation
  const handleSubmitCannotComplete = async (e) => {
    e.preventDefault();
    if (!cannotModalTicket) return;

    if (!cannotDetails.trim()) {
      alert('Please provide details for the administrator.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/worker/cannot-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ticketNo: cannotModalTicket.ticketNo,
          reason: cannotReason,
          details: cannotDetails,
        }),
      });

      if (res.status === 401) {
        setAuthStatus('unauthenticated');
        alert('Session expired. Please log in again.');
        return;
      }

      if (res.status === 403) {
        alert('Forbidden: This ticket is not assigned to your account.');
        return;
      }

      if (res.ok) {
        showToast(t.cannotCompleteSuccess);
        setCannotModalTicket(null);
        setCannotDetails('');
        fetchTickets();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error || 'Failed to escalate issue'}`);
      }
    } catch (err) {
      alert(`Error escalating issue: ${err.message}`);
    }
  };

  // Filter Tickets by Tab
  const filteredTickets = tickets.filter((ticket) => {
    if (activeTab === 'active') {
      return (
        ticket.status === 'Unsolved' ||
        ticket.status === 'Ongoing' ||
        ticket.status === 'Reopened'
      );
    }
    if (activeTab === 'completed') {
      return (
        ticket.status === 'Awaiting User Confirmation' ||
        ticket.status === 'Resolved' ||
        ticket.status === 'Completed'
      );
    }
    if (activeTab === 'escalated') {
      return ticket.status === 'Cannot Complete' || ticket.isEscalated;
    }
    return true; // 'all'
  });

  // 1. SESSION LOADING SCREEN
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex flex-col items-center justify-center p-4">
        <CollegeLogo className="w-12 h-12 mb-4 animate-bounce" />
        <div className="w-8 h-8 border-4 border-[#800000] border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-bold text-slate-700">Verifying Worker Session...</p>
      </div>
    );
  }

  // 2. UNAUTHENTICATED WORKER LOGIN SCREEN
  if (authStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-[#F7F9FC] text-slate-800 font-sans flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-8 shadow-xl">
          {/* HEADER BRANDING */}
          <div className="text-center mb-6">
            <CollegeLogo className="w-14 h-14 mx-auto mb-3" />
            <h1 className="text-xl font-black text-slate-900 flex items-center justify-center gap-2">
              MCC FIX HUB
              <span className="bg-[#FFF5F5] text-[#800000] text-xs uppercase font-bold px-2.5 py-0.5 rounded-full border border-[#800000]/20">
                Worker
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Field Staff Authentication Portal
            </p>
          </div>

          {/* ERROR ALERT */}
          {loginError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold p-3.5 rounded-2xl mb-5 flex items-center gap-2">
              <span>⚠️</span>
              <span>{loginError}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Worker ID / Identity
              </label>
              <input
                type="text"
                required
                value={loginWorkerId}
                onChange={(e) => setLoginWorkerId(e.target.value)}
                placeholder="e.g. w1, w2 or Rajan Kumar"
                className="w-full bg-white text-slate-900 text-sm font-bold border border-slate-300 rounded-xl p-3.5 focus:outline-none focus:border-[#800000] focus:ring-1 focus:ring-[#800000] shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Security PIN
              </label>
              <input
                type="password"
                required
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                placeholder="••••"
                className="w-full bg-white text-slate-900 text-sm font-bold border border-slate-300 rounded-xl p-3.5 focus:outline-none focus:border-[#800000] focus:ring-1 focus:ring-[#800000] shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-[#800000] hover:bg-[#650000] text-white font-black text-sm py-3.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Authenticating...
                </>
              ) : (
                '🔑 Login to Field Portal'
              )}
            </button>
          </form>

          {/* HINT FOOTER */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500 font-medium">
              💡 <strong className="text-slate-700 font-bold">Local Dev Test PIN:</strong> 1234
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Worker IDs: w1 (Rajan), w2 (Suresh), w3 (Priya), w4 (Anitha), w5 (Biju), w6 (Deva)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. AUTHENTICATED WORKER DASHBOARD SCREEN
  return (
    <div className="min-h-screen bg-[#F7F9FC] text-slate-800 font-sans pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-[#800000] text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-bounce border border-[#650000]">
          <span>✓</span> {toastMessage}
        </div>
      )}

      {/* TOP BAR & BRANDING */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CollegeLogo className="w-9 h-9 shrink-0" />
            <div>
              <h1 className="text-base font-black tracking-tight text-slate-900 flex items-center gap-2">
                {t.portalTitle}
                <span className="bg-[#FFF5F5] text-[#800000] text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border border-[#800000]/20">
                  Worker
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">{t.portalSubtitle}</p>
            </div>
          </div>

          {/* LANGUAGE SELECTOR */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                lang === 'en'
                  ? 'bg-[#800000] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('ta')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                lang === 'ta'
                  ? 'bg-[#800000] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              தமிழ்
            </button>
            <button
              onClick={() => setLang('hi')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                lang === 'hi'
                  ? 'bg-[#800000] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              हिंदी
            </button>
          </div>
        </div>
      </header>

      {/* AUTHENTICATED WORKER PROFILE & LOGOUT BAR */}
      <section className="bg-slate-50 border-b border-slate-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FFF5F5] border border-[#800000]/20 text-[#800000] font-black text-sm flex items-center justify-center shrink-0">
              🛠️
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span>{authenticatedWorker.name}</span>
                <span className="text-[10px] text-slate-500 font-medium">({authenticatedWorker.role})</span>
              </p>
              <p className="text-[10px] text-slate-500 font-mono">ID: {authenticatedWorker.id}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="bg-white hover:bg-rose-50 text-rose-700 hover:border-rose-300 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-slate-300 shadow-sm transition-all flex items-center gap-1"
          >
            <span>🚪</span> Log Out
          </button>
        </div>
      </section>

      {/* MAIN CONTAINER */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* TAB FILTER BUTTONS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all border ${
              activeTab === 'active'
                ? 'bg-[#800000] text-white border-[#800000] shadow-md'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
            }`}
          >
            <span>⚡</span> {t.filterActive}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                activeTab === 'active'
                  ? 'bg-[#650000] text-white'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {
                tickets.filter(
                  (t) =>
                    t.status === 'Unsolved' ||
                    t.status === 'Ongoing' ||
                    t.status === 'Reopened'
                ).length
              }
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all border ${
              activeTab === 'completed'
                ? 'bg-[#800000] text-white border-[#800000] shadow-md'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
            }`}
          >
            <span>⏳</span> {t.filterCompleted}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                activeTab === 'completed'
                  ? 'bg-[#650000] text-white'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {
                tickets.filter(
                  (t) =>
                    t.status === 'Awaiting User Confirmation' ||
                    t.status === 'Resolved' ||
                    t.status === 'Completed'
                ).length
              }
            </span>
          </button>

          <button
            onClick={() => setActiveTab('escalated')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all border ${
              activeTab === 'escalated'
                ? 'bg-[#800000] text-white border-[#800000] shadow-md'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
            }`}
          >
            <span>⚠️</span> {t.filterEscalated}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                activeTab === 'escalated'
                  ? 'bg-[#650000] text-white'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {
                tickets.filter(
                  (t) => t.status === 'Cannot Complete' || t.isEscalated
                ).length
              }
            </span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all border ${
              activeTab === 'all'
                ? 'bg-[#800000] text-white border-[#800000] shadow-md'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
            }`}
          >
            <span>📋</span> {t.filterAll}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                activeTab === 'all'
                  ? 'bg-[#650000] text-white'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {tickets.length}
            </span>
          </button>
        </div>

        {/* TICKET LIST */}
        {loading ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-8 h-8 border-4 border-[#800000] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-slate-500 font-medium">Loading assigned tasks...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 px-4 shadow-sm">
            <span className="text-4xl block mb-3">📋</span>
            <p className="text-slate-800 font-bold text-base mb-1">{t.noTicketsFound}</p>
            <p className="text-xs text-slate-500">No work orders currently assigned to your account.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {filteredTickets.map((ticket) => {
              const isUrgent = ticket.isUrgent || ticket.priority === 'Critical';
              const isOngoing = ticket.status === 'Ongoing';
              const isAwaiting = ticket.status === 'Awaiting User Confirmation';
              const isResolved = ticket.status === 'Resolved' || ticket.status === 'Completed';
              const isCannotComplete = ticket.status === 'Cannot Complete' || ticket.isEscalated;

              return (
                <div
                  key={ticket.ticketNo}
                  className={`bg-white rounded-2xl border p-5 transition-all shadow-sm hover:shadow-md ${
                    isUrgent
                      ? 'border-red-300 bg-red-50/10'
                      : isOngoing
                      ? 'border-amber-300 bg-amber-50/10'
                      : isCannotComplete
                      ? 'border-purple-300 bg-purple-50/10'
                      : 'border-slate-200'
                  }`}
                >
                  {/* CARD TOP BAR */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-lg text-slate-900 font-mono">
                        {ticket.ticketNo}
                      </span>
                      <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200">
                        {ticket.issueCategory}
                      </span>
                      {isUrgent ? (
                        <span className="bg-red-100 text-red-700 text-xs font-black px-2.5 py-1 rounded-lg border border-red-200">
                          {t.priorityCritical}
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200">
                          {t.priorityNormal}
                        </span>
                      )}
                    </div>

                    {/* STATUS BADGE */}
                    <div>
                      {isOngoing && (
                        <span className="bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold px-3 py-1 rounded-xl">
                          {t.statusOngoing}
                        </span>
                      )}
                      {isAwaiting && (
                        <span className="bg-yellow-100 text-yellow-800 border border-yellow-300 text-xs font-bold px-3 py-1 rounded-xl">
                          {t.statusAwaiting}
                        </span>
                      )}
                      {isResolved && (
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold px-3 py-1 rounded-xl">
                          {t.statusResolved}
                        </span>
                      )}
                      {ticket.status === 'Reopened' && (
                        <span className="bg-red-100 text-red-800 border border-red-300 text-xs font-bold px-3 py-1 rounded-xl">
                          {t.statusReopened}
                        </span>
                      )}
                      {isCannotComplete && (
                        <span className="bg-purple-100 text-purple-800 border border-purple-300 text-xs font-bold px-3 py-1 rounded-xl">
                          {t.statusBlocked}
                        </span>
                      )}
                      {ticket.status === 'Unsolved' && (
                        <span className="bg-red-50 text-red-700 border border-red-200 text-xs font-bold px-3 py-1 rounded-xl">
                          {t.statusUnsolved}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* LOCATION BOX */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-4 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                        {t.location}
                      </span>
                      <p className="text-sm font-black text-slate-900 mt-0.5">
                        🏢 Block {ticket.block || 'Main Campus'}, {t.room} {ticket.roomNo || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                        {t.complainant}
                      </span>
                      <p className="text-xs font-bold text-slate-700 mt-0.5">
                        {ticket.name || 'Student/Faculty'}
                      </p>
                    </div>
                  </div>

                  {/* DESCRIPTION & TTS BUTTON */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        {t.description}:
                      </span>
                      <button
                        onClick={() => handleListenComplaint(ticket)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 shadow-sm ${
                          speakingTicketId === ticket.ticketNo
                            ? 'bg-[#800000] text-white border-[#800000] animate-pulse'
                            : 'bg-white text-[#800000] border-slate-200 hover:border-[#800000] hover:bg-[#FFF5F5]'
                        }`}
                      >
                        {speakingTicketId === ticket.ticketNo ? t.stopListenBtn : t.listenBtn}
                      </button>
                    </div>
                    <p className="text-sm text-slate-800 font-medium whitespace-pre-line leading-relaxed">
                      {ticket.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* WORKER ACTION BUTTONS */}
                  <div className="flex flex-col sm:flex-row items-stretch gap-3 pt-2">
                    {/* START WORK BUTTON (If Unsolved or Reopened) */}
                    {(ticket.status === 'Unsolved' || ticket.status === 'Reopened') && (
                      <button
                        onClick={() => handleStartWork(ticket)}
                        className="flex-1 bg-[#800000] hover:bg-[#650000] text-white font-black text-sm py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        {t.startWorkBtn}
                      </button>
                    )}

                    {/* WORK COMPLETED BUTTON (If Ongoing) */}
                    {isOngoing && (
                      <button
                        onClick={() => setCompleteModalTicket(ticket)}
                        className="flex-1 bg-[#800000] hover:bg-[#650000] text-white font-black text-sm py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        {t.workCompletedBtn}
                      </button>
                    )}

                    {/* CANNOT COMPLETE BUTTON (If Unsolved, Ongoing, or Reopened) */}
                    {(ticket.status === 'Unsolved' || isOngoing || ticket.status === 'Reopened') && (
                      <button
                        onClick={() => setCannotModalTicket(ticket)}
                        className="bg-white hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 text-slate-700 font-bold text-xs py-3 px-4 rounded-xl border border-slate-300 shadow-sm transition-all flex items-center justify-center gap-1.5"
                      >
                        {t.cannotCompleteBtn}
                      </button>
                    )}

                    {/* COMPLETED / AWAITING NOTICE */}
                    {isAwaiting && (
                      <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3 rounded-xl text-center shadow-sm">
                        ✓ {t.statusAwaiting}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL 1: WORK COMPLETED */}
      {completeModalTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-[#800000]">{t.completeModalTitle}</h3>
                <p className="text-xs text-slate-500">{t.completeModalSubtitle}</p>
              </div>
              <button
                onClick={() => setCompleteModalTicket(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitWorkCompleted} className="space-y-4">
              {/* TICKET SUMMARY */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-500 font-bold">Ticket:</span>{' '}
                <strong className="text-slate-900 font-mono">{completeModalTicket.ticketNo}</strong> ·{' '}
                <span className="text-slate-700">{completeModalTicket.issueCategory}</span>
              </div>

              {/* ACTION TAKEN NOTE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.noteLabel}
                </label>
                <textarea
                  rows="3"
                  value={completeNote}
                  onChange={(e) => setCompleteNote(e.target.value)}
                  placeholder={t.notePlaceholder}
                  className="w-full bg-white text-slate-900 text-sm border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-[#800000] focus:ring-1 focus:ring-[#800000] shadow-sm"
                ></textarea>
              </div>

              {/* BEFORE/AFTER PHOTO */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.photoLabel}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
                {completePhoto && (
                  <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-200 max-h-40">
                    <img src={completePhoto} alt="Work preview" className="w-full object-cover" />
                  </div>
                )}
              </div>

              {/* VOICE NOTE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.voiceLabel}
                </label>
                <div className="flex items-center gap-2">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="bg-white hover:bg-slate-50 text-[#800000] font-bold text-xs px-3.5 py-2 rounded-xl border border-slate-300 flex items-center gap-1 shadow-sm"
                    >
                      {t.recordVoice}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1 animate-pulse shadow-sm"
                    >
                      {t.stopRecord}
                    </button>
                  )}

                  {voiceUrl && (
                    <audio controls src={voiceUrl} className="h-8 max-w-[200px]" />
                  )}
                </div>
              </div>

              {/* MODAL ACTIONS */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCompleteModalTicket(null)}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl border border-slate-200"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="w-2/3 bg-[#800000] hover:bg-[#650000] text-white font-black text-xs py-3 rounded-xl shadow-md"
                >
                  {t.submitComplete}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CANNOT COMPLETE ESCALATION */}
      {cannotModalTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-amber-700 flex items-center gap-2">
                  <span>⚠️</span> {t.cannotModalTitle}
                </h3>
                <p className="text-xs text-slate-500">{t.cannotModalSubtitle}</p>
              </div>
              <button
                onClick={() => setCannotModalTicket(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCannotComplete} className="space-y-4">
              {/* REASON SELECTION */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {t.selectReasonLabel}
                </label>
                <div className="space-y-2">
                  {[
                    t.reasonSparePart,
                    t.reasonSupervisor,
                    t.reasonInaccessible,
                    t.reasonWrongIssue,
                    t.reasonMoreTime,
                    t.reasonOther,
                  ].map((r) => (
                    <label
                      key={r}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        cannotReason === r
                          ? 'bg-[#FFF5F5] border-[#800000] text-slate-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cannotReason"
                        value={r}
                        checked={cannotReason === r}
                        onChange={(e) => setCannotReason(e.target.value)}
                        className="accent-[#800000]"
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* DETAILS INPUT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.escDetailsLabel}
                </label>
                <textarea
                  rows="3"
                  required
                  value={cannotDetails}
                  onChange={(e) => setCannotDetails(e.target.value)}
                  placeholder={t.escDetailsPlaceholder}
                  className="w-full bg-white text-slate-900 text-sm border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-[#800000] focus:ring-1 focus:ring-[#800000] shadow-sm"
                ></textarea>
              </div>

              {/* MODAL ACTIONS */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCannotModalTicket(null)}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl border border-slate-200"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="w-2/3 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs py-3 rounded-xl shadow-md"
                >
                  {t.submitEscalation}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
