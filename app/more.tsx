import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppFrame } from '@/components/app-frame';
import {
  type BackupSummary,
  type HomeManualBackup,
  chooseBackupFile,
  exportBackup,
  getBackupSummary,
  restoreBackup,
} from '@/features/backup/backup-service';

function describeBackup(summary: BackupSummary) {
  const parts = [
    `${summary.items} item${summary.items === 1 ? '' : 's'}`,
    `${summary.maintenanceTasks} maintenance task${summary.maintenanceTasks === 1 ? '' : 's'}`,
    `${summary.documents} document${summary.documents === 1 ? '' : 's'}`,
    `${summary.repairRecords} repair${summary.repairRecords === 1 ? '' : 's'}`,
    `${summary.homeEssentials} essential${summary.homeEssentials === 1 ? '' : 's'}`,
  ];
  return parts.join(' · ');
}

export default function MoreScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [busy, setBusy] = useState<'export' | 'choose' | 'restore' | null>(null);
  const [pendingBackup, setPendingBackup] = useState<HomeManualBackup | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingSummary = pendingBackup ? getBackupSummary(pendingBackup) : null;

  async function createBackupFile() {
    setBusy('export');
    setError(null);
    setMessage(null);
    try {
      const summary = await exportBackup(db);
      setMessage(`Backup ready: ${describeBackup(summary)}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the backup.');
    } finally {
      setBusy(null);
    }
  }

  async function pickBackup() {
    setBusy('choose');
    setError(null);
    setMessage(null);
    try {
      const backup = await chooseBackupFile();
      if (backup) setPendingBackup(backup);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not read that backup.');
    } finally {
      setBusy(null);
    }
  }

  async function confirmRestore() {
    if (!pendingBackup) return;
    setBusy('restore');
    setError(null);
    try {
      const summary = getBackupSummary(pendingBackup);
      await restoreBackup(db, pendingBackup);
      setPendingBackup(null);
      setMessage(`Restore complete: ${describeBackup(summary)}.`);
      router.replace('/items');
    } catch (caught) {
      setPendingBackup(null);
      setError(caught instanceof Error ? caught.message : 'Could not restore the backup.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppFrame>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>YOUR HOME</Text>
        <Text style={styles.title}>More</Text>

        <View style={styles.backupCard}>
          <View style={styles.cardHeading}>
            <View style={styles.iconTile}>
              <Ionicons color="#2f6651" name="shield-checkmark-outline" size={24} />
            </View>
            <View style={styles.headingText}>
              <Text style={styles.cardTitle}>Backup & restore</Text>
              <Text style={styles.cardBody}>
                Keep a copy of your manual somewhere safe. No account or server needed.
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={busy !== null}
            onPress={createBackupFile}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            {busy === 'export' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons color="#fff" name="download-outline" size={20} />
                <Text style={styles.primaryButtonText}>Create backup</Text>
              </>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={busy !== null}
            onPress={pickBackup}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            {busy === 'choose' ? (
              <ActivityIndicator color="#2f6651" />
            ) : (
              <>
                <Ionicons color="#2f6651" name="folder-open-outline" size={20} />
                <Text style={styles.secondaryButtonText}>Restore from file</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.helper}>
            A backup includes your homes, items, maintenance history, repairs, and readable attachments.
          </Text>
        </View>

        {message ? (
          <View style={styles.successBanner}>
            <Ionicons color="#2f6651" name="checkmark-circle" size={20} />
            <Text style={styles.successText}>{message}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons color="#9b352f" name="alert-circle" size={20} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>MANAGE</Text>
        <View style={styles.menuCard}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/documents' as Href)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Text style={styles.rowTitle}>Documents</Text>
            <Text style={styles.meta}>Browse all files</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/essentials' as Href)}
            style={({ pressed }) => [styles.row, styles.lastRow, pressed && styles.pressed]}>
            <Text style={styles.rowTitle}>Home Essentials</Text>
            <Text style={styles.meta}>Edit quick access</Text>
          </Pressable>
        </View>
        <Text style={styles.sectionLabel}>COMING LATER</Text>
        <View style={styles.menuCard}>
          <View style={[styles.row, styles.lastRow]}>
            <Text style={styles.rowTitle}>Areas</Text>
            <Text style={styles.meta}>Manage rooms</Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setPendingBackup(null)}
        transparent
        visible={pendingBackup !== null}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.warningIcon}>
              <Ionicons color="#8a5a15" name="swap-horizontal-outline" size={25} />
            </View>
            <Text style={styles.modalTitle}>Replace your local manual?</Text>
            <Text style={styles.modalBody}>
              This will replace everything currently stored on this device with the selected backup.
            </Text>
            {pendingSummary ? (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryDate}>
                  Backup from {new Date(pendingSummary.createdAt).toLocaleString()}
                </Text>
                <Text style={styles.summaryText}>{describeBackup(pendingSummary)}</Text>
                {pendingSummary.missingAttachments > 0 ? (
                  <Text style={styles.warningText}>
                    {pendingSummary.missingAttachments} attachment
                    {pendingSummary.missingAttachments === 1 ? '' : 's'} could not be included in this backup.
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy === 'restore'}
              onPress={confirmRestore}
              style={styles.dangerButton}>
              {busy === 'restore' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.dangerButtonText}>Replace my data</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy === 'restore'}
              onPress={() => setPendingBackup(null)}
              style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  backupCard: { backgroundColor: '#fff', borderColor: '#e3e6e2', borderRadius: 20, borderWidth: 1, gap: 12, padding: 18 },
  cancelButton: { alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  cancelButtonText: { color: '#53615c', fontSize: 15, fontWeight: '700' },
  cardBody: { color: '#68736f', fontSize: 14, lineHeight: 20 },
  cardHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, marginBottom: 4 },
  cardTitle: { color: '#1f2c28', fontSize: 19, fontWeight: '800', marginBottom: 4 },
  content: { padding: 20, paddingBottom: 36 },
  dangerButton: { alignItems: 'center', backgroundColor: '#9b352f', borderRadius: 13, justifyContent: 'center', minHeight: 50 },
  dangerButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  errorBanner: { alignItems: 'flex-start', backgroundColor: '#fae9e7', borderRadius: 14, flexDirection: 'row', gap: 9, marginTop: 14, padding: 14 },
  errorText: { color: '#7e302b', flex: 1, fontSize: 14, lineHeight: 20 },
  eyebrow: { color: '#2f6651', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  headingText: { flex: 1 },
  helper: { color: '#7a837f', fontSize: 12, lineHeight: 18, marginTop: 2 },
  iconTile: { alignItems: 'center', backgroundColor: '#e5f0ea', borderRadius: 12, height: 44, justifyContent: 'center', width: 44 },
  lastRow: { borderBottomWidth: 0 },
  menuCard: { backgroundColor: '#fff', borderColor: '#e3e6e2', borderRadius: 16, borderWidth: 1, paddingHorizontal: 16 },
  meta: { color: '#7a837f', fontSize: 13 },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(20, 28, 25, 0.48)', flex: 1, justifyContent: 'center', padding: 22 },
  modalBody: { color: '#68736f', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 22, gap: 13, maxWidth: 420, padding: 22, width: '100%' },
  modalTitle: { color: '#1f2c28', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: 0.78 },
  primaryButton: { alignItems: 'center', backgroundColor: '#263b33', borderRadius: 13, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 51 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  row: { borderBottomColor: '#e7e9e7', borderBottomWidth: 1, gap: 4, paddingVertical: 16 },
  rowTitle: { color: '#26332f', fontSize: 16, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', borderColor: '#b9cbc3', borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 51 },
  secondaryButtonText: { color: '#2f6651', fontSize: 15, fontWeight: '800' },
  sectionLabel: { color: '#53615c', fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginBottom: 9, marginTop: 26 },
  successBanner: { alignItems: 'flex-start', backgroundColor: '#e5f0ea', borderRadius: 14, flexDirection: 'row', gap: 9, marginTop: 14, padding: 14 },
  successText: { color: '#285543', flex: 1, fontSize: 14, lineHeight: 20 },
  summaryBox: { backgroundColor: '#f5f4ef', borderRadius: 13, gap: 5, padding: 13 },
  summaryDate: { color: '#35423e', fontSize: 13, fontWeight: '700' },
  summaryText: { color: '#68736f', fontSize: 13, lineHeight: 19 },
  title: { color: '#1f2c28', fontSize: 30, fontWeight: '800', marginBottom: 20, marginTop: 5 },
  warningIcon: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#fbf0da', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  warningText: { color: '#8a5a15', fontSize: 12, lineHeight: 17, marginTop: 3 },
});
