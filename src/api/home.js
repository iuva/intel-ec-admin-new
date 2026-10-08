import request from '../utils/request'

export const stats = () => {
  return request({
    url: '/api/v1/host/admin/host/stats',
    method: 'get'
  })
}

/**
 * 警告和待审批列表
 * @param data
 * type: 警告列表状态（all、occupied、offline、hw_stale），审批列表： pending
 * kind： 审批列表过滤条件：Activation/Hardware Change/Forced Offline/Unknown
 * page: 页数
 * page_size: 每页数量
 * @returns {*}
 */
export const alerts = (params) => {
  return request({
    url: '/api/v1/host/admin/host/alerts',
    method: 'get',
    params
  })
}
