import { render, screen } from '@testing-library/react-native';
import { ScanScoresheetCard } from '@/components/ScanScoresheetCard';

describe('the scan scoresheet placeholder', () => {
  it('says what it will do and that it is coming soon', async () => {
    await render(<ScanScoresheetCard />);
    expect(screen.getByText('Scan scoresheet')).toBeOnTheScreen();
    expect(screen.getByText('Coming soon')).toBeOnTheScreen();
    expect(screen.getByLabelText(/Scan scoresheet\..*Coming soon\.$/)).toBeOnTheScreen();
  });

  it('is not a button yet, so nobody taps into a dead end', async () => {
    await render(<ScanScoresheetCard />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
