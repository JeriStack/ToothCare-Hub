import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton, SkeletonText, SkeletonAvatar, SkeletonButton } from '../../components/ui/Skeleton';
import {
  StatCardSkeleton,
  TableSkeleton,
  CardSkeleton,
  AppointmentCardSkeleton,
  DashboardSkeleton,
  BookingStepSkeleton,
  ScheduleCalendarSkeleton,
  ProfileSkeleton,
  NotificationSkeleton,
  AppointmentDetailSkeleton,
  SystemHealthSkeleton,
  ReportSkeleton,
  PermissionMatrixSkeleton,
} from '../../components/skeletons';

describe('Base Skeleton Component', () => {
  it('renders with role="presentation" and aria-hidden="true"', () => {
    const { container } = render(<Skeleton data-testid="base-skeleton" />);
    const el = container.querySelector('[aria-hidden="true"]');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('role', 'presentation');
  });

  it('accepts custom class names for dimensions and shapes', () => {
    const { container } = render(<Skeleton className="h-12 w-48 rounded-full" />);
    const el = container.firstElementChild;
    expect(el).toHaveClass('h-12');
    expect(el).toHaveClass('w-48');
    expect(el).toHaveClass('rounded-full');
  });

  it('includes reduced-motion support in its animation classes', () => {
    const { container } = render(<Skeleton animation="pulse" />);
    const el = container.firstElementChild;
    expect(el).toHaveClass('motion-reduce:animate-none');
    expect(el).toHaveClass('animate-pulse');
  });

  it('supports shimmer animation variant', () => {
    const { container } = render(<Skeleton animation="shimmer" />);
    const el = container.firstElementChild;
    expect(el).toHaveClass('before:animate-[shimmer_2s_infinite]');
  });

  it('supports srText for accessible hidden descriptions', () => {
    render(<Skeleton srText="Loading confidential content" />);
    expect(screen.getByText('Loading confidential content')).toBeInTheDocument();
    expect(screen.getByText('Loading confidential content')).toHaveClass('sr-only');
  });
});

describe('Skeleton Typography & Element Primitives', () => {
  it('renders SkeletonText with customizable lines and ragging', () => {
    const { container } = render(<SkeletonText lines={4} lastLineWidth="w-1/2" />);
    const lines = container.querySelectorAll('.w-full > div');
    expect(lines.length).toBe(4);
    expect(lines[3]).toHaveClass('w-1/2');
  });

  it('renders SkeletonAvatar with preset sizes and shapes', () => {
    const { container } = render(<SkeletonAvatar size="lg" shape="circle" />);
    const avatar = container.querySelector('.rounded-full.w-12.h-12');
    expect(avatar).toBeInTheDocument();
  });

  it('renders SkeletonButton with proper sizing and border radius', () => {
    const { container } = render(<SkeletonButton size="md" width="w-36" />);
    const btn = container.querySelector('.h-10.w-36');
    expect(btn).toBeInTheDocument();
  });
});

describe('StatCardSkeleton Component', () => {
  it('renders default 4 stat cards with aria-busy="true"', () => {
    const { container } = render(<StatCardSkeleton />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.children.length).toBe(4);
  });

  it('renders custom count of stat cards', () => {
    const { container } = render(<StatCardSkeleton count={2} />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper.children.length).toBe(2);
  });
});

describe('TableSkeleton Component', () => {
  it('renders table headers and specified row count', () => {
    const { container } = render(<TableSkeleton rows={3} columns={['w-16', 'w-32', 'w-24']} />);
    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  });

  it('renders TableSkeleton.Rows in a table tbody', () => {
    const { container } = render(
      <table>
        <tbody>
          <TableSkeleton.Rows count={4} columns={5} />
        </tbody>
      </table>
    );
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(4);
    const cells = rows[0].querySelectorAll('td');
    expect(cells.length).toBe(5);
  });
});

describe('CardSkeleton Component', () => {
  it('renders service variant with correct count and aria-busy', () => {
    const { container } = render(<CardSkeleton variant="service" count={3} />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.children.length).toBe(3);
  });

  it('renders dentist variant with circular avatar placeholders', () => {
    const { container } = render(<CardSkeleton variant="dentist" count={2} />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.children.length).toBe(2);
    const roundAvatars = container.querySelectorAll('.rounded-full');
    expect(roundAvatars.length).toBeGreaterThanOrEqual(2);
  });
});

describe('AppointmentCardSkeleton Component', () => {
  it('renders appointment cards with header, details, and action skeletons', () => {
    const { container } = render(<AppointmentCardSkeleton count={2} />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.children.length).toBe(2);
  });
});

describe('DashboardSkeleton Component', () => {
  it('renders admin dashboard skeleton with KPI cards and triage summaries', () => {
    const { container } = render(<DashboardSkeleton role="admin" />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-label', 'Loading administrator executive dashboard');
  });

  it('renders receptionist dashboard skeleton with front desk queues and check-in triage', () => {
    const { container } = render(<DashboardSkeleton role="receptionist" />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-label', 'Loading front desk operations dashboard');
  });

  it('renders dentist clinical workspace skeleton', () => {
    const { container } = render(<DashboardSkeleton role="dentist" />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-label', 'Loading dentist clinical workspace');
  });

  it('renders patient dashboard skeleton with greeting, next visit, and metrics', () => {
    const { container } = render(<DashboardSkeleton role="patient" />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-label', 'Loading patient portal');
  });
});

describe('Module-Specific Skeleton Components', () => {
  it('renders ProfileSkeleton with responsive 1:2 layout and aria-busy', () => {
    const { container } = render(<ProfileSkeleton title="Staff Profile" />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-label', 'Loading Staff Profile');
  });

  it('renders NotificationSkeleton in compact dropdown and page variants', () => {
    const { container: compactContainer } = render(<NotificationSkeleton variant="compact" count={3} />);
    expect(compactContainer.querySelector('[aria-label="Loading notifications"]')).toBeInTheDocument();

    const { container: pageContainer } = render(<NotificationSkeleton variant="page" count={4} />);
    expect(pageContainer.querySelector('[aria-label="Loading notification history"]')).toBeInTheDocument();
  });

  it('renders AppointmentDetailSkeleton with back button and clinical sections', () => {
    const { container } = render(<AppointmentDetailSkeleton />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-label', 'Loading appointment clinical details');
  });

  it('renders SystemHealthSkeleton with operational diagnostics placeholders', () => {
    const { container } = render(<SystemHealthSkeleton />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-label', 'Loading system diagnostics and configuration');
  });

  it('renders ReportSkeleton with KPI metrics and chart placeholders', () => {
    const { container } = render(<ReportSkeleton />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-label', 'Loading reports and analytics data');
  });

  it('renders PermissionMatrixSkeleton with role cards and matrix table', () => {
    const { container } = render(<PermissionMatrixSkeleton />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-label', 'Loading role permissions matrix');
  });
});

describe('BookingStepSkeleton Component', () => {
  it('renders booking step 1 service procedure selection', () => {
    const { container } = render(<BookingStepSkeleton step={1} />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
  });

  it('renders booking step 2 dentist selection', () => {
    const { container } = render(<BookingStepSkeleton step={2} />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
  });

  it('renders booking step 3 with slot picker', () => {
    const { container } = render(<BookingStepSkeleton step={3} />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
  });

  it('renders isolated slot pill skeletons', () => {
    const { container } = render(<BookingStepSkeleton.Slots count={6} />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper.children.length).toBe(6);
  });
});

describe('ScheduleCalendarSkeleton Component', () => {
  it('renders facility operating hours view skeleton', () => {
    const { container } = render(<ScheduleCalendarSkeleton view="hours" />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
  });

  it('renders weekly recurring shifts view skeleton', () => {
    const { container } = render(<ScheduleCalendarSkeleton view="shifts" />);
    const wrapper = container.querySelector('[aria-busy="true"]');
    expect(wrapper).toBeInTheDocument();
  });
});
