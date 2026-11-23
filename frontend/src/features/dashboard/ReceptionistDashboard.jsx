import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  UserCheck,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Plus,
  UserPlus,
  Search,
  Filter,
  ArrowRight,
  Phone,
  ShieldAlert,
  ChevronRight,
  Eye,
  AlertTriangle,
  Stethoscope,
  Sparkles,
  Timer
} from 'lucide-react';
import { receptionistApi } from '../receptionist/api';
import { DashboardSkeleton } from '../../components/skeletons/DashboardSkeleton';
import { useDashboardSync } from '../../hooks/useDashboardSync';
import { DASHBOARD_SYNC_DOMAINS } from '../../services/realtime/dashboardSync';


import { DialogOverlay } from '../../components/ui/DialogOverlay';
export function ReceptionistDashboard({ user, onNavigateTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters for Today's Schedule
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('ALL');

  // Modals state
  const [checkInTarget, setCheckInTarget] = useState(null);
  const [checkInNotes, setCheckInNotes] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const [attendanceModalTarget, setAttendanceModalTarget] = useState(null);
  const [attendanceStatusChoice, setAttendanceStatusChoice] = useState('WAITING');
  const [attendanceNotes, setAttendanceNotes] = useState('');
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState(false);

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: 'OTHER',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    medical_alerts: '',
  });
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
  const [registerSuccessMsg, setRegisterSuccessMsg] = useState(null);
  const [registerErrorMsg, setRegisterErrorMsg] = useState(null);

  const [toastMessage, setToastMessage] = useState(null);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const summary = await receptionistApi.getDashboard();
      setData(summary);
    } catch (err) {
      console.error('Failed to load receptionist dashboard:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to load front desk dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useDashboardSync({
    role: 'RECEPTIONIST',
    domains: [
      DASHBOARD_SYNC_DOMAINS.RECEPTIONIST_DASHBOARD,
      DASHBOARD_SYNC_DOMAINS.APPOINTMENTS,
      DASHBOARD_SYNC_DOMAINS.SCHEDULES,
      DASHBOARD_SYNC_DOMAINS.SERVICES,
      DASHBOARD_SYNC_DOMAINS.ACCOUNTS,
    ],
    onRefresh: () => fetchDashboardData(true),
  });

  // Handle Quick Check-In
  const handlePerformCheckIn = async (e) => {
    e.preventDefault();
    if (!checkInTarget) return;

    setIsCheckingIn(true);
    try {
      await receptionistApi.checkIn(checkInTarget.id, checkInNotes || null);
      triggerToast(`Checked in ${checkInTarget.patient_first_name} ${checkInTarget.patient_last_name} successfully.`);
      setCheckInTarget(null);
      setCheckInNotes('');
      fetchDashboardData(true);
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to record check-in.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Handle Attendance Status Transition
  const handleUpdateAttendanceStatus = async (e) => {
    e.preventDefault();
    if (!attendanceModalTarget) return;

    setIsUpdatingAttendance(true);
    try {
      await receptionistApi.updateAttendance(attendanceModalTarget.id, attendanceStatusChoice, attendanceNotes || null);
      triggerToast(`Attendance updated for ${attendanceModalTarget.patient_first_name} ${attendanceModalTarget.patient_last_name}.`);
      setAttendanceModalTarget(null);
      setAttendanceNotes('');
      fetchDashboardData(true);
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to update attendance.');
    } finally {
      setIsUpdatingAttendance(false);
    }
  };

  // Handle Front-Desk Walk-In Patient Intake
  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    setIsSubmittingRegister(true);
    setRegisterSuccessMsg(null);
    setRegisterErrorMsg(null);

    try {
      const res = await receptionistApi.registerPatient(registerForm);
      setRegisterSuccessMsg(res.message || 'Patient successfully registered!');
      triggerToast(`Patient ${registerForm.first_name} ${registerForm.last_name} registered.`);
      setRegisterForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        gender: 'OTHER',
        address: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        medical_alerts: '',
      });
      setTimeout(() => {
        setIsRegisterOpen(false);
        setRegisterSuccessMsg(null);
      }, 1500);
      fetchDashboardData(true);
    } catch (err) {
      setRegisterErrorMsg(err.response?.data?.error?.message || err.message || 'Registration failed.');
    } finally {
      setIsSubmittingRegister(false);
    }
  };

  if (loading && !data) {
    return <DashboardSkeleton role="receptionist" />;
  }

  const counts = data?.counts || {
    today_total: 0,
    pending_requests: 0,
    confirmed_today: 0,
    checked_in: 0,
    waiting: 0,
    in_consultation: 0,
    completed_today: 0,
    cancelled_today: 0,
  };

  const schedule = data?.today_schedule || [];
  const waitingList = data?.waiting_list || [];
  const pendingReview = data?.pending_review || [];

  // Filter schedule based on search and status
  const filteredSchedule = schedule.filter((item) => {
    const fullName = `${item.patient_first_name || ''} ${item.patient_last_name || ''}`.toLowerCase();
    const serviceName = (item.service_name || '').toLowerCase();
    const doctorName = `${item.dentist_first_name || ''} ${item.dentist_last_name || ''}`.toLowerCase();
    const phone = (item.patient_phone || '').toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch = fullName.includes(q) || serviceName.includes(q) || doctorName.includes(q) || phone.includes(q);
    const matchesFilter = attendanceFilter === 'ALL' || item.attendance_status === attendanceFilter;

    return matchesSearch && matchesFilter;
  });

  const receptionistName =
    user?.first_name
      ? `${user.first_name} ${user.last_name || ''}`.trim()
      : user?.display_name && !String(user.display_name).includes('@')
      ? user.display_name
      : 'Front Desk Specialist';

  return (
    <div className="space-y-8 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#12304A] dark:bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-teal-500/30 dark:border-teal-400/30 text-sm animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#12304A] to-[#1E3A8A] dark:from-[#0f2438] dark:to-[#172c64] dark:border dark:border-slate-700/80 text-white rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-teal-500/20 text-teal-300 border border-teal-400/30">
                Front Desk Operations
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Desk
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome back, {receptionistName}
            </h1>
            <p className="text-slate-300 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" />
              <span>Clinic Time: {data?.clinic_time || 'Asia/Manila (PST)'}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm shadow-sm transition-all focus:ring-2 focus:ring-teal-400/50"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register Patient</span>
            </button>
            <button
              onClick={() => onNavigateTab?.('triage')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm border border-white/20 transition-all"
            >
              <Calendar className="w-4 h-4 text-teal-300" />
              <span>Review Queue ({counts.pending_requests})</span>
            </button>
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/20 transition-all disabled:opacity-50"
              title="Refresh Clinic Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/80 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Unable to refresh dashboard data</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* 7 Operational KPI Summary Cards */}
      <div className="portal-grid-7">
        {/* 1. Today's Total */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-slate-200/80 dark:border-gray-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Today's Visits</span>
            <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{counts.today_total}</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Total scheduled</p>
          </div>
        </div>

        {/* 2. Pending Requests */}
        <div
          onClick={() => onNavigateTab?.('triage')}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-amber-200/80 dark:border-amber-800/70 shadow-xs flex flex-col justify-between cursor-pointer hover:border-amber-300 dark:hover:border-amber-600 transition-colors"
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-medium uppercase tracking-wider">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{counts.pending_requests}</span>
            <p className="text-[11px] text-amber-600/80 dark:text-amber-300/80 mt-0.5">Awaiting triage</p>
          </div>
        </div>

        {/* 3. Confirmed Today */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-slate-200/80 dark:border-gray-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
            <span className="text-xs font-medium uppercase tracking-wider">Confirmed</span>
            <CheckCircle2 className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{counts.confirmed_today}</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Ready for arrival</p>
          </div>
        </div>

        {/* 4. Arrived / Checked-In */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-emerald-200/80 dark:border-emerald-800/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-medium uppercase tracking-wider">Checked In</span>
            <UserCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{counts.checked_in}</span>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-300/80 mt-0.5">At the clinic</p>
          </div>
        </div>

        {/* 5. Waiting in Lobby */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-teal-200/80 dark:border-teal-800/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-teal-600 dark:text-teal-400">
            <span className="text-xs font-medium uppercase tracking-wider">Waiting Room</span>
            <Timer className="w-4 h-4 text-teal-500 dark:text-teal-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-teal-600 dark:text-teal-400">{counts.waiting}</span>
            {counts.in_consultation > 0 && (
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">({counts.in_consultation} in chair)</span>
            )}
            <p className="text-[11px] text-teal-600/80 dark:text-teal-300/80 mt-0.5">Queued</p>
          </div>
        </div>

        {/* 6. Completed Today */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-slate-200/80 dark:border-gray-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-700 dark:text-slate-200">{counts.completed_today}</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Visits finished</p>
          </div>
        </div>

        {/* 7. Cancelled Today */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-slate-200/80 dark:border-gray-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Cancelled</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-rose-500 dark:text-rose-400">{counts.cancelled_today}</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">No-show / cancelled</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Waiting List & Today's Schedule */}
      <div className="portal-split-1-2">
        {/* Left Column: Live Waiting Room Queue (1 Col) */}
        <div className="min-w-0 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between bg-slate-50/50 dark:bg-gray-800/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-50 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-lg">
                  <Timer className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Waiting Room Queue</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Patients currently on-site waiting for treatment</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300">
                {waitingList.length} Active
              </span>
            </div>

            <div className="p-4 divide-y divide-slate-100 dark:divide-gray-700">
              {waitingList.length === 0 ? (
                <div className="py-10 text-center text-slate-400 dark:text-slate-500">
                  <UserCheck className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 stroke-1" />
                  <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">No patients waiting</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Arrived patients will appear here with wait times</p>
                </div>
              ) : (
                waitingList.map((item) => (
                  <div key={item.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                            {item.patient_first_name} {item.patient_last_name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              item.status === 'IN_CONSULTATION'
                                ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300'
                                : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                            }`}
                          >
                            {item.status === 'IN_CONSULTATION' ? 'In Chair' : 'Waiting'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Dr. {item.dentist_first_name} {item.dentist_last_name} • {item.service_name}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                          <span className="flex items-center gap-1 text-teal-700 dark:text-teal-400 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            {item.waiting_minutes !== null ? `${item.waiting_minutes}m waiting` : 'Just checked in'}
                          </span>
                          <span>Slot: {item.start_at ? item.start_at.substring(11, 16) : ''}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => {
                            setAttendanceModalTarget(item);
                            setAttendanceStatusChoice(item.status === 'IN_CONSULTATION' ? 'FINISHED' : 'IN_CONSULTATION');
                          }}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          {item.status === 'IN_CONSULTATION' ? 'Finish Visit' : 'Call into Chair'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Review Queue Peeking */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pending Review Queue</h3>
              </div>
              <button
                onClick={() => onNavigateTab?.('triage')}
                className="tch-tap text-xs text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-semibold flex items-center gap-1"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-4 divide-y divide-slate-100 dark:divide-gray-700">
              {pendingReview.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 py-3 text-center">No pending appointment requests to review.</p>
              ) : (
                pendingReview.slice(0, 3).map((item) => (
                  <div key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {item.patient_first_name} {item.patient_last_name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.service_name}</p>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                      <span>{item.start_at ? item.start_at.substring(0, 16) : ''}</span>
                      <span className="text-amber-600 dark:text-amber-400 font-medium">Pending</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Today's Front Desk Schedule (2 Cols) */}
        <div className="min-w-0 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700 shadow-xs overflow-hidden">
            {/* Header with Search and Filter */}
            <div className="p-5 border-b border-slate-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50 dark:bg-gray-800/80">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Today's Clinic Schedule</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Manage arrivals, check-ins, and consultation progress</p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search patient or service..."
                    className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-gray-600 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400"
                  />
                </div>

                <select
                  value={attendanceFilter}
                  onChange={(e) => setAttendanceFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-gray-600 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 bg-white dark:bg-gray-700 text-slate-700 dark:text-slate-100"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="NOT_ARRIVED">Not Arrived</option>
                  <option value="CHECKED_IN">Checked In</option>
                  <option value="WAITING">Waiting</option>
                  <option value="IN_CONSULTATION">In Chair</option>
                  <option value="FINISHED">Finished</option>
                  <option value="NO_SHOW">No Show</option>
                </select>
              </div>
            </div>

            {/* Schedule Table / List */}
            <div className="overflow-x-auto">
              {filteredSchedule.length === 0 ? (
                <div className="py-14 text-center text-slate-400 dark:text-slate-500">
                  <Calendar className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 stroke-1" />
                  <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">No appointments found</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {searchQuery ? 'Try clearing your search or status filter' : 'No appointments scheduled for today.'}
                  </p>
                </div>
              ) : (
                <table role="table" className="tch-responsive-table w-full text-left border-collapse text-xs">
                  <thead role="rowgroup">
                    <tr role="row" className="border-b border-slate-100 dark:border-gray-700 bg-slate-50/75 dark:bg-gray-900/50 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th role="columnheader" className="py-3 px-4">Time</th>
                      <th role="columnheader" className="py-3 px-4">Patient</th>
                      <th role="columnheader" className="py-3 px-4">Service & Provider</th>
                      <th role="columnheader" className="py-3 px-4">Lifecycle</th>
                      <th role="columnheader" className="py-3 px-4">Desk State</th>
                      <th role="columnheader" className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup" className="divide-y divide-slate-100 dark:divide-gray-700">
                    {filteredSchedule.map((apt) => {
                      const startTime = apt.start_at ? apt.start_at.substring(11, 16) : '--:--';
                      const endTime = apt.end_at ? apt.end_at.substring(11, 16) : '--:--';
                      const isArrived = apt.attendance_status && apt.attendance_status !== 'NOT_ARRIVED';

                      return (
                        <tr role="row" key={apt.id} className="hover:bg-slate-50/60 dark:hover:bg-gray-700/40 transition-colors">
                          {/* Time */}
                          <td role="cell" data-label="Time" className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block">{startTime}</span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">to {endTime}</span>
                          </td>

                          {/* Patient */}
                          <td role="cell" data-label="Patient" className="py-3.5 px-4">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                              {apt.patient_first_name} {apt.patient_last_name}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                              {apt.patient_phone || 'No phone'}
                            </span>
                            {apt.patient_medical_alerts && apt.patient_medical_alerts !== 'None recorded' && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded mt-1 border border-rose-200 dark:border-rose-800">
                                <ShieldAlert className="w-2.5 h-2.5" />
                                {apt.patient_medical_alerts}
                              </span>
                            )}
                          </td>

                          {/* Service & Provider */}
                          <td role="cell" data-label="Service & Provider" className="py-3.5 px-4">
                            <span className="font-medium text-slate-800 dark:text-slate-200 block">{apt.service_name}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              Dr. {apt.dentist_first_name} {apt.dentist_last_name}
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5">
                              {apt.operatory_chair || 'Chair 1'}
                            </span>
                          </td>

                          {/* Lifecycle Status */}
                          <td role="cell" data-label="Lifecycle" className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                                apt.appointment_status === 'CONFIRMED'
                                  ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300'
                                  : apt.appointment_status === 'COMPLETED'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                                  : apt.appointment_status === 'CANCELLED'
                                  ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300'
                                  : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                              }`}
                            >
                              {apt.appointment_status}
                            </span>
                          </td>

                          {/* Attendance Status */}
                          <td role="cell" data-label="Desk State" className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 rounded text-[11px] font-medium inline-flex items-center gap-1 ${
                                apt.attendance_status === 'NOT_ARRIVED'
                                  ? 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300'
                                  : apt.attendance_status === 'CHECKED_IN'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                                  : apt.attendance_status === 'WAITING'
                                  ? 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300'
                                  : apt.attendance_status === 'IN_CONSULTATION'
                                  ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300'
                                  : apt.attendance_status === 'FINISHED'
                                  ? 'bg-slate-200 dark:bg-gray-700 text-slate-800 dark:text-slate-200'
                                  : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300'
                              }`}
                            >
                              {apt.attendance_status === 'NOT_ARRIVED' && 'Not Arrived'}
                              {apt.attendance_status === 'CHECKED_IN' && 'Checked In'}
                              {apt.attendance_status === 'WAITING' && 'Waiting'}
                              {apt.attendance_status === 'IN_CONSULTATION' && 'In Chair'}
                              {apt.attendance_status === 'FINISHED' && 'Finished'}
                              {apt.attendance_status === 'NO_SHOW' && 'No Show'}
                            </span>
                          </td>

                          {/* Action Button */}
                          <td role="cell" data-label="Action" className="py-3.5 px-4 text-right whitespace-nowrap">
                            {!isArrived && apt.appointment_status === 'CONFIRMED' ? (
                              <button
                                onClick={() => {
                                  setCheckInTarget(apt);
                                  setCheckInNotes('');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-teal-600 dark:bg-teal-700 hover:bg-teal-500 dark:hover:bg-teal-600 text-white font-medium text-xs transition-colors shadow-xs"
                              >
                                Check In
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setAttendanceModalTarget(apt);
                                  setAttendanceStatusChoice(apt.attendance_status || 'WAITING');
                                  setAttendanceNotes(apt.attendance_notes || '');
                                }}
                                className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-gray-600 hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors"
                              >
                                Manage
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Quick Check-In Modal */}
      {checkInTarget && (
        <DialogOverlay
          onClose={() => setCheckInTarget(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/65 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-gray-700 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <UserCheck className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Confirm Patient Arrival</h3>
              </div>
              <button
                onClick={() => setCheckInTarget(null)}
                aria-label="Close dialog" className="inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 rounded-lg text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>
                Confirm check-in for <strong className="text-slate-900 dark:text-slate-100">{checkInTarget.patient_first_name} {checkInTarget.patient_last_name}</strong>?
              </p>
              <div className="p-3 bg-slate-50 dark:bg-gray-900/60 rounded-xl space-y-1 text-xs border border-slate-200/70 dark:border-gray-700">
                <p><span className="text-slate-400 dark:text-slate-500">Service:</span> {checkInTarget.service_name}</p>
                <p><span className="text-slate-400 dark:text-slate-500">Dentist:</span> Dr. {checkInTarget.dentist_first_name} {checkInTarget.dentist_last_name}</p>
                <p><span className="text-slate-400 dark:text-slate-500">Scheduled Time:</span> {checkInTarget.start_at ? checkInTarget.start_at.substring(11, 16) : ''}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Desk Arrival Notes (Optional)
                </label>
                <input
                  type="text"
                  value={checkInNotes}
                  onChange={(e) => setCheckInNotes(e.target.value)}
                  placeholder="e.g. Arrived on time, ID verified, health declaration completed."
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCheckInTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePerformCheckIn}
                disabled={isCheckingIn}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-teal-600 dark:bg-teal-700 hover:bg-teal-500 dark:hover:bg-teal-600 text-white transition-colors disabled:opacity-50"
              >
                {isCheckingIn ? 'Checking in...' : 'Confirm Check-In'}
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* MODAL 2: Manage Attendance State Modal */}
      {attendanceModalTarget && (
        <DialogOverlay
          onClose={() => setAttendanceModalTarget(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/65 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-gray-700 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Update Attendance State</h3>
              <button
                onClick={() => setAttendanceModalTarget(null)}
                aria-label="Close dialog" className="inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 rounded-lg text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Patient: <strong className="text-slate-900 dark:text-slate-100">{attendanceModalTarget.patient_first_name} {attendanceModalTarget.patient_last_name}</strong>
              </p>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Attendance Status</label>
                <select
                  value={attendanceStatusChoice}
                  onChange={(e) => setAttendanceStatusChoice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="CHECKED_IN">Checked In (Front Desk)</option>
                  <option value="WAITING">Waiting in Lobby</option>
                  <option value="IN_CONSULTATION">In Chair / In Consultation</option>
                  <option value="FINISHED">Visit Finished</option>
                  <option value="NO_SHOW">No Show</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Operational Notes</label>
                <input
                  type="text"
                  value={attendanceNotes}
                  onChange={(e) => setAttendanceNotes(e.target.value)}
                  placeholder="e.g. Sent to Operatory Chair 1"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAttendanceModalTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateAttendanceStatus}
                disabled={isUpdatingAttendance}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#12304A] dark:bg-teal-700 hover:bg-slate-800 dark:hover:bg-teal-600 text-white transition-colors disabled:opacity-50"
              >
                {isUpdatingAttendance ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}

      {/* MODAL 3: Walk-In Patient Registration Modal */}
      {isRegisterOpen && (
        <DialogOverlay
          onClose={() => setIsRegisterOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/65 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-gray-700 max-h-[90dvh] overflow-y-auto space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <UserPlus className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Walk-In Patient Intake</h3>
              </div>
              <button
                onClick={() => setIsRegisterOpen(false)}
                aria-label="Close dialog" className="inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 rounded-lg text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700"
              >
                ✕
              </button>
            </div>

            {registerSuccessMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs">
                {registerSuccessMsg}
              </div>
            )}

            {registerErrorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 text-xs">
                {registerErrorMsg}
              </div>
            )}

            <form onSubmit={handleRegisterPatient} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={registerForm.first_name}
                    onChange={(e) => setRegisterForm({ ...registerForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={registerForm.last_name}
                    onChange={(e) => setRegisterForm({ ...registerForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    placeholder="+639171234567"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={registerForm.date_of_birth}
                    onChange={(e) => setRegisterForm({ ...registerForm, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                  <select
                    value={registerForm.gender}
                    onChange={(e) => setRegisterForm({ ...registerForm, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Residential Address</label>
                <input
                  type="text"
                  value={registerForm.address}
                  onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                  placeholder="Street, City, Metro Manila"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={registerForm.emergency_contact_name}
                    onChange={(e) => setRegisterForm({ ...registerForm, emergency_contact_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    value={registerForm.emergency_contact_phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, emergency_contact_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Medical Alerts / Allergies</label>
                <input
                  type="text"
                  value={registerForm.medical_alerts}
                  onChange={(e) => setRegisterForm({ ...registerForm, medical_alerts: e.target.value })}
                  placeholder="e.g. Penicillin allergy, Hypertension (or 'None recorded')"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2 font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRegister}
                  className="px-5 py-2 font-semibold rounded-xl bg-teal-600 dark:bg-teal-700 hover:bg-teal-500 dark:hover:bg-teal-600 text-white transition-colors disabled:opacity-50"
                >
                  {isSubmittingRegister ? 'Registering...' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}

export default ReceptionistDashboard;
