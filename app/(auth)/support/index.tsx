import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { PrimaryButton, ScreenContainer } from '@/components';
import { dfxSupportService, type SupportIssueDto } from '@/services/dfx';
import { DfxColors, Typography } from '@/theme';

type SupportView = 'list' | 'create' | 'chat';

const STATE_COLORS: Record<string, string> = {
  Open: DfxColors.warning,
  InProgress: DfxColors.info,
  Resolved: DfxColors.success,
  Closed: DfxColors.textTertiary,
};

export default function SupportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [view, setView] = useState<SupportView>('list');
  const [issues, setIssues] = useState<SupportIssueDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<SupportIssueDto | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadIssues = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await dfxSupportService.getIssues();
      setIssues(data);
    } catch {
      // May not be authenticated
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);

  const handleCreate = async () => {
    if (!subject.trim() || !message.trim()) return;
    setIsLoading(true);
    setSubmitError(null);
    try {
      // DFX requires `type` and `reason` (enum values) plus `name` —
      // the previous `{ reason, message }` body silently failed
      // class-validator and the ticket never landed. Default to the
      // most generic enum values so a single Subject+Message form is
      // enough; the user-typed subject becomes the ticket `name`.
      await dfxSupportService.createIssue({
        name: subject.trim(),
        message: message.trim(),
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubject('');
      setMessage('');
      setView('list');
      await loadIssues();
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSubmitError(err instanceof Error ? err.message : t('support.createError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedIssue || !chatMessage.trim()) return;
    setSubmitError(null);
    try {
      await dfxSupportService.sendMessage(selectedIssue.id, chatMessage.trim());
      setChatMessage('');
      // Reload to get updated messages
      const updated = await dfxSupportService.getIssues();
      setIssues(updated);
      setSelectedIssue(updated.find((i) => i.id === selectedIssue.id) ?? null);
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSubmitError(err instanceof Error ? err.message : t('support.sendError'));
    }
  };

  const renderList = () => (
    <View style={styles.stepContent}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={DfxColors.primary} />
        </View>
      ) : issues.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No support tickets</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.ticketList} showsVerticalScrollIndicator={false}>
          {issues.map((issue) => (
            <Pressable
              key={issue.id}
              style={styles.ticketItem}
              onPress={() => {
                setSelectedIssue(issue);
                setView('chat');
              }}
            >
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketSubject}>{issue.reason}</Text>
                <Text style={styles.ticketDate}>
                  {new Date(issue.createdDate).toLocaleDateString()}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: STATE_COLORS[issue.state] ?? DfxColors.textTertiary },
                ]}
              >
                <Text style={styles.statusText}>{issue.state}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <PrimaryButton title={t('support.createTicket')} onPress={() => setView('create')} />
    </View>
  );

  const renderCreate = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('support.createTicket')}</Text>

      <TextInput
        style={styles.input}
        value={subject}
        onChangeText={setSubject}
        placeholder="Subject"
        placeholderTextColor={DfxColors.textTertiary}
      />

      <TextInput
        style={[styles.input, styles.messageInput]}
        value={message}
        onChangeText={setMessage}
        placeholder="Describe your issue..."
        placeholderTextColor={DfxColors.textTertiary}
        multiline
        textAlignVertical="top"
      />

      {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

      <View style={styles.spacer} />

      <PrimaryButton
        title={t('common.submit')}
        onPress={handleCreate}
        disabled={!subject.trim() || !message.trim()}
        loading={isLoading}
      />
    </View>
  );

  const renderChat = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{selectedIssue?.reason}</Text>

      <ScrollView style={styles.chatMessages} showsVerticalScrollIndicator={false}>
        {selectedIssue?.messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.chatBubble,
              msg.author === 'User' ? styles.userBubble : styles.supportBubble,
            ]}
          >
            <Text style={styles.chatAuthor}>{msg.author}</Text>
            <Text style={styles.chatText}>{msg.message}</Text>
            <Text style={styles.chatDate}>{new Date(msg.createdDate).toLocaleString()}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.chatInputRow}>
        <TextInput
          style={[styles.input, styles.chatInput]}
          value={chatMessage}
          onChangeText={setChatMessage}
          placeholder="Type a message..."
          placeholderTextColor={DfxColors.textTertiary}
        />
        <Pressable style={styles.sendButton} onPress={handleSendMessage}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (view === 'list') router.back();
              else if (view === 'chat') setView('list');
              else setView('list');
            }}
          >
            <Text style={styles.backButton}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.title}>{t('support.title')}</Text>
          <View style={styles.backButton} />
        </View>

        {view === 'list' && renderList()}
        {view === 'create' && renderCreate()}
        {view === 'chat' && renderChat()}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingVertical: 16,
    gap: 16,
  },
  errorText: {
    ...Typography.bodySmall,
    color: DfxColors.error,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    fontSize: 24,
    color: DfxColors.text,
    width: 32,
  },
  title: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  stepContent: {
    flex: 1,
    gap: 16,
  },
  stepTitle: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...Typography.bodyLarge,
    color: DfxColors.textTertiary,
  },
  ticketList: {
    gap: 8,
  },
  ticketItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
  },
  ticketInfo: {
    flex: 1,
    gap: 4,
  },
  ticketSubject: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.text,
  },
  ticketDate: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: DfxColors.black,
  },
  input: {
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
    padding: 16,
    color: DfxColors.text,
    ...Typography.bodyLarge,
  },
  messageInput: {
    minHeight: 160,
  },
  chatMessages: {
    flex: 1,
  },
  chatBubble: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: DfxColors.primary,
    alignSelf: 'flex-end',
  },
  supportBubble: {
    backgroundColor: DfxColors.surface,
    alignSelf: 'flex-start',
  },
  chatAuthor: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: DfxColors.textSecondary,
    marginBottom: 4,
  },
  chatText: {
    ...Typography.bodyMedium,
    color: DfxColors.text,
  },
  chatDate: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    marginTop: 4,
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chatInput: {
    flex: 1,
  },
  sendButton: {
    backgroundColor: DfxColors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendText: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.white,
  },
  spacer: {
    flex: 1,
  },
});
