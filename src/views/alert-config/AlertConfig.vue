<template>
  <!-- 一级功能页：面包屑仅显示功能名本身（覆盖 matched 多层级默认渲染） -->
  <page-header-wrapper
    class="alert-config"
    :breadcrumb="{ props: { routes: [{ path: '/alert-config', breadcrumbName: $t('menu.alert-config') }] } }"
  >
    <!-- 用 a-spin 而非 a-card :loading：骨架屏会卸载表单，导致 GET 回填时
         v-decorator 字段尚未注册（"You cannot set a form field before rendering..."）；
         a-spin 始终渲染子内容，表单自首次挂载即注册完毕 -->
    <a-card :bordered="false">
      <a-spin :spinning="loading">
        <a-form :form="form" v-bind="formItemLayout" @submit.prevent>
          <!-- 超时阈值：四类超时告警阈值（PUT 后 Dashboard stats/alerts 即时生效） -->
          <a-divider orientation="left">Timeout Thresholds (hours)</a-divider>
          <a-form-item label="Occupied Timeout" extra="Alert when a host stays occupied longer than this threshold">
            <a-input-number
              v-decorator="['occupied_timeout_hours', { rules: [numberRangeRule(1, 72)] }]"
              :min="1"
              :max="72"
              :precision="0"
              class="threshold-input"
            />
          </a-form-item>
          <a-form-item label="Offline Timeout" extra="Alert when a host has been offline longer than this threshold">
            <a-input-number
              v-decorator="['offline_timeout_hours', { rules: [numberRangeRule(1, 720)] }]"
              :min="1"
              :max="720"
              :precision="0"
              class="threshold-input"
            />
          </a-form-item>
          <a-form-item label="Hardware Sync Timeout" extra="Alert when hardware info has not been synced for this long">
            <a-input-number
              v-decorator="['hardware_timeout_hours', { rules: [numberRangeRule(1, 720)] }]"
              :min="1"
              :max="720"
              :precision="0"
              class="threshold-input"
            />
          </a-form-item>
          <a-form-item label="Lock Timeout" extra="Timeout for locked/idle occupancy (email notification)">
            <a-input-number
              v-decorator="['lock_timeout_hours', { rules: [numberRangeRule(1, 72)] }]"
              :min="1"
              :max="72"
              :precision="0"
              class="threshold-input"
            />
          </a-form-item>

          <!-- 邮件通知：总开关 + 重复间隔 + 离线抄送 -->
          <a-divider orientation="left">Email Notification</a-divider>
          <a-form-item label="Email Notification" extra="Master switch of the email notification task">
            <a-switch
              v-decorator="['notify_enabled', { valuePropName: 'checked', initialValue: true }]"
            />
          </a-form-item>
          <a-form-item
            label="Repeat Interval"
            extra="Minimum interval between repeated notifications for the same alert"
          >
            <a-input-number
              v-decorator="['notify_repeat_hours', { rules: [numberRangeRule(1, 168)] }]"
              :min="1"
              :max="168"
              :precision="0"
              :disabled="!notifyEnabled"
              class="threshold-input"
            />
          </a-form-item>
          <a-form-item label="CC Latest User" extra="CC the latest user when an occupied host goes offline">
            <a-switch
              v-decorator="['notify_offline_to_user', { valuePropName: 'checked', initialValue: true }]"
            />
          </a-form-item>
          <a-form-item
            label="CC Window"
            extra="Only CC when the host was used within this window before going offline"
          >
            <a-input-number
              v-decorator="['offline_user_window_hours', { rules: [numberRangeRule(1, 720)] }]"
              :min="1"
              :max="720"
              :precision="0"
              :disabled="!notifyOfflineToUser"
              class="threshold-input"
            />
          </a-form-item>

          <!-- 收件人域白名单：服务端自动去 @ 并小写，前端保存前同步归一化 -->
          <a-divider orientation="left">Allowed Email Domains</a-divider>
          <a-form-item
            label="Email Domains"
            extra="Recipient domain whitelist. Press Enter or comma to add; '@' prefix and case are normalized automatically"
          >
            <a-select
              v-decorator="['allowed_email_domains', { rules: [{ required: true, type: 'array', message: 'At least one email domain is required' }] }]"
              mode="tags"
              :token-separators="[',', ' ']"
              :open="false"
              placeholder="e.g. intel.com"
            />
          </a-form-item>

          <!-- 操作按钮：与表单控件对齐 -->
          <a-form-item :wrapper-col="{ lg: { span: 9, offset: 8 }, sm: { span: 14, offset: 10 } }">
            <a-button type="primary" :loading="saving" @click="handleSave">Save</a-button>
            <a-button style="margin-left: 8px" :disabled="saving" @click="handleReset">Reset</a-button>
          </a-form-item>
        </a-form>
      </a-spin>
    </a-card>
  </page-header-wrapper>
</template>

<script>
import { fetchAlertConfig, updateAlertConfig } from '@/api/alert-config'

// 契约默认值：GET 失败或字段缺失时的回显兜底（见 ec-api-contract-detail.md §2.3）
const DEFAULT_CONFIG = {
  occupied_timeout_hours: 4,
  offline_timeout_hours: 24,
  hardware_timeout_hours: 48,
  lock_timeout_hours: 2,
  notify_enabled: true,
  notify_repeat_hours: 24,
  notify_offline_to_user: true,
  offline_user_window_hours: 24,
  allowed_email_domains: ['intel.com']
}

// 整数范围校验规则（后端 422 ALERT_CONFIG_INVALID 的前端前置校验）
const numberRangeRule = (min, max) => ({
  validator: (rule, value, callback) => {
    if (value === undefined || value === null || value === '') {
      callback(new Error(`Please enter an integer between ${min} and ${max}`))
      return
    }
    if (!Number.isInteger(value) || value < min || value > max) {
      callback(new Error(`Please enter an integer between ${min} and ${max}`))
      return
    }
    callback()
  }
})

export default {
  name: 'AlertConfig',
  beforeCreate () {
    this.form = this.$form.createForm(this)
  },
  data () {
    return {
      formItemLayout: {
        labelCol: { lg: { span: 8 }, sm: { span: 10 } },
        wrapperCol: { lg: { span: 9 }, sm: { span: 14 } }
      },
      loading: false,
      saving: false,
      // 最近一次 GET 的全量配置，Reset 时回显
      rawConfig: {}
    }
  },
  computed: {
    // 依赖装饰器字段值：邮件总开关关闭时禁用重复间隔输入
    notifyEnabled () {
      return !!this.form.getFieldValue('notify_enabled')
    },
    // 抄送开关关闭时禁用抄送窗口输入
    notifyOfflineToUser () {
      return !!this.form.getFieldValue('notify_offline_to_user')
    }
  },
  created () {
    this.fetchConfig()
  },
  methods: {
    numberRangeRule,
    // 查询配置（§2.3 GET）：三角色可读，本页菜单仅 Admin 可见
    fetchConfig () {
      this.loading = true
      fetchAlertConfig().then(res => {
        this.rawConfig = res || {}
      }).catch(() => {
        this.$message.error('Failed to load alert config')
      }).finally(() => {
        // 先关 loading 再回填：确保回填时表单处于已渲染状态
        this.loading = false
        this.populateForm(this.rawConfig)
      })
    },
    // 回显表单：响应为保存后的全量 9 字段，缺失字段按契约默认值兜底
    populateForm (config) {
      const merged = { ...DEFAULT_CONFIG, ...config }
      this.$nextTick(() => {
        this.form.setFieldsValue({
          occupied_timeout_hours: merged.occupied_timeout_hours,
          offline_timeout_hours: merged.offline_timeout_hours,
          hardware_timeout_hours: merged.hardware_timeout_hours,
          lock_timeout_hours: merged.lock_timeout_hours,
          notify_enabled: merged.notify_enabled,
          notify_repeat_hours: merged.notify_repeat_hours,
          notify_offline_to_user: merged.notify_offline_to_user,
          offline_user_window_hours: merged.offline_user_window_hours,
          allowed_email_domains: merged.allowed_email_domains || []
        })
      })
    },
    // 保存（§2.3 PUT，admin only）：保存后 stats/alerts 即时生效，响应为全量字段直接回显
    handleSave () {
      this.form.validateFields((err, values) => {
        if (err) return
        // 域白名单归一化（与服务端口径一致：去 @、小写、去空、去重）
        const domains = [...new Set((values.allowed_email_domains || [])
          .map(d => String(d).trim().replace(/^@+/, '').toLowerCase())
          .filter(Boolean))]
        if (!domains.length) {
          this.$message.warning('At least one email domain is required')
          return
        }
        this.saving = true
        updateAlertConfig({ ...values, allowed_email_domains: domains }).then(res => {
          this.$message.success('Alert config saved, changes take effect immediately')
          if (res) {
            this.rawConfig = res
            this.populateForm(res)
          }
        }).catch(e => {
          const msg = (((e.response || {}).data || {}).message) || 'Save failed, please try again later'
          this.$message.error(msg)
        }).finally(() => {
          this.saving = false
        })
      })
    },
    // 重置：回显最近一次查询/保存后的配置
    handleReset () {
      this.populateForm(this.rawConfig)
    }
  }
}
</script>

<style lang="less" scoped>
// 阈值输入框：默认 80px 过窄，统一加宽并保证各输入框宽度一致
.threshold-input {
  width: 200px;
}

// 分节标题：加重字色，弱化分割线的视觉噪音
/deep/ .ant-divider-horizontal .ant-divider-inner-text {
  font-weight: 500;
  color: rgba(0, 0, 0, 0.85);
}
</style>
