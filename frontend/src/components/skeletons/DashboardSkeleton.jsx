import React from 'react';
import { Skeleton, SkeletonAvatar, SkeletonButton, SkeletonText } from '../ui/Skeleton';
import { StatCardSkeleton } from './StatCardSkeleton';
import { TableSkeleton } from './TableSkeleton';
import { AppointmentCardSkeleton } from './AppointmentCardSkeleton';

/**
 * Composite Dashboard Skeleton
 *
 * Dedicated, layout-accurate skeleton screens for all four portal roles:
 * - 'admin': Executive header, 11 KPI metrics (4 core + 7 triage), and 3-column streams grid.
 * - 'receptionist': Front desk header banner, 7 operational KPIs, daily queue, and waiting roster.
 * - 'dentist': Clinical overview header, 4 practice metrics, next patient card, and today's consultations queue.
 * - 'patient': Personalized greeting header, next visit card, 3 stat cards, discovery cards, and upcoming appointments.
 *
 * @param {'admin' | 'receptionist' | 'dentist' | 'patient'} role
 */
export function DashboardSkeleton({ role = 'patient' }) {
  // 1. ADMINISTRATOR EXECUTIVE DASHBOARD SKELETON
  if (role === 'admin') {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading administrator executive dashboard">
        {/* Executive Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-[#12304A] to-[#1e496e] text-white p-6 rounded-2xl shadow-sm">
          <div>
            <Skeleton className="h-7 w-64 bg-white/20" />
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Skeleton className="h-5 w-32 rounded-full bg-teal-400/30" />
              <Skeleton className="h-4 w-44 bg-white/20" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-28 hidden md:block bg-white/20" />
            <Skeleton className="h-9 w-36 rounded-xl bg-teal-400/40" />
          </div>
        </div>

        {/* 4 Core Aggregate Metric Cards */}
        <StatCardSkeleton count={4} />

        {/* 7-Card Operational Streams & Triage Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="w-2.5 h-2.5 rounded-full" />
                </div>
                <Skeleton className="h-7 w-10" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>

        {/* 3-Column Operational Streams Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recently Registered Patients */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
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

          {/* Service Catalog & Fees */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
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

          {/* Recent Administrative Activity */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3.5 w-16" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start justify-between py-2 border-b border-slate-100 dark:border-slate-700/40 last:border-none">
                  <div className="space-y-1">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. RECEPTIONIST FRONT DESK DASHBOARD SKELETON
  if (role === 'receptionist') {
    return (
      <div className="space-y-8 pb-12" aria-busy="true" aria-label="Loading front desk operations dashboard">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#12304A] to-[#1E3A8A] text-white rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-5 w-36 rounded-full bg-teal-500/20" />
                <Skeleton className="h-5 w-24 rounded-full bg-white/10" />
              </div>
              <Skeleton className="h-8 w-64 bg-white/20" />
              <Skeleton className="h-4 w-48 bg-white/20" />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Skeleton className="h-10 w-36 rounded-xl bg-teal-500/30" />
              <Skeleton className="h-10 w-36 rounded-xl bg-white/10" />
              <Skeleton className="h-10 w-10 rounded-xl bg-white/10" />
            </div>
          </div>
        </div>

        {/* 7 Operational KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="w-6 h-6 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          ))}
        </div>

        {/* Today's Schedule Table & Queue */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700/60">
            <div className="space-y-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-64" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-60 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl" />
            </div>
          </div>

          <TableSkeleton
            showHeader={true}
            showPagination={false}
            rows={5}
            columns={['w-20', 'w-44', 'w-36', 'w-28', 'w-24', 'w-24']}
            className="border-none shadow-none"
          />
        </div>

        {/* 2-Column Split: Waiting Room & Review Queue */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-700/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <SkeletonAvatar size="sm" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-7 w-20 rounded-lg" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-700/20 flex items-center justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. DENTIST CLINICAL DASHBOARD SKELETON
  if (role === 'dentist') {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading dentist clinical workspace">
        {/* Clinical Overview Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-96 max-w-full" />
          </div>
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-36 rounded-xl" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
        </div>

        {/* 4 Practice Metric Cards */}
        <div className="portal-grid-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="w-8 h-8 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>

        {/* Next Patient Hero Card */}
        <div className="bg-gradient-to-r from-[#12304A] to-[#1E4D6B] rounded-2xl p-5 sm:p-6 text-white shadow-md">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-36 rounded-full bg-teal-400/30" />
              <Skeleton className="h-4 w-20 rounded-full bg-white/20" />
            </div>
            <div className="flex items-start gap-4">
              <SkeletonAvatar size="xl" shape="rounded-2xl" className="bg-teal-500/30 border border-teal-300/40" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-48 bg-white/30" />
                <Skeleton className="h-4 w-72 bg-white/20" />
                <Skeleton className="h-4 w-40 rounded-full bg-rose-500/30" />
              </div>
            </div>
          </div>
        </div>

        {/* Today's Consultations Queue */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <div className="space-y-1">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-60" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-48 rounded-xl" />
              <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
          </div>

          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-700/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <SkeletonAvatar size="md" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-52" />
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Skeleton className="h-7 w-24 rounded-lg" />
                  <Skeleton className="h-7 w-20 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 4. PATIENT DASHBOARD SKELETON (Default)
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading patient portal">
      {/* Header Greeting + Book Button */}
      <div className="bg-gradient-to-br from-white via-white to-teal-50/45 dark:from-slate-800 dark:to-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-44 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </div>
          <div className="flex items-center gap-2.5">
            <SkeletonButton size="md" width="w-24" />
            <SkeletonButton size="md" width="w-44" />
          </div>
        </div>
      </div>

      {/* 3 Quick Metric Cards */}
      <div className="portal-grid-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex items-center justify-between"
          >
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="w-10 h-10 rounded-full" />
          </div>
        ))}
      </div>

      {/* Next Confirmed Visit Banner */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </div>
        </div>
        <SkeletonButton size="md" width="w-32" />
      </div>

      {/* 3 Discovery Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-xl" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
            <Skeleton className="w-4 h-4 rounded" />
          </div>
        ))}
      </div>

      {/* Upcoming Confirmed Appointments List */}
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
