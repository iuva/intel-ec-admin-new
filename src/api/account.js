import request from '@/utils/request'

/**
 * 账号管理接口（契约 §6，全部 admin only）
 * 角色取值：admin / labtech / viewer
 * 分页出参统一：{ list, page, page_size, total }
 */

// 账号列表：GET /api/v1/auth/admin/users
// params: { page, page_size, username?, role? }（username 模糊过滤；role 精确过滤，非法 422）
// 行字段：id / user_account / role / password / create_time / last_login_time
// password 恒为掩码；viewer 请求时后端不下发该字段
export function getAccountList (params) {
  return request({
    url: '/api/v1/auth/admin/users',
    method: 'get',
    params
  })
}

// 新建账号：POST /api/v1/auth/admin/users
// data: { user_account, password, password_confirm?, user_name?, email?, role? }
// 出参 data: { id, user_account, role }
// 422：密码强度 / role 非法 / 账号已存在 / password_confirm 不一致
export function addAccount (data) {
  return request({
    url: '/api/v1/auth/admin/users',
    method: 'post',
    data
  })
}

// 编辑账号：PUT /api/v1/auth/admin/users/{user_id}
// data: { user_name?, email?, role?, state_flag?, password? }（user_account 不可变）
// 改密 / 改角色 / 禁用 → 该用户即时失效（需重新登录）
export function updateAccount (userId, data) {
  return request({
    url: `/api/v1/auth/admin/users/${userId}`,
    method: 'put',
    data
  })
}

// 删除账号：DELETE /api/v1/auth/admin/users/{user_id}
// 出参 data: { ok: true }
// 422：不能删自己 / 不能删最后一个启用 admin
export function deleteAccount (userId) {
  return request({
    url: `/api/v1/auth/admin/users/${userId}`,
    method: 'delete'
  })
}
