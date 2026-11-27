import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
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
  Archive,
  History,
  MessageSquare,
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
import { LandingPage } from '../features/landing/LandingPage';
import { NotificationCenter } from '../features/notifications/components/NotificationCenter';
import { NotificationToastContainer } from '../components/notifications/NotificationToastContainer';

// Phase 18 Performance Hardening: route/role-level code splitting for portal & help pages
const HelpCenterPage = lazy(() => import('../features/help/pages/HelpCenterPage').then((m) => ({ default: m.HelpCenterPage })));
const TermsOfServicePage = lazy(() => import('../features/legal/pages/TermsOfServicePage').then((m) => ({ default: m.TermsOfServicePage })));
const PrivacyPolicyPage = lazy(() => import('../features/legal/pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })));
const LegalReacceptanceModal = lazy(() => import('../features/legal/components/LegalReacceptanceModal').then((m) => ({ default: m.LegalReacceptanceModal })));
const PatientDashboard = lazy(() => import('../features/dashboard/PatientDashboard').then((m) => ({ default: m.PatientDashboard })));
const AdminDashboard = lazy(() => import('../features/dashboard/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const ReceptionistDashboard = lazy(() => import('../features/dashboard/ReceptionistDashboard').then((m) => ({ default: m.ReceptionistDashboard })));
const DentistDashboard = lazy(() => import('../features/dashboard/DentistDashboard').then((m) => ({ default: m.DentistDashboard })));
const ServicesPage = lazy(() => import('../features/services/pages/ServicesPage').then((m) => ({ default: m.ServicesPage })));
const DentistListPage = lazy(() => import('../features/dentists/pages/DentistListPage').then((m) => ({ default: m.DentistListPage })));
const PatientListPage = lazy(() => import('../features/patients/pages/PatientListPage').then((m) => ({ default: m.PatientListPage })));
const AdminSchedulePage = lazy(() => import('../features/schedules/pages/AdminSchedulePage').then((m) => ({ default: m.AdminSchedulePage })));
const BookAppointmentPage = lazy(() => import('../features/appointments/pages/BookAppointmentPage').then((m) => ({ default: m.BookAppointmentPage })));
const AppointmentHistoryPage = lazy(() => import('../features/appointments/pages/AppointmentHistoryPage').then((m) => ({ default: m.AppointmentHistoryPage })));
const AdminAppointmentsPage = lazy(() => import('../features/appointments/pages/AdminAppointmentsPage').then((m) => ({ default: m.AdminAppointmentsPage })));
const PatientServicesPage = lazy(() => import('../features/services/pages/PatientServicesPage').then((m) => ({ default: m.PatientServicesPage })));
const PatientDentistsPage = lazy(() => import('../features/dentists/pages/PatientDentistsPage').then((m) => ({ default: m.PatientDentistsPage })));
const PatientProfilePage = lazy(() => import('../features/patients/pages/PatientProfilePage').then((m) => ({ default: m.PatientProfilePage })));
const PatientNotificationsPage = lazy(() => import('../features/notifications/pages/PatientNotificationsPage').then((m) => ({ default: m.PatientNotificationsPage })));
const DentistAppointmentsPage = lazy(() => import('../features/dentists/pages/DentistAppointmentsPage').then((m) => ({ default: m.DentistAppointmentsPage })));
const DentistAppointmentDetailPage = lazy(() => import('../features/dentists/pages/DentistAppointmentDetailPage').then((m) => ({ default: m.DentistAppointmentDetailPage })));
const DentistProfilePage = lazy(() => import('../features/dentists/pages/DentistProfilePage').then((m) => ({ default: m.DentistProfilePage })));
const DentistTreatmentRecordsPage = lazy(() => import('../features/treatment-records/pages/DentistTreatmentRecordsPage').then((m) => ({ default: m.DentistTreatmentRecordsPage })));
const UserManagementPage = lazy(() => import('../features/users/pages/UserManagementPage').then((m) => ({ default: m.UserManagementPage })));
const RolePermissionMatrixPage = lazy(() => import('../features/roles/pages/RolePermissionMatrixPage').then((m) => ({ default: m.RolePermissionMatrixPage })));
const AuditTrailPage = lazy(() => import('../features/audit/pages/AuditTrailPage').then((m) => ({ default: m.AuditTrailPage })));
const ReportsPage = lazy(() => import('../features/reports/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const SystemHealthPage = lazy(() => import('../features/system/pages/SystemHealthPage').then((m) => ({ default: m.SystemHealthPage })));
const StaffProfilePage = lazy(() => import('../features/staff/pages/StaffProfilePage').then((m) => ({ default: m.StaffProfilePage })));
const ArchiveCenterPage = lazy(() => import('../features/archives/pages/ArchiveCenterPage').then((m) => ({ default: m.ArchiveCenterPage })));
const HistoryRecordsPage = lazy(() => import('../features/history/pages/HistoryRecordsPage').then((m) => ({ default: m.HistoryRecordsPage })));
const MessagesPage = lazy(() => import('../features/messages/pages/MessagesPage').then((m) => ({ default: m.MessagesPage })));
import { useUnreadMessagesBadge } from '../features/messages/hooks/useUnreadMessagesBadge';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { LoadingProvider, useRouteLoading } from '../contexts/LoadingContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { RealtimeProvider } from '../contexts/RealtimeProvider';
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
  if (path === '/help-support' || path === '/help-support/') return 'HELP_SUPPORT';
  if (path === '/terms-of-service' || path === '/terms-of-service/') return 'TERMS_OF_SERVICE';
  if (path === '/privacy-policy' || path === '/privacy-policy/') return 'PRIVACY_POLICY';
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
    if (['dashboard', 'book', 'services', 'dentists', 'appointments', 'messages', 'archives', 'notifications', 'profile'].includes(sub)) {
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
        'history',
        'archives',
        'reports',
        'system',
        'notifications',
        'profile',
      ].includes(sub)
    ) {
      return sub === 'queue' ? 'triage' : sub;
    }
  }
  if (path.startsWith('/dentist/')) {
    const sub = path.replace('/dentist/', '').split('/')[0];
    if (['dashboard', 'appointments', 'messages', 'treatment-records', 'archives', 'notifications', 'profile'].includes(sub)) {
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
function getSidebarSections(currentRole, hasPermission, { onPatientNav, onAdminNav, onDentistNav, unreadMessagesCount = 0 }) {
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
          { key: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadMessagesCount, onSelect: () => onPatientNav('messages') },
          { key: 'archives', label: 'My Archive', icon: Archive, onSelect: () => onPatientNav('archives') },
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
      (currentRole === 'ADMIN' || hasPermission('history.view')) && {
        key: 'history',
        label: 'History Records',
        icon: History,
        onSelect: () => onAdminNav('history'),
      },
      currentRole === 'ADMIN' && {
        key: 'archives',
        label: 'Archive Vault',
        icon: Archive,
        onSelect: () => onAdminNav('archives'),
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
          ...(currentRole === 'RECEPTIONIST'
            ? [{ key: 'archives', label: 'Archive Vault', icon: Archive, onSelect: () => onAdminNav('archives') }]
            : []),
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
          { key: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadMessagesCount, onSelect: () => onDentistNav('messages') },
          { key: 'treatment-records', label: 'Treatment Records', icon: FileText, onSelect: () => onDentistNav('treatment-records') },
          { key: 'archives', label: 'Clinical Archive', icon: Archive, onSelect: () => onDentistNav('archives') },
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
  const [adminTriageInitialFilters, setAdminTriageInitialFilters] = useState({ statusFilter: '', date: '' });
  const [dentistApptInitialStatus, setDentistApptInitialStatus] = useState('ALL');
  const [legalOriginRoute, setLegalOriginRoute] = useState(null);
  const userMenuRef = useRef(null);
  const userMenuTriggerRef = useRef(null);
  const mobileMenuTriggerRef = useRef(null);
  const mobileDrawerRef = useRef(null);
  const mobileDrawerCloseRef = useRef(null);
  const { triggerRouteTransition } = useRouteLoading();
  const prevNavKeyRef = useRef(null);

  // Live unread direct-message counter (active strictly for Patient & Dentist sessions)
  const unreadMessagesCount = useUnreadMessagesBadge(isAuthenticated, user?.role);

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
  const handlePatientNav = (tab, options = {}) => {
    if (tab === 'book' && !options?.preservePrefill) {
      setBookingPrefill(null);
    }
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    const subPath = tab === 'dashboard' ? '/patient' : `/patient/${tab}`;
    if (window.location.pathname !== subPath) {
      window.history.pushState({}, '', subPath);
    }
  };

  // Admin Sub-Route Navigation with URL History Sync
  const handleAdminNav = (tab, options = {}) => {
    setActiveTab(tab);
    if (tab === 'triage') {
      setAdminTriageInitialFilters({
        statusFilter: options?.statusFilter || '',
        date: options?.date || '',
      });
    }
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    const subPath = tab === 'dashboard' ? '/admin' : `/admin/${tab}`;
    if (window.location.pathname !== subPath) {
      window.history.pushState({}, '', subPath);
    }
  };

  // Dentist Sub-Route Navigation with URL History Sync
  const handleDentistNav = (tab, options = {}) => {
    setActiveTab(tab);
    setSelectedDentistAppointmentId(options?.appointmentId ?? null);
    if (tab === 'appointments') {
      setDentistApptInitialStatus(options?.statusFilter || 'ALL');
    }
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
    if (route !== 'TERMS_OF_SERVICE' && route !== 'PRIVACY_POLICY') {
      setLegalOriginRoute(null);
    }
    if (path && window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  };

  const navigateToLegal = (targetRoute, path, origin = null) => {
    if (origin) {
      setLegalOriginRoute(origin);
    } else if (currentRoute === 'REGISTER') {
      setLegalOriginRoute('REGISTER');
    }
    navigateTo(targetRoute, path);
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

  // Mobile navigation drawer: Escape to close, focus trap + restore, body scroll lock,
  // and automatic dismissal once the viewport grows into the persistent desktop sidebar.
  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;

    const trigger = mobileMenuTriggerRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mobileDrawerCloseRef.current?.focus();

    const getFocusable = () =>
      Array.from(
        mobileDrawerRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsMobileMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const desktopQuery =
      typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 1024px)') : null;
    const handleDesktopChange = (event) => {
      if (event.matches) setIsMobileMenuOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    desktopQuery?.addEventListener?.('change', handleDesktopChange);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      desktopQuery?.removeEventListener?.('change', handleDesktopChange);
      trigger?.focus?.();
    };
  }, [isMobileMenuOpen]);

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

  // Shared helper: map role to its canonical portal route & URL
  const navigateToRolePortal = (roleValue) => {
    const normalized = String(roleValue || 'PATIENT').toUpperCase();
    if (normalized === 'ADMIN' || normalized === 'RECEPTIONIST') {
      navigateTo('ADMIN', '/admin');
    } else if (normalized === 'DENTIST') {
      navigateTo('DENTIST', '/dentist');
    } else {
      navigateTo('PATIENT', '/patient');
    }
  };

  const renderToastBanner = () =>
    toastMessage ? (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 sm:max-w-sm z-[60] bg-[#12304A] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700 text-xs"
      >
        <Sparkles className="w-4 h-4 text-teal-400 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">{toastMessage}</span>
      </div>
    ) : null;

  const isProtectedPortalRoute = (route) =>
    route === 'PATIENT' || route === 'ADMIN' || route === 'RECEPTIONIST' || route === 'DENTIST';

  // Server-Governed Route & Role Authorization Guard
  useEffect(() => {
    if (isLoading) return;

    const isProtectedRoute = isProtectedPortalRoute(currentRoute);

    if (isProtectedRoute) {
      if (!isAuthenticated) {
        navigateTo('LOGIN', '/login');
        showToast('Please sign in to access your portal.');
        return;
      }

      const role = user?.role?.toUpperCase();
      const isAdminOrReceptionist = role === 'ADMIN' || role === 'RECEPTIONIST';

      if (currentRoute === 'RECEPTIONIST') {
        if (isAdminOrReceptionist) {
          navigateTo('ADMIN', '/admin');
        } else {
          navigateToRolePortal(role);
          showToast('Access restricted: Administrative or Front Desk authorization required.');
        }
        return;
      }

      if (currentRoute === 'PATIENT' && role !== 'PATIENT') {
        navigateToRolePortal(role);
        showToast(
          `Redirected to your authorized ${
            role === 'ADMIN' ? 'administrator' : role === 'RECEPTIONIST' ? 'front desk' : 'dentist'
          } portal.`
        );
      } else if (currentRoute === 'ADMIN' && !isAdminOrReceptionist) {
        navigateToRolePortal(role);
        showToast('Access restricted: Administrative or Front Desk authorization required.');
      } else if (currentRoute === 'DENTIST' && role !== 'DENTIST') {
        navigateToRolePortal(role);
        showToast('Access restricted: Dentist clinical authorization required.');
      }
    }
  }, [isLoading, isAuthenticated, user, currentRoute]);

  // Loading Session State Guard for Protected Portals
  if (isLoading && isProtectedPortalRoute(currentRoute)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 text-[#0D9488] dark:text-[#2DD4BF] animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Verifying authenticated session...</p>
        </div>
      </div>
    );
  }

  const handleLoginSuccess = (loggedUser) => {
    const role = loggedUser?.role?.toUpperCase();
    const firstName =
      loggedUser?.patient?.first_name ||
      loggedUser?.dentist?.first_name ||
      loggedUser?.first_name ||
      'User';
    showToast(`Welcome back, ${firstName}!`);
    navigateToRolePortal(role);
  };

  // Unauthenticated Guard for Protected Portals
  if (!isLoading && !isAuthenticated && isProtectedPortalRoute(currentRoute)) {
    return (
      <>
        <LoginPage
          onSuccess={handleLoginSuccess}
          onNavigateRegister={() => navigateTo('REGISTER', '/register')}
          onNavigateForgotPassword={() => navigateTo('FORGOT_PASSWORD', '/forgot-password')}
          onNavigateHome={() => navigateTo('LANDING', '/')}
        />
        {renderToastBanner()}
      </>
    );
  }

  // 1. Auth Page Views
  if (currentRoute === 'LOGIN') {
    return (
      <>
        <LoginPage
          onSuccess={handleLoginSuccess}
          onNavigateRegister={() => navigateTo('REGISTER', '/register')}
          onNavigateForgotPassword={() => navigateTo('FORGOT_PASSWORD', '/forgot-password')}
          onNavigateHome={() => navigateTo('LANDING', '/')}
        />
        {renderToastBanner()}
      </>
    );
  }

  if (currentRoute === 'REGISTER') {
    return (
      <>
        <RegisterPage
          onSuccess={() => {
            showToast('Account created successfully! Check your email for verification.');
          }}
          onNavigateLogin={() => navigateTo('LOGIN', '/login')}
          onNavigateHome={() => navigateTo('LANDING', '/')}
          onNavigateTerms={() => navigateToLegal('TERMS_OF_SERVICE', '/terms-of-service', 'REGISTER')}
          onNavigatePrivacy={() => navigateToLegal('PRIVACY_POLICY', '/privacy-policy', 'REGISTER')}
        />
        {renderToastBanner()}
      </>
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

  // 2. Public Help Center & Support (accessible without authentication)
  if (currentRoute === 'HELP_SUPPORT') {
    return (
      <Suspense
        fallback={
          <div className="min-h-dvh flex items-center justify-center bg-[#F5F8FA] dark:bg-gray-900">
            <div
              role="status"
              aria-label="Loading Help Center"
              className="w-8 h-8 rounded-full border-2 border-[#0D9488] border-t-transparent animate-spin"
            />
          </div>
        }
      >
        <HelpCenterPage
        onNavigateHome={() => navigateTo('LANDING', '/')}
        onNavigateLandingSection={(sectionId) => {
          navigateTo('LANDING', '/');
          window.requestAnimationFrame?.(() => {
            window.setTimeout(() => {
              const target = document.getElementById(sectionId);
              if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 60);
          });
        }}
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
              navigateToRolePortal(role);
            }
          } else {
            navigateTo('LOGIN', '/login');
            showToast('Please sign in or create an account to schedule an appointment.');
          }
        }}
        onLogin={() => {
          if (isAuthenticated) {
            navigateToRolePortal(user?.role);
          } else {
            navigateTo('LOGIN', '/login');
          }
        }}
        onViewAppointments={() => {
          if (isAuthenticated) {
            const role = user?.role?.toUpperCase() || 'PATIENT';
            if (role === 'PATIENT') {
              navigateTo('PATIENT', '/patient/appointments');
              setActiveTab('appointments');
            } else {
              navigateToRolePortal(role);
            }
          } else {
            navigateTo('LOGIN', '/login');
          }
        }}
        onRegister={() => navigateTo('REGISTER', '/register')}
        onForgotPassword={() => navigateTo('FORGOT_PASSWORD', '/forgot-password')}
        onAdminLogin={() => {
          const role = user?.role?.toUpperCase();
          if (isAuthenticated && (role === 'ADMIN' || role === 'RECEPTIONIST')) {
            navigateTo('ADMIN', '/admin');
          } else {
            navigateTo('LOGIN', '/login');
          }
        }}
        onTermsOfService={() => navigateToLegal('TERMS_OF_SERVICE', '/terms-of-service')}
        onPrivacyPolicy={() => navigateToLegal('PRIVACY_POLICY', '/privacy-policy')}
      />
      </Suspense>
    );
  }

  // 2a. Public Legal Document Pages (accessible without authentication)
  if (currentRoute === 'TERMS_OF_SERVICE' || currentRoute === 'PRIVACY_POLICY') {
    const LegalPageComponent =
      currentRoute === 'PRIVACY_POLICY' ? PrivacyPolicyPage : TermsOfServicePage;
    return (
      <>
      <Suspense
        fallback={
          <div className="min-h-dvh flex items-center justify-center bg-[#F5F8FA] dark:bg-gray-900">
            <div
              role="status"
              aria-label="Loading legal document"
              className="w-8 h-8 rounded-full border-2 border-[#0D9488] border-t-transparent animate-spin"
            />
          </div>
        }
      >
        <LegalPageComponent
          cameFromRegister={legalOriginRoute === 'REGISTER'}
          onNavigateHome={() => navigateTo('LANDING', '/')}
          onNavigateRegister={() => navigateTo('REGISTER', '/register')}
          onNavigateTerms={() => navigateToLegal('TERMS_OF_SERVICE', '/terms-of-service', legalOriginRoute)}
          onNavigatePrivacy={() => navigateToLegal('PRIVACY_POLICY', '/privacy-policy', legalOriginRoute)}
          onHelpSupport={() => navigateTo('HELP_SUPPORT', '/help-support')}
          onNavigateLandingSection={(sectionId) => {
            navigateTo('LANDING', '/');
            window.requestAnimationFrame?.(() => {
              window.setTimeout(() => {
                const target = document.getElementById(sectionId);
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }, 60);
            });
          }}
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
                navigateToRolePortal(role);
              }
            } else {
              navigateTo('LOGIN', '/login');
              showToast('Please sign in or create an account to schedule an appointment.');
            }
          }}
          onNavigateLogin={() => {
            if (isAuthenticated) {
              navigateToRolePortal(user?.role);
            } else {
              navigateTo('LOGIN', '/login');
            }
          }}
          onAdminLogin={() => {
            const role = user?.role?.toUpperCase();
            if (isAuthenticated && (role === 'ADMIN' || role === 'RECEPTIONIST')) {
              navigateTo('ADMIN', '/admin');
            } else {
              navigateTo('LOGIN', '/login');
            }
          }}
        />
      </Suspense>
      {renderToastBanner()}
      </>
    );
  }

  // 2b. Public Landing Page (Production-ready without demo bars)
  if (currentRoute === 'LANDING') {
    return (
      <>
      <LandingPage
        onHelpSupport={() => navigateTo('HELP_SUPPORT', '/help-support')}
        onTermsOfService={() => navigateToLegal('TERMS_OF_SERVICE', '/terms-of-service')}
        onPrivacyPolicy={() => navigateToLegal('PRIVACY_POLICY', '/privacy-policy')}
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
              navigateToRolePortal(role);
            }
          } else {
            navigateTo('LOGIN', '/login');
            showToast('Please sign in or create an account to schedule an appointment.');
          }
        }}
        onLogin={() => {
          if (isAuthenticated) {
            navigateToRolePortal(user?.role);
          } else {
            navigateTo('LOGIN', '/login');
          }
        }}
        onAdminLogin={() => {
          const role = user?.role?.toUpperCase();
          if (isAuthenticated && (role === 'ADMIN' || role === 'RECEPTIONIST')) {
            navigateTo('ADMIN', '/admin');
          } else {
            navigateTo('LOGIN', '/login');
          }
        }}
      />
      {renderToastBanner()}
      </>
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
    unreadMessagesCount,
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
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <button
              ref={mobileMenuTriggerRef}
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="portal-sidebar"
              className="lg:hidden min-h-11 min-w-11 inline-flex items-center justify-center p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 cursor-pointer"
              aria-label="Navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('dashboard');
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-2.5 group text-left cursor-pointer min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-lg"
            >
              <div className="w-10 h-10 group-hover:scale-105 motion-reduce:transform-none transition-transform flex items-center justify-center shrink-0">
                <img
                  src="/images/logo-icon.png"
                  alt="ToothCare Hub Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="hidden min-[420px]:flex flex-col text-left min-w-0">
                <h1 className="font-bold text-lg sm:text-xl tracking-tight leading-tight text-white truncate">
                  Tooth<span className="text-[#14B8A6]">Care</span> Hub
                </h1>
                <span className="hidden sm:block text-[10px] tracking-wide text-teal-400 font-medium truncate">
                  Healthier Smiles. Brighter Futures.
                </span>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <ThemeToggle variant="header" />

            {/* Direct Messages Shortcut (Patient & Dentist Portals Only) */}
            {(currentRole === 'PATIENT' || currentRole === 'DENTIST') && (
              <button
                type="button"
                onClick={() => {
                  if (currentRole === 'PATIENT') {
                    handlePatientNav('messages');
                  } else {
                    handleDentistNav('messages');
                  }
                }}
                aria-label={
                  unreadMessagesCount > 0
                    ? `Messages (${unreadMessagesCount} unread)`
                    : 'Messages'
                }
                aria-current={activeTab === 'messages' ? 'page' : undefined}
                title="Messages"
                data-testid="header-messages-button"
                className={`relative inline-flex items-center justify-center min-h-11 min-w-11 p-2 rounded-xl transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                  activeTab === 'messages'
                    ? 'bg-white/15 text-teal-300'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <MessageSquare className="w-5 h-5" aria-hidden="true" />
                {unreadMessagesCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0.5 right-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-[#0B6EFD] dark:bg-blue-500 px-1 text-[10px] font-bold text-white shadow-sm"
                  >
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                  </span>
                )}
              </button>
            )}

            {/* Unified In-App Notifications Dropdown (All Four Authenticated Roles) */}
            <NotificationCenter
              onSelectNotification={(notif) => {
                const refType = notif?.reference_type || 'appointments';
                if (currentRole === 'PATIENT') {
                  handlePatientNav('appointments');
                } else if (currentRole === 'DENTIST') {
                  if (refType === 'schedules') {
                    handleDentistNav('dashboard');
                  } else if (refType === 'accounts') {
                    handleDentistNav('profile');
                  } else {
                    handleDentistNav('appointments', {
                      appointmentId: notif?.reference_id || null,
                    });
                  }
                } else {
                  if (refType === 'schedules') {
                    handleAdminNav('schedules');
                  } else if (refType === 'services') {
                    handleAdminNav('services');
                  } else if (refType === 'accounts') {
                    handleAdminNav(currentRole === 'ADMIN' ? 'users' : 'patients');
                  } else {
                    handleAdminNav('triage');
                  }
                }
              }}
              onViewAllNotifications={() => {
                if (currentRole === 'PATIENT') {
                  handlePatientNav('notifications');
                } else if (currentRole === 'DENTIST') {
                  handleDentistNav('notifications');
                } else {
                  handleAdminNav('notifications');
                }
              }}
            />

            {/* User Profile Account Dropdown */}
            <div className="relative pl-1.5 sm:pl-2 border-l border-white/10" ref={userMenuRef}>
              <button
                ref={userMenuTriggerRef}
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-expanded={isUserMenuOpen}
                aria-controls="user-account-menu"
                aria-label={`${userDisplayName} account menu`}
                title={userDisplayName}
                className="flex items-center justify-center min-h-11 min-w-11 p-1 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-[#0D9488]/30 border border-[#14B8A6] text-teal-200 flex items-center justify-center font-semibold text-xs shrink-0 overflow-hidden">
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
              </button>

              {isUserMenuOpen && (
                <div
                  id="user-account-menu"
                  className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-slate-200/90 dark:border-gray-700 z-50 overflow-hidden text-slate-800 dark:text-gray-100"
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
                      className="w-full min-h-11 flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700/70 hover:text-[#12304A] dark:hover:text-white transition-colors text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
                    >
                      <User className="w-4 h-4 text-[#0D9488] dark:text-teal-400" />
                      <span>My Profile</span>
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-gray-700" />

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full min-h-11 flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
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
        
        {/* Mobile drawer backdrop */}
        {isMobileMenuOpen && (
          <div
            data-testid="portal-drawer-backdrop"
            className="fixed inset-0 z-[45] bg-slate-950/55 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Navigation Sidebar (off-canvas drawer below lg, persistent sidebar at lg+) */}
        <aside
          id="portal-sidebar"
          ref={mobileDrawerRef}
          data-collapsed={isSidebarCollapsed ? 'true' : 'false'}
          data-mobile-open={isMobileMenuOpen ? 'true' : 'false'}
          className={`fixed inset-y-0 left-0 z-50 w-[min(20rem,calc(100vw-2.5rem))] overflow-y-auto overscroll-contain bg-white dark:bg-gray-800 shadow-2xl duration-200 ease-out motion-reduce:transition-none ${
            /* Open: visible immediately so focus can move in. Closed: visibility flips only after the slide-out. */
            isMobileMenuOpen
              ? 'translate-x-0 visible transition-transform'
              : '-translate-x-full invisible transition-[transform,visibility]'
          } lg:static lg:inset-auto lg:z-auto lg:shrink-0 lg:translate-x-0 lg:visible lg:overflow-visible lg:bg-transparent lg:dark:bg-transparent lg:shadow-none lg:transition-[width] ${
            isSidebarCollapsed ? 'lg:w-[4.5rem]' : 'lg:w-60'
          }`}
        >
          <div
            className={`lg:bg-white lg:dark:bg-gray-800 lg:rounded-xl lg:border lg:border-slate-200/80 lg:dark:border-gray-700 lg:shadow-sm lg:sticky lg:top-20 ${
              isSidebarCollapsed ? 'p-3 lg:p-2' : 'p-3'
            }`}
          >
            {/* Drawer header (mobile / tablet only) */}
            <div className="lg:hidden flex items-center justify-between gap-3 pl-3 pr-1 pb-3 mb-2 border-b border-slate-100 dark:border-gray-700">
              <span className="text-sm font-bold text-[#12304A] dark:text-gray-50 truncate">
                {userRoleLabel} Menu
              </span>
              <button
                ref={mobileDrawerCloseRef}
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-gray-300 hover:text-[#12304A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-700/70 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div
              className={`hidden lg:flex items-center ${
                isSidebarCollapsed
                  ? 'justify-center pb-2 mb-1.5 border-b border-slate-100 dark:border-gray-700'
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
                className="inline-flex items-center justify-center min-h-9 min-w-9 rounded-lg text-slate-400 dark:text-gray-400 hover:text-[#12304A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-700/70 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400"
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
                  {section.items.map(({ key, label, icon: Icon, badge, onSelect }) => {
                    const isActive = activeTab === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={onSelect}
                        title={isSidebarCollapsed ? label : undefined}
                        aria-current={isActive ? 'page' : undefined}
                        className={`relative w-full min-h-11 lg:min-h-10 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] dark:focus-visible:ring-teal-400 ${
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
                            isSidebarCollapsed ? 'lg:sr-only whitespace-nowrap' : 'truncate flex-1 text-left'
                          }
                        >
                          {label}
                        </span>
                        {Number(badge) > 0 && (
                          <span
                            aria-label={`${badge} unread`}
                            className={`inline-flex items-center justify-center rounded-full text-[10px] font-bold text-white bg-[#0B6EFD] dark:bg-blue-500 ${
                              isSidebarCollapsed
                                ? 'lg:absolute lg:top-1.5 lg:right-1.5 lg:min-w-[1.1rem] lg:h-4 lg:px-1 min-w-[1.25rem] h-5 px-1.5'
                                : 'min-w-[1.25rem] h-5 px-1.5 shrink-0'
                            }`}
                          >
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
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
          <Suspense
            fallback={
              <div
                role="status"
                aria-live="polite"
                className="p-8 text-center text-sm text-slate-500 dark:text-gray-400"
              >
                Loading view...
              </div>
            }
          >
          
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
                  onNavigateToAppointments={() => {
                    setBookingPrefill(null);
                    handlePatientNav('appointments');
                  }}
                />
              )}

              {activeTab === 'services' && (
                <PatientServicesPage
                  onBookService={(service) => {
                    setBookingPrefill({ service, dentist: null });
                    handlePatientNav('book', { preservePrefill: true });
                  }}
                />
              )}

              {activeTab === 'dentists' && (
                <PatientDentistsPage
                  onBookDentist={(dentist) => {
                    setBookingPrefill({ service: null, dentist });
                    handlePatientNav('book', { preservePrefill: true });
                  }}
                />
              )}

              {activeTab === 'appointments' && (
                <AppointmentHistoryPage onNavigateToBook={() => handlePatientNav('book')} />
              )}

              {activeTab === 'messages' && (
                <MessagesPage />
              )}

              {activeTab === 'archives' && (
                <ArchiveCenterPage />
              )}

              {activeTab === 'notifications' && (
                <PatientNotificationsPage
                  onNavigateToAppointments={() => handlePatientNav('appointments')}
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

              {activeTab === 'history' && (
                <HistoryRecordsPage />
              )}

              {activeTab === 'archives' && (
                <ArchiveCenterPage />
              )}

              {activeTab === 'reports' && hasPermission('reports.view') && (
                <ReportsPage />
              )}

              {activeTab === 'system' && (hasPermission('system.health') || hasPermission('settings.manage')) && (
                <SystemHealthPage />
              )}

              {activeTab === 'notifications' && (
                <PatientNotificationsPage
                  onSelectNotification={(notif) => {
                    const refType = notif?.reference_type || 'appointments';
                    if (refType === 'schedules') handleAdminNav('schedules');
                    else if (refType === 'services') handleAdminNav('services');
                    else if (refType === 'accounts') handleAdminNav('patients');
                    else handleAdminNav('triage');
                  }}
                />
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
                <AdminDashboard onNavigateTab={(tab, options) => handleAdminNav(tab, options)} />
              )}

              {activeTab === 'triage' && (
                <AdminAppointmentsPage
                  initialStatus={adminTriageInitialFilters.statusFilter}
                  initialDate={adminTriageInitialFilters.date}
                />
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

              {activeTab === 'history' && (
                <HistoryRecordsPage />
              )}

              {activeTab === 'archives' && (
                <ArchiveCenterPage />
              )}

              {activeTab === 'reports' && (
                <ReportsPage />
              )}

              {activeTab === 'notifications' && (
                <PatientNotificationsPage
                  onSelectNotification={(notif) => {
                    const refType = notif?.reference_type || 'appointments';
                    if (refType === 'schedules') handleAdminNav('schedules');
                    else if (refType === 'services') handleAdminNav('services');
                    else if (refType === 'accounts') handleAdminNav('users');
                    else handleAdminNav('triage');
                  }}
                />
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
                  onNavigateTab={(tab, options) => handleDentistNav(tab, options)}
                  onSelectAppointment={(id) => handleDentistNav('appointments', { appointmentId: id })}
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
                    initialStatus={dentistApptInitialStatus}
                    onSelectAppointment={(id) => setSelectedDentistAppointmentId(id)}
                  />
                )
              )}

              {activeTab === 'treatment-records' && (
                <DentistTreatmentRecordsPage />
              )}

              {activeTab === 'messages' && (
                <MessagesPage />
              )}

              {activeTab === 'archives' && (
                <ArchiveCenterPage />
              )}

              {activeTab === 'notifications' && (
                <PatientNotificationsPage
                  onSelectNotification={(notif) => {
                    if (notif?.reference_type === 'schedules') {
                      handleDentistNav('dashboard');
                    } else if (notif?.reference_type === 'accounts') {
                      handleDentistNav('profile');
                    } else {
                      handleDentistNav('appointments', {
                        appointmentId: notif?.reference_id || null,
                      });
                    }
                  }}
                />
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

          </Suspense>
        </main>
      </div>

      {/* Real-Time Non-Intrusive Toast Notifications */}
      <NotificationToastContainer />

      {/* Floating Toast Feedback */}
      {renderToastBanner()}

      {/* Authenticated Legal Re-Acceptance Workflow (only triggered on material policy updates) */}
      {isAuthenticated && user?.legal_status?.requires_reacceptance && (
        <Suspense fallback={null}>
          <LegalReacceptanceModal
            isOpen={true}
            onCompleted={async () => {
              await refreshUser?.({ silent: true });
              showToast('Thank you. Your updated legal confirmation has been recorded.');
            }}
            onSignOut={handleSignOut}
          />
        </Suspense>
      )}

      {/* FOOTER */}
      <footer className="bg-white dark:bg-gray-900 border-t border-slate-200 dark:border-gray-800 mt-auto py-4 px-4 text-center text-xs text-slate-400 dark:text-gray-400">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span>ToothCare Hub &copy; 2026. Real-Time Clinical Management System.</span>
          <span aria-hidden="true">•</span>
          <a
            href="/terms-of-service"
            onClick={(e) => {
              e.preventDefault();
              navigateToLegal('TERMS_OF_SERVICE', '/terms-of-service');
            }}
            className="hover:text-[#0D9488] dark:hover:text-teal-400 underline underline-offset-2 transition-colors"
          >
            Terms of Service
          </a>
          <span aria-hidden="true">•</span>
          <a
            href="/privacy-policy"
            onClick={(e) => {
              e.preventDefault();
              navigateToLegal('PRIVACY_POLICY', '/privacy-policy');
            }}
            className="hover:text-[#0D9488] dark:hover:text-teal-400 underline underline-offset-2 transition-colors"
          >
            Privacy Policy
          </a>
        </div>
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
            <RealtimeProvider>
              <AppContent />
            </RealtimeProvider>
          </AuthProvider>
        </LoadingProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
