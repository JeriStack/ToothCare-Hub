import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  Shield,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Bell,
  Stethoscope,
  ChevronRight,
  Menu,
  X,
  Plus,
  Search,
  Filter,
  FileText,
  Phone,
  Check,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  Info
} from 'lucide-react';
import {
  INITIAL_SERVICES,
  INITIAL_DENTISTS,
  INITIAL_PATIENTS,
  INITIAL_APPOINTMENTS,
  INITIAL_NOTIFICATIONS
} from './mockData';

export default function App() {
  // Global Role: 'PATIENT' | 'ADMIN' | 'DENTIST'
  const [currentRole, setCurrentRole] = useState('PATIENT');
  
  // Navigation tabs per role
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Master state
  const [appointments, setAppointments] = useState(INITIAL_APPOINTMENTS);
  const [patients, setPatients] = useState(INITIAL_PATIENTS);
  const [services] = useState(INITIAL_SERVICES);
  const [dentists] = useState(INITIAL_DENTISTS);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  
  // UI Panels & Modals
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedApptDetail, setSelectedApptDetail] = useState(null);
  const [cancelModalAppt, setCancelModalAppt] = useState(null);
  const [cancelReason, setCancelReason] = useState('Schedule conflict');
  const [rejectModalAppt, setRejectModalAppt] = useState(null);
  const [rejectReason, setRejectReason] = useState('Dentist schedule override');
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Booking Wizard State
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedServiceId, setSelectedServiceId] = useState(1);
  const [selectedDentistId, setSelectedDentistId] = useState(1);
  const [selectedDate, setSelectedDate] = useState('2026-11-03');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('09:30 AM');
  const [patientChiefComplaint, setPatientChiefComplaint] = useState('');
  const [isPolicyAgreed, setIsPolicyAgreed] = useState(false);
  const [bookedApptRef, setBookedApptRef] = useState(null);

  // Dentist Treatment Entry State
  const [activeTreatmentAppt, setActiveTreatmentAppt] = useState(null);
  const [selectedTeeth, setSelectedTeeth] = useState([14, 45]);
  const [diagnosisText, setDiagnosisText] = useState('Moderate occlusal dentin caries on #14 and #45. Pulp normal.');
  const [procedureText, setProcedureText] = useState('Administered 1 carpule 2% Mepivacaine. Caries excavation completed. Etch, bond, and shade A2 nanohybrid composite restored.');
  const [prescriptionText, setPrescriptionText] = useState('Paracetamol 500mg tab PRN for pain. Avoid hard foods on right side for 24h.');

  // Trigger Toast helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const unreadNotifsCount = notifications.filter(n => !n.isRead).length;

  const markAllNotifsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    showToast('All notifications marked as read.');
  };

  // Switch role reset
  const handleRoleChange = (newRole) => {
    setCurrentRole(newRole);
    setActiveTab('dashboard');
    setIsMobileMenuOpen(false);
  };

  // Booking Wizard submit
  const handleCompleteBooking = () => {
    const srv = services.find(s => s.id === selectedServiceId);
    const dnt = dentists.find(d => d.id === selectedDentistId);
    const newId = Math.floor(1000 + Math.random() * 9000);

    const newAppt = {
      id: newId,
      patientId: 101,
      patientName: 'Juan Dela Cruz',
      patientPhone: '+63 917 123 4567',
      dentistId: dnt.id,
      dentistName: dnt.name,
      serviceId: srv.id,
      serviceName: srv.name,
      date: selectedDate,
      timeSlot: selectedTimeSlot,
      durationMinutes: srv.durationMinutes,
      fee: srv.price,
      status: 'PENDING',
      chiefComplaint: patientChiefComplaint || 'Routine examination.',
      chair: dnt.chair,
      createdAt: new Date().toISOString(),
    };

    setAppointments(prev => [newAppt, ...prev]);
    setBookedApptRef(newId);
    setWizardStep(6);

    // Add in-app notification
    const newNotif = {
      id: Date.now(),
      userId: 1,
      role: 'ADMIN',
      title: `New Booking Request #${newId}`,
      message: `Juan Dela Cruz requested ${srv.name} on ${selectedDate} at ${selectedTimeSlot}.`,
      time: 'Just now',
      isRead: false,
      appointmentId: newId,
    };
    setNotifications(prev => [newNotif, ...prev]);
    showToast(`Appointment request #${newId} submitted for reception review!`);
  };

  // Admin Approve
  const handleApproveAppt = (id) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'CONFIRMED' } : a));
    const notif = {
      id: Date.now(),
      userId: 101,
      role: 'PATIENT',
      title: 'Appointment Confirmed!',
      message: `Your appointment #${id} has been confirmed by reception.`,
      time: 'Just now',
      isRead: false,
      appointmentId: id,
    };
    setNotifications(prev => [notif, ...prev]);
    showToast(`Appointment #${id} confirmed successfully!`);
    if (selectedApptDetail && selectedApptDetail.id === id) {
      setSelectedApptDetail(prev => ({ ...prev, status: 'CONFIRMED' }));
    }
  };

  // Admin Reject
  const handleConfirmReject = () => {
    if (!rejectModalAppt) return;
    const id = rejectModalAppt.id;
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'CANCELLED', rejectionReason: rejectReason } : a));
    setRejectModalAppt(null);
    showToast(`Appointment #${id} rejected. Slot released.`);
  };

  // Patient Cancel
  const handleConfirmCancel = () => {
    if (!cancelModalAppt) return;
    const id = cancelModalAppt.id;
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'CANCELLED', cancelReason } : a));
    setCancelModalAppt(null);
    if (selectedApptDetail && selectedApptDetail.id === id) {
      setSelectedApptDetail(null);
    }
    showToast(`Appointment #${id} cancelled. The slot has been released.`);
  };

  // Dentist Complete Treatment
  const handleCompleteTreatment = () => {
    if (!activeTreatmentAppt) return;
    const id = activeTreatmentAppt.id;
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'COMPLETED' } : a));
    setActiveTreatmentAppt(null);
    setActiveTab('dashboard');
    showToast(`Visit #${id} completed. Treatment record archived with 24h edit window.`);
  };

  return (
    <div className="min-h-screen bg-[#F5F8FA] text-[#334155] flex flex-col font-sans selection:bg-[#CCFBF1] selection:text-[#0F766E]">
      
      {/* 1. DEMO & ROLE SWITCHER BAR */}
      <div className="bg-[#0B1D2D] text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between border-b border-slate-800 gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-teal-400 font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
            LIVE APPLICATION (PHASE 3 UX)
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-300">Timezone: <strong>Asia/Manila (UTC+08:00)</strong></span>
          <span className="text-slate-400 hidden sm:inline">|</span>
          <span className="text-slate-400 hidden sm:inline">Docker Nginx: Port 8080</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 mr-1">Switch Experience:</span>
          <button
            onClick={() => handleRoleChange('PATIENT')}
            className={`px-2.5 py-1 rounded transition-colors font-medium ${currentRole === 'PATIENT' ? 'bg-[#0D9488] text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            Patient Portal
          </button>
          <button
            onClick={() => handleRoleChange('ADMIN')}
            className={`px-2.5 py-1 rounded transition-colors font-medium ${currentRole === 'ADMIN' ? 'bg-[#0D9488] text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            Admin / Receptionist
          </button>
          <button
            onClick={() => handleRoleChange('DENTIST')}
            className={`px-2.5 py-1 rounded transition-colors font-medium ${currentRole === 'DENTIST' ? 'bg-[#0D9488] text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            Dentist Practice
          </button>
        </div>
      </div>

      {/* 2. MAIN APPLICATION TOPBAR */}
      <header className="bg-[#12304A] text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-1.5 text-slate-300 hover:text-white rounded hover:bg-white/10"
              aria-label="Toggle Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-9 h-9 rounded-lg bg-[#0D9488] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                T
              </div>
              <div>
                <h1 className="font-bold text-base leading-tight tracking-tight text-white flex items-center gap-2">
                  ToothCare Hub
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#CCFBF1] text-[#0F766E] hidden sm:inline-block">
                    {currentRole === 'PATIENT' ? 'Patient' : currentRole === 'ADMIN' ? 'Admin' : 'Dentist'}
                  </span>
                </h1>
                <p className="text-[11px] text-teal-200/80 hidden sm:block">Dental Appointment & Clinic Management</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <button
              onClick={() => setIsNotifDrawerOpen(true)}
              className="relative p-2 text-slate-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#0D9488] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#12304A]">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {/* User Profile Info */}
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <div className="w-8 h-8 rounded-full bg-[#0D9488]/30 border border-[#0D9488] text-teal-200 flex items-center justify-center font-semibold text-xs">
                {currentRole === 'PATIENT' ? 'JD' : currentRole === 'ADMIN' ? 'AD' : 'MS'}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold leading-tight text-white">
                  {currentRole === 'PATIENT' ? 'Juan Dela Cruz' : currentRole === 'ADMIN' ? 'Clinic Admin' : 'Dr. Maria Santos'}
                </p>
                <p className="text-[10px] text-teal-200/70">
                  {currentRole === 'PATIENT' ? 'Patient' : currentRole === 'ADMIN' ? 'Receptionist' : 'Attending Dentist'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 3. APP BODY CONTAINER */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">
        
        {/* Navigation Sidebar */}
        <aside className={`lg:w-60 shrink-0 ${isMobileMenuOpen ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-sm sticky top-22">
            <div className="text-[11px] font-semibold uppercase text-slate-400 px-3 py-2 tracking-wider">
              Navigation Menu
            </div>
            <nav className="space-y-1">
              {currentRole === 'PATIENT' && (
                <>
                  <button
                    onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-[#CCFBF1] text-[#0F766E]' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Calendar className="w-4 h-4" />
                    Dashboard
                  </button>
                  <button
                    onClick={() => { setActiveTab('book'); setWizardStep(1); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'book' ? 'bg-[#CCFBF1] text-[#0F766E]' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Plus className="w-4 h-4" />
                    Book Appointment
                  </button>
                  <button
                    onClick={() => { setActiveTab('appointments'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'appointments' ? 'bg-[#CCFBF1] text-[#0F766E]' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <FileText className="w-4 h-4" />
                    My Appointments
                  </button>
                </>
              )}

              {currentRole === 'ADMIN' && (
                <>
                  <button
                    onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-[#CCFBF1] text-[#0F766E]' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Calendar className="w-4 h-4" />
                    Overview
                  </button>
                  <button
                    onClick={() => { setActiveTab('triage'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'triage' ? 'bg-[#CCFBF1] text-[#0F766E]' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span className="flex items-center gap-3">
                      <Clock className="w-4 h-4" />
                      Review Queue
                    </span>
                    {appointments.filter(a => a.status === 'PENDING').length > 0 && (
                      <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                        {appointments.filter(a => a.status === 'PENDING').length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => { setActiveTab('patients'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'patients' ? 'bg-[#CCFBF1] text-[#0F766E]' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <User className="w-4 h-4" />
                    Patient Registry
                  </button>
                  <button
                    onClick={() => { setActiveTab('services'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'services' ? 'bg-[#CCFBF1] text-[#0F766E]' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Stethoscope className="w-4 h-4" />
                    Services & Fees
                  </button>
                </>
              )}

              {currentRole === 'DENTIST' && (
                <>
                  <button
                    onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-[#CCFBF1] text-[#0F766E]' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Clock className="w-4 h-4" />
                    Today's Practice
                  </button>
                  <button
                    onClick={() => { 
                      const inChair = appointments.find(a => a.status === 'IN_CHAIR');
                      if (inChair) {
                        setActiveTreatmentAppt(inChair);
                        setActiveTab('treatment');
                      }
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'treatment' ? 'bg-[#CCFBF1] text-[#0F766E]' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <FileText className="w-4 h-4" />
                    Treatment Entry
                  </button>
                </>
              )}
            </nav>

            <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-2 text-slate-700 font-semibold mb-1">
                <Phone className="w-3.5 h-3.5 text-[#0D9488]" />
                Clinic Helpline
              </div>
              <p>(02) 8123-4567</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Mon - Sat: 9:00 AM - 5:00 PM</p>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          
          {/* ======================================================== */}
          {/* A. PATIENT PORTAL VIEWS */}
          {/* ======================================================== */}
          {currentRole === 'PATIENT' && (
            <>
              {/* Patient Dashboard */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Greeting */}
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#12304A]">
                      Good morning, Juan!
                    </h2>
                    <p className="text-sm text-slate-500">Welcome to your ToothCare Hub dental management portal.</p>
                  </div>

                  {/* Next Scheduled Visit Hero */}
                  {appointments.find(a => a.status === 'CONFIRMED') && (
                    <div className="bg-white rounded-2xl border-2 border-[#0D9488]/30 p-5 sm:p-6 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#CCFBF1]/40 rounded-full blur-2xl -mr-10 -mt-10"></div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-bold tracking-wider uppercase text-[#0D9488] flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          Next Scheduled Visit
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#CCFBF1] text-[#0F766E] border border-teal-200">
                          Confirmed
                        </span>
                      </div>

                      {(() => {
                        const appt = appointments.find(a => a.status === 'CONFIRMED');
                        return (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                              <h3 className="text-lg font-bold text-[#12304A]">{appt.serviceName}</h3>
                              <p className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" />
                                {appt.date} • {appt.timeSlot} (Asia/Manila)
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                Practitioner: <strong>{appt.dentistName}</strong> • {appt.chair}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedApptDetail(appt)}
                                className="px-4 py-2 rounded-lg bg-[#0D9488] text-white text-xs font-semibold hover:bg-[#0F766E] transition-colors shadow-sm"
                              >
                                View Details
                              </button>
                              <button
                                onClick={() => setCancelModalAppt(appt)}
                                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 text-xs font-medium transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Quick Actions Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      onClick={() => { setActiveTab('book'); setWizardStep(1); }}
                      className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0D9488] hover:shadow-md transition-all text-left flex items-start gap-3.5 group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#CCFBF1] text-[#0D9488] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Plus className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#12304A]">Book Appointment</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Choose procedure, dentist & 30-min slot.</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('appointments')}
                      className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0D9488] hover:shadow-md transition-all text-left flex items-start gap-3.5 group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#12304A]">Visit History</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Review completed visits and notes.</p>
                      </div>
                    </button>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 text-left flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#12304A]">Emergency Assistance</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Call reception at (02) 8123-4567.</p>
                      </div>
                    </div>
                  </div>

                  {/* Active Appointments Table */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="font-bold text-sm text-[#12304A]">Your Appointments & Requests</h4>
                      <span className="text-xs text-slate-500">{appointments.length} total records</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {appointments.map(appt => (
                        <div key={appt.id} className="p-4 hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-600">
                              #{appt.id}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-[#12304A]">{appt.serviceName}</p>
                              <p className="text-xs text-slate-500">
                                {appt.dentistName} • 📅 {appt.date} at {appt.timeSlot}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                              appt.status === 'CONFIRMED'
                                ? 'bg-[#CCFBF1] text-[#0F766E]'
                                : appt.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800'
                                : appt.status === 'COMPLETED'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {appt.status === 'CONFIRMED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                              {appt.status === 'PENDING' && <Clock className="w-3.5 h-3.5" />}
                              {appt.status === 'COMPLETED' && <Check className="w-3.5 h-3.5" />}
                              {appt.status === 'CANCELLED' && <XCircle className="w-3.5 h-3.5" />}
                              {appt.status}
                            </span>
                            <button
                              onClick={() => setSelectedApptDetail(appt)}
                              className="text-slate-400 hover:text-slate-600 p-1"
                              aria-label="View Details"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 6-Step Booking Wizard */}
              {activeTab === 'book' && (
                <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                  {/* Stepper Progress */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                      <span className={wizardStep >= 1 ? 'text-[#0D9488]' : ''}>1. Service</span>
                      <span className={wizardStep >= 2 ? 'text-[#0D9488]' : ''}>2. Dentist</span>
                      <span className={wizardStep >= 3 ? 'text-[#0D9488]' : ''}>3. Date & Slot</span>
                      <span className={wizardStep >= 4 ? 'text-[#0D9488]' : ''}>4. Notes</span>
                      <span className={wizardStep >= 5 ? 'text-[#0D9488]' : ''}>5. Review</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0D9488] h-full transition-all duration-300"
                        style={{ width: `${(wizardStep / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Wizard Step 1: Services */}
                  {wizardStep === 1 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-[#12304A]">Step 1: Choose Dental Service</h3>
                      <p className="text-xs text-slate-500">Select the procedure required. Durations calibrate bookable slot blocks.</p>
                      <div className="space-y-3 pt-2">
                        {services.map(srv => (
                          <div
                            key={srv.id}
                            onClick={() => setSelectedServiceId(srv.id)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                              selectedServiceId === srv.id
                                ? 'border-[#0D9488] bg-[#F0FDFA] ring-2 ring-[#0D9488]/20'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-[#12304A]">{srv.name}</h4>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {srv.category}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">{srv.description}</p>
                              <p className="text-xs font-semibold text-[#0D9488] mt-1">
                                Est. Duration: {srv.durationMinutes} minutes
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-base font-bold text-[#12304A]">₱{srv.price.toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 flex justify-end">
                        <button
                          onClick={() => setWizardStep(2)}
                          className="px-6 py-2.5 rounded-lg bg-[#0D9488] text-white font-semibold text-sm hover:bg-[#0F766E] transition-colors shadow-sm"
                        >
                          Continue to Dentist Selection &gt;
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Wizard Step 2: Dentists */}
                  {wizardStep === 2 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-[#12304A]">Step 2: Choose Dental Practitioner</h3>
                      <p className="text-xs text-slate-500">Pick an attending dentist licensed for your selected procedure.</p>
                      <div className="space-y-3 pt-2">
                        {dentists.map(dnt => (
                          <div
                            key={dnt.id}
                            onClick={() => setSelectedDentistId(dnt.id)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                              selectedDentistId === dnt.id
                                ? 'border-[#0D9488] bg-[#F0FDFA] ring-2 ring-[#0D9488]/20'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3.5">
                              <span className="text-2xl">{dnt.avatar}</span>
                              <div>
                                <h4 className="font-bold text-sm text-[#12304A]">{dnt.name}</h4>
                                <p className="text-xs text-slate-500">{dnt.specialty}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{dnt.license} • {dnt.chair}</p>
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-[#0D9488] bg-[#CCFBF1] px-2.5 py-1 rounded-full">
                              Available
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 flex justify-between">
                        <button
                          onClick={() => setWizardStep(1)}
                          className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
                        >
                          &lt; Back
                        </button>
                        <button
                          onClick={() => setWizardStep(3)}
                          className="px-6 py-2.5 rounded-lg bg-[#0D9488] text-white font-semibold text-sm hover:bg-[#0F766E] transition-colors shadow-sm"
                        >
                          Continue to Date & Slot &gt;
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Wizard Step 3: Date & 30-min Slot */}
                  {wizardStep === 3 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-[#12304A]">Step 3: Select Date & 30-Minute Time Slot</h3>
                      <p className="text-xs text-slate-500">Anchored in clinic timezone <strong>Asia/Manila (UTC+08:00)</strong>.</p>
                      
                      <div className="pt-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Appointment Date</label>
                        <input
                          type="date"
                          value={selectedDate}
                          min="2026-10-28"
                          onChange={e => setSelectedDate(e.target.value)}
                          className="w-full sm:w-64 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-[#0D9488] focus:ring-2 focus:ring-[#CCFBF1] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">Available 30-Minute Starting Slots</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {['09:00 AM', '09:30 AM', '10:30 AM', '11:15 AM', '01:30 PM', '02:00 PM', '03:30 PM', '04:00 PM'].map(slot => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setSelectedTimeSlot(slot)}
                              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border ${
                                selectedTimeSlot === slot
                                  ? 'bg-[#0D9488] text-white border-[#0D9488] shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 flex justify-between">
                        <button
                          onClick={() => setWizardStep(2)}
                          className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
                        >
                          &lt; Back
                        </button>
                        <button
                          onClick={() => setWizardStep(4)}
                          className="px-6 py-2.5 rounded-lg bg-[#0D9488] text-white font-semibold text-sm hover:bg-[#0F766E] transition-colors shadow-sm"
                        >
                          Continue to Patient Notes &gt;
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Wizard Step 4: Notes */}
                  {wizardStep === 4 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-[#12304A]">Step 4: Chief Complaint & Notes</h3>
                      <p className="text-xs text-slate-500">Describe any current discomfort, symptoms, or special accommodations.</p>
                      
                      <div className="pt-2">
                        <textarea
                          rows={4}
                          value={patientChiefComplaint}
                          onChange={e => setPatientChiefComplaint(e.target.value)}
                          placeholder="e.g., Routine cleaning, slight gum bleeding when brushing, sensitive to cold water on upper right molar."
                          className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:border-[#0D9488] focus:ring-2 focus:ring-[#CCFBF1] outline-none"
                        ></textarea>
                        <p className="text-[11px] text-slate-400 mt-1">Maximum 500 characters.</p>
                      </div>

                      <div className="pt-4 flex justify-between">
                        <button
                          onClick={() => setWizardStep(3)}
                          className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
                        >
                          &lt; Back
                        </button>
                        <button
                          onClick={() => setWizardStep(5)}
                          className="px-6 py-2.5 rounded-lg bg-[#0D9488] text-white font-semibold text-sm hover:bg-[#0F766E] transition-colors shadow-sm"
                        >
                          Review & Agreement &gt;
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Wizard Step 5: Review & Submit */}
                  {wizardStep === 5 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-[#12304A]">Step 5: Review & Confirm Request</h3>
                      <p className="text-xs text-slate-500">Please verify your booking details before submission to clinic reception.</p>

                      {(() => {
                        const srv = services.find(s => s.id === selectedServiceId);
                        const dnt = dentists.find(d => d.id === selectedDentistId);
                        return (
                          <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-200/60">
                              <span className="text-slate-500">Service:</span>
                              <span className="font-bold text-[#12304A]">{srv.name} ({srv.durationMinutes} mins)</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/60">
                              <span className="text-slate-500">Dentist:</span>
                              <span className="font-bold text-[#12304A]">{dnt.name} ({dnt.specialty})</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/60">
                              <span className="text-slate-500">Schedule:</span>
                              <span className="font-bold text-[#12304A]">{selectedDate} at {selectedTimeSlot} (Asia/Manila)</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/60">
                              <span className="text-slate-500">Estimated Fee:</span>
                              <span className="font-bold text-[#0D9488] text-sm">₱{srv.price.toLocaleString()} (Pay at clinic)</span>
                            </div>
                            {patientChiefComplaint && (
                              <div className="py-1">
                                <span className="text-slate-500 block mb-0.5">Notes / Chief Complaint:</span>
                                <span className="text-slate-700 italic font-medium">"{patientChiefComplaint}"</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="pt-2">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isPolicyAgreed}
                            onChange={e => setIsPolicyAgreed(e.target.checked)}
                            className="mt-0.5 rounded text-[#0D9488] focus:ring-[#0D9488]"
                          />
                          <span className="text-xs text-slate-600 leading-relaxed">
                            I understand that appointment requests are subject to clinic review and confirmation. Cancellations must be made at least <strong>24 hours</strong> in advance.
                          </span>
                        </label>
                      </div>

                      <div className="pt-4 flex justify-between">
                        <button
                          onClick={() => setWizardStep(4)}
                          className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
                        >
                          &lt; Back
                        </button>
                        <button
                          disabled={!isPolicyAgreed}
                          onClick={handleCompleteBooking}
                          className="px-6 py-2.5 rounded-lg bg-[#0D9488] text-white font-semibold text-sm hover:bg-[#0F766E] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Confirm & Submit Request
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Wizard Step 6: Confirmation Success */}
                  {wizardStep === 6 && (
                    <div className="text-center py-6 space-y-4">
                      <div className="w-16 h-16 bg-[#CCFBF1] text-[#0D9488] rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <Check className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-[#12304A]">Appointment Request Submitted!</h3>
                      <p className="text-sm text-slate-600 max-w-md mx-auto">
                        Your request has been queued for review by reception under reference ID:
                      </p>
                      <div className="inline-block bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 font-mono font-bold text-sm text-[#0D9488]">
                        #APP-{bookedApptRef}
                      </div>
                      <p className="text-xs text-slate-500">
                        Status: <span className="text-amber-700 font-semibold">Pending Clinic Review</span>. You will receive an in-app alert when approved.
                      </p>
                      <div className="pt-4">
                        <button
                          onClick={() => { setActiveTab('dashboard'); setWizardStep(1); }}
                          className="px-6 py-2.5 rounded-lg bg-[#0D9488] text-white font-semibold text-sm hover:bg-[#0F766E] shadow-sm transition-colors"
                        >
                          Back to Patient Dashboard
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Patient My Appointments View */}
              {activeTab === 'appointments' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-[#12304A]">My Appointment History</h3>
                      <p className="text-xs text-slate-500">Track current booking statuses and past clinical treatments.</p>
                    </div>
                    <button
                      onClick={() => { setActiveTab('book'); setWizardStep(1); }}
                      className="px-3 py-1.5 rounded-lg bg-[#0D9488] text-white text-xs font-semibold hover:bg-[#0F766E]"
                    >
                      + Book New
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {appointments.map(appt => (
                      <div key={appt.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-400">#{appt.id}</span>
                            <h4 className="font-bold text-sm text-[#12304A]">{appt.serviceName}</h4>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              appt.status === 'CONFIRMED' ? 'bg-[#CCFBF1] text-[#0F766E]' :
                              appt.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                              appt.status === 'COMPLETED' ? 'bg-sky-100 text-sky-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {appt.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            📅 {appt.date} at {appt.timeSlot} • {appt.dentistName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedApptDetail(appt)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50"
                          >
                            Details
                          </button>
                          {(appt.status === 'CONFIRMED' || appt.status === 'PENDING') && (
                            <button
                              onClick={() => setCancelModalAppt(appt)}
                              className="px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-medium"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ======================================================== */}
          {/* B. ADMIN / RECEPTIONIST VIEWS */}
          {/* ======================================================== */}
          {currentRole === 'ADMIN' && (
            <>
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Admin KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <span className="text-xs font-semibold text-slate-400 uppercase">Today's Visits</span>
                      <p className="text-2xl font-bold text-[#12304A] mt-1">14</p>
                      <span className="text-[11px] text-teal-600 font-medium">4 chairs active</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <span className="text-xs font-semibold text-slate-400 uppercase">Pending Requests</span>
                      <p className="text-2xl font-bold text-amber-600 mt-1">
                        {appointments.filter(a => a.status === 'PENDING').length}
                      </p>
                      <span className="text-[11px] text-amber-700 font-medium">Needs review</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <span className="text-xs font-semibold text-slate-400 uppercase">Dentists On Duty</span>
                      <p className="text-2xl font-bold text-[#12304A] mt-1">3</p>
                      <span className="text-[11px] text-slate-500 font-medium">1 on leave</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <span className="text-xs font-semibold text-slate-400 uppercase">Est. Revenue</span>
                      <p className="text-2xl font-bold text-[#0D9488] mt-1">₱28,500</p>
                      <span className="text-[11px] text-slate-500 font-medium">Today's schedule</span>
                    </div>
                  </div>

                  {/* Triage Alert Banner */}
                  {appointments.filter(a => a.status === 'PENDING').length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-amber-900">
                            {appointments.filter(a => a.status === 'PENDING').length} Appointment Requests Awaiting Review
                          </p>
                          <p className="text-[11px] text-amber-700">Review pending slots before schedule locks.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab('triage')}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors shrink-0"
                      >
                        Open Triage Queue &gt;
                      </button>
                    </div>
                  )}

                  {/* Operatory Chairs Visualizer */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                    <h4 className="font-bold text-sm text-[#12304A]">Live Operatory Chairs Status</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="border border-teal-200 bg-[#F0FDFA] p-3 rounded-lg">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-[#12304A]">Operatory Chair 1</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#CCFBF1] text-[#0F766E]">Active</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-2 font-medium">Dr. Maria Santos, DMD</p>
                        <p className="text-[11px] text-slate-500">In Chair: Elena Gomez (Filling)</p>
                      </div>

                      <div className="border border-slate-200 p-3 rounded-lg">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-[#12304A]">Operatory Chair 2</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">Available</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-2 font-medium">Dr. Roberto Reyes, DMD</p>
                        <p className="text-[11px] text-slate-500">Next: 02:00 PM (Maria Garcia)</p>
                      </div>

                      <div className="border border-slate-200 p-3 rounded-lg">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-[#12304A]">Operatory Chair 3</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">Available</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-2 font-medium">Dr. Carmela Lim, DMD</p>
                        <p className="text-[11px] text-slate-500">Next: 03:00 PM (Consultation)</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Appointment Triage Queue */}
              {activeTab === 'triage' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-[#12304A]">Appointment Triage & Review Queue</h3>
                    <p className="text-xs text-slate-500">Verify patient details, dentist availability, and approve or reject requests.</p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {appointments.filter(a => a.status === 'PENDING').length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle2 className="w-10 h-10 text-teal-500 mx-auto mb-2" />
                        <h4 className="font-bold text-sm text-[#12304A]">Queue is Clean!</h4>
                        <p className="text-xs text-slate-500">Zero pending appointment requests awaiting review.</p>
                      </div>
                    ) : (
                      appointments.filter(a => a.status === 'PENDING').map(appt => (
                        <div key={appt.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-400">#{appt.id}</span>
                              <h4 className="font-bold text-sm text-[#12304A]">{appt.patientName}</h4>
                              <span className="text-xs text-slate-500">({appt.patientPhone})</span>
                            </div>
                            <p className="text-xs font-semibold text-[#0D9488] mt-1">{appt.serviceName} • ₱{appt.fee.toLocaleString()}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              📅 Requested: <strong>{appt.date} at {appt.timeSlot}</strong> • Dentist: {appt.dentistName}
                            </p>
                            {appt.chiefComplaint && (
                              <p className="text-xs text-slate-600 italic mt-1 bg-slate-50 p-2 rounded border border-slate-100">
                                Note: "{appt.chiefComplaint}"
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-[11px] text-teal-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Conflict Check: Zero overlapping slots found on {appt.chair}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleApproveAppt(appt.id)}
                              className="px-4 py-2 rounded-lg bg-[#0D9488] text-white text-xs font-semibold hover:bg-[#0F766E] shadow-sm transition-colors"
                            >
                              Approve Appointment
                            </button>
                            <button
                              onClick={() => setRejectModalAppt(appt)}
                              className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 text-xs font-medium transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Admin Patient Registry */}
              {activeTab === 'patients' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-[#12304A]">Patient Registry Directory</h3>
                      <p className="text-xs text-slate-500">Master record of all registered clinic dental patients.</p>
                    </div>
                    <button
                      onClick={() => setIsWalkInModalOpen(true)}
                      className="px-3.5 py-2 rounded-lg bg-[#0D9488] text-white text-xs font-semibold hover:bg-[#0F766E] shadow-sm flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Register Walk-In Patient
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">ID</th>
                          <th className="py-2.5 px-3">Patient Name</th>
                          <th className="py-2.5 px-3">Phone</th>
                          <th className="py-2.5 px-3">Date of Birth</th>
                          <th className="py-2.5 px-3">Medical Allergies</th>
                          <th className="py-2.5 px-3">Visits</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {patients.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-3 px-3 font-mono font-bold text-slate-400">#{p.id}</td>
                            <td className="py-3 px-3 font-bold text-[#12304A]">{p.name}</td>
                            <td className="py-3 px-3 text-slate-600">{p.phone}</td>
                            <td className="py-3 px-3 text-slate-600">{p.dob}</td>
                            <td className="py-3 px-3">
                              {p.allergies.includes('Penicillin') ? (
                                <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                  ⚠️ {p.allergies}
                                </span>
                              ) : (
                                <span className="text-slate-500">{p.allergies}</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-700">{p.pastVisitsCount} visits</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Admin Services & Pricing Catalog */}
              {activeTab === 'services' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-[#12304A]">Dental Services & Pricing Catalog</h3>
                    <p className="text-xs text-slate-500">Standard clinic procedures, durations (driving 30-min slot math), and fees.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {services.map(srv => (
                      <div key={srv.id} className="border border-slate-200 rounded-xl p-4 hover:border-[#0D9488] transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              {srv.category}
                            </span>
                            <h4 className="font-bold text-sm text-[#12304A] mt-1">{srv.name}</h4>
                          </div>
                          <span className="font-bold text-base text-[#0D9488]">₱{srv.price.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">{srv.description}</p>
                        <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                          <span className="text-slate-600">Standard Duration:</span>
                          <span className="font-semibold text-slate-800">{srv.durationMinutes} mins</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ======================================================== */}
          {/* C. DENTIST CLINICAL PRACTICE VIEWS */}
          {/* ======================================================== */}
          {currentRole === 'DENTIST' && (
            <>
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#12304A]">Dr. Maria Santos, DMD</h2>
                    <p className="text-sm text-slate-500">Today's Practice: Tuesday, Nov 3 • Operatory Chair 1</p>
                  </div>

                  {/* Active In-Chair Patient */}
                  {appointments.find(a => a.status === 'IN_CHAIR') && (
                    <div className="bg-white rounded-2xl border-2 border-teal-500 p-5 shadow-sm space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[#0D9488] uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-ping"></span>
                          CURRENT ACTIVE PATIENT IN CHAIR
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#CCFBF1] text-[#0F766E]">
                          In Progress
                        </span>
                      </div>

                      {(() => {
                        const inChair = appointments.find(a => a.status === 'IN_CHAIR');
                        return (
                          <div>
                            <h3 className="text-lg font-bold text-[#12304A]">{inChair.patientName}</h3>
                            <div className="mt-1 flex flex-wrap gap-2 items-center text-xs">
                              <span className="text-slate-600 font-medium">Procedure: {inChair.serviceName}</span>
                              <span className="text-slate-400">•</span>
                              <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                ALLERGY: PENICILLIN (NO AMOXICILLIN)
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded border border-slate-100">
                              Chief Complaint: "{inChair.chiefComplaint}"
                            </p>
                            <div className="mt-4">
                              <button
                                onClick={() => {
                                  setActiveTreatmentAppt(inChair);
                                  setActiveTab('treatment');
                                }}
                                className="px-5 py-2.5 bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-2"
                              >
                                <FileText className="w-4 h-4" />
                                Author Treatment Notes & Complete Visit &gt;
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Daily Agenda Timeline */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                    <h4 className="font-bold text-sm text-[#12304A]">Today's Assigned Patient Timeline</h4>
                    <div className="divide-y divide-slate-100">
                      <div className="py-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-[#12304A]">09:00 AM • Juan Dela Cruz (#101)</p>
                          <p className="text-[11px] text-slate-500">Dental Prophylaxis (Cleaning) • 45 mins</p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                          ✓ Completed
                        </span>
                      </div>
                      <div className="py-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-[#12304A]">09:30 AM • Elena Gomez (#104)</p>
                          <p className="text-[11px] text-slate-500">Composite Tooth Filling • Operatory Chair 1</p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#CCFBF1] text-[#0F766E]">
                          ● In Chair Now
                        </span>
                      </div>
                      <div className="py-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-[#12304A]">11:00 AM • Roberto Tan</p>
                          <p className="text-[11px] text-slate-500">Routine Dental Checkup & Scaling</p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          Upcoming
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dentist Treatment Entry Form */}
              {activeTab === 'treatment' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
                  <div className="border-b border-slate-100 pb-3">
                    <span className="text-xs font-bold uppercase text-[#0D9488]">Clinical Documentation</span>
                    <h3 className="text-lg font-bold text-[#12304A] mt-0.5">
                      Clinical Treatment Record Entry — Visit #{activeTreatmentAppt ? activeTreatmentAppt.id : '1040'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Patient: <strong>{activeTreatmentAppt ? activeTreatmentAppt.patientName : 'Elena Gomez'}</strong> • Chair: Operatory Chair 1
                    </p>
                  </div>

                  {/* Teeth Selection Grid (FDI Two-Digit Notation) */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-[#12304A]">
                      1. Teeth Numbers Treated (Select FDI Two-Digit Notation)
                    </label>
                    <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      {[18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28, 48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38].map(tooth => {
                        const isSelected = selectedTeeth.includes(tooth);
                        return (
                          <button
                            key={tooth}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTeeth(selectedTeeth.filter(t => t !== tooth));
                              } else {
                                setSelectedTeeth([...selectedTeeth, tooth]);
                              }
                            }}
                            className={`w-8 h-8 rounded text-xs font-bold transition-colors ${
                              isSelected ? 'bg-[#0D9488] text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {tooth}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Selected teeth: <strong>{selectedTeeth.length > 0 ? selectedTeeth.map(t => `#${t}`).join(', ') : 'None'}</strong>
                    </p>
                  </div>

                  {/* Clinical Diagnosis */}
                  <div>
                    <label className="block text-xs font-bold text-[#12304A] mb-1">
                      2. Clinical Diagnosis & Findings *
                    </label>
                    <textarea
                      rows={3}
                      value={diagnosisText}
                      onChange={e => setDiagnosisText(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:border-[#0D9488] focus:ring-2 focus:ring-[#CCFBF1] outline-none"
                    ></textarea>
                  </div>

                  {/* Procedures Performed */}
                  <div>
                    <label className="block text-xs font-bold text-[#12304A] mb-1">
                      3. Procedures Performed & Materials Used *
                    </label>
                    <textarea
                      rows={3}
                      value={procedureText}
                      onChange={e => setProcedureText(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:border-[#0D9488] focus:ring-2 focus:ring-[#CCFBF1] outline-none"
                    ></textarea>
                  </div>

                  {/* Prescriptions & Instructions */}
                  <div>
                    <label className="block text-xs font-bold text-[#12304A] mb-1">
                      4. Prescriptions & Home Care Instructions
                    </label>
                    <textarea
                      rows={2}
                      value={prescriptionText}
                      onChange={e => setPrescriptionText(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:border-[#0D9488] focus:ring-2 focus:ring-[#CCFBF1] outline-none"
                    ></textarea>
                  </div>

                  <div className="bg-[#F0FDFA] p-3 rounded-lg border border-teal-100 flex items-center gap-2 text-xs text-[#0F766E]">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>Audit Notice: You have 24 hours post-completion to edit or amend these clinical treatment notes.</span>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setActiveTab('dashboard')}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCompleteTreatment}
                      className="px-6 py-2.5 rounded-lg bg-[#0D9488] text-white text-xs font-bold hover:bg-[#0F766E] shadow-sm transition-colors"
                    >
                      Complete Visit & Finalize Record
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </main>
      </div>

      {/* ======================================================== */}
      {/* 4. MODALS & DRAWERS */}
      {/* ======================================================== */}

      {/* Notification Center Slide-Over Drawer */}
      {isNotifDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#12304A]">Notification Center</h3>
                <p className="text-xs text-slate-500">{unreadNotifsCount} unread updates</p>
              </div>
              <button
                onClick={() => setIsNotifDrawerOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Real-time socket sync: Active</span>
              <button
                onClick={markAllNotifsRead}
                className="text-[#0D9488] font-bold hover:underline"
              >
                Mark all read
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
              {notifications.map(n => (
                <div key={n.id} className={`p-3 rounded-lg transition-colors ${n.isRead ? 'hover:bg-slate-50' : 'bg-[#F0FDFA]'}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#12304A]">{n.title}</span>
                    <span className="text-[10px] text-slate-400">{n.time}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Appointment Detail Modal */}
      {selectedApptDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-slate-400">Ref #APP-{selectedApptDetail.id}</span>
                <h3 className="text-base font-bold text-[#12304A] mt-0.5">{selectedApptDetail.serviceName}</h3>
              </div>
              <button onClick={() => setSelectedApptDetail(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-[#0D9488]">{selectedApptDetail.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Schedule:</span>
                <span className="font-bold text-slate-800">{selectedApptDetail.date} at {selectedTimeSlot}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Dentist:</span>
                <span className="font-bold text-slate-800">{selectedApptDetail.dentistName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Operatory:</span>
                <span className="font-bold text-slate-800">{selectedApptDetail.chair}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Fee:</span>
                <span className="font-bold text-[#0D9488]">₱{selectedApptDetail.fee.toLocaleString()}</span>
              </div>
              {selectedApptDetail.chiefComplaint && (
                <div className="py-1">
                  <span className="text-slate-500 block mb-0.5">Patient Notes:</span>
                  <p className="text-slate-700 bg-slate-50 p-2 rounded">{selectedApptDetail.chiefComplaint}</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setSelectedApptDetail(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelModalAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#12304A]">Confirm Appointment Cancellation</h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to cancel appointment <strong>#{cancelModalAppt.id}</strong> ({cancelModalAppt.serviceName})?
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Cancellation</label>
              <select
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-200 text-xs outline-none"
              >
                <option value="Schedule conflict">Personal schedule conflict</option>
                <option value="Illness or medical emergency">Illness or medical emergency</option>
                <option value="Financial considerations">Financial considerations</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="bg-amber-50 p-2.5 rounded border border-amber-200 text-[11px] text-amber-800">
              Free cancellation is allowed up to 24 hours prior to scheduled visit time.
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setCancelModalAppt(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
              >
                Keep Visit
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
              >
                Yes, Cancel Slot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal (Admin) */}
      {rejectModalAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#12304A]">Reject Appointment Request #{rejectModalAppt.id}</h3>
            <p className="text-xs text-slate-600">
              Please specify a reason for rejecting the request from <strong>{rejectModalAppt.patientName}</strong>:
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Rejection Reason Code</label>
              <select
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-200 text-xs outline-none"
              >
                <option value="Dentist schedule override">Dentist emergency leave / schedule override</option>
                <option value="Chair maintenance">Operatory chair sterilization / maintenance</option>
                <option value="Service discontinued">Selected procedure temporarily unavailable</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setRejectModalAppt(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Walk-in Modal (Admin) */}
      {isWalkInModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#12304A]">Register Walk-In Patient</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Carlos Santos"
                  id="walkin-name"
                  className="w-full p-2.5 rounded-lg border border-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mobile Phone *</label>
                <input
                  type="tel"
                  placeholder="e.g., +63 917 123 4567"
                  id="walkin-phone"
                  className="w-full p-2.5 rounded-lg border border-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Medical Alerts / Allergies</label>
                <input
                  type="text"
                  placeholder="e.g., Penicillin allergy, Hypertension"
                  id="walkin-allergy"
                  className="w-full p-2.5 rounded-lg border border-slate-200 outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setIsWalkInModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const nameInput = document.getElementById('walkin-name');
                  const phoneInput = document.getElementById('walkin-phone');
                  const allergyInput = document.getElementById('walkin-allergy');
                  const newPatient = {
                    id: Math.floor(110 + Math.random() * 800),
                    name: nameInput?.value || 'Walk-In Patient',
                    phone: phoneInput?.value || '+63 917 000 0000',
                    dob: '1995-01-01',
                    allergies: allergyInput?.value || 'None',
                    pastVisitsCount: 1,
                  };
                  setPatients(prev => [newPatient, ...prev]);
                  setIsWalkInModalOpen(false);
                  showToast(`Patient ${newPatient.name} registered successfully!`);
                }}
                className="px-4 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold transition-colors"
              >
                Save Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#12304A] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700 text-xs animate-bounce">
          <Sparkles className="w-4 h-4 text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 5. FOOTER */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-4 text-center text-xs text-slate-400">
        ToothCare Hub — Dental Appointment & Clinic Management System &copy; 2026. Phase 3 Design Foundations Applied.
      </footer>
    </div>
  );
}
