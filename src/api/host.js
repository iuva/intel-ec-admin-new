import request from '../utils/request'


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

// Enable host - re-enables a disabled host (sets appr_state=1)
// NOTE: 契约 §3.2：停用/启用共用 PUT /host/disable，由后端按当前 appr_state 切换
// Request body: { host_id: string } - ID of the host to enable
// Response: { message: string }
export const enableHost = (data) => {
  return request({
    url: '/api/v1/host/admin/host/enable',
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

// Modify host password - updates the password for a specific host (stored encrypted with AES)
// Request body: { host_id: string, password: string } - ID and new password for the host
// Response: { message: string }
export const modifyHostPassword = (hostId, password) => {
  return request({
    url: `/api/v1/host/admin/host/password`,
    method: 'put',
    data: {
      host_id: hostId,
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

// get host vnc info
// Path parameter: id
export const getHWV = (id) => {
  return request({
    url: `/api/v1/host/admin/host/${id}/hw-versions`,
    method: 'get'
  })
}
