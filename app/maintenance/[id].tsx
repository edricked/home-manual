import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getHome } from '@/features/home/home-repository';
import { listItems, type Item } from '@/features/items/item-repository';
import {
  deleteMaintenanceTask,
  formatDate,
  getMaintenanceTask,
  listTaskEvents,
  setMaintenancePaused,
  undoMaintenanceEvent,
  updateMaintenanceTask,
  updateMaintenanceReminder,
  type MaintenanceEvent,
  type MaintenanceTask,
} from '@/features/maintenance/maintenance-repository';
import {
  cancelTaskReminder,
  requestReminderPermission,
  scheduleTaskReminder,
} from '../../features/reminders/reminder-service';

const intervals = [
  { days: 30, label: 'Monthly' },
  { days: 90, label: 'Every 3 months' },
  { days: 180, label: 'Every 6 months' },
  { days: 365, label: 'Yearly' },
];

export default function MaintenanceDetailScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<MaintenanceTask>();
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemId, setItemId] = useState('');
  const [title, setTitle] = useState('');
  const [intervalDays, setIntervalDays] = useState(90);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState<{ kind: 'delete' } | { kind: 'undo'; event: MaintenanceEvent }>();
  const remindersAvailable = Platform.OS !== 'web';

  const load = useCallback(async () => {
    try {
      const home = await getHome(db);
      if (!home) return router.replace('/onboarding');
      const [taskRow, eventRows, itemRows] = await Promise.all([
        getMaintenanceTask(db, id),
        listTaskEvents(db, id),
        listItems(db, home.id),
      ]);
      if (!taskRow) return router.replace('/maintenance');
      setTask(taskRow);
      setEvents(eventRows);
      setItems(itemRows);
      setItemId(taskRow.itemId);
      setTitle(taskRow.title);
      setIntervalDays(taskRow.intervalDays);
      setDueDate(taskRow.nextDueDate);
      setNotes(taskRow.notes ?? '');
      setReminderEnabled(taskRow.reminderEnabled);
      setReminderDaysBefore(taskRow.reminderDaysBefore);
    } catch {
      setError('Could not load this maintenance task.');
    }
  }, [db, id]);

  useFocusEffect(useCallback(() => void load(), [load]));

  async function save() {
    if (!task) return;
    setSaving(true);
    setError(undefined);
    try {
      await updateMaintenanceTask(db, task.id, {
        homeId: task.homeId,
        itemId,
        title,
        intervalDays,
        nextDueDate: dueDate,
        notes: notes || null,
      });
      if (reminderEnabled && !task.pausedAt) {
        const updatedTask: MaintenanceTask = {
          ...task,
          itemId,
          itemName: items.find((item) => item.id === itemId)?.name ?? task.itemName,
          title,
          intervalDays,
          nextDueDate: dueDate,
          notes: notes || null,
        };
        const notificationId = await scheduleTaskReminder(updatedTask, reminderDaysBefore);
        await updateMaintenanceReminder(db, task.id, true, reminderDaysBefore, notificationId);
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this task.');
    } finally {
      setSaving(false);
    }
  }

  async function togglePaused() {
    if (!task) return;
    setSaving(true);
    try {
      if (!task.pausedAt) await cancelTaskReminder(task.notificationId);
      await setMaintenancePaused(db, task.id, !task.pausedAt);
      if (task.pausedAt && reminderEnabled) {
        const notificationId = await scheduleTaskReminder(task, reminderDaysBefore);
        await updateMaintenanceReminder(db, task.id, true, reminderDaysBefore, notificationId);
      } else if (!task.pausedAt) {
        await updateMaintenanceReminder(db, task.id, reminderEnabled, reminderDaysBefore, null);
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this task.');
    } finally {
      setSaving(false);
    }
  }

  async function runConfirmedAction() {
    if (!task || !confirm) return;
    setSaving(true);
    try {
      if (confirm.kind === 'delete') {
        await cancelTaskReminder(task.notificationId);
        await deleteMaintenanceTask(db, task.id);
        setConfirm(undefined);
        router.replace('/maintenance');
        return;
      }
      await undoMaintenanceEvent(db, task, confirm.event);
      setConfirm(undefined);
      if (reminderEnabled && !task.pausedAt) {
        const updated = await getMaintenanceTask(db, task.id);
        if (updated) {
          const notificationId = await scheduleTaskReminder(updated, reminderDaysBefore);
          await updateMaintenanceReminder(db, task.id, true, reminderDaysBefore, notificationId);
        }
      }
      await load();
    } catch (caught) {
      setConfirm(undefined);
      setError(caught instanceof Error ? caught.message : 'Could not make that change.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleReminder(enabled: boolean) {
    if (!task) return;
    setSaving(true);
    setError(undefined);
    try {
      if (!enabled) {
        await cancelTaskReminder(task.notificationId);
        await updateMaintenanceReminder(db, task.id, false, reminderDaysBefore, null);
        setReminderEnabled(false);
        await load();
        return;
      }
      const permission = await requestReminderPermission();
      if (permission === 'unavailable') throw new Error('Reminders are available in the installed iPhone and Android app.');
      if (permission !== 'granted') throw new Error('Notifications are turned off. Enable them in your phone settings.');
      const notificationId = await scheduleTaskReminder(task, reminderDaysBefore);
      await updateMaintenanceReminder(db, task.id, true, reminderDaysBefore, notificationId);
      setReminderEnabled(true);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not enable this reminder.');
    } finally {
      setSaving(false);
    }
  }

  async function changeReminderDays(days: number) {
    setReminderDaysBefore(days);
    if (!task || !reminderEnabled || task.pausedAt) return;
    setSaving(true);
    try {
      const currentTask = { ...task, title, intervalDays, nextDueDate: dueDate };
      const notificationId = await scheduleTaskReminder(currentTask, days);
      await updateMaintenanceReminder(db, task.id, true, days, notificationId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reschedule this reminder.');
    } finally {
      setSaving(false);
    }
  }

  if (!task && !error) return <View style={styles.center}><ActivityIndicator size="large" /></View>;

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>MAINTENANCE TASK</Text>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>{task?.title ?? 'Maintenance'}</Text>
            {task?.pausedAt ? <Text style={styles.pausedPill}>PAUSED</Text> : null}
          </View>
          <Text style={styles.body}>Update the schedule, instructions, and completion history.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Item</Text>
          <View style={styles.choiceGrid}>
            {items.map((item) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: item.id === itemId }}
                key={item.id}
                onPress={() => setItemId(item.id)}
                style={[styles.choice, item.id === itemId && styles.choiceSelected]}>
                <Text style={[styles.choiceText, item.id === itemId && styles.choiceTextSelected]}>{item.name}</Text>
                <Text style={styles.choiceMeta}>{item.areaName || item.category || 'Home item'}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.reminderCard}>
          <View style={styles.reminderTop}>
            <View style={styles.reminderIcon}><Ionicons color="#2f6651" name="notifications-outline" size={21} /></View>
            <View style={styles.flex}>
              <Text style={styles.reminderTitle}>Maintenance reminder</Text>
              <Text style={styles.reminderBody}>
                {!remindersAvailable
                  ? 'Available in the installed iPhone and Android app.'
                  : task?.pausedAt
                    ? 'Resume this task to schedule its reminder.'
                    : 'A local notification on this device.'}
              </Text>
            </View>
            <Switch
              disabled={saving || Boolean(task?.pausedAt) || !remindersAvailable}
              onValueChange={toggleReminder}
              trackColor={{ false: '#cfd6d2', true: '#6b9a86' }}
              value={reminderEnabled && !task?.pausedAt}
            />
          </View>
          {reminderEnabled ? (
            <View style={styles.reminderOptions}>
              {[0, 1, 3, 7].map((days) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: reminderDaysBefore === days }}
                  disabled={saving || Boolean(task?.pausedAt)}
                  key={days}
                  onPress={() => changeReminderDays(days)}
                  style={[styles.reminderOption, reminderDaysBefore === days && styles.reminderOptionSelected]}>
                  <Text style={[styles.reminderOptionText, reminderDaysBefore === days && styles.reminderOptionTextSelected]}>
                    {days === 0 ? 'Due day' : `${days}d before`}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <Field label="Task name" onChangeText={setTitle} value={title} />

        <View style={styles.section}>
          <Text style={styles.label}>Repeat</Text>
          <View style={styles.chips}>
            {intervals.map((interval) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: interval.days === intervalDays }}
                key={interval.days}
                onPress={() => setIntervalDays(interval.days)}
                style={[styles.chip, interval.days === intervalDays && styles.chipSelected]}>
                <Text style={[styles.chipText, interval.days === intervalDays && styles.chipTextSelected]}>{interval.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Field label="Next due date" onChangeText={setDueDate} placeholder="YYYY-MM-DD" value={dueDate} />

        <View style={styles.section}>
          <Text style={styles.label}>Instructions or notes</Text>
          <TextInput
            accessibilityLabel="Instructions or notes"
            multiline
            onChangeText={setNotes}
            style={[styles.input, styles.notes]}
            textAlignVertical="top"
            value={notes}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={styles.primaryButton}>
          <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save changes'}</Text>
        </Pressable>

        <View style={styles.historySection}>
          <View style={styles.historyHeading}>
            <Text style={styles.sectionTitle}>COMPLETION HISTORY</Text>
            <Text style={styles.historyCount}>{events.length}</Text>
          </View>
          {events.length ? (
            <View style={styles.historyCard}>
              {events.map((event, index) => (
                <View key={event.id} style={[styles.historyRow, index < events.length - 1 && styles.historyBorder]}>
                  <View style={styles.historyCheck}><Ionicons color="#2f6651" name="checkmark" size={18} /></View>
                  <View style={styles.flex}>
                    <Text style={styles.historyDate}>{formatDate(event.completedAt)}</Text>
                    <Text style={styles.historyTime}>
                      {new Date(event.completedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                    {event.notes ? <Text style={styles.historyNotes}>{event.notes}</Text> : null}
                  </View>
                  {index === 0 ? (
                    <Pressable
                      accessibilityLabel={`Undo completion from ${formatDate(event.completedAt)}`}
                      accessibilityRole="button"
                      onPress={() => setConfirm({ kind: 'undo', event })}
                      style={styles.undoButton}>
                      <Text style={styles.undoText}>Undo</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyHistoryText}>No completions recorded yet.</Text>
            </View>
          )}
        </View>

        <View style={styles.manageSection}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={togglePaused} style={styles.secondaryButton}>
            <Ionicons color="#405a4f" name={task?.pausedAt ? 'play-outline' : 'pause-outline'} size={19} />
            <Text style={styles.secondaryText}>{task?.pausedAt ? 'Resume task' : 'Pause task'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => setConfirm({ kind: 'delete' })} style={styles.deleteButton}>
            <Text style={styles.deleteText}>Delete task and history</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal animationType="fade" onRequestClose={() => setConfirm(undefined)} transparent visible={Boolean(confirm)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.warningIcon}><Ionicons color="#8a5a15" name={confirm?.kind === 'delete' ? 'trash-outline' : 'arrow-undo-outline'} size={24} /></View>
            <Text style={styles.modalTitle}>{confirm?.kind === 'delete' ? 'Delete this task?' : 'Undo this completion?'}</Text>
            <Text style={styles.modalBody}>
              {confirm?.kind === 'delete'
                ? 'The task and its entire completion history will be permanently removed.'
                : 'The completion will be removed and the previous due date restored.'}
            </Text>
            <Pressable accessibilityRole="button" disabled={saving} onPress={runConfirmedAction} style={styles.dangerButton}>
              <Text style={styles.dangerText}>{confirm?.kind === 'delete' ? 'Delete task' : 'Undo completion'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => setConfirm(undefined)} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, ...props }: { label: string; onChangeText: (value: string) => void; placeholder?: string; value: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} autoCapitalize="none" style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { color: '#68736f', fontSize: 14, lineHeight: 21 },
  cancelButton: { alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  cancelText: { color: '#58655f', fontSize: 15, fontWeight: '700' },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  chip: { backgroundColor: '#ebece8', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  chipSelected: { backgroundColor: '#2f6651' },
  chipText: { color: '#4f5d58', fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { backgroundColor: '#fff', borderColor: '#d9dedb', borderRadius: 13, borderWidth: 1, minWidth: 145, padding: 12 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  choiceMeta: { color: '#77817f', fontSize: 11, marginTop: 3 },
  choiceSelected: { backgroundColor: '#e5f0ea', borderColor: '#2f6651', borderWidth: 2 },
  choiceText: { color: '#26332f', fontSize: 14, fontWeight: '700' },
  choiceTextSelected: { color: '#214f3e' },
  content: { padding: 20, paddingBottom: 42 },
  dangerButton: { alignItems: 'center', backgroundColor: '#9b352f', borderRadius: 13, justifyContent: 'center', minHeight: 50 },
  dangerText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  deleteButton: { alignItems: 'center', justifyContent: 'center', minHeight: 49 },
  deleteText: { color: '#9b352f', fontSize: 14, fontWeight: '700' },
  emptyHistory: { backgroundColor: '#fff', borderColor: '#e2e6e3', borderRadius: 14, borderWidth: 1, padding: 18 },
  emptyHistoryText: { color: '#74807b', fontSize: 14 },
  error: { backgroundColor: '#fae9e7', borderRadius: 11, color: '#8f352e', marginTop: 16, padding: 12 },
  eyebrow: { color: '#2f6651', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  flex: { flex: 1 },
  historyBorder: { borderBottomColor: '#e7eae8', borderBottomWidth: 1 },
  historyCard: { backgroundColor: '#fff', borderColor: '#e2e6e3', borderRadius: 15, borderWidth: 1, paddingHorizontal: 14 },
  historyCheck: { alignItems: 'center', backgroundColor: '#e5f0ea', borderRadius: 17, height: 34, justifyContent: 'center', width: 34 },
  historyCount: { backgroundColor: '#e5ede9', borderRadius: 10, color: '#496359', fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2 },
  historyDate: { color: '#33413c', fontSize: 14, fontWeight: '700' },
  historyHeading: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  historyNotes: { color: '#65716d', fontSize: 13, lineHeight: 18, marginTop: 7 },
  historyRow: { alignItems: 'center', flexDirection: 'row', gap: 11, minHeight: 72, paddingVertical: 12 },
  historySection: { gap: 10, marginTop: 30 },
  historyTime: { color: '#7a847f', fontSize: 11, marginTop: 2 },
  input: { backgroundColor: '#fff', borderColor: '#ccd4d0', borderRadius: 12, borderWidth: 1, color: '#22302b', fontSize: 16, minHeight: 50, paddingHorizontal: 14, paddingVertical: 12 },
  intro: { gap: 6, marginBottom: 22 },
  label: { color: '#33403b', fontSize: 14, fontWeight: '700' },
  manageSection: { borderTopColor: '#e0e4e1', borderTopWidth: 1, gap: 5, marginTop: 29, paddingTop: 18 },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(20, 28, 25, 0.48)', flex: 1, justifyContent: 'center', padding: 22 },
  modalBody: { color: '#68736f', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 21, gap: 13, maxWidth: 410, padding: 22, width: '100%' },
  modalTitle: { color: '#25322e', fontSize: 21, fontWeight: '800', textAlign: 'center' },
  notes: { minHeight: 105 },
  page: { backgroundColor: '#f8f7f3', flex: 1 },
  pageTitle: { color: '#1f2c28', flexShrink: 1, fontSize: 27, fontWeight: '800' },
  pausedPill: { backgroundColor: '#e7e9e7', borderRadius: 9, color: '#61706a', fontSize: 9, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4 },
  primaryButton: { alignItems: 'center', backgroundColor: '#263b33', borderRadius: 13, justifyContent: 'center', marginTop: 20, minHeight: 52 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  reminderBody: { color: '#6d7973', fontSize: 12, lineHeight: 17, marginTop: 2 },
  reminderCard: { backgroundColor: '#edf3f0', borderRadius: 15, gap: 13, marginBottom: 18, padding: 14 },
  reminderIcon: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  reminderOption: { backgroundColor: '#fff', borderColor: '#d3dcd7', borderRadius: 16, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  reminderOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  reminderOptionSelected: { backgroundColor: '#2f6651', borderColor: '#2f6651' },
  reminderOptionText: { color: '#58665f', fontSize: 11, fontWeight: '700' },
  reminderOptionTextSelected: { color: '#fff' },
  reminderTitle: { color: '#31413a', fontSize: 14, fontWeight: '800' },
  reminderTop: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  secondaryButton: { alignItems: 'center', borderColor: '#bcc9c3', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 49 },
  secondaryText: { color: '#405a4f', fontSize: 14, fontWeight: '800' },
  section: { gap: 8, marginBottom: 17 },
  sectionTitle: { color: '#4b5953', fontSize: 11, fontWeight: '800', letterSpacing: 0.9 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  undoButton: { borderColor: '#c7d2cd', borderRadius: 9, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  undoText: { color: '#456055', fontSize: 12, fontWeight: '800' },
  warningIcon: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#fbf0da', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
});
