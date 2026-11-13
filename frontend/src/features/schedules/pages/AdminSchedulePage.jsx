import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Building2,
  User,
  Shield,
  Coffee,
  Check,
  X,
  RefreshCw,
  Search,
} from 'lucide-react';
import { schedulesApi } from '../api';
import { dentistsApi } from '../../dentists/api';
import { servicesApi } from '../../services/api';
import { AvailabilitySlotPicker } from '../components/AvailabilitySlotPicker';
import { ScheduleCalendarSkeleton } from '../../../components/skeletons/ScheduleCalendarSkeleton';

const DAYS_OF_WEEK = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
  { id: 7, name: 'Sunday' },
];

export function AdminSchedulePage() {
  const [activeTab, setActiveTab] = useState('clinic'); // 'clinic', 'shifts', 'timeoff', 'tester'
  const [initialLoading, setInitialLoading] = useState(true);

  // Common data
  const [dentists, setDentists] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedDentistId, setSelectedDentistId] = useState('');

  // Notifications
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Tab 1: Clinic Hours & Closures
  const [clinicHours, setClinicHours] = useState([]);
  const [closures, setClosures] = useState([]);
  const [isHoursSaving, setIsHoursSaving] = useState(false);
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [closureForm, setClosureForm] = useState({
    title: '',
    start_at: '',
    end_at: '',
    closure_type: 'HOLIDAY',
    notes: '',
  });

  // Tab 2: Dentist Weekly Shifts
  const [shifts, setShifts] = useState([]);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [shiftForm, setShiftForm] = useState({
    day_of_week: 1,
    start_time: '08:00',
    end_time: '12:00',
    operatory_chair: 'Chair 1',
    is_active: 1,
  });

  // Tab 3: Dentist Time-Off
  const [timeOffList, setTimeOffList] = useState([]);
  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState(false);
  const [timeOffForm, setTimeOffForm] = useState({
    start_at: '',
    end_at: '',
    reason: '',
  });

  // Tab 4: Tester
  const [testServiceId, setTestServiceId] = useState('');
  const [testDate, setTestDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedTestSlot, setSelectedTestSlot] = useState(null);

  // Initial Load: Dentists and Services
  useEffect(() => {
    Promise.all([
      dentistsApi
        .getAdminDentists({ per_page: 50 })
        .then((res) => {
          const list = res.data || [];
          setDentists(list);
          if (list.length > 0 && !selectedDentistId) {
            setSelectedDentistId(list[0].id);
          }
        })
        .catch(() => {}),

      servicesApi
        .getPublicServices()
        .then((res) => {
          const list = res || [];
          setServices(list);
          if (list.length > 0 && !testServiceId) {
            setTestServiceId(list[0].id);
          }
        })
        .catch(() => {}),

      loadClinicData(),
    ]).finally(() => {
      setInitialLoading(false);
    });
  }, []);

  // Reload shifts or time-off when selected dentist changes
  useEffect(() => {
    if (!selectedDentistId) return;
    if (activeTab === 'shifts') {
      loadDentistShifts(selectedDentistId);
    } else if (activeTab === 'timeoff') {
      loadDentistTimeOff(selectedDentistId);
    }
  }, [selectedDentistId, activeTab]);

  const loadClinicData = async () => {
    try {
      const [hours, cls] = await Promise.all([
        schedulesApi.getClinicHours(),
        schedulesApi.getClinicClosures(),
      ]);
      setClinicHours(hours);
      setClosures(cls);
    } catch (e) {
      setErrorMsg('Failed to load clinic facility operating data.');
    }
  };

  const loadDentistShifts = async (dentistId) => {
    try {
      const data = await schedulesApi.getDentistSchedules(dentistId);
      setShifts(data);
    } catch {
      setErrorMsg('Failed to load practitioner weekly shifts.');
    }
  };

  const loadDentistTimeOff = async (dentistId) => {
    try {
      const data = await schedulesApi.getDentistTimeOff(dentistId);
      setTimeOffList(data);
    } catch {
      setErrorMsg('Failed to load practitioner leave records.');
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setErrorMsg(null);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setSuccessMsg(null);
  };

  // --- Clinic Hours Handlers ---
  const handleClinicHourChange = (dayOfWeek, field, value) => {
    setClinicHours((prev) =>
      prev.map((item) =>
        item.day_of_week === dayOfWeek ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSaveClinicHours = async () => {
    setIsHoursSaving(true);
    setErrorMsg(null);
    try {
      await schedulesApi.updateClinicHours({ hours: clinicHours });
      showSuccess('Clinic facility weekly operating hours updated successfully.');
      loadClinicData();
    } catch (e) {
      showError(e.response?.data?.error?.message || 'Failed to update operating hours.');
    } finally {
      setIsHoursSaving(false);
    }
  };

  // --- Clinic Closure Handlers ---
  const handleCreateClosure = async (e) => {
    e.preventDefault();
    try {
      await schedulesApi.createClinicClosure(closureForm);
      showSuccess('Clinic closure window registered successfully.');
      setIsClosureModalOpen(false);
      setClosureForm({ title: '', start_at: '', end_at: '', closure_type: 'HOLIDAY', notes: '' });
      loadClinicData();
    } catch (err) {
      showError(err.response?.data?.error?.message || 'Failed to register clinic closure.');
    }
  };

  const handleDeleteClosure = async (id) => {
    if (!confirm('Are you sure you want to remove this clinic closure?')) return;
    try {
      await schedulesApi.deleteClinicClosure(id);
      showSuccess('Clinic closure removed.');
      loadClinicData();
    } catch {
      showError('Failed to remove closure.');
    }
  };

  // --- Dentist Shifts Handlers ---
  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!selectedDentistId) return;

    try {
      if (editingShiftId) {
        await schedulesApi.updateDentistSchedule(selectedDentistId, editingShiftId, shiftForm);
        showSuccess('Shift updated successfully.');
      } else {
        await schedulesApi.createDentistSchedule(selectedDentistId, shiftForm);
        showSuccess('Shift created successfully.');
      }
      setIsShiftModalOpen(false);
      setEditingShiftId(null);
      setShiftForm({ day_of_week: 1, start_time: '08:00', end_time: '12:00', operatory_chair: 'Chair 1', is_active: 1 });
      loadDentistShifts(selectedDentistId);
    } catch (err) {
      showError(err.response?.data?.error?.message || 'Failed to save shift.');
    }
  };

  const handleDeleteShift = async (scheduleId) => {
    if (!confirm('Delete this working shift for the dentist?')) return;
    try {
      await schedulesApi.deleteDentistSchedule(selectedDentistId, scheduleId);
      showSuccess('Shift removed successfully.');
      loadDentistShifts(selectedDentistId);
    } catch {
      showError('Failed to delete shift.');
    }
  };

  // --- Dentist Time-Off Handlers ---
  const handleSaveTimeOff = async (e) => {
    e.preventDefault();
    if (!selectedDentistId) return;

    try {
      await schedulesApi.createDentistTimeOff(selectedDentistId, timeOffForm);
      showSuccess('Practitioner time-off registered successfully.');
      setIsTimeOffModalOpen(false);
      setTimeOffForm({ start_at: '', end_at: '', reason: '' });
      loadDentistTimeOff(selectedDentistId);
    } catch (err) {
      showError(err.response?.data?.error?.message || 'Failed to record time-off.');
    }
  };

  const handleDeleteTimeOff = async (timeOffId) => {
    if (!confirm('Cancel/remove this practitioner leave period?')) return;
    try {
      await schedulesApi.deleteDentistTimeOff(selectedDentistId, timeOffId);
      showSuccess('Practitioner time-off removed.');
      loadDentistTimeOff(selectedDentistId);
    } catch {
      showError('Failed to delete time-off.');
    }
  };

  const getDayName = (dow) => DAYS_OF_WEEK.find((d) => d.id === dow)?.name || `Day ${dow}`;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#12304A] dark:text-slate-100">Clinic Hours & Practitioner Schedules</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Phase 9 Availability Engine: Manage facility hours, recurring dentist shifts, holidays, and bookable intervals.
          </p>
        </div>

        {/* Global Notifications */}
        {successMsg && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/70 text-teal-800 dark:text-teal-200 text-xs font-semibold animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/70 text-red-800 dark:text-red-200 text-xs font-semibold animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            {errorMsg}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 dark:border-gray-700 gap-2">
        <button
          onClick={() => setActiveTab('clinic')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'clinic'
              ? 'border-teal-600 dark:border-teal-400 text-teal-700 dark:text-teal-300 bg-teal-50/50 dark:bg-teal-950/40 rounded-t-lg'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-gray-800 rounded-t-lg'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Clinic Hours & Closures
        </button>

        <button
          onClick={() => setActiveTab('shifts')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'shifts'
              ? 'border-teal-600 dark:border-teal-400 text-teal-700 dark:text-teal-300 bg-teal-50/50 dark:bg-teal-950/40 rounded-t-lg'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-gray-800 rounded-t-lg'
          }`}
        >
          <Clock className="w-4 h-4" />
          Dentist Weekly Shifts
        </button>

        <button
          onClick={() => setActiveTab('timeoff')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'timeoff'
              ? 'border-teal-600 dark:border-teal-400 text-teal-700 dark:text-teal-300 bg-teal-50/50 dark:bg-teal-950/40 rounded-t-lg'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-gray-800 rounded-t-lg'
          }`}
        >
          <Coffee className="w-4 h-4" />
          Dentist Time-Off & Leaves
        </button>

        <button
          onClick={() => setActiveTab('tester')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'tester'
              ? 'border-teal-600 dark:border-teal-400 text-teal-700 dark:text-teal-300 bg-teal-50/50 dark:bg-teal-950/40 rounded-t-lg'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-gray-800 rounded-t-lg'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Live Availability Tester
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: CLINIC OPERATING HOURS & FACILITY CLOSURES */}
      {/* ========================================================= */}
      {activeTab === 'clinic' && (
        initialLoading ? (
          <ScheduleCalendarSkeleton view="hours" />
        ) : (
        <div className="space-y-6">
          {/* Weekly Hours Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#12304A] dark:text-slate-100">Weekly Facility Operating Hours</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Global clinic boundaries (Asia/Manila). Dentist shifts cannot be scheduled outside these hours.
                </p>
              </div>
              <button
                onClick={handleSaveClinicHours}
                disabled={isHoursSaving}
                className="px-4 py-2 rounded-lg bg-teal-600 dark:bg-[#0F766E] text-white text-xs font-semibold hover:bg-teal-700 dark:hover:bg-[#0D9488] transition shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {isHoursSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save Facility Hours
              </button>
            </div>

            <div className="border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-gray-700/70">
              {DAYS_OF_WEEK.map((day) => {
                const hourRecord = clinicHours.find((h) => h.day_of_week === day.id) || {
                  day_of_week: day.id,
                  opening_time: '08:00:00',
                  closing_time: '17:00:00',
                  is_closed: 0,
                };
                const isClosed = Boolean(hourRecord.is_closed);

                return (
                  <div key={day.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-800">
                    <div className="w-32">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{day.name}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isClosed}
                          onChange={(e) =>
                            handleClinicHourChange(day.id, 'is_closed', e.target.checked ? 1 : 0)
                          }
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span className={`text-xs font-medium ${isClosed ? 'text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'}`}>
                          {isClosed ? 'Closed All Day' : 'Open'}
                        </span>
                      </label>

                      {!isClosed && (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={hourRecord.opening_time.substring(0, 5)}
                            onChange={(e) =>
                              handleClinicHourChange(day.id, 'opening_time', e.target.value + ':00')
                            }
                            className="px-2.5 py-1 text-xs bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400"
                          />
                          <span className="text-xs text-slate-400 dark:text-slate-500">to</span>
                          <input
                            type="time"
                            value={hourRecord.closing_time.substring(0, 5)}
                            onChange={(e) =>
                              handleClinicHourChange(day.id, 'closing_time', e.target.value + ':00')
                            }
                            className="px-2.5 py-1 text-xs bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scheduled Closures Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#12304A] dark:text-slate-100">Clinic-Wide Closures & Holidays</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Entire facility closures that supersede all dentist shifts and suppress all slot booking.
                </p>
              </div>
              <button
                onClick={() => setIsClosureModalOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-teal-600 dark:border-teal-500 text-teal-700 dark:text-teal-300 text-xs font-semibold hover:bg-teal-50 dark:hover:bg-teal-950/50 transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Schedule Closure
              </button>
            </div>

            {closures.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-gray-700 rounded-xl">
                No active or scheduled clinic closures found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-gray-700/70 border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden">
                {closures.map((c) => (
                  <div key={c.id} className="p-3.5 flex items-center justify-between gap-4 bg-white dark:bg-gray-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{c.title}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                          {c.closure_type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {c.start_at} → {c.end_at}
                      </p>
                      {c.notes && <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-0.5">"{c.notes}"</p>}
                    </div>

                    <button
                      onClick={() => handleDeleteClosure(c.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition"
                      title="Remove Closure"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )
      )}

      {/* ========================================================= */}
      {/* TAB 2: DENTIST WEEKLY SHIFT PLANNER */}
      {/* ========================================================= */}
      {activeTab === 'shifts' && (
        initialLoading ? (
          <ScheduleCalendarSkeleton view="shifts" />
        ) : (
        <div className="space-y-6">
          {/* Dentist Selector Bar */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Practitioner:</label>
              <select
                value={selectedDentistId}
                onChange={(e) => setSelectedDentistId(Number(e.target.value))}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400 bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100"
              >
                {dentists.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.first_name} {d.last_name} ({d.specialization})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setEditingShiftId(null);
                setShiftForm({
                  day_of_week: 1,
                  start_time: '08:00',
                  end_time: '12:00',
                  operatory_chair: 'Chair 1',
                  is_active: 1,
                });
                setIsShiftModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-teal-600 dark:bg-[#0F766E] text-white text-xs font-semibold hover:bg-teal-700 dark:hover:bg-[#0D9488] transition shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Recurring Shift
            </button>
          </div>

          {/* Shifts Grid by Day */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DAYS_OF_WEEK.map((day) => {
              const dayShifts = shifts.filter((s) => s.day_of_week === day.id);

              return (
                <div key={day.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 pb-2">
                    <span className="font-bold text-xs text-[#12304A] dark:text-slate-100">{day.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300">
                      {dayShifts.length} {dayShifts.length === 1 ? 'Shift' : 'Shifts'}
                    </span>
                  </div>

                  {dayShifts.length === 0 ? (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-2">No shift scheduled (off duty)</p>
                  ) : (
                    <div className="space-y-2">
                      {dayShifts.map((shift) => (
                        <div
                          key={shift.id}
                          className="p-2.5 rounded-xl border border-teal-100 dark:border-teal-800/60 bg-teal-50/40 dark:bg-teal-950/35 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-teal-900 dark:text-teal-200">
                              <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                              {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                            </div>
                            <span className="text-[10px] text-teal-700 dark:text-teal-300 font-medium">
                              {shift.operatory_chair || 'Chair 1'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingShiftId(shift.id);
                                setShiftForm({
                                  day_of_week: shift.day_of_week,
                                  start_time: shift.start_time.substring(0, 5),
                                  end_time: shift.end_time.substring(0, 5),
                                  operatory_chair: shift.operatory_chair || 'Chair 1',
                                  is_active: shift.is_active,
                                });
                                setIsShiftModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 transition"
                              title="Edit Shift"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteShift(shift.id)}
                              className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition"
                              title="Delete Shift"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        )
      )}

      {/* ========================================================= */}
      {/* TAB 3: DENTIST TIME-OFF & LEAVES */}
      {/* ========================================================= */}
      {activeTab === 'timeoff' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Practitioner:</label>
              <select
                value={selectedDentistId}
                onChange={(e) => setSelectedDentistId(Number(e.target.value))}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400 bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100"
              >
                {dentists.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.first_name} {d.last_name} ({d.specialization})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsTimeOffModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-teal-600 dark:bg-[#0F766E] text-white text-xs font-semibold hover:bg-teal-700 dark:hover:bg-[#0D9488] transition shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Schedule Time-Off
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#12304A] dark:text-slate-100">Scheduled Practitioner Leaves & Vacations</h3>

            {timeOffList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-gray-700 rounded-xl">
                No active leave or vacation records for this dentist.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-gray-700/70 border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden">
                {timeOffList.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between gap-4 bg-white dark:bg-gray-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{item.reason}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        📅 {item.start_at} → {item.end_at}
                      </p>
                      {item.approver_name && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Approved by: {item.approver_name}</p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteTimeOff(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition"
                      title="Cancel Leave"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: LIVE AVAILABILITY TESTER */}
      {/* ========================================================= */}
      {activeTab === 'tester' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-[#12304A] dark:text-slate-100">Real-Time Availability Slot Inspection</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Directly tests the centralized AvailabilityService engine across dentist shifts, clinic hours, buffer intervals, and existing bookings.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-gray-900/50 border border-slate-200 dark:border-gray-700">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Dentist</label>
              <select
                value={selectedDentistId}
                onChange={(e) => setSelectedDentistId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400"
              >
                {dentists.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.first_name} {d.last_name} ({d.specialization})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Service & Duration</label>
              <select
                value={testServiceId}
                onChange={(e) => setTestServiceId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration_minutes}m • ₱{s.price})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Target Date</label>
              <input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400"
              />
            </div>
          </div>

          <div className="border border-slate-200 dark:border-gray-700 rounded-xl p-5">
            <AvailabilitySlotPicker
              dentistId={Number(selectedDentistId)}
              serviceId={Number(testServiceId)}
              selectedDate={testDate}
              selectedSlot={selectedTestSlot?.start_at}
              onSelectSlot={(slot) => setSelectedTestSlot(slot)}
            />

            {selectedTestSlot && (
              <div className="mt-4 p-3 rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/70 text-xs text-teal-900 dark:text-teal-200 space-y-1">
                <span className="font-bold">Selected Slot Details:</span>
                <p>Start: {selectedTestSlot.start_at}</p>
                <p>Service End: {selectedTestSlot.end_at} ({selectedTestSlot.duration_minutes}m)</p>
                <p>Post-Service Buffer End: {selectedTestSlot.blocking_end_at} ({selectedTestSlot.buffer_minutes}m buffer)</p>
                <p>Operatory Chair: {selectedTestSlot.operatory_chair}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT SHIFT */}
      {/* ========================================================= */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#12304A] dark:text-slate-100">
                {editingShiftId ? 'Edit Weekly Shift' : 'Add Recurring Weekly Shift'}
              </h3>
              <button
                onClick={() => setIsShiftModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Day of Week</label>
                <select
                  value={shiftForm.day_of_week}
                  onChange={(e) => setShiftForm({ ...shiftForm, day_of_week: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400 bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={shiftForm.start_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={shiftForm.end_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Operatory Chair</label>
                <input
                  type="text"
                  required
                  value={shiftForm.operatory_chair}
                  onChange={(e) => setShiftForm({ ...shiftForm, operatory_chair: e.target.value })}
                  placeholder="e.g. Chair 1, Chair 2, Surgery Bay"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-gray-600 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-600 dark:bg-[#0F766E] text-white text-xs font-semibold hover:bg-teal-700 dark:hover:bg-[#0D9488] shadow-sm"
                >
                  {editingShiftId ? 'Update Shift' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SCHEDULE CLINIC CLOSURE */}
      {/* ========================================================= */}
      {isClosureModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#12304A] dark:text-slate-100">Schedule Facility Closure</h3>
              <button
                onClick={() => setIsClosureModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClosure} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Christmas Holiday, Facility Renovation"
                  value={closureForm.title}
                  onChange={(e) => setClosureForm({ ...closureForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Start Date/Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={closureForm.start_at}
                    onChange={(e) => setClosureForm({ ...closureForm, start_at: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">End Date/Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={closureForm.end_at}
                    onChange={(e) => setClosureForm({ ...closureForm, end_at: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Closure Category</label>
                <select
                  value={closureForm.closure_type}
                  onChange={(e) => setClosureForm({ ...closureForm, closure_type: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400 bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-100"
                >
                  <option value="HOLIDAY">Holiday</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="EMERGENCY">Emergency</option>
                  <option value="SPECIAL_CLOSURE">Special Closure</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={closureForm.notes}
                  onChange={(e) => setClosureForm({ ...closureForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsClosureModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-gray-600 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-600 dark:bg-[#0F766E] text-white text-xs font-semibold hover:bg-teal-700 dark:hover:bg-[#0D9488] shadow-sm"
                >
                  Register Closure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DENTIST TIME-OFF */}
      {/* ========================================================= */}
      {isTimeOffModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#12304A] dark:text-slate-100">Schedule Practitioner Leave</h3>
              <button
                onClick={() => setIsTimeOffModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTimeOff} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Start Date/Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={timeOffForm.start_at}
                    onChange={(e) => setTimeOffForm({ ...timeOffForm, start_at: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">End Date/Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={timeOffForm.end_at}
                    onChange={(e) => setTimeOffForm({ ...timeOffForm, end_at: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Reason / Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Medical Leave, Conference, Vacation"
                  value={timeOffForm.reason}
                  onChange={(e) => setTimeOffForm({ ...timeOffForm, reason: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 dark:focus:ring-teal-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTimeOffModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-gray-600 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-600 dark:bg-[#0F766E] text-white text-xs font-semibold hover:bg-teal-700 dark:hover:bg-[#0D9488] shadow-sm"
                >
                  Schedule Leave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminSchedulePage;

