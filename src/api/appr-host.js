import request from '../utils/request'

// Fetch pending approval hosts list - retrieves hosts awaiting admin approval
// Query parameters: page, page_size, hostname, host_ip, user, mac, mg_id, host_state (all fuzzy except host_state exact)
// host_state: int (5=Pending Activation 6=Hardware Modification 7=Manually Disabled 8=Updating)
// Response: { data: { hosts: [...], total: number }, message: string }
// Row fields: host_id / host_ip / mg_id / mac_addr / host_state / subm_time / diff_state (1=version change 2=content change)
export const fetchPendingList = (params) => {
  return request({
    url: '/api/v1/host/admin/appr-host/list',
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

// Maintain email configuration - sets the maintenance notification email
// Request body: { email: string, email_confirm?: string } - email_confirm must equal email when provided (422 EMAIL_CONFIRM_MISMATCH); empty email 400 EMAIL_EMPTY
// Response: { message: string }
export const maintainEmail = (data) => {
  return request({
    url: '/api/v1/host/admin/appr-host/maintain-email',
    method: 'post',
    data
  })
}

// Fetch maintain email configuration - retrieves the current maintenance notification email
// Response: { data: { conf_key: 'email', conf_val: string }, message: string }
export const fetchMaintainEmail = (params) => {
  return request({
    url: '/api/v1/host/admin/appr-host/maintain-email',
    method: 'get',
    params
  })
}

// Activate host - approves and enables pending approval hosts (approve only, no reject)
// Request body: { host_ids: array, diff_type?: number } - diff_type: 1=version change 2=content change (host_ids required when diff_type=2)
// Response: { data: { results: [...] }, message: string }
export const activateHost = (data) => {
  return request({
    url: '/api/v1/host/admin/appr-host/approve',
    method: 'post',
    data
  })
}


// Fetch hardware change history records for one host (doc §3.3 hardware change history list)
// Path parameter: host_id - returns host_hw_rec records sorted by created_time desc
// Query parameters (all optional): page (default 1) / page_size (default 20, max 100) / sync_state (0=empty 1=pending sync 2=effective 3=failed 4=approved) / diff_state (1=version change 2=content change 3=abnormal) / hw_ver (LIKE) / include_hw_info (bool, default false)
// Response: { data: { page, total, records: [...] }, message: string }
// Row fields: hw_rec_id / host_id / hw_ver / revision (only when include_hw_info) / sync_state / diff_state / appr_time / appr_by / appr_by_name / created_time / updated_time / hw_info
export const getHwRecord = (id, params) => {
  return request({
    url: `/api/v1/host/admin/host/${id}/hw-records`,
    method: 'get',
    params
  })
}


// Fetch hardware version by record (doc §4.2: GET /appr-host/hw/{hw_rec_id})
// Path parameter: hw_rec_id (host_hw_rec.id); 404(53001) when record missing/deleted
// Response: { data: { hw_rec_id, host_id, hw_ver, revision, sync_state, diff_state, appr_time, hw_info, previous }, message: string }
// hw_info = the record itself (pending new version); previous = last effective version (sync_state=2, created earlier): { hw_rec_id, hw_ver, hw_info } | null
export const getHWV = (id) => {
  return request({
    url: `/api/v1/host/admin/appr-host/hw/${id}`,
    method: 'get'
  })
}
