import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AccountTableActions from '../account-table-actions';

describe('AccountTableActions Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders CSV export download button', () => {
    const mockAccounts = [
      { id: '1', name: 'Dompet Tunai', type: 'CASH', balance: '250000' },
      { id: '2', name: 'BCA Tabungan', type: 'BANK', balance: '5000000' },
    ];

    render(<AccountTableActions accounts={mockAccounts} />);

    const exportBtn = screen.getByTitle('Ekspor daftar rekening ke CSV');
    expect(exportBtn).toBeInTheDocument();
  });

  it('triggers download when clicked', () => {
    const mockAccounts = [
      { id: '1', name: 'Dompet Tunai', type: 'CASH', balance: '250000' },
    ];

    // Mock URL.createObjectURL
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    window.URL.createObjectURL = mockCreateObjectURL;

    render(<AccountTableActions accounts={mockAccounts} />);

    const exportBtn = screen.getByTitle('Ekspor daftar rekening ke CSV');
    fireEvent.click(exportBtn);

    expect(mockCreateObjectURL).toHaveBeenCalled();
  });
});
