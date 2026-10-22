import { fireEvent, screen } from '@testing-library/react-native';

import { PlazaDirectory } from '@/components/plaza/PlazaDirectory';

import { renderApp } from './render';

describe('plaza directory', () => {
  it('finds a plaza by name and shows its price status', async () => {
    await renderApp(<PlazaDirectory />);
    await fireEvent.changeText(screen.getByLabelText('Search toll plazas'), 'Machado');
    expect(await screen.findByText('Machado')).toBeTruthy();
    expect(screen.queryByText('Mariannhill')).toBeNull();
  });

  it('finds plazas by road number', async () => {
    await renderApp(<PlazaDirectory />);
    await fireEvent.changeText(screen.getByLabelText('Search toll plazas'), 'N3');
    expect(await screen.findByText('Mooi')).toBeTruthy();
    expect(screen.queryByText('Machado')).toBeNull();
  });

  it('shows an empty state with a way out when nothing matches', async () => {
    await renderApp(<PlazaDirectory />);
    await fireEvent.changeText(screen.getByLabelText('Search toll plazas'), 'zzzz-no-such-plaza');
    expect(await screen.findByText('No toll plazas match')).toBeTruthy();
  });
});
