import { fireEvent, render, within } from '@testing-library/react-native';
import { GlassCard } from '../../src/components/GlassCard';
import { GlassListGroup } from '../../src/components/GlassListGroup';
import { AssetGlyph } from '../../src/features/buy-sell/AssetGlyph';
import { CurrencyGlyph } from '../../src/features/buy-sell/CurrencyGlyph';
import { AssetPickerStep } from '../../src/features/transfer/AssetPickerStep';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// `Icon` renders only its name here so a row's chevron-vs-check swap can be
// asserted by text content instead of inspecting raw SVG output. Everything
// else (`GlassListGroup`, `GlassCard`, `SectionTitle`) stays real so the
// structural assertions below (glass surfaces, section title) hold.
jest.mock('@/components', () => ({
  ...jest.requireActual('@/components'),
  Icon: ({ name }: { name: string }) => {
    const { Text: MockText } = jest.requireActual('react-native');
    return <MockText>{name}</MockText>;
  },
}));

const ASSETS = [{ symbol: 'BTC' }, { symbol: 'CHF' }];

describe('AssetPickerStep', () => {
  it('renders one row per asset with the i18n name and the matching glyph', () => {
    const { getByTestId, getByText, UNSAFE_getAllByType } = render(
      <AssetPickerStep heading="Pick" assets={ASSETS} onSelect={jest.fn()} testIDPrefix="send" />,
    );

    expect(getByTestId('send-asset-list')).toBeTruthy();
    expect(getByTestId('send-asset-btc')).toBeTruthy();
    expect(getByTestId('send-asset-chf')).toBeTruthy();
    expect(getByText('BTC')).toBeTruthy();
    expect(getByText('CHF')).toBeTruthy();
    expect(getByText('transfer.assetName.BTC')).toBeTruthy();
    expect(getByText('transfer.assetName.CHF')).toBeTruthy();
    // BTC renders through `AssetGlyph`, CHF through `CurrencyGlyph`.
    expect(UNSAFE_getAllByType(AssetGlyph)).toHaveLength(1);
    expect(UNSAFE_getAllByType(CurrencyGlyph)).toHaveLength(1);
  });

  it('taps a row and reports the pressed symbol', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <AssetPickerStep
        heading="Pick"
        assets={ASSETS}
        onSelect={onSelect}
        testIDPrefix="receive"
      />,
    );

    fireEvent.press(getByTestId('receive-asset-chf'));
    expect(onSelect).toHaveBeenCalledWith('CHF');
  });

  it('marks the selected row as accessibilityState.selected and shows a check instead of a chevron', () => {
    const { getByTestId } = render(
      <AssetPickerStep
        heading="Pick"
        assets={ASSETS}
        selectedSymbol="BTC"
        onSelect={jest.fn()}
        testIDPrefix="send"
      />,
    );

    const selectedRow = getByTestId('send-asset-btc');
    expect(selectedRow.props.accessibilityState).toMatchObject({ selected: true });
    expect(within(selectedRow).getByText('check')).toBeTruthy();
    expect(within(selectedRow).queryByText('chevron-right')).toBeNull();

    const otherRow = getByTestId('send-asset-chf');
    expect(otherRow.props.accessibilityState).toMatchObject({ selected: false });
    expect(within(otherRow).getByText('chevron-right')).toBeTruthy();
    expect(within(otherRow).queryByText('check')).toBeNull();
  });

  it('renders no section title and no bank card without bankAction', () => {
    const { queryByText, queryByTestId } = render(
      <AssetPickerStep heading="Pick" assets={ASSETS} onSelect={jest.fn()} testIDPrefix="send" />,
    );

    expect(queryByText('transfer.bankSection')).toBeNull();
    expect(queryByTestId('send-destination-bank')).toBeNull();
  });

  it('renders the bank section + card and fires onPress when bankAction is set', () => {
    const onPress = jest.fn();
    const { getByText, getByTestId } = render(
      <AssetPickerStep
        heading="Pick"
        assets={ASSETS}
        onSelect={jest.fn()}
        testIDPrefix="send"
        bankAction={{
          title: 'send.sendToBank',
          subtitle: 'send.sendToBankSubtitle',
          onPress,
          testID: 'send-destination-bank',
        }}
      />,
    );

    expect(getByText('transfer.bankSection')).toBeTruthy();
    expect(getByText('send.sendToBank')).toBeTruthy();
    expect(getByText('send.sendToBankSubtitle')).toBeTruthy();

    fireEvent.press(getByTestId('send-destination-bank'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the asset list and the bank card on real glass surfaces', () => {
    const { UNSAFE_getAllByType } = render(
      <AssetPickerStep
        heading="Pick"
        assets={ASSETS}
        onSelect={jest.fn()}
        testIDPrefix="send"
        bankAction={{
          title: 'send.sendToBank',
          subtitle: 'send.sendToBankSubtitle',
          onPress: jest.fn(),
          testID: 'send-destination-bank',
        }}
      />,
    );

    expect(UNSAFE_getAllByType(GlassListGroup).length).toBeGreaterThanOrEqual(1);
    expect(UNSAFE_getAllByType(GlassCard).length).toBeGreaterThanOrEqual(1);
  });
});
