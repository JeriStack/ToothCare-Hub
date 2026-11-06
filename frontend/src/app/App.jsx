import React, { useState, useEffect, useMemo } from 'react';
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
import { AdminDashboard } from '../features/dashboard/AdminDashboard';
import { DentistDashboard } from '../features/dashboard/DentistDashboard';
import { ServicesPage } from '../features/services/pages/ServicesPage';
import { DentistListPage } from '../features/dentists/pages/DentistListPage';
import { PatientListPage } from '../features/patients/pages/PatientListPage';
import { AdminSchedulePage } from '../features/schedules/pages/AdminSchedulePage';
import { BookAppointmentPage } from '../features/appointments/pages/BookAppointmentPage';
import { AppointmentHistoryPage } from '../features/appointments/pages/AppointmentHistoryPage';
import { AdminAppointmentsPage } from '../features/appointments/pages/AdminAppointmentsPage';
import { LandingPage } from '../features/landing/LandingPage';

const SAMPLE_TIME_SLOTS = ['09:00 AM', '09:30 AM', '10:30 AM', '11:15 AM', '01:30 PM', '02:00 PM', '03:30 PM', '04:00 PM'];
const SAMPLE_CLINIC_CLOSE_MINUTES = 17 * 60;
const BOOKING_STATUSES = new Set(['PENDING', 'CONFIRMED', 'IN_CHAIR']);
const WEEKDAY_CODES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const APPOINTMENT_STATUS_LABELS = {
  PENDING: 'Awaiting clinic review',
  CONFIRMED: 'Confirmed',
  IN_CHAIR: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Declined',
};

const getAppointmentStatusLabel = status => APPOINTMENT_STATUS_LABELS[status] || status;

const getManilaDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
};

const getManilaMinutes = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);

  return hour * 60 + minute;
};

const getTimeInMinutes = (time) => {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time || '');
  if (!match) return null;

  const [, hourText, minuteText, meridiem] = match;
  const hour = Number(hourText) % 12 + (meridiem.toUpperCase() === 'PM' ? 12 : 0);
  return hour * 60 + Number(minuteText);
};

const getWeekdayCode = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;

  return WEEKDAY_CODES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
};

const getSampleAvailableSlots = (date, dentist, service, appointments) => {
  if (!date || !dentist || !service) return [];

  const weekday = getWeekdayCode(date);
  if (!weekday || !dentist.shifts.includes(weekday)) return [];

  const now = new Date();
  const isToday = date === getManilaDate(now);
  const currentMinutes = getManilaMinutes(now);

  return SAMPLE_TIME_SLOTS.filter(slot => {
    const start = getTimeInMinutes(slot);
    if (start === null || (isToday && start <= currentMinutes)) return false;

    const end = start + service.durationMinutes;
    if (end > SAMPLE_CLINIC_CLOSE_MINUTES) return false;

    return !appointments.some(appointment => {
      if (
        appointment.date !== date ||
        appointment.dentistId !== dentist.id ||
        !BOOKING_STATUSES.has(appointment.status)
      ) {
        return false;
      }

      const appointmentStart = getTimeInMinutes(appointment.timeSlot);
      const duration = Number(appointment.durationMinutes);
      if (appointmentStart === null || !Number.isFinite(duration) || duration <= 0) return true;

      const appointmentEnd = appointmentStart + duration;
      return start < appointmentEnd && appointmentStart < end;
    });
  });
};

export default function App() {
  // Global Role: 'LANDING' | 'PATIENT' | 'ADMIN' | 'DENTIST'
  const [currentRole, setCurrentRole] = useState('LANDING');
  
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
  const [selectedDate, setSelectedDate] = useState(getManilaDate);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
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
  const todayManila = getManilaDate();
  const availableSampleTimeSlots = useMemo(() => {
    const dentist = dentists.find(d => d.id === selectedDentistId);
    const service = services.find(s => s.id === selectedServiceId);

    return getSampleAvailableSlots(selectedDate, dentist, service, appointments);
  }, [appointments, dentists, selectedDate, selectedDentistId, selectedServiceId, services]);

  useEffect(() => {
    if (!availableSampleTimeSlots.includes(selectedTimeSlot)) {
      setSelectedTimeSlot(availableSampleTimeSlots[0] || '');
    }
  }, [availableSampleTimeSlots, selectedTimeSlot]);

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
    if (!srv || !dnt) {
      setWizardStep(3);
      showToast('Choose a service and dentist before continuing.');
      return;
    }

    const currentSampleTimeSlots = getSampleAvailableSlots(selectedDate, dnt, srv, appointments);
    if (!currentSampleTimeSlots.includes(selectedTimeSlot)) {
      setSelectedTimeSlot(currentSampleTimeSlots[0] || '');
      setWizardStep(3);
      showToast('That sample time is no longer available. Choose another time.');
      return;
    }

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
    setWizardStep(5);

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
    showToast(`Demo appointment request #${newId} added for reception review.`);
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
    showToast(`Appointment #${id} marked cancelled in this demo.`);
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

  if (currentRole === 'LANDING') {
    return (
      <div className="min-h-screen bg-white text-[#334155] flex flex-col font-sans selection:bg-[#CCFBF1] selection:text-[#0F766E]">
        {/* Top Demo Bar */}
        <div className="bg-[#0B1D2D] text-white px-4 py-1.5 text-xs flex flex-wrap items-center justify-between border-b border-slate-800 gap-2 sticky top-0 z-[60]">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 font-semibold text-slate-200 text-[11px]">
              ToothCare Hub
            </span>
            <span className="text-[11px] text-teal-400 font-medium hidden sm:inline">
              Public Dental Practice Website
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 mr-1 hidden sm:inline">Preview portals:</span>
            <button
              onClick={() => handleRoleChange('LANDING')}
              className="px-2.5 py-1 rounded transition-colors font-semibold text-xs bg-[#0D9488] text-white"
            >
              Public Website
            </button>
            <button
              onClick={() => handleRoleChange('PATIENT')}
              className="px-2.5 py-1 rounded transition-colors font-medium text-xs bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Patient Portal
            </button>
            <button
              onClick={() => handleRoleChange('ADMIN')}
              className="px-2.5 py-1 rounded transition-colors font-medium text-xs bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Admin Triage
            </button>
            <button
              onClick={() => handleRoleChange('DENTIST')}
              className="px-2.5 py-1 rounded transition-colors font-medium text-xs bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Dentist Practice
            </button>
          </div>
        </div>

        <LandingPage
          onBookAppointment={() => {
            setCurrentRole('PATIENT');
            setActiveTab('book');
          }}
          onLogin={() => {
            setCurrentRole('PATIENT');
            setActiveTab('dashboard');
          }}
          onAdminLogin={() => {
            setCurrentRole('ADMIN');
            setActiveTab('dashboard');
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F8FA] text-[#334155] flex flex-col font-sans selection:bg-[#CCFBF1] selection:text-[#0F766E]">
      
      {/* 1. DEMO & ROLE SWITCHER BAR */}
      <div className="bg-[#0B1D2D] text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between border-b border-slate-800 gap-2">
        <span className="rounded-full bg-slate-800 px-2.5 py-1 font-semibold text-slate-200">Demo mode</span>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 mr-1">Preview role:</span>
          <button
            onClick={() => handleRoleChange('LANDING')}
            className="px-2.5 py-1 rounded transition-colors font-medium text-slate-300 hover:bg-slate-700"
          >
            Public Website
          </button>
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
              Navigation
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
                  <button
                    onClick={() => { setActiveTab('dentists'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dentists' ? 'bg-[#CCFBF1] text-[#0F766E]' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Shield className="w-4 h-4" />
                    Dentist Roster
                  </button>
                  <button
                    onClick={() => { setActiveTab('schedules'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'schedules' ? 'bg-[#CCFBF1] text-[#0F766E]' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Clock className="w-4 h-4" />
                    Hours & Schedules
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
                  <button
                    onClick={() => { setActiveTab('shifts'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'shifts' ? 'bg-[#CCFBF1] text-[#0F766E]' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Calendar className="w-4 h-4" />
                    My Shifts & Leaves
                  </button>
                </>
              )}
            </nav>

            <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-2 text-slate-700 font-semibold mb-1">
                <Phone className="w-3.5 h-3.5 text-[#0D9488]" />
                Call the clinic
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
                      Your care overview
                    </h2>
                    <p className="text-sm text-slate-500">View your upcoming appointment and requests, or book a visit.</p>
                  </div>

                  {/* Next Scheduled Visit Hero */}
                  {appointments.find(a => a.status === 'CONFIRMED') && (
                    <div className="bg-white rounded-2xl border-2 border-[#0D9488]/30 p-5 sm:p-6 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#CCFBF1]/40 rounded-full blur-2xl -mr-10 -mt-10"></div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-bold tracking-wider uppercase text-[#0D9488] flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          Upcoming appointment
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
                                Dentist: <strong>{appt.dentistName}</strong> • {appt.chair}
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

                  <div className="flex flex-col gap-3 rounded-xl border border-[#BFE8E2] bg-[#F0FDFA] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-[#12304A]">Need an appointment?</h4>
                      <p className="text-xs text-slate-600 mt-0.5">Choose a service and preferred time.</p>
                    </div>
                    <button
                      onClick={() => { setActiveTab('book'); setWizardStep(1); }}
                      className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0F766E] sm:self-auto"
                    >
                      <Plus className="h-4 w-4" />
                      Book appointment
                    </button>
                  </div>

                  {/* Active Appointments Table */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="font-bold text-sm text-[#12304A]">Your appointments</h4>
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
                              {getAppointmentStatusLabel(appt.status)}
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

              {/* Booking Wizard */}
              {activeTab === 'book' && (
                <BookAppointmentPage onNavigateToAppointments={() => setActiveTab('appointments')} />
              )}

              {/* Patient My Appointments View */}
              {activeTab === 'appointments' && (
                <AppointmentHistoryPage onNavigateToBook={() => setActiveTab('book')} />
              )}
            </>
          )}

          {/* ======================================================== */}
          {/* B. ADMIN / RECEPTIONIST VIEWS */}
          {/* ======================================================== */}
          {currentRole === 'ADMIN' && (
            <>
              {activeTab === 'dashboard' && (
                <AdminDashboard onNavigateTab={(tab) => setActiveTab(tab)} />
              )}

              {/* Admin Appointment Triage Queue */}
              {activeTab === 'triage' && (
                <AdminAppointmentsPage />
              )}

              {/* Admin Patient Registry */}
              {activeTab === 'patients' && (
                <PatientListPage />
              )}

              {/* Admin Services & Pricing Catalog */}
              {activeTab === 'services' && (
                <ServicesPage />
              )}

              {/* Admin Dentist Roster */}
              {activeTab === 'dentists' && (
                <DentistListPage />
              )}

              {/* Admin Clinic Operating Hours & Dentist Shifts */}
              {activeTab === 'schedules' && (
                <AdminSchedulePage />
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

              {/* Dentist Shifts & Approved Leaves View */}
              {activeTab === 'shifts' && (
                <DentistDashboard dentistId={1} onNavigateTab={setActiveTab} />
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
                <p className="text-xs text-slate-500">{unreadNotifsCount} unread notifications</p>
              </div>
              <button
                onClick={() => setIsNotifDrawerOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Demo notifications</span>
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
                <span className="font-bold text-[#0D9488]">{getAppointmentStatusLabel(selectedApptDetail.status)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Schedule:</span>
                <span className="font-bold text-slate-800">{selectedApptDetail.date} at {selectedApptDetail.timeSlot}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Dentist:</span>
                <span className="font-bold text-slate-800">{selectedApptDetail.dentistName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Chair:</span>
                <span className="font-bold text-slate-800">{selectedApptDetail.chair}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Fee:</span>
                <span className="font-bold text-[#0D9488]">₱{selectedApptDetail.fee.toLocaleString()}</span>
              </div>
              {selectedApptDetail.chiefComplaint && (
                <div className="py-1">
                  <span className="text-slate-500 block mb-0.5">Notes for the clinic:</span>
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

            <div className="bg-amber-50 p-3 rounded border border-amber-200 text-xs text-amber-900">
              Cancellation eligibility follows clinic policy. This demo does not check the clinic's rules; contact reception if you are unsure.
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
        ToothCare Hub &copy; 2026.
      </footer>
    </div>
  );
}
