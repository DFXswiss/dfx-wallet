import type { KycLevel, LanguageDto, TradingLimitDto } from './user';

export type KycStepName =
  | 'ContactData'
  | 'PersonalData'
  | 'NationalityData'
  | 'Ident'
  | 'FinancialData'
  | 'AdditionalDocuments'
  | 'ResidencePermit'
  | 'Recommendation'
  | 'OwnerDirectory'
  | 'CommercialRegister'
  | 'LegalEntity'
  | 'SoleProprietorshipConfirmation'
  | 'SignatoryPower'
  | 'Authority'
  | 'BeneficialOwner'
  | 'OperationalActivity'
  | 'Statutes'
  | 'DfxApproval'
  | 'PaymentAgreement'
  | 'RecallAgreement'
  | 'PhoneChange'
  | 'AddressChange'
  | 'NameChange'
  | 'RealUnitRegistration';

export type KycStepStatus =
  | 'NotStarted'
  | 'InProgress'
  | 'InReview'
  | 'Failed'
  | 'Completed'
  | 'Outdated'
  | 'DataRequested'
  | 'OnHold';

export type KycStepType = 'Auto' | 'Video' | 'Manual' | 'SumsubAuto' | 'SumsubVideo';

export type KycStepDto = {
  name: KycStepName;
  type?: KycStepType;
  status: KycStepStatus;
  reason?: string;
  sequenceNumber: number;
  isCurrent: boolean;
};

export type KycLevelDto = {
  kycLevel: KycLevel;
  tradingLimit: TradingLimitDto;
  language: LanguageDto;
  kycSteps: KycStepDto[];
};

export type KycSessionDto = KycLevelDto & {
  currentStep?: KycStepDto & {
    session: {
      url: string;
      type: 'Browser' | 'API' | 'Token' | 'None';
    };
  };
};
