import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  Coffee,
  CheckCircle2,
  Stethoscope,
  RefreshCw,
} from 'lucide-react';
import { schedulesApi } from '../schedules/api';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      schedulesApi.getDentistSchedules(dentistId).catch(() => []),
      schedulesApi.getDentistTimeOff(dentistId).catch(() => []),
    ])
      .then(([s, t]) => {
        if (!isMounted) return;
        setShifts(s || []);
        setTimeOffList(t || []);
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
          <h2 className="text-xl font-bold text-[#12304A]">Today's Clinical Practice</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Your assigned weekly chair shifts, working hours, and upcoming approved leaves.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-5 h-5 text-teal-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading your schedule and shifts...</p>
        </div>
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
        </div>
      )}
    </div>
  );
}

export default DentistDashboard;

