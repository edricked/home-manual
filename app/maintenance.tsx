import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppFrame } from '@/components/app-frame';
import { getHome } from '@/features/home/home-repository';
import {
  completeMaintenanceTask,
  formatDate,
  getDueState,
  listMaintenanceEvents,
  listMaintenanceTasks,
  listPausedMaintenanceTasks,
  type MaintenanceEvent,
  type MaintenanceTask,
} from '@/features/maintenance/maintenance-repository';

export default function MaintenanceScreen() {
  const db = useSQLiteContext();
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [history, setHistory] = useState<MaintenanceEvent[]>([]);
  const [pausedTasks, setPausedTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string>();
  const [error, setError] = useState<string>();
  const [pendingTask, setPendingTask] = useState<MaintenanceTask>();
  const [completionNotes, setCompletionNotes] = useState('');

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const home = await getHome(db);
      if (!home) return router.replace('/onboarding');
      const [taskRows, eventRows, pausedRows] = await Promise.all([
        listMaintenanceTasks(db, home.id),
        listMaintenanceEvents(db, home.id),
        listPausedMaintenanceTasks(db, home.id),
      ]);
      setTasks(taskRows);
      setHistory(eventRows);
      setPausedTasks(pausedRows);
    } catch {
      setError('Could not load maintenance.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => void load(), [load]));

  const groups = useMemo(() => {
    const urgent = tasks.filter((task) => ['overdue', 'due', 'soon'].includes(getDueState(task.nextDueDate).key));
    const upcoming = tasks.filter((task) => getDueState(task.nextDueDate).key === 'upcoming');
    return { urgent, upcoming };
  }, [tasks]);

  async function complete(task: MaintenanceTask, notes: string | null = null) {
    setCompletingId(task.id);
    setError(undefined);
    try {
      await completeMaintenanceTask(db, task, notes);
      setPendingTask(undefined);
      setCompletionNotes('');
      await load();
    } catch {
      setError('Could not mark this task complete.');
    } finally {
      setCompletingId(undefined);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <AppFrame>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>HOME CARE</Text>
            <Text style={styles.title}>Maintenance</Text>
            <Text style={styles.subtitle}>Small jobs, remembered for you.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/maintenance/new')} style={styles.addButton}>
            <Text style={styles.addIcon}>+</Text>
            <Text style={styles.addText}>Add task</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>✓</Text></View>
            <Text style={styles.emptyTitle}>Nothing to remember yet</Text>
            <Text style={styles.emptyBody}>
              Add recurring care for an appliance or home system. We’ll keep the next due date here.
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/maintenance/new')} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Add your first task</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.summary}>
              <View>
                <Text style={styles.summaryNumber}>{groups.urgent.length}</Text>
                <Text style={styles.summaryLabel}>Need attention</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View>
                <Text style={styles.summaryNumber}>{groups.upcoming.length}</Text>
                <Text style={styles.summaryLabel}>Coming up</Text>
              </View>
            </View>

            {groups.urgent.length > 0 ? (
              <TaskSection
                completingId={completingId}
                onComplete={setPendingTask}
                onOpen={(task) => router.push({ pathname: '/maintenance/[id]', params: { id: task.id } })}
                tasks={groups.urgent}
                title="Needs attention"
              />
            ) : (
              <View style={styles.allClear}>
                <Text style={styles.allClearTitle}>All clear</Text>
                <Text style={styles.allClearBody}>Nothing is due in the next two weeks.</Text>
              </View>
            )}

            {groups.upcoming.length > 0 ? (
              <TaskSection
                completingId={completingId}
                onComplete={setPendingTask}
                onOpen={(task) => router.push({ pathname: '/maintenance/[id]', params: { id: task.id } })}
                tasks={groups.upcoming}
                title="Upcoming recurring"
              />
            ) : null}
          </>
        )}

        {history.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recently completed</Text>
            <View style={styles.historyCard}>
              {history.map((event, index) => (
                <Pressable
                  accessibilityRole="button"
                  key={event.id}
                  onPress={() => router.push({ pathname: '/maintenance/[id]', params: { id: event.taskId } })}
                  style={({ pressed }) => [styles.historyRow, index < history.length - 1 && styles.historyBorder, pressed && styles.pressed]}>
                  <View style={styles.historyCheck}><Text style={styles.historyCheckText}>✓</Text></View>
                  <View style={styles.taskText}>
                    <Text style={styles.historyTitle}>{event.taskTitle}</Text>
                    <Text style={styles.taskMeta}>{event.itemName} · {formatDate(event.completedAt)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {pausedTasks.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Paused</Text>
            <View style={styles.historyCard}>
              {pausedTasks.map((task, index) => (
                <Pressable
                  accessibilityRole="button"
                  key={task.id}
                  onPress={() => router.push({ pathname: '/maintenance/[id]', params: { id: task.id } })}
                  style={({ pressed }) => [styles.historyRow, index < pausedTasks.length - 1 && styles.historyBorder, pressed && styles.pressed]}>
                  <View style={styles.pausedIcon}><Text style={styles.pausedIconText}>Ⅱ</Text></View>
                  <View style={styles.taskText}>
                    <Text style={styles.historyTitle}>{task.title}</Text>
                    <Text style={styles.taskMeta}>{task.itemName} · Tap to resume</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Modal animationType="fade" onRequestClose={() => setPendingTask(undefined)} transparent visible={Boolean(pendingTask)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.completeIcon}><Text style={styles.completeIconText}>✓</Text></View>
            <Text style={styles.modalTitle}>Complete {pendingTask?.title}?</Text>
            <Text style={styles.modalBody}>Add an optional note about what you did, supplies used, or anything to remember next time.</Text>
            <TextInput
              accessibilityLabel="Completion notes"
              multiline
              onChangeText={setCompletionNotes}
              placeholder="Completion note (optional)"
              style={styles.completionInput}
              textAlignVertical="top"
              value={completionNotes}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!pendingTask || Boolean(completingId)}
              onPress={() => pendingTask && complete(pendingTask, completionNotes)}
              style={styles.modalPrimary}>
              <Text style={styles.modalPrimaryText}>{completingId ? 'Saving…' : 'Mark complete'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={Boolean(completingId)} onPress={() => {
              setPendingTask(undefined);
              setCompletionNotes('');
            }} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AppFrame>
  );
}

function TaskSection({
  completingId,
  onComplete,
  onOpen,
  tasks,
  title,
}: {
  completingId?: string;
  onComplete: (task: MaintenanceTask) => void;
  onOpen: (task: MaintenanceTask) => void;
  tasks: MaintenanceTask[];
  title: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.taskCard}>
        {tasks.map((task, index) => {
          const state = getDueState(task.nextDueDate);
          const completedToday = task.lastCompletedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10);
          return (
            <View key={task.id} style={[styles.taskRow, index < tasks.length - 1 && styles.taskBorder]}>
              <View style={[styles.statusDot, styles[`status_${state.key}`]]} />
              <Pressable accessibilityRole="button" onPress={() => onOpen(task)} style={styles.taskText}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskMeta}>{task.itemName} · repeats every {task.intervalDays} days</Text>
                <Text style={[styles.dueLabel, styles[`due_${state.key}`]]}>
                  {completedToday ? `Completed today · next ${formatDate(task.nextDueDate)}` : state.label}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={completedToday ? `${task.title} completed today` : `Mark ${task.title} done`}
                accessibilityRole="button"
                disabled={completingId === task.id || completedToday}
                onPress={() => onComplete(task)}
                style={[styles.doneButton, completedToday && styles.doneButtonDisabled]}>
                <Text style={styles.doneButtonText}>
                  {completingId === task.id ? '…' : completedToday ? 'Done today' : 'Done'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: { alignItems: 'center', backgroundColor: '#263b33', borderRadius: 13, flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 15 },
  addIcon: { color: '#fff', fontSize: 20, lineHeight: 22 },
  addText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  allClear: { backgroundColor: '#e4f0e9', borderRadius: 16, gap: 4, padding: 18 },
  allClearBody: { color: '#52665d', fontSize: 14 },
  allClearTitle: { color: '#27543f', fontSize: 18, fontWeight: '800' },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  chevron: { color: '#819089', fontSize: 24 },
  completeIcon: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#e5f0ea', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  completeIconText: { color: '#2f6651', fontSize: 24, fontWeight: '800' },
  completionInput: { backgroundColor: '#f7f7f4', borderColor: '#ccd5d0', borderRadius: 12, borderWidth: 1, color: '#27342f', fontSize: 15, minHeight: 92, padding: 12 },
  content: { gap: 25, padding: 20, paddingBottom: 36 },
  doneButton: { alignItems: 'center', borderColor: '#b7c6bf', borderRadius: 10, borderWidth: 1, justifyContent: 'center', minHeight: 38, paddingHorizontal: 13 },
  doneButtonDisabled: { backgroundColor: '#f0f3f1', opacity: 0.7 },
  doneButtonText: { color: '#2f6651', fontSize: 13, fontWeight: '800' },
  due_due: { color: '#9b4c13' },
  due_overdue: { color: '#a33b32' },
  due_soon: { color: '#9b6a12' },
  due_upcoming: { color: '#65716d' },
  dueLabel: { fontSize: 12, fontWeight: '700', marginTop: 5 },
  emptyBody: { color: '#65716d', fontSize: 15, lineHeight: 22, maxWidth: 390, textAlign: 'center' },
  emptyCard: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#e1e4df', borderRadius: 20, borderWidth: 1, gap: 10, padding: 28 },
  emptyIcon: { alignItems: 'center', backgroundColor: '#e5f0ea', borderRadius: 25, height: 50, justifyContent: 'center', marginBottom: 4, width: 50 },
  emptyIconText: { color: '#2f6651', fontSize: 25, fontWeight: '800' },
  emptyTitle: { color: '#22302b', fontSize: 21, fontWeight: '800', textAlign: 'center' },
  error: { backgroundColor: '#fbe9e7', borderRadius: 10, color: '#9b342c', padding: 12 },
  eyebrow: { color: '#2f6651', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerText: { flex: 1, gap: 3 },
  historyBorder: { borderBottomColor: '#e7e9e5', borderBottomWidth: 1 },
  historyCard: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16 },
  historyCheck: { alignItems: 'center', backgroundColor: '#e5f0ea', borderRadius: 15, height: 30, justifyContent: 'center', width: 30 },
  historyCheckText: { color: '#2f6651', fontWeight: '800' },
  historyRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 68, paddingVertical: 11 },
  historyTitle: { color: '#35423d', fontSize: 15, fontWeight: '600' },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(20, 28, 25, 0.48)', flex: 1, justifyContent: 'center', padding: 22 },
  modalBody: { color: '#68736f', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  modalCancel: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  modalCancelText: { color: '#58655f', fontSize: 14, fontWeight: '700' },
  modalCard: { backgroundColor: '#fff', borderRadius: 21, gap: 12, maxWidth: 420, padding: 22, width: '100%' },
  modalPrimary: { alignItems: 'center', backgroundColor: '#263b33', borderRadius: 12, justifyContent: 'center', minHeight: 50 },
  modalPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  modalTitle: { color: '#26332f', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  pausedIcon: { alignItems: 'center', backgroundColor: '#e8ebe9', borderRadius: 15, height: 30, justifyContent: 'center', width: 30 },
  pausedIconText: { color: '#62706a', fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.68 },
  primaryButton: { alignItems: 'center', backgroundColor: '#263b33', borderRadius: 13, justifyContent: 'center', marginTop: 7, minHeight: 50, paddingHorizontal: 18 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  section: { gap: 10 },
  sectionTitle: { color: '#43504b', fontSize: 13, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  statusDot: { borderRadius: 5, height: 10, marginTop: 5, width: 10 },
  status_due: { backgroundColor: '#c87226' },
  status_overdue: { backgroundColor: '#c24b42' },
  status_soon: { backgroundColor: '#d49a2c' },
  status_upcoming: { backgroundColor: '#8a9691' },
  subtitle: { color: '#707a76', fontSize: 14 },
  summary: { backgroundColor: '#263b33', borderRadius: 18, flexDirection: 'row', gap: 25, padding: 20 },
  summaryDivider: { backgroundColor: '#52675e', width: 1 },
  summaryLabel: { color: '#c8d4ce', fontSize: 13, marginTop: 2 },
  summaryNumber: { color: '#fff', fontSize: 28, fontWeight: '800' },
  taskBorder: { borderBottomColor: '#e7e9e5', borderBottomWidth: 1 },
  taskCard: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16 },
  taskMeta: { color: '#76807c', fontSize: 12, marginTop: 3 },
  taskRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 11, minHeight: 92, paddingVertical: 15 },
  taskText: { flex: 1 },
  taskTitle: { color: '#26332f', fontSize: 16, fontWeight: '700' },
  title: { color: '#1f2c28', fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
});
