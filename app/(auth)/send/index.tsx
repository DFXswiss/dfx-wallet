import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useAccount, type IAsset } from '@tetherto/wdk-react-native-core';
import { AppHeader, GlassSheet, Icon, ScreenBackdrop, type AmountKey } from '@/components';
import { QrScanner } from '@/components/QrScanner';
import type { ChainId } from '@/config/chains';
import { getPaymasterTokenInfo } from '@/config/chains';
import { getExplorerTxUrl } from '@/config/explorer';
import { formatBalance } from '@/config/portfolio-presentation';
import { getSendAssetForCanonical } from '@/config/tokens';
import { AssetPickerStep } from '@/features/transfer/AssetPickerStep';
import { ContactActionSheet, ContactFormSheet } from '@/features/transfer/ContactSheets';
import { SendAmountStep } from '@/features/transfer/SendAmountStep';
import { SendConfirmStep } from '@/features/transfer/SendConfirmStep';
import { SendOverview } from '@/features/transfer/SendOverview';
import { SendSuccessStep } from '@/features/transfer/SendSuccessStep';
import {
  getAddressKind,
  isPlausibleAddress,
  normalizeAddressInput,
  shortenAddress,
} from '@/features/transfer/address';
import {
  applyKey,
  exceedsBalance,
  formatAmountLabel,
  formatBalanceLabel,
  formatEnteredAmount,
  formatEquivalents,
  getAvailableUnits,
  getUnitRates,
  hasPositiveBalance,
  maxDecimalsFor,
  toAssetAmount,
} from '@/features/transfer/amount';
import {
  SEND_ASSETS,
  assetsForAddressKind,
  findSendAsset,
  pickDefaultAsset,
  resolveChain,
} from '@/features/transfer/assets';
import { describeLastUsed } from '@/features/transfer/contacts';
import { useBankAccounts } from '@/features/transfer/useBankAccounts';
import { useSendFlow } from '@/hooks';
import { getRawBalance, useBalances } from '@/services/balances';
import { pricingService } from '@/services/pricing-service';
import {
  findContactByAddress,
  sortContacts,
  useAddressBookStore,
  type Contact,
  type ContactError,
} from '@/store/address-book';
import { Header, useColors, type ThemeColors } from '@/theme';

type SendStep = 'overview' | 'amount' | 'confirm' | 'success';

type Sheet =
  | { kind: 'create' }
  | { kind: 'actions'; contact: Contact }
  | { kind: 'rename'; contact: Contact }
  | { kind: 'save' };

type FeeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; fee: string }
  | { status: 'error'; message: string };

const FEE_PREVIEW_DELAY_MS = 400;
const COPIED_RESET_MS = 2000;
const EMPTY_RATES: ReadonlyMap<string, number> = new Map();

export default function SendScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState<SendStep>('overview');
  const [query, setQuery] = useState('');
  const [recipient, setRecipient] = useState('');
  const [assetSymbol, setAssetSymbol] = useState('BTC');
  const [selectedChain, setSelectedChain] = useState<ChainId>('spark');
  const [unit, setUnit] = useState('BTC');
  const [input, setInput] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [assetSheetVisible, setAssetSheetVisible] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [pricingReady, setPricingReady] = useState(pricingService.isReady());
  const [feeState, setFeeState] = useState<FeeState>({ status: 'idle' });
  const [previewFee, setPreviewFee] = useState<FeeState>({ status: 'idle' });
  const estimateReqRef = useRef(0);
  const previewReqRef = useRef(0);

  const { send, estimate, isLoading, txHash, error, reset } = useSendFlow(selectedChain);
  const estimateRef = useRef(estimate);
  useEffect(() => {
    estimateRef.current = estimate;
  }, [estimate]);

  // Local address book. Hydration is explicit so importing the store never
  // touches native storage.
  const storedContacts = useAddressBookStore((s) => s.contacts);
  const hydrateContacts = useAddressBookStore((s) => s.hydrate);
  const addContact = useAddressBookStore((s) => s.addContact);
  const renameContact = useAddressBookStore((s) => s.renameContact);
  const removeContact = useAddressBookStore((s) => s.removeContact);
  const markUsed = useAddressBookStore((s) => s.markUsed);
  // Layout effect: the persisted contacts are in place before the first paint.
  useLayoutEffect(() => {
    hydrateContacts();
  }, [hydrateContacts]);
  const contacts = useMemo(() => sortContacts(storedContacts), [storedContacts]);
  const recipientContact = useMemo(
    () => findContactByAddress(contacts, recipient),
    [contacts, recipient],
  );

  // Prices: start the cache if the dashboard has not done it yet.
  useEffect(() => {
    if (pricingService.isReady()) {
      setPricingReady(true);
      return;
    }
    let cancelled = false;
    const init = async () => {
      try {
        await pricingService.initialize();
        if (!cancelled) setPricingReady(true);
      } catch {
        // No prices: the fiat units stay hidden, the asset unit keeps working.
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const { address: derivedAddress } = useAccount({ network: 'bitcoin', accountIndex: 0 });
  const ownAddress = derivedAddress ?? '';
  const bankAccounts = useBankAccounts();

  // One asset per send-list symbol on its default chain (balances, default pick).
  const defaultAssets = useMemo(() => {
    const bySymbol = new Map<string, IAsset>();
    for (const option of SEND_ASSETS) {
      const asset = getSendAssetForCanonical(option.symbol, resolveChain(option));
      if (asset) bySymbol.set(option.symbol, asset);
    }
    return bySymbol;
  }, []);
  const sendAsset = useMemo(
    () => getSendAssetForCanonical(assetSymbol, selectedChain),
    [assetSymbol, selectedChain],
  );
  const balanceAssets = useMemo(() => {
    const assets = Array.from(defaultAssets.values());
    if (sendAsset && !assets.some((a) => a.getId() === sendAsset.getId())) assets.push(sendAsset);
    return assets;
  }, [defaultAssets, sendAsset]);
  const { data: balances } = useBalances(balanceAssets);

  const hasBalanceFor = (symbol: string): boolean => {
    const asset = defaultAssets.get(symbol);
    return asset ? hasPositiveBalance(getRawBalance(balances, asset.getId())) : false;
  };
  const overviewAsset = pickDefaultAsset(SEND_ASSETS, hasBalanceFor);
  const overviewAssetInstance = defaultAssets.get(overviewAsset.symbol);
  const overviewBalance = overviewAssetInstance
    ? balances.get(overviewAssetInstance.getId())
    : undefined;
  const balanceLabel =
    overviewAssetInstance && overviewBalance?.status === 'ok'
      ? formatBalanceLabel(overviewBalance.rawBalance, {
          symbol: overviewAsset.symbol,
          decimals: overviewAssetInstance.getDecimals(),
        })
      : null;

  // Amount step: what the user typed, in which unit, and what it means in asset units.
  const assetOptions = assetsForAddressKind(getAddressKind(recipient));
  const currentAsset = findSendAsset(assetSymbol) ?? SEND_ASSETS[0]!;
  const assetDecimals = sendAsset ? sendAsset.getDecimals() : 8;
  const amountAsset = { symbol: assetSymbol, decimals: assetDecimals };
  const rates = pricingReady ? getUnitRates(assetSymbol) : EMPTY_RATES;
  const units = getAvailableUnits(assetSymbol, rates);
  const rate = rates.get(unit);
  const rateMissing = unit !== assetSymbol && rate === undefined;
  const assetAmount = toAssetAmount(input, unit, amountAsset, rate);
  const paymasterToken = useMemo(() => getPaymasterTokenInfo(selectedChain), [selectedChain]);
  const balanceEntry = sendAsset ? balances.get(sendAsset.getId()) : undefined;
  const insufficient =
    assetAmount !== undefined &&
    balanceEntry?.status === 'ok' &&
    exceedsBalance(assetAmount, balanceEntry.rawBalance, assetDecimals);
  const recipientName = recipientContact ? recipientContact.name : shortenAddress(recipient, 6, 4);

  // Fee preview under the amount: debounced, and a stale answer is dropped.
  useEffect(() => {
    if (step !== 'amount' || !sendAsset || !assetAmount) {
      setPreviewFee((prev) => (prev.status === 'idle' ? prev : { status: 'idle' }));
      return;
    }
    const reqId = ++previewReqRef.current;
    setPreviewFee({ status: 'loading' });
    const timer = setTimeout(() => {
      const run = async () => {
        const result = await estimateRef.current({
          asset: sendAsset,
          to: recipient,
          amount: assetAmount,
        });
        if (reqId !== previewReqRef.current) return;
        setPreviewFee(
          result.success
            ? { status: 'ok', fee: result.fee }
            : { status: 'error', message: result.error },
        );
      };
      void run();
    }, FEE_PREVIEW_DELAY_MS);
    return () => {
      clearTimeout(timer);
      previewReqRef.current += 1;
    };
  }, [step, sendAsset, recipient, assetAmount]);

  const formatFee = (state: FeeState): string | undefined => {
    if (state.status !== 'ok' || !paymasterToken) return undefined;
    return `${formatBalance(state.fee, paymasterToken.decimals)} ${paymasterToken.symbol}`;
  };

  const goToAmount = (address: string, contact?: Contact) => {
    const options = assetsForAddressKind(getAddressKind(address));
    const preferred = contact?.assetSymbol
      ? options.find((option) => option.symbol === contact.assetSymbol)
      : undefined;
    const asset = preferred ?? pickDefaultAsset(options, hasBalanceFor);
    setRecipient(address);
    setAssetSymbol(asset.symbol);
    setSelectedChain(resolveChain(asset, contact?.chain));
    setUnit(asset.symbol);
    setInput('');
    reset();
    setStep('amount');
  };

  const handleScan = (data: string) => {
    const address = normalizeAddressInput(data);
    if (isPlausibleAddress(address)) goToAmount(address, findContactByAddress(contacts, address));
    else setQuery(address);
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setQuery(normalizeAddressInput(text));
  };

  const handleUnitSelect = (next: string) => {
    if (next !== unit) {
      setUnit(next);
      setInput('');
      return;
    }
    // A second tap on the active asset segment opens the asset picker.
    if (next === assetSymbol && assetOptions.length > 1) setAssetSheetVisible(true);
  };

  const handleAssetSelect = (symbol: string) => {
    const asset = findSendAsset(symbol);
    if (!asset) return;
    setAssetSymbol(asset.symbol);
    setSelectedChain(resolveChain(asset));
    setUnit(asset.symbol);
    setInput('');
    setAssetSheetVisible(false);
  };

  const handleKey = (key: AmountKey) => {
    setInput((prev) => applyKey(prev, key, maxDecimalsFor(unit, amountAsset)));
  };

  const goToConfirm = useCallback(async () => {
    // The continue button is gated on `sendAsset` and `assetAmount` via its
    // `disabled` prop, so both are set by the time this handler runs.
    setStep('confirm');
    setFeeState({ status: 'loading' });
    const reqId = ++estimateReqRef.current;
    const result = await estimate({ asset: sendAsset!, to: recipient, amount: assetAmount! });
    // Drop stale results from earlier estimate calls (e.g. user went back, edited, returned).
    if (reqId !== estimateReqRef.current) return;
    if (result.success) {
      setFeeState({ status: 'ok', fee: result.fee });
    } else {
      setFeeState({ status: 'error', message: result.error });
    }
  }, [sendAsset, estimate, recipient, assetAmount]);

  const backToAmount = () => {
    reset();
    // Drop any in-flight estimate so a late-arriving result doesn't render after cancel.
    estimateReqRef.current += 1;
    setFeeState({ status: 'idle' });
    setStep('amount');
  };

  const handleSend = async () => {
    const hash = await send({ asset: sendAsset!, to: recipient, amount: assetAmount! });
    if (hash) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (recipientContact) markUsed(recipientContact.id);
      setStep('success');
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      backToAmount();
    } else if (step === 'amount') {
      reset();
      setStep('overview');
    } else {
      router.back();
    }
  };

  const handleCopyHash = async () => {
    if (!txHash) return;
    await Clipboard.setStringAsync(txHash);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), COPIED_RESET_MS);
  };

  const submitNewContact = (name: string, address: string): ContactError | null => {
    const isEvm = getAddressKind(address) === 'evm';
    const result = addContact(
      isEvm
        ? { name, address, chain: 'ethereum' }
        : { name, address, chain: 'spark', assetSymbol: 'BTC' },
    );
    if (!result.ok) return result.error;
    setSheet(null);
    return null;
  };

  const submitSavedAddress = (name: string): ContactError | null => {
    const result = addContact({
      name,
      address: recipient,
      chain: selectedChain,
      assetSymbol,
    });
    if (!result.ok) return result.error;
    markUsed(result.contact.id);
    setSheet(null);
    return null;
  };

  const submitRename = (contact: Contact, name: string): ContactError | null => {
    const result = renameContact(contact.id, name);
    if (!result.ok) return result.error;
    setSheet(null);
    return null;
  };

  // Send button: one state at a time, in the order the user has to fix them.
  const ctaTitle = (): string => {
    if (rateMissing) return t('send.rateUnavailable');
    if (!assetAmount) return t('send.enterAmount');
    if (insufficient) return t('send.insufficientBalance');
    return t('send.ctaSend', { amount: formatAmountLabel(input, unit), name: recipientName });
  };
  const ctaDisabled = rateMissing || !assetAmount || insufficient || !sendAsset;

  const previewFeeLine = (): string => {
    if (previewFee.status === 'loading') return t('send.feeEstimating');
    if (previewFee.status === 'error') return t('send.feeUnavailable');
    const formatted = formatFee(previewFee);
    return formatted ? t('send.feeLine', { fee: formatted }) : t('send.feeLineIdle');
  };

  const lastUsed =
    recipientContact?.lastUsedAt !== undefined
      ? describeLastUsed(recipientContact.lastUsedAt, Date.now())
      : undefined;
  const lastUsedLabel = lastUsed
    ? t(`send.lastUsed.${lastUsed.key}`, { count: lastUsed.count })
    : undefined;

  const confirmFee = (): string => {
    if (feeState.status === 'loading') return t('send.feeEstimating');
    if (feeState.status === 'error') return t('send.feeUnavailable');
    return formatFee(feeState) ?? '–';
  };
  const chainLabel = currentAsset.chains.find((c) => c.chain === selectedChain)?.label;
  const confirmRows: { key: string; label: string; value: string }[] = [
    { key: 'network', label: t('send.network'), value: chainLabel ?? selectedChain },
    { key: 'recipient', label: t('send.recipient'), value: recipientName },
  ];
  if (recipientContact) {
    const address = shortenAddress(recipient, 10, 6);
    confirmRows.push({ key: 'address', label: t('send.address'), value: address });
  }
  confirmRows.push({
    key: 'amount',
    label: t('send.amount'),
    value: `${assetAmount ?? ''} ${assetSymbol}`,
  });
  if (unit !== assetSymbol) {
    const entered = formatEnteredAmount(input, unit, amountAsset);
    confirmRows.push({ key: 'entered', label: t('send.entered'), value: entered });
  }
  confirmRows.push({ key: 'fee', label: t('send.networkFee'), value: confirmFee() });

  const explorerUrl = txHash ? getExplorerTxUrl(selectedChain, txHash) : undefined;

  const scanAction = (
    <Pressable
      style={styles.headerAction}
      onPress={() => setScannerVisible(true)}
      testID="send-recipient-scan-button"
      accessibilityRole="button"
      accessibilityLabel={t('send.scan')}
    >
      <Icon name="scan" size={20} color={colors.text} />
    </Pressable>
  );

  const body = (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <AppHeader
        title=""
        onBack={handleBack}
        hideBack={step === 'success'}
        testID="send-screen"
        {...(step === 'overview' ? { rightAction: scanAction } : {})}
      />

      {step === 'overview' && (
        <SendOverview
          contacts={contacts}
          query={query}
          onQueryChange={setQuery}
          ownAddress={ownAddress}
          balanceLabel={balanceLabel}
          bankAccounts={bankAccounts}
          onSubmitAddress={(address) =>
            goToAmount(address, findContactByAddress(contacts, address))
          }
          onSelectContact={(contact) => goToAmount(contact.address, contact)}
          onContactActions={(contact) => setSheet({ kind: 'actions', contact })}
          onNewContact={() => setSheet({ kind: 'create' })}
          onShowOwnCode={() => router.push('/(auth)/receive')}
          onOpenBuy={() => router.push('/(auth)/buy')}
          onOpenSell={() => router.push('/(auth)/sell')}
          onPaste={handlePaste}
        />
      )}

      {step === 'amount' && (
        <SendAmountStep
          address={recipient}
          asset={currentAsset}
          selectedChain={selectedChain}
          units={units}
          unit={unit}
          input={input}
          equivalents={formatEquivalents(input, unit, amountAsset, rates)}
          feeLine={previewFeeLine()}
          error={error}
          ctaTitle={ctaTitle()}
          ctaDisabled={ctaDisabled}
          assetSelectable={assetOptions.length > 1}
          onKey={handleKey}
          onUnitSelect={handleUnitSelect}
          onChainSelect={setSelectedChain}
          onContinue={goToConfirm}
          {...(recipientContact ? { contactName: recipientContact.name } : {})}
          {...(lastUsedLabel ? { lastUsedLabel } : {})}
        />
      )}

      {step === 'confirm' && (
        <SendConfirmStep
          rows={confirmRows}
          error={error}
          isLoading={isLoading}
          onConfirm={handleSend}
          onCancel={backToAmount}
        />
      )}

      {step === 'success' && (
        <SendSuccessStep
          recipientLabel={recipientName}
          amountLabel={formatAmountLabel(input, unit)}
          equivalentLabel={formatEquivalents(input, unit, amountAsset, rates)}
          txHash={txHash}
          copiedHash={copiedHash}
          canSaveAddress={!recipientContact}
          onSaveAddress={() => setSheet({ kind: 'save' })}
          onCopyHash={handleCopyHash}
          onDone={() => router.back()}
          {...(explorerUrl ? { explorerUrl } : {})}
        />
      )}

      <QrScanner
        visible={scannerVisible}
        onScan={handleScan}
        onClose={() => setScannerVisible(false)}
      />

      <GlassSheet
        visible={assetSheetVisible}
        position="bottom"
        onRequestClose={() => setAssetSheetVisible(false)}
        testID="send-asset-sheet"
      >
        <AssetPickerStep
          heading={t('send.selectAsset')}
          assets={assetOptions}
          selectedSymbol={assetSymbol}
          onSelect={handleAssetSelect}
          testIDPrefix="send"
        />
      </GlassSheet>

      {sheet?.kind === 'create' && (
        <ContactFormSheet
          title={t('send.contactNewTitle')}
          submitLabel={t('common.save')}
          showAddress
          onSubmit={submitNewContact}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'save' && (
        <ContactFormSheet
          title={t('send.saveAddressTitle')}
          submitLabel={t('common.save')}
          showAddress={false}
          onSubmit={submitSavedAddress}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'rename' && (
        <ContactFormSheet
          title={t('send.contactRename')}
          submitLabel={t('common.save')}
          showAddress={false}
          initialName={sheet.contact.name}
          onSubmit={(name) => submitRename(sheet.contact, name)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'actions' && (
        <ContactActionSheet
          name={sheet.contact.name}
          onRename={() => setSheet({ kind: 'rename', contact: sheet.contact })}
          onDelete={() => {
            removeContact(sheet.contact.id);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </SafeAreaView>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <View style={styles.bg}>
        <ScreenBackdrop />
        {body}
      </View>
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bg: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeArea: {
      flex: 1,
    },
    headerAction: {
      width: Header.slotSize,
      height: Header.slotSize,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
