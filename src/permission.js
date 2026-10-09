import router, { resetRouter } from './router'
import store from './store'
import storage from 'store'
import NProgress from 'nprogress' // progress bar
import '@/components/NProgress/nprogress.less' // progress bar custom style
import { setDocumentTitle, domTitle } from '@/utils/domUtil'
import { ACCESS_TOKEN, CURRENT_USER } from '@/store/mutation-types'
import { i18nRender } from '@/locales'
import { welcome } from '@/utils/util'

NProgress.configure({ showSpinner: false }) // NProgress Configuration

const allowList = ['login', 'register', 'registerResult'] // no redirect allowList
const loginRoutePath = '/user/login'
const defaultRoutePath = '/home'

/* ===================== 权限配置（唯一入口） =====================
 * 每个角色一组配置，新增角色只需在 ROLE_CONFIG 里加一组：
 *   pages   页面权限数组：与路由 meta.permission 对应（见 config/router.config.js），
 *           角色仅能访问 pages 内的页面，未授权路由不注册（直接输 URL 会 404）
 *   actions 按钮权限数组：'模块:操作' 标识，页面中用 v-action:模块:操作 声明，
 *           无权限的按钮自动隐藏；'*' 表示全部按钮
 * 现有按钮标识：host:vnc / host:disable / host:offline / host:delete /
 *               host:approve / host:email / host:password / account:add / account:delete
 */
export const ROLE_CONFIG = {
  // Admin：全部页面 + 全部按钮
  Admin: {
    pages: ['home', 'table', 'account-management', 'alert-config'],
    actions: ['*']
  },
  // Lab Tech：账号管理不可见；主机可操作，无删除/修改密码
  'Lab Tech': {
    pages: ['home', 'table'],
    actions: ['host:vnc', 'host:disable', 'host:offline', 'host:approve', 'host:email']
  },
  // Viewer：只读
  Viewer: {
    pages: ['home', 'table'],
    actions: []
  }
}

// 角色名归一化：忽略大小写和空格/连字符/下划线（兼容后端返回 admin / LabTech / lab_tech 等写法）
const normalizeRoleName = role => String(role || '').toLowerCase().replace(/[\s_-]/g, '')

// 取角色配置：未匹配时兜底 Admin（与未登录时的兜底行为一致）
export const getRoleConfig = role => {
  const name = Object.keys(ROLE_CONFIG).find(key => normalizeRoleName(key) === normalizeRoleName(role)) || 'Admin'
  return { name, ...ROLE_CONFIG[name] }
}

// 按钮权限判断：'*' 通配全部
export const hasAction = (actions, action) => actions.includes('*') || actions.includes(action)

router.beforeEach((to, from, next) => {
  NProgress.start() // start progress bar
  to.meta && typeof to.meta.title !== 'undefined' && setDocumentTitle(`${i18nRender(to.meta.title)} - ${domTitle}`)
  /* has token */
  const token = storage.get(ACCESS_TOKEN)
  if (token) {
    if (to.path === loginRoutePath) {
      next({ path: defaultRoutePath })
      NProgress.done()
    } else {
      // 角色未就绪或路由未生成：登录后首次进入 / 刷新页面 / 换账号重新登录
      if (store.getters.roles.length === 0 || store.getters.addRouters.length === 0) {
        // 登录时角色已写入 vuex（user.js Login -> SET_ROLES）；刷新页面后从本地存储还原
        const savedUser = storage.get(CURRENT_USER) || {}
        const config = getRoleConfig(store.getters.roles[0] || savedUser.role)
        store.commit('SET_ROLES', [config.name])
        store.commit('SET_ACTIONS', config.actions)
        store.commit('SET_INFO', savedUser)
        store.commit('SET_NAME', { name: savedUser.name, welcome: welcome() })
        store.commit('SET_AVATAR', savedUser.avatar)
        // 根据角色页面权限过滤生成可访问的路由表
        store.dispatch('GenerateRoutes', { role: { name: config.name, permissionList: config.pages } }).then(() => {
          // VueRouter@3.5.0+ New API
          resetRouter() // 重置路由 防止退出重新登录或者 token 过期后页面未刷新，导致的路由重复添加
          store.getters.addRouters.forEach(r => {
            router.addRoute(r)
          })
          // 请求带有 redirect 重定向时，登录自动重定向到该地址
          const redirect = decodeURIComponent(from.query.toPath || from.query.redirect || to.path)
          if (to.path === redirect || redirect === '/404') {
            // set the replace: true so the navigation will not leave a history record
            next({ ...to, replace: true })
          } else {
            // 跳转到目的路由
            next({ path: redirect })
          }
        })
      } else {
        next()
      }
    }
  } else {
    if (allowList.includes(to.name)) {
      // 在免登录名单，直接进入
      next()
    } else {
      next({ path: loginRoutePath, query: { redirect: to.fullPath } })
      NProgress.done() // if current page is login will not trigger afterEach hook, so manually handle it
    }
  }
})

router.afterEach(() => {
  NProgress.done() // finish progress bar
})
