export interface Reminder {
  id: string;
  title: string;
  notes: string;
  dateTime: string; // ISO-8601 string, e.g. "2026-07-02T15:00"
  triggered: boolean;
  createdAt: string;
}

export interface WebNotificationConfig {
  permission: NotificationPermission;
  supported: boolean;
}
