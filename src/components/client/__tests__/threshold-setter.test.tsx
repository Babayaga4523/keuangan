import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ThresholdSetter from '../threshold-setter';
import * as actions from '@/lib/actions';

vi.mock('@/lib/actions', () => ({
  actionUpdateAccountThreshold: vi.fn(),
}));

describe('ThresholdSetter Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders trigger edit button', () => {
    render(
      <ThresholdSetter
        accountId="acc-123"
        accountName="Dompet Cash"
        currentThreshold={100000}
      />
    );

    const triggerBtn = screen.getByTitle('Set limit alert saldo');
    expect(triggerBtn).toBeInTheDocument();
  });

  it('opens dialog on trigger click and shows account information', async () => {
    render(
      <ThresholdSetter
        accountId="acc-123"
        accountName="Dompet Cash"
        currentThreshold={100000}
      />
    );

    const triggerBtn = screen.getByTitle('Set limit alert saldo');
    fireEvent.click(triggerBtn);

    expect(screen.getByText('Peringatan Saldo Menipis')).toBeInTheDocument();
    expect(screen.getByText('Dompet Cash')).toBeInTheDocument();
  });

  it('submits updated threshold value correctly', async () => {
    vi.mocked(actions.actionUpdateAccountThreshold).mockResolvedValue({
      success: true,
      data: undefined,
    });

    render(
      <ThresholdSetter
        accountId="acc-123"
        accountName="Dompet Cash"
        currentThreshold={100000}
      />
    );

    fireEvent.click(screen.getByTitle('Set limit alert saldo'));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '250.000' } });

    const submitBtn = screen.getByRole('button', { name: /simpan/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.actionUpdateAccountThreshold).toHaveBeenCalledWith({
        accountId: 'acc-123',
        threshold: 250000,
      });
    });
  });
});
