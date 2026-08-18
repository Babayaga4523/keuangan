import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SavingGoalCard from '../saving-goal-card';

vi.mock('@/lib/actions', () => ({
  actionUpdateSavingGoal: vi.fn(),
  actionDeleteSavingGoal: vi.fn(),
  actionFundSavingGoal: vi.fn(),
}));

describe('SavingGoalCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockGoal = {
    id: 'goal-123',
    name: 'Dana Darurat',
    target_amount: 10000000,
    current_amount: 5000000,
    deadline: '2026-12-31',
    is_completed: false,
  };

  const mockAccounts = [
    { id: 'acc-1', name: 'BCA', balance: 15000000 },
  ];

  it('renders goal name and progress percentage correctly', () => {
    render(<SavingGoalCard goal={mockGoal} accounts={mockAccounts} />);

    expect(screen.getByText('Dana Darurat')).toBeInTheDocument();
    // Check for progress status (50% is ACCELERATING)
    expect(screen.getByText('ACCELERATING')).toBeInTheDocument();
    // Check progress percentage text (50.0% Terkumpul)
    expect(screen.getByText(/50\.0%\s*Terkumpul/i)).toBeInTheDocument();
  });

  it('displays COMPLETED badge when goal is completed or 100%', () => {
    const completedGoal = {
      ...mockGoal,
      current_amount: 10000000,
      is_completed: true,
    };

    render(<SavingGoalCard goal={completedGoal} accounts={mockAccounts} />);
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText(/100\.0%\s*Terkumpul/i)).toBeInTheDocument();
  });

  it('displays ON TRACK badge when progress is 70% or more', () => {
    const onTrackGoal = {
      ...mockGoal,
      current_amount: 8000000,
    };

    render(<SavingGoalCard goal={onTrackGoal} accounts={mockAccounts} />);
    expect(screen.getByText('ON TRACK')).toBeInTheDocument();
    expect(screen.getByText(/80\.0%\s*Terkumpul/i)).toBeInTheDocument();
  });
});
