import request from '../utils/request'

// Admin login interface - authenticates admin users and returns access tokens
// Request body: { username: string, password: string }
// Response: { token: string, refresh_token: string, message: string }
export const login = (data) => {
  return request({
    url: '/api/v1/auth/admin/login',
    method: 'post',
    data
  })
}

export const logout = (data) => {
  return request({
    url: '/api/v1/auth/logout',
    method: 'post',
    data
  })
}

// Refresh token interface - exchanges a refresh token for a new access token
// Request body: { refresh_token: string }
// Headers: Authorization: 'Bearer ' + current_access_token
// Response: { token: string, refresh_token: string }
export const refreshToken = (refreshToken, token) => {
  return request({
    url: '/api/v1/auth/refresh',
    method: 'post',
    headers: { Authorization: 'Bearer ' + token },
    data: {
      refresh_token: refreshToken
    }
  })
}

// Get available hosts list - queries available hosts with pagination
// Query parameters: page, page_size, mac, username, host_state, mg_id, use_by
// Response: { data: { hosts: [...], total: number }, message: string }
export const getAvailableHostsList = (params) => {
  return request({
    url: '/api/v1/host/admin/host/list',
    method: 'get',
    params
  })
}

// Get host detail - retrieves detailed information for a specific host
// Query parameter: host_id
// Response: { data: { host_info }, message: string }
export const getHostDetail = (hostId) => {
  return request({
    url: `/api/v1/host/admin/host/detail`,
    method: 'get',
    params: {
      host_id: hostId
    }
  })
}
