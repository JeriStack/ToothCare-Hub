import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  Shield,
  Stethoscope,
  Menu,
  X,
  Plus,
  FileText,
  Phone,
  ArrowLeft,
  Sparkles,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import {
  AuthProvider,
  useAuth,
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from '../features/auth';
import { PatientDashboard } from '../features/dashboard/PatientDashboard';
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

function getInitialRoute() {
  if (typeof window === 'undefined') return 'LANDING';
  const path = window.location.pathname.toLowerCase();
  if (path === '/login') return 'LOGIN';
  if (path === '/register') return 'REGISTER';
  if (path === '/forgot-password' || path === '/forgot') return 'FORGOT_PASSWORD';
  if (path === '/reset-password' || path === '/reset') return 'RESET_PASSWORD';
  if (path === '/verify-email' || path === '/verify') return 'VERIFY_EMAIL';
  if (path === '/patient') return 'PATIENT';
  if (path === '/admin') return 'ADMIN';
  if (path === '/dentist') return 'DENTIST';
  return 'LANDING';
}

function AppContent() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // Active View / Route
  const [currentRoute, setCurrentRoute] = useState(getInitialRoute);
  
  // Navigation tabs per role
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // UI Panels
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [bookingPrefill, setBookingPrefill] = useState(null);

  // Trigger Toast helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Navigation handler with browser URL sync
  const navigateTo = (route, path) => {
    setCurrentRoute(route);
    setActiveTab('dashboard');
    if (path && window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setIsMobileMenuOpen(false);
  };

  // Sign out handler
  const handleSignOut = async () => {
    await logout();
    showToast('You have been signed out successfully.');
    navigateTo('LANDING', '/');
  };

  // Popstate & Global Auth Event Listeners
  useEffect(() => {
    const handlePopState = () => {
      const route = getInitialRoute();
      setCurrentRoute(route);
    };

    const handleForbidden = (e) => {
      showToast(e.detail?.message || 'Access denied: Insufficient permissions for this resource.');
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('toothcare:forbidden', handleForbidden);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('toothcare:forbidden', handleForbidden);
    };
  }, []);

  // Server-Governed Route & Role Authorization Guard
  useEffect(() => {
    if (isLoading) return;

    const isProtectedRoute =
      currentRoute === 'PATIENT' || currentRoute === 'ADMIN' || currentRoute === 'DENTIST';

    if (isProtectedRoute) {
      if (!isAuthenticated) {
        navigateTo('LOGIN', '/login');
        showToast('Please sign in to access your portal.');
        return;
      }

      const role = user?.role?.toUpperCase();
      if (currentRoute === 'PATIENT' && role !== 'PATIENT') {
        const dest = role === 'ADMIN' ? '/admin' : '/dentist';
        navigateTo(role, dest);
        showToast(`Redirected to your authorized ${role === 'ADMIN' ? 'administrator' : 'dentist'} portal.`);
      } else if (currentRoute === 'ADMIN' && role !== 'ADMIN') {
        const dest = role === 'DENTIST' ? '/dentist' : '/patient';
        navigateTo(role, dest);
        showToast('Access restricted: Administrative authorization required.');
      } else if (currentRoute === 'DENTIST' && role !== 'DENTIST') {
        const dest = role === 'ADMIN' ? '/admin' : '/patient';
        navigateTo(role, dest);
        showToast('Access restricted: Dentist clinical authorization required.');
      }
    }
  }, [isLoading, isAuthenticated, user, currentRoute]);

  // Loading Session State Guard for Protected Portals
  if (
    isLoading &&
    (currentRoute === 'PATIENT' || currentRoute === 'ADMIN' || currentRoute === 'DENTIST')
  ) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 text-[#0D9488] animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Verifying authenticated session...</p>
        </div>
      </div>
    );
  }

  // 1. Auth Page Views
  if (currentRoute === 'LOGIN') {
    return (
      <LoginPage
        onSuccess={(loggedUser) => {
          const role = loggedUser?.role?.toUpperCase();
          const firstName =
            loggedUser?.patient?.first_name ||
            loggedUser?.dentist?.first_name ||
            loggedUser?.first_name ||
            'User';
          showToast(`Welcome back, ${firstName}!`);

          if (role === 'ADMIN') {
            navigateTo('ADMIN', '/admin');
          } else if (role === 'DENTIST') {
            navigateTo('DENTIST', '/dentist');
          } else {
            navigateTo('PATIENT', '/patient');
          }
        }}
        onNavigateRegister={() => navigateTo('REGISTER', '/register')}
        onNavigateForgotPassword={() => navigateTo('FORGOT_PASSWORD', '/forgot-password')}
        onNavigateHome={() => navigateTo('LANDING', '/')}
      />
    );
  }

  if (currentRoute === 'REGISTER') {
    return (
      <RegisterPage
        onSuccess={() => {
          showToast('Account created successfully! Check your email for verification.');
          navigateTo('LOGIN', '/login');
        }}
        onNavigateLogin={() => navigateTo('LOGIN', '/login')}
        onNavigateHome={() => navigateTo('LANDING', '/')}
      />
    );
  }

  if (currentRoute === 'FORGOT_PASSWORD') {
    return (
      <ForgotPasswordPage
        onNavigateLogin={() => navigateTo('LOGIN', '/login')}
        onNavigateHome={() => navigateTo('LANDING', '/')}
      />
    );
  }

  if (currentRoute === 'RESET_PASSWORD') {
    return (
      <ResetPasswordPage
        onNavigateLogin={() => navigateTo('LOGIN', '/login')}
        onNavigateForgotPassword={() => navigateTo('FORGOT_PASSWORD', '/forgot-password')}
        onNavigateHome={() => navigateTo('LANDING', '/')}
      />
    );
  }

  if (currentRoute === 'VERIFY_EMAIL') {
    return (
      <VerifyEmailPage
        onNavigateLogin={() => navigateTo('LOGIN', '/login')}
        onNavigateHome={() => navigateTo('LANDING', '/')}
      />
    );
  }

  // 2. Public Landing Page (Production-ready without demo bars)
  if (currentRoute === 'LANDING') {
    return (
      <LandingPage
        onBookAppointment={(service, dentist) => {
          if (service || dentist) {
            setBookingPrefill({ service, dentist });
          }
          if (isAuthenticated) {
            const role = user?.role?.toUpperCase();
            if (role === 'PATIENT') {
              navigateTo('PATIENT', '/patient');
              setActiveTab('book');
            } else {
              navigateTo(role, role === 'ADMIN' ? '/admin' : '/dentist');
            }
          } else {
            navigateTo('LOGIN', '/login');
            showToast('Please sign in or create an account to schedule an appointment.');
          }
        }}
        onLogin={() => {
          if (isAuthenticated) {
            const role = user?.role?.toUpperCase() || 'PATIENT';
            navigateTo(role, `/${role.toLowerCase()}`);
          } else {
            navigateTo('LOGIN', '/login');
          }
        }}
        onAdminLogin={() => {
          if (isAuthenticated && user?.role === 'ADMIN') {
            navigateTo('ADMIN', '/admin');
          } else {
            navigateTo('LOGIN', '/login');
          }
        }}
      />
    );
  }

  // 3. Authenticated Role Definition
  const currentRole = user?.role?.toUpperCase() || currentRoute;

  // Resolve user display info
  const userInitials = user
    ? `${(
        user.patient?.first_name?.[0] ||
        user.dentist?.first_name?.[0] ||
        user.first_name?.[0] ||
        user.email?.[0] ||
        'U'
      ).toUpperCase()}${(
        user.patient?.last_name?.[0] ||
        user.dentist?.last_name?.[0] ||
        user.last_name?.[0] ||
        ''
      ).toUpperCase()}`
    : 'U';

  const userDisplayName = user?.patient
    ? `${user.patient.first_name} ${user.patient.last_name}`
    : user?.dentist
    ? `Dr. ${user.dentist.first_name} ${user.dentist.last_name}`
    : user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.email || 'Authenticated User';

  const roleBadgeLabel =
    currentRole === 'PATIENT'
      ? 'Patient Portal'
      : currentRole === 'ADMIN'
      ? 'Admin Portal'
      : 'Dentist Portal';

  return (
    <div className="min-h-screen bg-[#F5F8FA] text-[#334155] flex flex-col font-sans selection:bg-[#CCFBF1] selection:text-[#0F766E]">
      
      {/* MAIN APPLICATION TOPBAR */}
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
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-10 h-10 flex items-center justify-center shrink-0">
                <img
                  src="/images/logo-icon.png"
                  alt="ToothCare Hub Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="font-bold text-base leading-tight tracking-tight text-white flex items-center gap-2">
                  Tooth<span className="text-[#0D9488]">Care</span> Hub
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#CCFBF1] text-[#0F766E] hidden sm:inline-block">
                    {roleBadgeLabel}
                  </span>
                </h1>
                <p className="text-[11px] text-teal-200/80 hidden sm:block">Healthier Smiles. Brighter Futures.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User Profile Info */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
              <div className="w-8 h-8 rounded-full bg-[#0D9488]/30 border border-[#0D9488] text-teal-200 flex items-center justify-center font-semibold text-xs">
                {userInitials}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold leading-tight text-white">
                  {userDisplayName}
                </p>
                <p className="text-[10px] text-teal-200/70">
                  {currentRole === 'ADMIN'
                    ? 'Administrator'
                    : currentRole === 'DENTIST'
                    ? 'Attending Dentist'
                    : 'Patient'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out of account"
                className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* APP BODY CONTAINER */}
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
                    onClick={() => { setActiveTab('book'); setIsMobileMenuOpen(false); }}
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
                  <button
                    onClick={() => navigateTo('LANDING', '/')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Website
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'triage' ? 'bg-[#CCFBF1] text-[#0F766E]' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Clock className="w-4 h-4" />
                    Review Queue
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
                  <button
                    onClick={() => navigateTo('LANDING', '/')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Website
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
                    Clinical Practice
                  </button>
                  <button
                    onClick={() => { setActiveTab('shifts'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'shifts' ? 'bg-[#CCFBF1] text-[#0F766E]' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Calendar className="w-4 h-4" />
                    My Shifts & Leaves
                  </button>
                  <button
                    onClick={() => navigateTo('LANDING', '/')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Website
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
              {activeTab === 'dashboard' && (
                <PatientDashboard
                  user={user}
                  onNavigateToBook={() => setActiveTab('book')}
                  onNavigateToAppointments={() => setActiveTab('appointments')}
                />
              )}

              {activeTab === 'book' && (
                <BookAppointmentPage
                  initialService={bookingPrefill?.service}
                  initialDentist={bookingPrefill?.dentist}
                  onNavigateToAppointments={() => setActiveTab('appointments')}
                />
              )}

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

              {activeTab === 'triage' && (
                <AdminAppointmentsPage />
              )}

              {activeTab === 'patients' && (
                <PatientListPage />
              )}

              {activeTab === 'services' && (
                <ServicesPage />
              )}

              {activeTab === 'dentists' && (
                <DentistListPage />
              )}

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
              {(activeTab === 'dashboard' || activeTab === 'shifts') && (
                <DentistDashboard
                  dentistId={user?.dentist?.id || user?.id || 1}
                  onNavigateTab={setActiveTab}
                />
              )}
            </>
          )}

        </main>
      </div>

      {/* Floating Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#12304A] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700 text-xs animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Sparkles className="w-4 h-4 text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-4 text-center text-xs text-slate-400">
        ToothCare Hub &copy; 2026. Real-Time Clinical Management System.
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
