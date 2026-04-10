import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PrimaryButton, ScreenContainer } from '@/components';
import { DfxColors, Typography } from '@/theme';

type SupportView = 'list' | 'create';

type Ticket = {
  id: string;
  subject: string;
  status: 'open' | 'resolved';
  date: string;
};

export default function SupportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [view, setView] = useState<SupportView>('list');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // TODO: Fetch from DFX API
  const tickets: Ticket[] = [];

  const renderList = () => (
    <View style={styles.stepContent}>
      {tickets.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No support tickets</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.ticketList}>
          {tickets.map((ticket) => (
            <Pressable key={ticket.id} style={styles.ticketItem}>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                <Text style={styles.ticketDate}>{ticket.date}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  ticket.status === 'resolved' && styles.statusResolved,
                ]}
              >
                <Text style={styles.statusText}>{ticket.status}</Text>
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
        onPress={() => {
          // TODO: dfxApi.post('/support/ticket', { subject, message })
          setView('list');
          setSubject('');
          setMessage('');
        }}
        disabled={!subject || !message}
      />
    </View>
  );

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => (view === 'list' ? router.back() : setView('list'))}>
            <Text style={styles.backButton}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.title}>{t('support.title')}</Text>
          <View style={styles.backButton} />
        </View>

        {view === 'list' && renderList()}
        {view === 'create' && renderCreate()}
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
    backgroundColor: DfxColors.warning,
  },
  statusResolved: {
    backgroundColor: DfxColors.success,
  },
  statusText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: DfxColors.black,
    textTransform: 'capitalize',
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
  spacer: {
    flex: 1,
  },
});
