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
      },
      // 个人中心 / 个人设置：仅头像下拉菜单使用，不在侧边导航显示
      {
        path: '/account',
        component: RouteView,
        redirect: '/account/center',
        name: 'account',
        hidden: true,
        meta: { title: 'menu.account', icon: 'user', keepAlive: true, permission: ['user'] },
        children: [
          {
            path: '/account/center',
            name: 'center',
            component: () => import('@/views/account/center'),
            meta: { title: 'menu.account.center', keepAlive: true, permission: ['user'] }
          },
          {
            path: '/account/settings',
            name: 'settings',
            component: () => import('@/views/account/settings/Index'),
            meta: { title: 'menu.account.settings', hideHeader: true, permission: ['user'] },
            redirect: '/account/settings/basic',
            hideChildrenInMenu: true,
            children: [
              {
                path: '/account/settings/basic',
                name: 'BasicSettings',
                component: () => import('@/views/account/settings/BasicSetting'),
                meta: { title: 'account.settings.menuMap.basic', hidden: true, permission: ['user'] }
              },
              {
                path: '/account/settings/security',
                name: 'SecuritySettings',
                component: () => import('@/views/account/settings/Security'),
                meta: {
                  title: 'account.settings.menuMap.security',
                  hidden: true,
                  keepAlive: true,
                  permission: ['user']
                }
              },
              {
                path: '/account/settings/custom',
                name: 'CustomSettings',
                component: () => import('@/views/account/settings/Custom'),
                meta: { title: 'account.settings.menuMap.custom', hidden: true, keepAlive: true, permission: ['user'] }
              },
              {
                path: '/account/settings/binding',
                name: 'BindingSettings',
                component: () => import('@/views/account/settings/Binding'),
                meta: { title: 'account.settings.menuMap.binding', hidden: true, keepAlive: true, permission: ['user'] }
              },
              {
                path: '/account/settings/notification',
                name: 'NotificationSettings',
                component: () => import('@/views/account/settings/Notification'),
                meta: {
                  title: 'account.settings.menuMap.notification',
                  hidden: true,
                  keepAlive: true,
                  permission: ['user']
                }
              }
            ]
          }
        ]
      }

      // other
      /*
      {
        path: '/other',
        name: 'otherPage',
        component: PageView,
        meta: { title: '其他组件', icon: 'slack', permission: [ 'dashboard' ] },
        redirect: '/other/icon-selector',
        children: [
          {
            path: '/other/icon-selector',
            name: 'TestIconSelect',
            component: () => import('@/views/other/IconSelectorView'),
            meta: { title: 'IconSelector', icon: 'tool', keepAlive: true, permission: [ 'dashboard' ] }
          },
          {
            path: '/other/list',
            component: RouteView,
            meta: { title: '业务布局', icon: 'layout', permission: [ 'support' ] },
            redirect: '/other/list/tree-list',
            children: [
              {
                path: '/other/list/tree-list',
                name: 'TreeList',
                component: () => import('@/views/other/TreeList'),
                meta: { title: '树目录表格', keepAlive: true }
              },
              {
                path: '/other/list/edit-table',
                name: 'EditList',
                component: () => import('@/views/other/TableInnerEditList'),
                meta: { title: '内联编辑表格', keepAlive: true }
              },
              {
                path: '/other/list/user-list',
                name: 'UserList',
                component: () => import('@/views/other/UserList'),
                meta: { title: '用户列表', keepAlive: true }
              },
              {
                path: '/other/list/role-list',
                name: 'RoleList',
                component: () => import('@/views/other/RoleList'),
                meta: { title: '角色列表', keepAlive: true }
              },
              {
                path: '/other/list/system-role',
                name: 'SystemRole',
                component: () => import('@/views/role/RoleList'),
                meta: { title: '角色列表2', keepAlive: true }
              },
              {
                path: '/other/list/permission-list',
                name: 'PermissionList',
                component: () => import('@/views/other/PermissionList'),
                meta: { title: '权限列表', keepAlive: true }
              }
            ]
          }
        ]
      }
      */
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
      },
      {
        path: 'register',
        name: 'register',
        component: () => import(/* webpackChunkName: "user" */ '@/views/user/Register')
      },
      {
        path: 'register-result',
        name: 'registerResult',
        component: () => import(/* webpackChunkName: "user" */ '@/views/user/RegisterResult')
      },
      {
        path: 'recover',
        name: 'recover',
        component: undefined
      }
    ]
  },

  {
    path: '/404',
    component: () => import(/* webpackChunkName: "fail" */ '@/views/exception/404')
  }
]
