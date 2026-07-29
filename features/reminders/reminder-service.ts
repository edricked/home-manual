import { Platform } from 'react-native';

import { type MaintenanceTask } from '@/features/maintenance/maintenance-repository';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

async function nativeNotifications() {
  if (Platform.OS === 'web') return null;
  return import('expo-notifications');
}

async function ensureChannel() {
  const Notifications = await nativeNotifications();
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('maintenance', {
    name: 'Maintenance reminders',
    description: 'Reminders for scheduled home maintenance',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getReminderPermission(): Promise<ReminderPermission> {
  const Notifications = await nativeNotifications();
  if (!Notifications) return 'unavailable';
  const permission = await Notifications.getPermissionsAsync();
  if (Platform.OS === 'ios' && permission.ios) {
    if (
      permission.ios.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      permission.ios.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      permission.ios.status === Notifications.IosAuthorizationStatus.EPHEMERAL
    ) return 'granted';
    if (permission.ios.status === Notifications.IosAuthorizationStatus.DENIED) return 'denied';
    return 'undetermined';
  }
  return permission.status;
}

export async function requestReminderPermission(): Promise<ReminderPermission> {
  const Notifications = await nativeNotifications();
  if (!Notifications) return 'unavailable';
  await ensureChannel();
  const current = await getReminderPermission();
  if (current !== 'undetermined') return current;
  await Notifications.requestPermissionsAsync();
  return getReminderPermission();
}

export async function cancelTaskReminder(notificationId: string | null) {
  const Notifications = await nativeNotifications();
  if (!Notifications || !notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function scheduleTaskReminder(
  task: MaintenanceTask,
  daysBefore: number,
): Promise<string> {
  const Notifications = await nativeNotifications();
  if (!Notifications) throw new Error('Maintenance reminders are available in the iPhone and Android app.');
  await ensureChannel();
  if ((await getReminderPermission()) !== 'granted') {
    throw new Error('Notifications are not allowed on this device.');
  }

  await cancelTaskReminder(task.notificationId);
  const date = new Date(`${task.nextDueDate}T09:00:00`);
  date.setDate(date.getDate() - daysBefore);
  if (date.getTime() <= Date.now()) date.setTime(Date.now() + 5_000);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Maintenance due: ${task.title}`,
      body: `${task.itemName}${daysBefore ? ` · Due in ${daysBefore} day${daysBefore === 1 ? '' : 's'}` : ' · Due today'}`,
      data: { url: `/maintenance/${task.id}` },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: 'maintenance',
    },
  });
}

export async function getScheduledReminderCount() {
  const Notifications = await nativeNotifications();
  return Notifications ? (await Notifications.getAllScheduledNotificationsAsync()).length : 0;
}

export async function configureReminderNavigation(onOpen: (url: string) => void) {
  const Notifications = await nativeNotifications();
  if (!Notifications) return () => {};

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const redirect = (notification: import('expo-notifications').Notification) => {
    const url = notification.request.content.data?.url;
    if (typeof url === 'string') onOpen(url);
  };
  const lastResponse = Notifications.getLastNotificationResponse();
  if (lastResponse?.notification) redirect(lastResponse.notification);
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    redirect(response.notification);
  });
  return () => subscription.remove();
}
