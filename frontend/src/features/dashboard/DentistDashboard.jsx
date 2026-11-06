import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  Coffee,
  CheckCircle2,
  Stethoscope,
  RefreshCw,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { schedulesApi } from '../schedules/api';
import { appointmentsApi } from '../appointments/api';
import { DashboardSkeleton } from '../../components/skeletons/DashboardSkeleton';

const DAYS_OF_WEEK = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
  { id: 7, name: 'Sunday' },
];

export function DentistDashboard({ dentistId = 1, onNavigateTab }) {
  const [shifts, setShifts] = useState([]);
  const [timeOffList, setTimeOffList] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      schedulesApi.getDentistSchedules(dentistId).catch(() => []),
      schedulesApi.getDentistTimeOff(dentistId).catch(() => []),
      appointmentsApi.listDentist().catch(() => []),
    ])
      .then(([s, t, a]) => {
        if (!isMounted) return;
        setShifts(s || []);
        setTimeOffList(t || []);
        setAppointments(Array.isArray(a) ? a : a?.items || []);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [dentistId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#12304A]">Today&apos;s Clinical Practice</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Your assigned weekly chair shifts, working hours, and patient appointments.
          </p>
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton role="dentist" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Shifts Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-[#12304A]">Weekly Recurring Shifts</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                {shifts.length} active shifts
              </span>
            </div>

            <div className="space-y-2">
              {DAYS_OF_WEEK.map((day) => {
                const dayShifts = shifts.filter((s) => s.day_of_week === day.id);

                return (
                  <div
                    key={day.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50"
                  >
                    <span className="text-xs font-semibold text-slate-700 w-24">{day.name}</span>
                    {dayShifts.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic">Off duty</span>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        {dayShifts.map((sh) => (
                          <div key={sh.id} className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-teal-800">
                              {sh.start_time.substring(0, 5)} - {sh.end_time.substring(0, 5)}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-teal-100/60 text-teal-700 rounded font-medium">
                              {sh.operatory_chair}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time-Off Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-[#12304A]">Approved Leaves & Time-Off</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">
                {timeOffList.length} scheduled
              </span>
            </div>

            {timeOffList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No active leaves or vacations scheduled.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {timeOffList.map((t) => (
                  <div key={t.id} className="py-3">
                    <p className="text-xs font-bold text-slate-800">{t.reason}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      📅 {t.start_at} → {t.end_at}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assigned Appointments Card */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-[#12304A]">Assigned Patient Appointments</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                {appointments.length} assigned
              </span>
            </div>

            {appointments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No patient appointments currently assigned to your practice.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {appointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {appt.patient_first_name
                            ? `${appt.patient_first_name} ${appt.patient_last_name}`
                            : `Patient #${appt.patient_id}`}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">
                          {appt.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {appt.service_name || 'Consultation'} • 📅 {appt.start_at}
                      </p>
                    </div>
                    {appt.chief_complaint && (
                      <p className="text-xs text-slate-600 italic bg-slate-50 px-2.5 py-1 rounded max-w-xs truncate">
                        &quot;{appt.chief_complaint}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DentistDashboard;

