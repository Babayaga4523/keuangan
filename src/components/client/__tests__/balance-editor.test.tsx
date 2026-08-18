import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BalanceEditor from '../balance-editor';
import * as actions from '@/lib/actions';

vi.mock('@/lib/actions', () => ({
  actionUpdateAccountBalance: vi.fn(),
}));

describe('BalanceEditor Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders edit pencil trigger button', () => {
    render(
      <BalanceEditor
        accountId="acc-1"
        accountName="BCA Payroll"
        currentBalance={5000000}
      />
    );

    const trigger = screen.getByTitle('Koreksi saldo rekening');
    expect(trigger).toBeInTheDocument();
  });

  it('opens dialog with account name and allows updating balance', async () => {
    vi.mocked(actions.actionUpdateAccountBalance).mockResolvedValue({
      success: true,
      data: undefined,
    });

    render(
      <BalanceEditor
        accountId="acc-1"
        accountName="BCA Payroll"
        currentBalance={5000000}
      />
    );

    fireEvent.click(screen.getByTitle('Koreksi saldo rekening'));

    expect(screen.getByText('Koreksi Saldo Rekening')).toBeInTheDocument();
    expect(screen.getByText('BCA Payroll')).toBeInTheDocument();

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '7.500.000' } });

    const submitBtn = screen.getByRole('button', { name: /simpan/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.actionUpdateAccountBalance).toHaveBeenCalledWith({
        accountId: 'acc-1',
        balance: 7500000,
      });
    });
  });
});
