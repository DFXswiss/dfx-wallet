import { dfxApi } from './api';

/** Mirror DFX' `SupportIssueType` enum verbatim — sending an unknown
 *  string value fails class-validator on the backend. */
export type SupportIssueType =
  | 'GenericIssue'
  | 'TransactionIssue'
  | 'VerificationCall'
  | 'KycIssue'
  | 'LimitRequest'
  | 'PartnershipRequest'
  | 'NotificationOfChanges'
  | 'BugReport';

/** Mirror DFX' `SupportIssueReason` enum. */
export type SupportIssueReason =
  | 'Other'
  | 'DataRequest'
  | 'FundsNotReceived'
  | 'TransactionMissing'
  | 'RejectCall'
  | 'RepeatCall'
  | 'NameChanged'
  | 'AddressChanged'
  | 'CivilStatusChanged';

export type SupportIssueDto = {
  id: number;
  uid: string;
  type: string;
  state: 'Open' | 'InProgress' | 'Resolved' | 'Closed' | 'Pending' | 'Completed' | 'Canceled';
  reason: string;
  createdDate: string;
  messages: SupportMessageDto[];
};

export type SupportMessageDto = {
  id: number;
  message: string;
  author: 'User' | 'Support';
  createdDate: string;
};

export type CreateSupportIssueParams = {
  /** Free-form ticket title; goes to DFX' required `name` field. */
  name: string;
  /** First message body. Optional per DFX schema but expected for any
   *  meaningful ticket; we treat empty-string as undefined. */
  message?: string;
  type?: SupportIssueType;
  reason?: SupportIssueReason;
};

export class DfxSupportService {
  async getIssues(): Promise<SupportIssueDto[]> {
    return dfxApi.get<SupportIssueDto[]>('/v1/support/issue');
  }

  /**
   * Open a support ticket. The DFX backend validates `type`, `reason` and
   * `name` as required fields (the previous `{ reason, message }` body was
   * silently rejected by class-validator — manifesting as the "ticket
   * never appears" bug). `type` and `reason` default to the most generic
   * enum values so the UI can offer a single "Subject + Message" form
   * without a category picker; advanced flows (transaction issues etc.)
   * pass concrete enum values.
   */
  async createIssue(params: CreateSupportIssueParams): Promise<SupportIssueDto> {
    const trimmedMessage = params.message?.trim();
    return dfxApi.post<SupportIssueDto>('/v1/support/issue', {
      type: params.type ?? 'GenericIssue',
      reason: params.reason ?? 'Other',
      name: params.name,
      ...(trimmedMessage ? { message: trimmedMessage } : {}),
    });
  }

  async sendMessage(issueId: number, message: string): Promise<SupportMessageDto> {
    return dfxApi.post<SupportMessageDto>(`/v1/support/issue/${issueId}/message`, { message });
  }
}

export const dfxSupportService = new DfxSupportService();
