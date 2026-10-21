import request from '../utils/request'

// 契约来源：docs/server/ec-api-contract-detail.md §5 OTA Management
// app_key 枚举：agent | ek | dmr_config（页签即 app_key）

// Fetch OTA releases list - version records of one app type（页签数据源）
// Query: { app_key }
// Response: { data: { list: [{ id, version, file_name, md5, current }] }, message }
// current 为布尔：该类型最近一次推送版本的 Current 标记（契约二轮修复口径）
export const fetchReleases = (params) => {
  return request({
    url: '/api/v1/host/admin/ota/releases',
    method: 'get',
    params
  })
}

// Upload installation package - multipart 上传安装包
// 版本号与 MD5 均由服务端解析（前端只选文件，不做本地 MD5）
// Request body: FormData { file: binary, app_key }
export const upload = (data) => {
  return request({
    url: '/api/v1/host/admin/ota/upload',
    method: 'post',
    data,
    // 安装包较大，放宽默认 6s 超时
    timeout: 120000
  })
}

// Deploy - 发布/重推共用端点（WS 广播 agent 升级）
// - 发布当前版本（confirm 语义 "publish as current"）：{ app_key, version }
// - 重推失败主机（定向单播）：{ app_key, host_ids: [host_id, ...] }；缺省 host_ids = 全量广播
export const deploy = (data) => {
  return request({
    url: '/api/v1/host/admin/ota/deploy',
    method: 'post',
    data
  })
}

// Fetch push details - 当前版本（该类型最近一次推送版本）的推送结果
// Query: { app_key }
// Response: { data: { version, to_upgrade, upgraded, failed,
//   list: [{ host_id, host_name, state: 'Push Failed', retry }] }, message }
// list 仅失败主机；app_state 口径：0/1=to_upgrade, 2=upgraded, 3=failed
export const fetchDeployResult = (params) => {
  return request({
    url: '/api/v1/host/admin/ota/deploy/result',
    method: 'get',
    params
  })
}
