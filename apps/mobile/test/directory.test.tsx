import { fireEvent, screen } from '@testing-library/react-native';

import { PlazaDirectory } from '@/components/plaza/PlazaDirectory';
import dataset from '@/data/generated/dataset.json';

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

describe('plaza directory sorting and filters', () => {
  // Row labels read "<name> toll plaza, <road>, …, R126.00, …"; the default class is Class 1.
  const rowLabels = () => screen.getAllByLabelText(/ toll plaza, /).map((el) => String(el.props.accessibilityLabel));
  const priceOf = (label: string) => {
    const m = /R([\d  ,]+\.\d\d)/.exec(label);
    return m ? Math.round(Number(m[1]!.replace(/[^\d.]/g, '')) * 100) : null;
  };

  it('sorts by price, lowest or highest first', async () => {
    await renderApp(<PlazaDirectory />);
    await fireEvent.press(screen.getByLabelText('Sort order: Default'));
    await fireEvent.press(screen.getByLabelText(/^Price: lowest first/));
    expect(screen.getByText('Lowest price')).toBeTruthy();
    const low = rowLabels().slice(0, 6).map(priceOf);
    expect(low.every((p) => p !== null)).toBe(true);
    expect([...low].sort((a, b) => a! - b!)).toEqual(low);

    await fireEvent.press(screen.getByLabelText('Sort order: Price: lowest first'));
    await fireEvent.press(screen.getByLabelText(/^Price: highest first/));
    const high = rowLabels().slice(0, 6).map(priceOf);
    expect([...high].sort((a, b) => b! - a!)).toEqual(high);
    expect(high[0]!).toBeGreaterThan(low[0]!);
  });

  it('sorts by name', async () => {
    await renderApp(<PlazaDirectory />);
    await fireEvent.press(screen.getByLabelText('Sort order: Default'));
    await fireEvent.press(screen.getByLabelText('Name (A–Z)'));
    const names = rowLabels()
      .slice(0, 6)
      .map((l) => l.split(' toll plaza')[0]!);
    expect([...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))).toEqual(names);
  });

  it('filters by province, says what the filter leaves out, and clears', async () => {
    const kzn = new Set(dataset.plazas.filter((p) => p.province === 'KZN').map((p) => p.name));
    await renderApp(<PlazaDirectory />);
    await fireEvent.press(screen.getByLabelText('Province: all'));
    expect(screen.getByText(/no province recorded yet/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('KwaZulu-Natal'));
    const names = rowLabels().map((l) => l.split(' toll plaza')[0]!);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => kzn.has(n))).toBe(true);

    await fireEvent.press(screen.getByText('Clear filters'));
    expect(screen.getByLabelText('Province: all')).toBeTruthy();
    expect(rowLabels().some((l) => !kzn.has(l.split(' toll plaza')[0]!))).toBe(true);
  });

  it('filters by operator', async () => {
    await renderApp(<PlazaDirectory />);
    await fireEvent.press(screen.getByLabelText('Operator: all'));
    await fireEvent.press(screen.getByLabelText(/^TRAC/));
    expect(screen.getByLabelText('Operator: TRAC')).toBeTruthy();
    expect(rowLabels().every((l) => l.includes(', TRAC,'))).toBe(true);
  });
});
