import router, { resetRouter } from './router'
import store from './store'
import storage from 'store'
import NProgress from 'nprogress' // progress bar
import '@/components/NProgress/nprogress.less' // progress bar custom style
// import notification from 'ant-design-vue/es/notification'
import { setDocumentTitle, domTitle } from '@/utils/domUtil'
import { ACCESS_TOKEN } from '@/store/mutation-types'
import { i18nRender } from '@/locales'
import { getPermissionList } from './mockMenu'
import { welcome } from '@/utils/util'

NProgress.configure({ showSpinner: false }) // NProgress Configuration

const allowList = ['login', 'register', 'registerResult'] // no redirect allowList
const loginRoutePath = '/user/login'
const defaultRoutePath = '/home'

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
      // check login user.roles is null
      if (store.getters.roles.length === 0) {
        // request login userInfo
        // store
        //   .dispatch('GetInfo')
        //   .then(res => {
        //     console.log('res', res)

        // const menus = getMenu()
        // console.log('sssssssssssssssssssssssssssssssssssssss', menus)
        // store.commit('SET_ROUTERS', menus)
        const permissions = getPermissionList()
        const role = {}
        role.permissions = permissions.permissions.map(permission => {
          const per = {
            ...permission,
            actionList: (permission.actionEntitySet || {}).map(item => item.action)
          }
          return per
        })
        role.permissionList = role.permissions.map(permission => { return permission.permissionId })
        const result = {
          id: '4291d7da9005377ec9aec4a71ea837f',
          name: 'admin',
          username: 'admin',
          password: '',
          avatar: '/avatar2.jpg',
          status: 1,
          telephone: '',
          lastLoginIp: '27.154.74.117',
          lastLoginTime: 1534837621348,
          creatorId: 'admin',
          createTime: 1497160610259,
          merchantCode: 'TLif2btpzg079h15bk',
          deleted: 0,
          roleId: 'Admin',
          role
        }
        store.commit('SET_ROLES', role)
        store.commit('SET_INFO', result)
        store.commit('SET_NAME', { name: result.name, welcome: welcome() })
        store.commit('SET_AVATAR', result.avatar)
        //     // 根据用户权限信息生成可访问的路由表
            store.dispatch('GenerateRoutes', { token, role }).then(() => {
        //       // 动态添加可访问路由表
        //       // VueRouter@3.5.0+ New API
              resetRouter() // 重置路由 防止退出重新登录或者 token 过期后页面未刷新，导致的路由重复添加
              store.getters.addRouters.forEach(r => {
                router.addRoute(r)
              })
        //       // 请求带有 redirect 重定向时，登录自动重定向到该地址
              const redirect = decodeURIComponent(from.query.toPath || from.query.redirect || to.path)
              if (to.path === redirect || redirect === '/404') {
        //         // set the replace: true so the navigation will not leave a history record
                next({ ...to, replace: true })
                // next()
              } else {
        //         // 跳转到目的路由
                next({ path: redirect })
              }
            })
        //   })
        //   .catch(() => {
        //     notification.error({
        //       message: '错误',
        //       description: '请求用户信息失败，请重试'
        //     })
        //     // 失败时，获取用户信息失败时，调用登出，来清空历史保留信息
        //     store.dispatch('Logout').then(() => {
        //       next({ path: loginRoutePath, query: { redirect: to.fullPath } })
        //     })
        //   })
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
