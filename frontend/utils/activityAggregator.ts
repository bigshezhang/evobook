/**
 * Activity aggregator for heatmap visualization
 *
 * Converts raw UTC activity timestamps to daily aggregated data
 * for GitHub-style activity heatmap display.
 */

export interface Activity {
  completed_at: string; // ISO 8601 UTC string
}

export interface DayActivity {
  date: string; // YYYY-MM-DD local date
  count: number;
  intensity: 'none' | 'light' | 'medium' | 'deep';
}

/**
 * Aggregate learning activities into daily heatmap data.
 *
 * @param activities - Array of activities with UTC timestamps
 * @param days - Number of days to generate (default: 36)
 * @returns Array of daily activity data with intensity levels
 */
export function aggregateActivitiesToHeatmap(
  activities: Activity[],
  days: number = 36
): DayActivity[] {
  // Get today in user's local timezone
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of day

  // Count activities by local date
  const dailyCounts: Record<string, number> = {};

  activities.forEach(activity => {
    // Parse UTC timestamp and convert to local date
    const utcDate = new Date(activity.completed_at);
    const localDateStr = formatDateToLocal(utcDate);

    dailyCounts[localDateStr] = (dailyCounts[localDateStr] || 0) + 1;
  });

  // Generate complete array for the past N days
  const result: DayActivity[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = formatDateToLocal(date);

    const count = dailyCounts[dateStr] || 0;

    // Determine intensity based on count
    // Rules: 1+ = light, 5+ = medium, 10+ = deep
    let intensity: DayActivity['intensity'];
    if (count >= 10) {
      intensity = 'deep';
    } else if (count >= 5) {
      intensity = 'medium';
    } else if (count >= 1) {
      intensity = 'light';
    } else {
      intensity = 'none';
    }

    result.push({ date: dateStr, count, intensity });
  }

  return result;
}

/**
 * Format a Date object to YYYY-MM-DD string in local timezone.
 *
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format
 */
function formatDateToLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
