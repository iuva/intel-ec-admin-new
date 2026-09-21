import request from '../utils/request'

// Fetch pending approval hosts list - retrieves hosts awaiting admin approval
// Query parameters: page, page_size, mac, mg_id, host_state
// Response: { data: { hosts: [...], total: number }, message: string }
export const fetchPendingList = (params) => {
  return request({
    url: '/api/v1/host/admin/appr-host/list',
    method: 'get',
    params
  })
}

// Fetch enabled hosts list - retrieves hosts that are currently enabled and available
// Query parameters: page, page_size, mac, username, host_state, mg_id, use_by
// Response: { data: { hosts: [...], total: number }, message: string }
export const fetchEnabledList = (params) => {
  return request({
    url: '/api/v1/host/admin/host/list',
    method: 'get',
    params
  })
}

// Maintain email configuration - sets the maintenance notification email
// Request body: { conf_val: string } - email address for notifications
// Response: { message: string }
export const maintainEmail = (data) => {
  return request({
    url: '/api/v1/host/admin/appr-host/maintain-email',
    method: 'post',
    data
  })
}

// Fetch maintain email configuration - retrieves the current maintenance notification email
// Response: { data: { conf_val: string }, message: string }
export const fetchMaintainEmail = (params) => {
  return request({
    url: '/api/v1/host/admin/appr-host/maintain-email',
    method: 'get',
    params
  })
}

// Fetch enabled host detail - retrieves detailed information for an enabled host
// Query parameter: host_id
// Response: { data: { host_details }, message: string }
export const fetchEnabledHostDetail = (params) => {
  return request({
    url: '/api/v1/host/admin/host/detail',
    method: 'get',
    params
  })
}
// Fetch pending host detail - retrieves detailed information for a pending approval host
// Query parameter: host_id
// Response: { data: { host_details }, message: string }
export const fetchPendingHostDetail = (params) => {
  return request({
    url: '/api/v1/host/admin/appr-host/detail',
    method: 'get',
    params
  })
}

// Fetch host execution logs - retrieves execution logs for a specific host
// Query parameters: host_id, page, page_size
// Response: { data: { logs: [...], total: number }, message: string }
export const fetchLogs = (params) => {
  return request({
    url: '/api/v1/host/admin/host/exec-logs',
    method: 'get',
    params
  })
}
// Activate host - approves and enables pending approval hosts
// Request body: { diff_type: number, host_ids: array } - specifies activation type and host IDs
// Response: { data: { results: [...] }, message: string }
export const activateHost = (data) => {
  return request({
    url: '/api/v1/host/admin/appr-host/approve',
    method: 'post',
    data
  })
}

// Deactivate host - disables a host (sets appr_state=0)
// Request body: { host_id: string } - ID of the host to disable
// Response: { message: string }
export const deactivateHost = (data) => {
  return request({
    url: '/api/v1/host/admin/host/disable',
    method: 'put',
    data
  })
}

// Force offline host - forces a host to go offline (sets host_state=4)
// Only allows hosts in idle state (host_state=0) to go offline
// Request body: { host_id: string } - ID of the host to force offline
// Response: { message: string }
export const forceOfflineHost = (data) => {
  return request({
    url: '/api/v1/host/admin/host/force-offline',
    method: 'post',
    data
  })
}

// Delete enabled host - logically deletes a host by setting del_flag=1
// Path parameter: id - ID of the host to delete
// Response: { message: string }
export const deleteEnabledHost = (id) => {
  return request({
    url: `/api/v1/host/admin/host/${id}`,
    method: 'delete'
  })
}

// Modify host password - updates the password for a specific host (stored encrypted with AES)
// Request body: { host_id: string, password: string } - ID and new password for the host
// Response: { message: string }
export const modifyHostPassword = (hostId, password) => {
  return request({
    url: `/api/v1/host/admin/host/password`,
    method: 'put',
    data: {
      hostId,
      password
    }
  })
}

// get host vnc info
// Path parameter: id
export const getVncInfo = (id) => {
  return request({
    url: `/api/v1/host/admin/host/${id}/vnc-credentials`,
    method: 'get'
  })
}
