// eslint-disable-next-line
import { UserLayout, BasicLayout, BlankLayout } from '@/layouts'

const RouteView = {
  name: 'RouteView',
  render: h => h('router-view')
}

export const asyncRouterMap = [
  {
    path: '/',
    name: 'index',
    component: BasicLayout,
    meta: { title: 'menu.home-page' },
    redirect: '/home',
    children: [
      // Home（首页）：导航栏第一位
      {
        path: '/home',
        name: 'Home',
        component: () => import('@/views/home/Home'),
        meta: { title: 'menu.home', keepAlive: true, icon: 'home', permission: ['home'] }
      },
      // Available HOST
      // 用 RouteView 包装一层（与 /dashboard 同模式）：详情页 matched 达到 3 层，
      // pro-layout 才能在 meta.hidden 时高亮父级菜单 /available-host
      {
        path: '/available-host',
        name: 'AvailableHost',
        redirect: '/available-host/list',
        component: RouteView,
        // 路由级属性：BaseMenu 按单个菜单项渲染，不显示子菜单
        hideChildrenInMenu: true,
        meta: { title: 'menu.host-management', keepAlive: true, icon: 'desktop', permission: ['table'] },
        children: [
          {
            path: 'list',
            name: 'AvailableHostList',
            component: () => import('@/views/host/AvailableHostList'),
            meta: { title: 'menu.host-management', keepAlive: true, permission: ['table'] }
          },
          // HOST 详情页：从列表点击 View 进入，不在菜单显示
          {
            path: 'detail',
            name: 'HostDetail',
            component: () => import('@/views/host/HostDetail'),
            // hidden 为路由级属性（非 meta.hidden），pro-layout 侧边栏按 item.hidden 过滤
            hidden: true,
            meta: { title: 'HOST Detail', hidden: true, permission: ['table'] }
          }
        ]
      },
      // Pending HOST
      // 用 RouteView 包装一层（与 /available-host 同模式）
      {
        path: '/pending-host',
        name: 'PendingHost',
        redirect: '/pending-host/list',
        component: RouteView,
        // 路由级属性：BaseMenu 按单个菜单项渲染，不显示子菜单
        hideChildrenInMenu: true,
        meta: { title: 'menu.pending-host', keepAlive: true, icon: 'audit', permission: ['table'] },
        children: [
          {
            path: 'list',
            name: 'PendingHostList',
            component: () => import('@/views/host/PendingHostList'),
            meta: { title: 'menu.pending-host', keepAlive: true, permission: ['table'] }
          },
          // Pending HOST 详情页：从列表点击 View 进入，不在菜单显示
          {
            path: 'detail',
            name: 'PendingHostDetail',
            component: () => import('@/views/host/PendingHostDetail'),
            // hidden 为路由级属性（非 meta.hidden），pro-layout 侧边栏按 item.hidden 过滤
            hidden: true,
            meta: { title: 'Pending HOST Detail', hidden: true, permission: ['table'] }
          }
        ]
      },
      // OTA Management
      {
        path: '/ota-management',
        name: 'OtaManagement',
        component: () => import('@/views/ota/OtaManagement'),
        meta: { title: 'menu.ota-management', keepAlive: true, icon: 'cloud-upload', permission: ['table'] }
      },
      // Account Management（账号管理）
      // 用 RouteView 包装一层（与 /available-host 同模式）：详情页 matched 达到 3 层，
      // pro-layout 才能在 meta.hidden 时高亮父级菜单 /account-management
      // 权限标识 account-management 仅 Admin 角色拥有，菜单入口只对 Admin 显示
      {
        path: '/account-management',
        name: 'AccountManagement',
        redirect: '/account-management/list',
        component: RouteView,
        // 路由级属性：BaseMenu 按单个菜单项渲染，不显示子菜单
        hideChildrenInMenu: true,
        meta: { title: 'menu.account-management', keepAlive: true, icon: 'user', permission: ['account-management'] },
        children: [
          {
            path: 'list',
            name: 'AccountManagementList',
            component: () => import('@/views/account-management/AccountList'),
            meta: { title: 'menu.account-management', keepAlive: true, permission: ['account-management'] }
          }
        ]
      }
    ]
  },
  {
    path: '*',
    redirect: '/404',
    hidden: true
  }
]

/**
 * 基础路由
 * @type { *[] }
 */
export const constantRouterMap = [
  {
    path: '/user',
    component: UserLayout,
    redirect: '/user/login',
    hidden: true,
    children: [
      {
        path: 'login',
        name: 'login',
        component: () => import(/* webpackChunkName: "user" */ '@/views/user/Login')
      }
    ]
  },

  {
    path: '/404',
    component: () => import(/* webpackChunkName: "fail" */ '@/views/exception/404')
  }
]
