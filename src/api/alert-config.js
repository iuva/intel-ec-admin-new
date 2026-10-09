import request from '../utils/request'

// Fetch alert threshold configuration - retrieves the global timeout thresholds and notification settings
// Permission: admin / labtech / viewer (readable by all roles)
// Response: { data: { occupied_timeout_hours, offline_timeout_hours, hardware_timeout_hours,
//            lock_timeout_hours, notify_enabled, notify_repeat_hours, notify_offline_to_user,
//            offline_user_window_hours, allowed_email_domains }, message: string }
export const fetchAlertConfig = (params) => {
  return request({
    url: '/api/v1/host/admin/host/alert-config',
    method: 'get',
    params
  })
}

// Update alert threshold configuration - saves and takes effect immediately for stats/alerts
// Permission: admin only. All fields optional, missing fields keep their current values.
// Request body: { occupied_timeout_hours: 1-72, offline_timeout_hours: 1-720, hardware_timeout_hours: 1-720,
//                 lock_timeout_hours: 1-72, notify_enabled: bool, notify_repeat_hours: 1-168,
//                 notify_offline_to_user: bool, offline_user_window_hours: 1-720,
//                 allowed_email_domains: string[] (non-empty) }
// Response: full 9 fields after saving (same shape as GET data)
// Error: 422 ALERT_CONFIG_INVALID with per-field errors list
export const updateAlertConfig = (data) => {
  return request({
    url: '/api/v1/host/admin/host/alert-config',
    method: 'put',
    data
  })
}
