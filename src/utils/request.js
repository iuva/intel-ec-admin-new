import axios from 'axios'
import store from '@/store'
import storage from 'store'
import notification from 'ant-design-vue/es/notification'
import { VueAxios } from './axios'
import { ACCESS_TOKEN, REFRESH_TOKEN } from '@/store/mutation-types'
import router from '@/router'
import { refreshToken } from '@/api/index'

// 创建 axios 实例
const request = axios.create({
  // API 请求的默认前缀
  baseURL: process.env.VUE_APP_API_BASE_URL,
  timeout: 6000 // 请求超时时间
})

let isRefreshing = false
// Store request queue
let requests = []

const loginRoutePath = '/user/login'

const signOut = () => {
  notification.error({
    message: 'Unauthorized',
    description: 'Authorization verification failed'
  })
  store.commit('SET_TOKEN', '')
  store.commit('SET_REFRESH_TOKEN', '')
  storage.remove(ACCESS_TOKEN)
  storage.remove(REFRESH_TOKEN)
  const { fullPath } = router.currentRoute
  // 携带当前页面路径，登录成功后跳回原页面
  if (fullPath && fullPath !== loginRoutePath) {
    router.push({ path: loginRoutePath, query: { toPath: fullPath } })
  } else {
    router.push(loginRoutePath)
  }
}

// 异常拦截处理器
const errorHandler = (error) => {
  if (error.response) {
    const { config, response } = error
    const currentToken = storage.get(ACCESS_TOKEN)

    if (response && response.status === 401) {
      if (
        !config ||
        config._retry ||
        response.data.error_code !== 'UNAUTHORIZED'
      ) {
        signOut()
        return Promise.reject(error)
      }

      config._retry = true

      // If token is being refreshed, add request to queue
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          requests.push((token) => {
            if (!token) {
              reject(new Error('Session expired'))
              return
            }
            config.headers['Authorization'] = `Bearer ${token}`
            resolve(request(config))
          })
        })
      }

      isRefreshing = true


      return new Promise((resolve, reject) => {
        const currentRefreshToken = storage.get(REFRESH_TOKEN)
        if (!currentRefreshToken) {
          isRefreshing = false
          signOut()
          reject(new Error('No refresh token available'))
          return
        }

        refreshToken(currentRefreshToken, currentToken).then(res => {
          const { access_token, refresh_token } = res.data
          store.commit('SET_TOKEN', access_token)
          store.commit('SET_REFRESH_TOKEN', refresh_token)
          storage.set(ACCESS_TOKEN, access_token)
          storage.set(REFRESH_TOKEN, refresh_token)

          config.headers['Authorization'] = `Bearer ${access_token}`
          requests.forEach((cb) => cb(access_token))
          requests = []
          resolve(request(config))
        }).catch((refreshError) => {
          requests.forEach((cb) => cb(null)) // 让排队请求 reject
          requests = []
          signOut()
          reject(refreshError)
        }).finally(() => {
          isRefreshing = false // 刷新结束后才复位
        })
      })
    }
  }
  return Promise.reject(error)
}

// request interceptor
request.interceptors.request.use(config => {
  const token = storage.get(ACCESS_TOKEN)
  // 如果 token 存在
  // 让每个请求携带自定义 token 请根据实际情况自行修改
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
}, errorHandler)

// response interceptor
request.interceptors.response.use((response) => {
  console.log('dddddddddddddddddddddddddddddd', response)
  return response.data
}, errorHandler)

const installer = {
  vm: {},
  install (Vue) {
    Vue.use(VueAxios, request)
  }
}

export default request

export {
  installer as VueAxios,
  request as axios
}
