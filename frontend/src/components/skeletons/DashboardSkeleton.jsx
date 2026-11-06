import React from 'react';
import { Skeleton } from '../ui/Skeleton';
import { StatCardSkeleton } from './StatCardSkeleton';
import { TableSkeleton } from './TableSkeleton';
import { AppointmentCardSkeleton } from './AppointmentCardSkeleton';

/**
 * Composite Dashboard Skeleton
 *
 * Tailored layout skeleton representing role-specific dashboards:
 * - 'admin': 4-stat KPI grid, appointment status breakdown, and recent tables.
 * - 'patient': Greeting header, next visit banner, 3-stat cards, and upcoming appointments.
 * - 'dentist': Header, 7-day recurring shift cards, and consultation roster.
 *
 * @param {'admin' | 'patient' | 'dentist'} role
 */
export function DashboardSkeleton({ role = 'patient' }) {
  if (role === 'admin') {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading administrator dashboard">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-28 hidden md:block" />
            <Skeleton className="h-9 w-36 rounded-lg" />
          </div>
        </div>

        {/* 4 Core Aggregate Metric Cards */}
        <StatCardSkeleton count={4} />

        {/* 5-Card Appointment Triage Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="w-2.5 h-2.5 rounded-full" />
                </div>
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </div>

        {/* 2-Column Split: Recent Patients & Active Services Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3.5 w-16" />
            </div>
            <TableSkeleton
              showHeader={false}
              showPagination={false}
              rows={4}
              columns={['w-36', 'w-24', 'w-20']}
              className="border-none shadow-none"
            />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3.5 w-16" />
            </div>
            <TableSkeleton
              showHeader={false}
              showPagination={false}
              rows={4}
              columns={['w-40', 'w-20', 'w-16']}
              className="border-none shadow-none"
            />
          </div>
        </div>
      </div>
    );
  }

  if (role === 'dentist') {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading dentist clinical schedule">
        {/* Header Greeting */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </div>
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>

        {/* 2-Column Clinical Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shifts Schedule Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>

            <div className="space-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between"
                >
                  <Skeleton className="h-3.5 w-20" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-24 rounded-md" />
                    <Skeleton className="h-4 w-16 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Today's Appointments & Patient Roster */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>

            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/40 dark:bg-slate-800/40 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-3.5 w-48" />
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-6 w-20 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Patient Dashboard Skeleton (Default)
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading patient portal">
      {/* Header Greeting + Book Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-44 rounded-xl" />
      </div>

      {/* Next Confirmed Visit Highlight Banner */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-60" />
            <Skeleton className="h-3.5 w-72" />
          </div>
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* 3 Quick Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex items-center gap-4"
          >
            <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming Appointments List Container */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3.5 w-20" />
        </div>
        <AppointmentCardSkeleton count={2} className="grid grid-cols-1 md:grid-cols-2 gap-4" />
      </div>
    </div>
  );
}

export default DashboardSkeleton;
