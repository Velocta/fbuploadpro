import { describe, expect, it, vi } from 'vitest';
import { ScheduleTimezoneModal } from '../../src/components/pages/dedicated/schedule-timezone-modal';

// Minimal React element tree walker helper
function findElement(node: any, predicate: (n: any) => boolean): any {
  if (!node) return null;
  if (predicate(node)) return node;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
  } else if (node.props && node.props.children) {
    return findElement(node.props.children, predicate);
  }
  return null;
}

function findByTestId(tree: any, testId: string): any {
  return findElement(tree, (n) => n?.props?.['data-testid'] === testId);
}

describe('ScheduleTimezoneModal (Spec 062)', () => {
  it('renders null when isOpen is false', () => {
    const tree = ScheduleTimezoneModal({
      isOpen: false,
      activeTimezone: 'UTC',
      slotsCount: 3,
      pendingQueueCount: 2,
      onClose: vi.fn(),
      onConfirmTimezone: vi.fn(),
    });
    expect(tree).toBeNull();
  });

  it('renders Step 1 with current active timezone banner and search input', () => {
    const tree = ScheduleTimezoneModal({
      isOpen: true,
      activeTimezone: 'UTC',
      slotsCount: 3,
      pendingQueueCount: 2,
      onClose: vi.fn(),
      onConfirmTimezone: vi.fn(),
    });

    expect(tree).not.toBeNull();
    const modal = findByTestId(tree, 'schedule-timezone-modal');
    expect(modal).not.toBeNull();

    const banner = findByTestId(tree, 'current-timezone-banner');
    expect(banner).not.toBeNull();

    const searchInput = findByTestId(tree, 'timezone-search-input');
    expect(searchInput).not.toBeNull();

    // Proceed button should be disabled because active === selected
    const proceedBtn = findByTestId(tree, 'proceed-to-step2-button');
    expect(proceedBtn?.props.disabled).toBe(true);
  });

  it('selects a different timezone and advances to Step 2', async () => {
    const onConfirmTimezone = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    const tree = ScheduleTimezoneModal({
      isOpen: true,
      activeTimezone: 'UTC',
      slotsCount: 4,
      pendingQueueCount: 5,
      onClose,
      onConfirmTimezone,
    });

    // Pick Asia/Karachi
    const option = findByTestId(tree, 'timezone-option-Asia/Karachi');
    expect(option).not.toBeNull();
    option.props.onClick();

    const proceedBtn = findByTestId(tree, 'proceed-to-step2-button');
    expect(proceedBtn).not.toBeNull();
  });

  it('filters timezone list when search input value changes', () => {
    const tree = ScheduleTimezoneModal({
      isOpen: true,
      activeTimezone: 'UTC',
      slotsCount: 2,
      pendingQueueCount: 1,
      onClose: vi.fn(),
      onConfirmTimezone: vi.fn(),
    });

    const searchInput = findByTestId(tree, 'timezone-search-input');
    expect(searchInput).not.toBeNull();
    searchInput.props.onChange({ target: { value: 'Karachi' } });
  });

  it('calls onClose when Cancel button is clicked in Step 1', () => {
    const onClose = vi.fn();
    const tree = ScheduleTimezoneModal({
      isOpen: true,
      activeTimezone: 'UTC',
      slotsCount: 2,
      pendingQueueCount: 1,
      onClose,
      onConfirmTimezone: vi.fn(),
    });

    // Find Cancel button
    const cancelBtn = findElement(tree, (n) => n?.props?.children === 'Cancel');
    expect(cancelBtn).not.toBeNull();
    cancelBtn.props.onClick();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

