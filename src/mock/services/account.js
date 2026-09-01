/**
 * 账号管理共享数据模块（纯数据，不依赖 mockjs2，供页面与 mock 服务共同引用）
 * 账号管理页面、登录 mock（auth.js）、用户信息 mock（user.js）都从这里读写数据，
 * 保证「登录账号 = 账号管理列表账号」闭环。
 * 后续接入后端接口时整体替换。
 */

// 角色常量：Viewer 只读 / Lab Tech 可操作 / Admin 全部
export const ROLES = {
  ADMIN: 'Admin',
  LAB_TECH: 'Lab Tech',
  VIEWER: 'Viewer'
}

// 角色可执行操作说明（用于界面提示）
export const ROLE_ACTIONS = {
  [ROLES.ADMIN]: 'All actions (incl. Delete, Account Management)',
  [ROLES.LAB_TECH]: 'View + Disable + Go Offline',
  [ROLES.VIEWER]: 'View (read-only)'
}

// 路由级权限基础清单：Viewer / Lab Tech 与 Admin 的差异仅在账号管理入口
const BASE_PERMISSIONS = ['home', 'dashboard', 'form', 'table', 'profile', 'result', 'exception', 'user']

// 角色 -> 路由权限清单（GenerateRoutes 按此过滤菜单；账号管理入口仅 Admin 可见）
export const ROLE_CONFIG = {
  [ROLES.ADMIN]: {
    name: ROLES.ADMIN,
    describe: ROLE_ACTIONS[ROLES.ADMIN],
    permissionList: [...BASE_PERMISSIONS, 'account-management']
  },
  [ROLES.LAB_TECH]: {
    name: ROLES.LAB_TECH,
    describe: ROLE_ACTIONS[ROLES.LAB_TECH],
    permissionList: [...BASE_PERMISSIONS]
  },
  [ROLES.VIEWER]: {
    name: ROLES.VIEWER,
    describe: ROLE_ACTIONS[ROLES.VIEWER],
    permissionList: [...BASE_PERMISSIONS]
  }
}

// 模拟账号数据，后续接入后端接口时替换
export const mockAccounts = [
  { id: 'ACC-001', username: 'admin', password: 'Admin@2025', role: ROLES.ADMIN, createTime: '2026-01-05 10:00:00', lastLoginTime: '2026-08-31 09:30:00' },
  { id: 'ACC-002', username: 'labtech01', password: 'Lab@2025', role: ROLES.LAB_TECH, createTime: '2026-02-14 14:20:00', lastLoginTime: '2026-08-30 18:12:00' },
  { id: 'ACC-003', username: 'viewer01', password: 'View@2025', role: ROLES.VIEWER, createTime: '2026-03-01 09:00:00', lastLoginTime: '2026-08-29 11:05:00' }
]

// 当前登录用户名持久化（刷新页面后 getInfo 仍能取到角色；接入后端后由 token 代替）
const SESSION_KEY = 'mock-session-username'

export function setSessionUser (username) {
  window.localStorage.setItem(SESSION_KEY, username)
}

export function clearSessionUser () {
  window.localStorage.removeItem(SESSION_KEY)
}

export function getSessionUser () {
  const username = window.localStorage.getItem(SESSION_KEY)
  return mockAccounts.find(item => item.username === username)
}

// 自增 ID：按现有 ACC-00X 序号追加
export function nextAccountId () {
  const max = mockAccounts.reduce((acc, item) => {
    const num = parseInt(String(item.id).replace('ACC-', ''), 10)
    return isNaN(num) ? acc : Math.max(acc, num)
  }, 0)
  return 'ACC-' + String(max + 1).padStart(3, '0')
}

export function addAccount ({ username, password, role }) {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const createTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  const account = { id: nextAccountId(), username, password, role, createTime, lastLoginTime: '-' }
  mockAccounts.push(account)
  return account
}

export function updateAccount (id, fields) {
  const account = mockAccounts.find(item => item.id === id)
  if (account) {
    Object.assign(account, fields)
  }
  return account
}

export function deleteAccount (id) {
  const index = mockAccounts.findIndex(item => item.id === id)
  if (index > -1) {
    mockAccounts.splice(index, 1)
  }
}
