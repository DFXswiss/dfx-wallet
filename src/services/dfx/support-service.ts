import { dfxApi } from './api';

export type SupportIssueDto = {
  id: number;
  uid: string;
  type: string;
  state: 'Open' | 'InProgress' | 'Resolved' | 'Closed';
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

export class DfxSupportService {
  async getIssues(): Promise<SupportIssueDto[]> {
    return dfxApi.get<SupportIssueDto[]>('/support/issue');
  }

  async createIssue(reason: string, message: string): Promise<SupportIssueDto> {
    return dfxApi.post<SupportIssueDto>('/support/issue', { reason, message });
  }

  async sendMessage(issueId: number, message: string): Promise<SupportMessageDto> {
    return dfxApi.post<SupportMessageDto>(`/support/issue/${issueId}/message`, { message });
  }
}

export const dfxSupportService = new DfxSupportService();
