import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
    loadIssues();
  }, [loadIssues]);

  const handleCreate = async () => {
    if (!subject || !message) return;
    setIsLoading(true);
    try {
      await dfxSupportService.createIssue(subject, message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubject('');
      setMessage('');
      setView('list');
      await loadIssues();
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedIssue || !chatMessage) return;
    try {
      await dfxSupportService.sendMessage(selectedIssue.id, chatMessage);
      setChatMessage('');
      // Reload to get updated messages
      const updated = await dfxSupportService.getIssues();
      setIssues(updated);
      setSelectedIssue(updated.find((i) => i.id === selectedIssue.id) ?? null);
    } catch {
      // Handle error
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

      <View style={styles.spacer} />

      <PrimaryButton
        title="Submit"
        onPress={handleCreate}
        disabled={!subject || !message}
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
            style={[styles.chatBubble, msg.author === 'User' ? styles.userBubble : styles.supportBubble]}
          >
            <Text style={styles.chatAuthor}>{msg.author}</Text>
            <Text style={styles.chatText}>{msg.message}</Text>
            <Text style={styles.chatDate}>
              {new Date(msg.createdDate).toLocaleString()}
            </Text>
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
