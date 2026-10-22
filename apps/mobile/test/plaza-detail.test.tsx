import { screen } from '@testing-library/react-native';

import PlazaScreen from '@/app/plazas/[id]';

import { routeParams } from './mocks';
import { renderApp } from './render';

describe('plaza page', () => {
  afterEach(() => {
    delete routeParams.id;
  });

  it('shows the plaza, every class price and that the prices are not verified', async () => {
    routeParams.id = 'n4-machado';
    await renderApp(<PlazaScreen />);
    expect((await screen.findAllByText('Machado')).length).toBeGreaterThan(0);
    expect(screen.getByText('Tariffs by vehicle class')).toBeTruthy();
    // Class 1 to Class 4 at Machado (TRAC 2026): R126.00, R350.00, R510.00, R729.00.
    for (const amount of ['R126.00', 'R350.00', 'R510.00', 'R729.00']) {
      expect(screen.getAllByText(amount).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('Unverified').length).toBeGreaterThan(0);
    expect(screen.getByText('Sources & verification')).toBeTruthy();
  });

  it('shows a clear message for an unknown plaza instead of crashing', async () => {
    routeParams.id = 'no-such-plaza';
    await renderApp(<PlazaScreen />);
    expect(await screen.findByText('Plaza not found')).toBeTruthy();
  });
});
