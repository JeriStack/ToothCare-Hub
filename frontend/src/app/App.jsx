import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Clock,
  User,
  Users,
  Shield,
  Stethoscope,
  Menu,
  X,
  Plus,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  LogOut,
  ChevronDown,
  RefreshCw,
  Bell,
  Key,
  Activity,
  BarChart3,
  Server,
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
import { ReceptionistDashboard } from '../features/dashboard/ReceptionistDashboard';
import { DentistDashboard } from '../features/dashboard/DentistDashboard';
import { ServicesPage } from '../features/services/pages/ServicesPage';
import { DentistListPage } from '../features/dentists/pages/DentistListPage';
import { PatientListPage } from '../features/patients/pages/PatientListPage';
import { AdminSchedulePage } from '../features/schedules/pages/AdminSchedulePage';
import { BookAppointmentPage } from '../features/appointments/pages/BookAppointmentPage';
import { AppointmentHistoryPage } from '../features/appointments/pages/AppointmentHistoryPage';
import { AdminAppointmentsPage } from '../features/appointments/pages/AdminAppointmentsPage';
import { LandingPage } from '../features/landing/LandingPage';
import { PatientServicesPage } from '../features/services/pages/PatientServicesPage';
import { PatientDentistsPage } from '../features/dentists/pages/PatientDentistsPage';
import { PatientProfilePage } from '../features/patients/pages/PatientProfilePage';
import { PatientNotificationsPage } from '../features/notifications/pages/PatientNotificationsPage';
import { NotificationCenter } from '../features/notifications/components/NotificationCenter';
import { DentistAppointmentsPage } from '../features/dentists/pages/DentistAppointmentsPage';
import { DentistAppointmentDetailPage } from '../features/dentists/pages/DentistAppointmentDetailPage';
import { DentistProfilePage } from '../features/dentists/pages/DentistProfilePage';
import { DentistTreatmentRecordsPage } from '../features/treatment-records/pages/DentistTreatmentRecordsPage';
import { UserManagementPage } from '../features/users/pages/UserManagementPage';
import { RolePermissionMatrixPage } from '../features/roles/pages/RolePermissionMatrixPage';
import { AuditTrailPage } from '../features/audit/pages/AuditTrailPage';
import { ReportsPage } from '../features/reports/pages/ReportsPage';
import { SystemHealthPage } from '../features/system/pages/SystemHealthPage';
import { StaffProfilePage } from '../features/staff/pages/StaffProfilePage';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { LoadingProvider, useRouteLoading } from '../contexts/LoadingContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { GlobalLoadingBar } from '../components/ui/GlobalLoadingBar';
import { ThemeToggle } from '../components/ui/ThemeToggle';

function getInitialRoute() {
  if (typeof window === 'undefined') return 'LANDING';
  const path = window.location.pathname.toLowerCase();
  if (path === '/login') return 'LOGIN';
  if (path === '/register') return 'REGISTER';
  if (path === '/forgot-password' || path === '/forgot') return 'FORGOT_PASSWORD';
  if (path === '/reset-password' || path === '/reset') return 'RESET_PASSWORD';
  if (path === '/verify-email' || path === '/verify') return 'VERIFY_EMAIL';
  if (path.startsWith('/patient')) return 'PATIENT';
  if (path.startsWith('/admin') || path.startsWith('/receptionist')) return 'ADMIN';
  if (path.startsWith('/dentist')) return 'DENTIST';
  return 'LANDING';
}

function getInitialTab() {
  if (typeof window === 'undefined') return 'dashboard';
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith('/patient/')) {
    const sub = path.replace('/patient/', '').split('/')[0];
    if (['dashboard', 'book', 'services', 'dentists', 'appointments', 'notifications', 'profile'].includes(sub)) {
      return sub;
    }
  }
  if (path.startsWith('/admin/') || path.startsWith('/receptionist/')) {
    const sub = path.replace(/^\/(admin|receptionist)\//, '').split('/')[0];
    if (
      [
        'dashboard',
        'triage',
        'queue',
        'patients',
        'services',
        'dentists',
        'schedules',
        'users',
        'roles',
        'audit',
        'reports',
        'system',
        'profile',
      ].includes(sub)
    ) {
      return sub === 'queue' ? 'triage' : sub;
    }
  }
  if (path.startsWith('/dentist/')) {
    const sub = path.replace('/dentist/', '').split('/')[0];
    if (['dashboard', 'appointments', 'treatment-records', 'profile'].includes(sub)) {
      return sub;
    }
  }
  return 'dashboard';
}

const ROLE_DISPLAY_TITLES = {
  ADMIN: 'Administrator',
  RECEPTIONIST: 'Front Desk Specialist',
  DENTIST: 'Dentist',
  PATIENT: 'Patient',
};

export function resolveUserIdentity(user, currentRole) {
  const roleLabel = ROLE_DISPLAY_TITLES[currentRole] || 'Patient';
  const dentist = user?.dentist;
  const patient = user?.patient;

  let firstName = '';
  let lastName = '';
  let displayName = '';

  if (dentist && (dentist.first_name || dentist.last_name)) {
    firstName = (dentist.first_name || '').trim();
    lastName = (dentist.last_name || '').trim();
    displayName = `Dr. ${`${firstName} ${lastName}`.trim()}`;
  } else if (patient && (patient.first_name || patient.last_name)) {
    firstName = (patient.first_name || '').trim();
    lastName = (patient.last_name || '').trim();
    displayName = `${firstName} ${lastName}`.trim();
  } else if (user?.first_name || user?.last_name) {
    firstName = (user.first_name || '').trim();
    lastName = (user.last_name || '').trim();
    displayName = `${firstName} ${lastName}`.trim();
  } else if (user?.display_name && !String(user.display_name).includes('@')) {
    displayName = String(user.display_name).trim();
  } else {
    displayName = roleLabel;
  }

  let initials = 'U';
  if (firstName || lastName) {
    initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'U';
  } else {
    const words = displayName.replace(/^Dr\.\s+/i, '').trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      initials = `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
    } else if (words.length === 1) {
      initials = words[0].slice(0, 2).toUpperCase();
    }
  }

  const avatarUrl = patient?.avatar_url || dentist?.avatar_url || user?.avatar_url || null;

  return { displayName, initials, roleLabel, avatarUrl };
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'toothcare_sidebar_collapsed';

function readSidebarCollapsedPref() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function persistSidebarCollapsedPref(collapsed) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // Ignore storage errors in restricted browsing contexts
  }
}

/** Build role-scoped sidebar navigation sections and items. */
function getSidebarSections(currentRole, hasPermission, { onPatientNav, onAdminNav, onDentistNav }) {
  if (currentRole === 'PATIENT') {
    return [
      {
        id: 'patient-primary',
        heading: null,
        items: [
          { key: 'dashboard', label: 'Dashboard', icon: Calendar, onSelect: () => onPatientNav('dashboard') },
          { key: 'book', label: 'Book Appointment', icon: Plus, onSelect: () => onPatientNav('book') },
          { key: 'services', label: 'Services', icon: Sparkles, onSelect: () => onPatientNav('services') },
          { key: 'dentists', label: 'Dentists', icon: Stethoscope, onSelect: () => onPatientNav('dentists') },
          { key: 'appointments', label: 'My Appointments', icon: FileText, onSelect: () => onPatientNav('appointments') },
          { key: 'notifications', label: 'Notifications', icon: Bell, onSelect: () => onPatientNav('notifications') },
          { key: 'profile', label: 'My Profile', icon: Shield, onSelect: () => onPatientNav('profile') },
        ],
      },
    ];
  }

  if (currentRole === 'ADMIN' || currentRole === 'RECEPTIONIST') {
    const adminSecurityItems = [
      hasPermission('users.view') && {
        key: 'users',
        label: 'User Accounts',
        icon: Users,
        onSelect: () => onAdminNav('users'),
      },
      hasPermission('roles.manage') && {
        key: 'roles',
        label: 'DRBAC Matrix',
        icon: Key,
        onSelect: () => onAdminNav('roles'),
      },
      hasPermission('audit_logs.view') && {
        key: 'audit',
        label: 'Audit Trail',
        icon: Activity,
        onSelect: () => onAdminNav('audit'),
      },
      hasPermission('reports.view') && {
        key: 'reports',
        label: 'Reports & Analytics',
        icon: BarChart3,
        onSelect: () => onAdminNav('reports'),
      },
      (hasPermission('system.health') || hasPermission('settings.manage')) && {
        key: 'system',
        label: 'System & Settings',
        icon: Server,
        onSelect: () => onAdminNav('system'),
      },
    ].filter(Boolean);

    return [
      {
        id: 'admin-primary',
        heading: null,
        items: [
          { key: 'dashboard', label: 'Overview', icon: Calendar, onSelect: () => onAdminNav('dashboard') },
          { key: 'triage', label: 'Review Queue', icon: Clock, onSelect: () => onAdminNav('triage') },
          { key: 'patients', label: 'Patient Registry', icon: User, onSelect: () => onAdminNav('patients') },
          { key: 'services', label: 'Services & Fees', icon: Stethoscope, onSelect: () => onAdminNav('services') },
          { key: 'dentists', label: 'Dentist Roster', icon: Shield, onSelect: () => onAdminNav('dentists') },
          { key: 'schedules', label: 'Hours & Schedules', icon: Clock, onSelect: () => onAdminNav('schedules') },
          { key: 'profile', label: 'My Profile', icon: Shield, onSelect: () => onAdminNav('profile') },
        ],
      },
      ...(adminSecurityItems.length > 0
        ? [
            {
              id: 'admin-security',
              heading: 'Administration & Security',
              items: adminSecurityItems,
            },
          ]
        : []),
    ];
  }

  if (currentRole === 'DENTIST') {
    return [
      {
        id: 'dentist-primary',
        heading: null,
        items: [
          { key: 'dashboard', label: 'Overview', icon: Clock, onSelect: () => onDentistNav('dashboard') },
          { key: 'appointments', label: 'Assigned Appointments', icon: Calendar, onSelect: () => onDentistNav('appointments') },
          { key: 'treatment-records', label: 'Treatment Records', icon: FileText, onSelect: () => onDentistNav('treatment-records') },
          { key: 'profile', label: 'My Profile', icon: Shield, onSelect: () => onDentistNav('profile') },
        ],
      },
    ];
  }

  return [];
}

function AppContent() {
  const { user, isAuthenticated, isLoading, logout, hasPermission, refreshUser } = useAuth();

  // Active View / Route
  const [currentRoute, setCurrentRoute] = useState(getInitialRoute);
  
  // Navigation tabs per role
  const [activeTab, setActiveTab] = useState(getInitialTab);
  
  // UI Panels
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(readSidebarCollapsedPref);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    setFailedAvatarUrl(null);
  }, [user?.avatar_url, user?.patient?.avatar_url, user?.dentist?.avatar_url]);

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      persistSidebarCollapsedPref(next);
      return next;
    });
  };
  const [toastMessage, setToastMessage] = useState(null);
  const [bookingPrefill, setBookingPrefill] = useState(null);
  const [selectedDentistAppointmentId, setSelectedDentistAppointmentId] = useState(null);
  const userMenuRef = useRef(null);
  const userMenuTriggerRef = useRef(null);
  const { triggerRouteTransition } = useRouteLoading();
  const prevNavKeyRef = useRef(null);

  // Trigger route transition tracking on qualifying navigation, tab, and detail changes
  useEffect(() => {
    const nextKey = `${currentRoute}:${activeTab}:${selectedDentistAppointmentId || ''}`;
    if (prevNavKeyRef.current === null) {
      prevNavKeyRef.current = nextKey;
      return;
    }
    if (prevNavKeyRef.current !== nextKey) {
      prevNavKeyRef.current = nextKey;
      triggerRouteTransition(nextKey);
    }
  }, [currentRoute, activeTab, selectedDentistAppointmentId, triggerRouteTransition]);

  // Trigger Toast helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Patient Sub-Route Navigation with URL History Sync
  const handlePatientNav = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    const subPath = tab === 'dashboard' ? '/patient' : `/patient/${tab}`;
    if (window.location.pathname !== subPath) {
      window.history.pushState({}, '', subPath);
    }
  };

  // Admin Sub-Route Navigation with URL History Sync
  const handleAdminNav = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    const subPath = tab === 'dashboard' ? '/admin' : `/admin/${tab}`;
    if (window.location.pathname !== subPath) {
      window.history.pushState({}, '', subPath);
    }
  };

  // Dentist Sub-Route Navigation with URL History Sync
  const handleDentistNav = (tab) => {
    setActiveTab(tab);
    setSelectedDentistAppointmentId(null);
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    const subPath = tab === 'dashboard' ? '/dentist' : `/dentist/${tab}`;
    if (window.location.pathname !== subPath) {
      window.history.pushState({}, '', subPath);
    }
  };

  // Navigation handler with browser URL sync
  const navigateTo = (route, path) => {
    setCurrentRoute(route);
    setActiveTab('dashboard');
    if (path && window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  };

  // Sign out handler
  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    await logout();
    showToast('You have been signed out successfully.');
    navigateTo('LANDING', '/');
  };

  // Close user account menu on outside click or Escape key
  useEffect(() => {
    if (!isUserMenuOpen) return undefined;

    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
        userMenuTriggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

  // Popstate & Global Auth Event Listeners
  useEffect(() => {
    const handlePopState = () => {
      const route = getInitialRoute();
      setCurrentRoute(route);
      setActiveTab(getInitialTab());
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
      const isAdminOrReceptionist = role === 'ADMIN' || role === 'RECEPTIONIST';

      if (currentRoute === 'PATIENT' && role !== 'PATIENT') {
        const dest = isAdminOrReceptionist ? '/admin' : '/dentist';
        navigateTo(role, dest);
        showToast(
          `Redirected to your authorized ${
            role === 'ADMIN' ? 'administrator' : role === 'RECEPTIONIST' ? 'front desk' : 'dentist'
          } portal.`
        );
      } else if (currentRoute === 'ADMIN' && !isAdminOrReceptionist) {
        const dest = role === 'DENTIST' ? '/dentist' : '/patient';
        navigateTo(role, dest);
        showToast('Access restricted: Administrative or Front Desk authorization required.');
      } else if (currentRoute === 'DENTIST' && role !== 'DENTIST') {
        const dest = isAdminOrReceptionist ? '/admin' : '/patient';
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 text-[#0D9488] dark:text-[#2DD4BF] animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Verifying authenticated session...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated Guard for Protected Portals
  if (
    !isLoading &&
    !isAuthenticated &&
    (currentRoute === 'PATIENT' || currentRoute === 'ADMIN' || currentRoute === 'DENTIST')
  ) {
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

  // Resolve user display info (always real user name, never raw email)
  const {
    displayName: userDisplayName,
    initials: userInitials,
    roleLabel: userRoleLabel,
    avatarUrl: userAvatarUrl,
  } = resolveUserIdentity(user, currentRole);
  const showUserAvatar = Boolean(userAvatarUrl && failedAvatarUrl !== userAvatarUrl);

  const sidebarSections = getSidebarSections(currentRole, hasPermission, {
    onPatientNav: handlePatientNav,
    onAdminNav: handleAdminNav,
    onDentistNav: handleDentistNav,
  });

  return (
    <div className="min-h-dvh bg-[#F5F8FA] dark:bg-gray-900 text-[#334155] dark:text-slate-200 flex flex-col font-sans overflow-x-clip selection:bg-[#CCFBF1] selection:text-[#0F766E] dark:selection:bg-teal-900/70 dark:selection:text-teal-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#12304A] dark:focus:bg-teal-700 focus:text-white focus:text-xs focus:font-semibold focus:shadow-lg"
      >
        Skip to main content
      </a>
      
      {/* MAIN APPLICATION TOPBAR */}
      <header className="bg-[#12304A] dark:bg-slate-950/95 dark:border-b dark:border-slate-800 text-white sticky top-0 z-40 shadow-md">
        <div className="w-full px-3 sm:px-5 lg:px-6 xl:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="portal-sidebar"
              className="lg:hidden min-h-10 min-w-10 inline-flex items-center justify-center p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              aria-label="Navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2.5 group text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-lg"
            >
              <div className="w-10 h-10 group-hover:scale-105 transition-transform flex items-center justify-center shrink-0">
                <img
                  src="/images/logo-icon.png"
                  alt="ToothCare Hub Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col text-left">
                <h1 className="font-bold text-xl tracking-tight leading-tight text-white">
                  Tooth<span className="text-[#14B8A6]">Care</span> Hub
                </h1>
                <span className="hidden sm:block text-[10px] tracking-wide text-teal-400 font-medium">
                  Healthier Smiles. Brighter Futures.
                </span>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle variant="header" />

            {/* In-App Notifications Dropdown */}
            {(currentRole === 'PATIENT' || currentRole === 'DENTIST') && (
              <NotificationCenter
                onNavigateAll={() => {
                  if (currentRole === 'PATIENT') {
                    handlePatientNav('notifications');
                  } else {
                    setActiveTab('appointments');
                  }
                }}
              />
            )}

            {/* User Profile Account Dropdown */}
            <div className="relative pl-2 border-l border-white/10" ref={userMenuRef}>
              <button
                ref={userMenuTriggerRef}
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-expanded={isUserMenuOpen}
                aria-controls="user-account-menu"
                aria-label={`${userDisplayName} account menu`}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-[#0D9488]/30 border border-[#14B8A6] text-teal-200 flex items-center justify-center font-semibold text-xs shrink-0 overflow-hidden">
                  {showUserAvatar ? (
                    <img
                      src={userAvatarUrl}
                      alt=""
                      onError={() => setFailedAvatarUrl(userAvatarUrl)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    userInitials
                  )}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold leading-tight text-white">
                    {userDisplayName}
                  </p>
                  <p className="text-[10px] text-teal-200/80">
                    {userRoleLabel}
                  </p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-teal-200/80 transition-transform duration-150 ${
                    isUserMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isUserMenuOpen && (
                <div
                  id="user-account-menu"
                  className="absolute right-0 mt-2 w-64 max-w-[calc(100dvw-2rem)] rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-slate-200/90 dark:border-gray-700 z-50 overflow-hidden text-slate-800 dark:text-gray-100 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="px-4 py-3 bg-slate-50/90 dark:bg-gray-900/70 border-b border-slate-100 dark:border-gray-700">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#CCFBF1] dark:bg-teal-900/60 border border-teal-200 dark:border-teal-700 text-[#0F766E] dark:text-teal-200 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                        {showUserAvatar ? (
                          <img
                            src={userAvatarUrl}
                            alt=""
                            onError={() => setFailedAvatarUrl(userAvatarUrl)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          userInitials
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#12304A] dark:text-gray-50 truncate">
                          {userDisplayName}
                        </p>
                        <p className="text-[11px] font-medium text-[#0F766E] dark:text-teal-300 truncate">
                          {userRoleLabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-1.5 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        if (currentRole === 'PATIENT') {
                          handlePatientNav('profile');
                        } else if (currentRole === 'DENTIST') {
                          handleDentistNav('profile');
                        } else {
                          handleAdminNav('profile');
                        }
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700/70 hover:text-[#12304A] dark:hover:text-white transition-colors text-left"
                    >
                      <User className="w-4 h-4 text-[#0D9488] dark:text-teal-400" />
                      <span>My Profile</span>
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-gray-700" />

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* APP BODY CONTAINER */}
      <div className="flex-1 w-full px-3 sm:px-5 lg:px-6 xl:px-8 py-4 sm:py-6 flex flex-col lg:flex-row gap-4 lg:gap-6">
        
        {/* Navigation Sidebar */}
        <aside
          id="portal-sidebar"
          data-collapsed={isSidebarCollapsed ? 'true' : 'false'}
          className={`shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none ${
            isSidebarCollapsed ? 'w-full lg:w-[4.5rem]' : 'w-full lg:w-60'
          } ${isMobileMenuOpen ? 'block' : 'hidden lg:block'}`}
        >
          <div
            className={`bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700 shadow-sm lg:sticky lg:top-20 ${
              isSidebarCollapsed ? 'p-3 lg:p-2' : 'p-3'
            }`}
          >
            <div
              className={`flex items-center ${
                isSidebarCollapsed
                  ? 'justify-between lg:justify-center pb-2 mb-1.5 lg:border-b lg:border-slate-100 dark:lg:border-gray-700'
                  : 'justify-between pl-3 pr-1 py-1 mb-1'
              }`}
            >
              <span
                className={`text-[11px] font-semibold uppercase text-slate-400 dark:text-gray-400 tracking-wider ${
                  isSidebarCollapsed ? 'lg:hidden' : ''
                }`}
              >
                Navigation
              </span>
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                aria-expanded={!isSidebarCollapsed}
                aria-controls="portal-sidebar-nav"
                aria-label="Toggle sidebar"
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
                className="hidden lg:inline-flex items-center justify-center min-h-9 min-w-9 rounded-lg text-slate-400 dark:text-gray-400 hover:text-[#12304A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-700/70 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <nav id="portal-sidebar-nav" aria-label="Portal" className="space-y-1">
              {sidebarSections.map((section) => (
                <React.Fragment key={section.id}>
                  {section.heading && (
                    <>
                      <div
                        className={`pt-3 pb-1 px-3 ${isSidebarCollapsed ? 'lg:hidden' : ''}`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-400">
                          {section.heading}
                        </span>
                      </div>
                      {isSidebarCollapsed && (
                        <div className="hidden lg:block my-2 border-t border-slate-100 dark:border-gray-700" aria-hidden="true" />
                      )}
                    </>
                  )}
                  {section.items.map(({ key, label, icon: Icon, onSelect }) => {
                    const isActive = activeTab === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={onSelect}
                        title={isSidebarCollapsed ? label : undefined}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-full min-h-10 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                          isSidebarCollapsed ? 'lg:justify-center lg:px-2' : ''
                        } ${
                          isActive
                            ? 'bg-[#CCFBF1] text-[#0F766E] dark:bg-teal-500/20 dark:text-teal-300'
                            : 'text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700/60 dark:hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span
                          className={
                            isSidebarCollapsed ? 'lg:sr-only whitespace-nowrap' : 'truncate'
                          }
                        >
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main id="main-content" tabIndex={-1} className="portal-main-shell flex-1 min-w-0 w-full focus:outline-none">
          
          {/* ======================================================== */}
          {/* A. PATIENT PORTAL VIEWS */}
          {/* ======================================================== */}
          {currentRole === 'PATIENT' && (
            <>
              {activeTab === 'dashboard' && (
                <PatientDashboard
                  user={user}
                  onNavigateToBook={() => handlePatientNav('book')}
                  onNavigateToAppointments={() => handlePatientNav('appointments')}
                  onNavigateToServices={() => handlePatientNav('services')}
                  onNavigateToDentists={() => handlePatientNav('dentists')}
                  onNavigateToProfile={() => handlePatientNav('profile')}
                />
              )}

              {activeTab === 'book' && (
                <BookAppointmentPage
                  initialService={bookingPrefill?.service}
                  initialDentist={bookingPrefill?.dentist}
                  onNavigateToAppointments={() => handlePatientNav('appointments')}
                />
              )}

              {activeTab === 'services' && (
                <PatientServicesPage
                  onBookService={(service) => {
                    setBookingPrefill((prev) => ({ ...prev, service }));
                    handlePatientNav('book');
                  }}
                />
              )}

              {activeTab === 'dentists' && (
                <PatientDentistsPage
                  onBookDentist={(dentist) => {
                    setBookingPrefill((prev) => ({ ...prev, dentist }));
                    handlePatientNav('book');
                  }}
                />
              )}

              {activeTab === 'appointments' && (
                <AppointmentHistoryPage onNavigateToBook={() => handlePatientNav('book')} />
              )}

              {activeTab === 'notifications' && (
                <PatientNotificationsPage
                  onNavigateAppointment={() => handlePatientNav('appointments')}
                />
              )}

              {activeTab === 'profile' && (
                <PatientProfilePage
                  onProfileUpdated={(message) => {
                    refreshUser?.();
                    showToast(message || 'Your clinical profile has been updated.');
                  }}
                />
              )}
            </>
          )}

          {/* ======================================================== */}
          {/* B. RECEPTIONIST FRONT DESK OPERATIONS VIEWS */}
          {/* ======================================================== */}
          {currentRole === 'RECEPTIONIST' && (
            <>
              {activeTab === 'dashboard' && (
                <ReceptionistDashboard user={user} onNavigateTab={(tab) => handleAdminNav(tab)} />
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

              {activeTab === 'users' && hasPermission('users.view') && (
                <UserManagementPage />
              )}

              {activeTab === 'roles' && hasPermission('roles.manage') && (
                <RolePermissionMatrixPage />
              )}

              {activeTab === 'audit' && hasPermission('audit_logs.view') && (
                <AuditTrailPage />
              )}

              {activeTab === 'reports' && hasPermission('reports.view') && (
                <ReportsPage />
              )}

              {activeTab === 'system' && (hasPermission('system.health') || hasPermission('settings.manage')) && (
                <SystemHealthPage />
              )}

              {activeTab === 'profile' && (
                <StaffProfilePage onProfileUpdated={(msg) => showToast(msg || 'Your staff profile has been updated.')} />
              )}
            </>
          )}

          {/* ======================================================== */}
          {/* C. ADMIN VIEWS */}
          {/* ======================================================== */}
          {currentRole === 'ADMIN' && (
            <>
              {activeTab === 'dashboard' && (
                <AdminDashboard onNavigateTab={(tab) => handleAdminNav(tab)} />
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

              {activeTab === 'profile' && (
                <StaffProfilePage onProfileUpdated={(msg) => showToast(msg || 'Your administrator profile has been updated.')} />
              )}

              {activeTab === 'users' && (
                <UserManagementPage />
              )}

              {activeTab === 'roles' && (
                <RolePermissionMatrixPage />
              )}

              {activeTab === 'audit' && (
                <AuditTrailPage />
              )}

              {activeTab === 'reports' && (
                <ReportsPage />
              )}

              {activeTab === 'system' && (
                <SystemHealthPage />
              )}
            </>
          )}

          {/* ======================================================== */}
          {/* C. DENTIST CLINICAL PRACTICE VIEWS */}
          {/* ======================================================== */}
          {currentRole === 'DENTIST' && (
            <>
              {activeTab === 'dashboard' && (
                <DentistDashboard
                  dentistId={user?.dentist?.id || user?.id || 1}
                  onNavigateTab={(tab) => {
                    setActiveTab(tab);
                    setSelectedDentistAppointmentId(null);
                  }}
                  onSelectAppointment={(id) => {
                    setSelectedDentistAppointmentId(id);
                    setActiveTab('appointments');
                  }}
                />
              )}

              {activeTab === 'appointments' && (
                selectedDentistAppointmentId ? (
                  <DentistAppointmentDetailPage
                    appointmentId={selectedDentistAppointmentId}
                    onBack={() => setSelectedDentistAppointmentId(null)}
                  />
                ) : (
                  <DentistAppointmentsPage
                    onSelectAppointment={(id) => setSelectedDentistAppointmentId(id)}
                  />
                )
              )}

              {activeTab === 'treatment-records' && (
                <DentistTreatmentRecordsPage />
              )}

              {activeTab === 'profile' && (
                <DentistProfilePage
                  onProfileUpdated={(message) => {
                    refreshUser?.();
                    showToast(message || 'Your practitioner profile has been updated.');
                  }}
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
      <footer className="bg-white dark:bg-gray-900 border-t border-slate-200 dark:border-gray-800 mt-auto py-4 text-center text-xs text-slate-400 dark:text-gray-400">
        ToothCare Hub &copy; 2026. Real-Time Clinical Management System.
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LoadingProvider>
          <GlobalLoadingBar />
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </LoadingProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
