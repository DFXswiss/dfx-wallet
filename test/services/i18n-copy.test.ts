import de from '@/i18n/locales/de.json';
import en from '@/i18n/locales/en.json';

describe('localised product terminology', () => {
  it('uses no-code quote errors without a backend-code placeholder', () => {
    expect(de.buy.quoteError.noCode).not.toContain('{{code}}');
    expect(de.sell.quoteError.noCode).not.toContain('{{code}}');
    expect(en.buy.quoteError.noCode).not.toContain('{{code}}');
    expect(en.sell.quoteError.noCode).not.toContain('{{code}}');
  });

  it('describes Multi-Sig as local plans instead of vaults', () => {
    expect(de.multiSig.manage.addAnotherCta).toBe('Weiteren lokalen Plan einrichten');
    expect(de.multiSig.manage.removeTitle).toBe('Lokalen Plan entfernen?');
    expect(de.multiSig.quorum.option_2_3_title).toBe('Familienplan');
    expect(de.multiSig.quorum.option_3_5_title).toBe('Teamplan');
    expect(en.multiSig.manage.addAnotherCta).toBe('Set up another local plan');
    expect(en.multiSig.manage.removeTitle).toBe('Remove local plan?');
    expect(en.multiSig.quorum.option_2_3_title).toBe('Family plan');
    expect(en.multiSig.quorum.option_3_5_title).toBe('Team plan');
  });

  it('uses DFX account consistently in English account copy', () => {
    expect(en.linkedWallet.notFound).toContain('DFX account');
    expect(en.wallets.intro).toContain('DFX account');
    expect(en.wallets.loadError).toContain('DFX account');
  });

  it('asks for an address without advertising unsupported ENS resolution', () => {
    expect(de.send.addressPlaceholder).toBe('Adresse');
    expect(en.send.addressPlaceholder).toBe('Address');
  });
});
