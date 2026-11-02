// Class and id references of Huly modules whose npm packages are not installed here
// (several @hcengineering packages are published without types). The server's model knows
// all of them; the client accepts plain string refs.

export const C = {
  InboxNotification: 'notification:class:InboxNotification',
  DocNotifyContext: 'notification:class:DocNotifyContext',
  ActivityMessage: 'activity:class:ActivityMessage',
  DocUpdateMessage: 'activity:class:DocUpdateMessage',
  Reaction: 'activity:class:Reaction',
  ThreadMessage: 'chunter:class:ThreadMessage',
  ToDo: 'time:class:ToDo',
  ProjectToDo: 'time:class:ProjectToDo',
  WorkSlot: 'time:class:WorkSlot',
  Calendar: 'calendar:class:Calendar',
  Event: 'calendar:class:Event',
  PullRequest: 'github:class:GithubPullRequest',
  PullRequestReview: 'github:class:GithubReview',
  ReviewComment: 'github:class:GithubReviewComment',
  Channel: 'contact:class:Channel'
} as const

export const IDS = {
  ToDosSpace: 'time:space:ToDos',
  ToDoNotAttached: 'time:ids:NotAttached',
  CalendarSpace: 'calendar:space:Calendar',
  EventNotAttached: 'calendar:ids:NoAttached',
  GithubIssueMixin: 'github:mixin:GithubIssue'
} as const

/** Huly's ToDoPriority enum (time plugin). */
export const TODO_PRIORITY: Record<string, number> = { High: 0, Medium: 1, Low: 2, NoPriority: 3, Urgent: 4 }
export const TODO_PRIORITY_LABEL: Record<number, string> = Object.fromEntries(Object.entries(TODO_PRIORITY).map(([k, v]) => [v, k]))

/** Contact channel providers (contact:channelProvider:*). */
export const CHANNEL_PROVIDERS = ['Email', 'Phone', 'LinkedIn', 'Twitter', 'GitHub', 'Facebook', 'Homepage', 'Whatsapp', 'Skype', 'Telegram', 'Viber', 'Profile'] as const

/** Calendar event ids are base32hex-encoded generated ids (calendar plugin generateEventId). */
export function generateEventId (id: string): string {
  const bytes = new TextEncoder().encode(id)
  const digits = '0123456789abcdefghijklmnopqrstuv'
  let out = ''
  for (let i = 0; i < bytes.length; i += 5) {
    const b = [0, 1, 2, 3, 4].map((k) => bytes[i + k] ?? 0)
    const octets = [
      b[0] >> 3, ((b[0] & 0x07) << 2) | (b[1] >> 6), (b[1] >> 1) & 0x1f, ((b[1] & 0x01) << 4) | (b[2] >> 4),
      ((b[2] & 0x0f) << 1) | (b[3] >> 7), (b[3] >> 2) & 0x1f, ((b[3] & 0x03) << 3) | (b[4] >> 5), b[4] & 0x1f
    ]
    for (const o of octets) out += digits.charAt(o)
  }
  return out
}
