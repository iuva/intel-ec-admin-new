<template>
  <page-header-wrapper
    class="host-detail-tabs"
    :title="'HOST ID: ' + hostId"
    :breadcrumb="breadcrumb"
    :tab-list="tabList"
    :tab-active-key="tabActiveKey"
    @tabChange="handleTabChange"
  >
    <template v-slot:content>
      <!-- Host 基础信息 -->
      <a-descriptions size="small" :column="isMobile ? 1 : 3" class="host-meta" title="Host Information">
        <a-descriptions-item label="Hostname">
          <span class="meta-value">{{ hostInfo.hostname }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="IP">
          <span class="meta-value">{{ hostInfo.ip }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="MAC">
          <span class="meta-value">{{ hostInfo.mac }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="MachineGuid">
          <span class="meta-value">{{ hostInfo.machineGuid }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="Port">
          <span class="meta-value">5900</span>
        </a-descriptions-item>
        <a-descriptions-item label="Password">
          <span class="meta-value">{{ passwordDisplay }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="Last Modified">
          <span>{{ hostInfo.lastModified }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="Last Refresh">
          <span class="meta-highlight">{{ hostInfo.lastRefresh }}</span>
        </a-descriptions-item>
      </a-descriptions>

      <!-- 使用信息：仅 Occupied/Running 状态有人使用，其它状态显示 -（与 Available HOST 列表口径一致） -->
      <a-descriptions size="small" :column="isMobile ? 1 : 3" class="host-meta usage-meta" title="Usage Information">
        <a-descriptions-item label="User">
          <span>{{ usageInfo.user }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="TC ID">
          <span>{{ usageInfo.tcId }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="Occupied At">
          <span>{{ usageInfo.occupiedAt }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="Duration">
          <span class="meta-highlight">{{ usageInfo.duration }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="Last Connected">
          <span>{{ usageInfo.lastConnected }}</span>
        </a-descriptions-item>
      </a-descriptions>
    </template>

    <!-- actions：realvnc 为高频主操作（primary），其余为次要操作；
         角色控制：Viewer 只读全部隐藏，Lab Tech 可用 realvnc 但无 Update Password，Admin 全部 -->
    <template v-slot:extra>
      <template v-if="!isViewer">
        <a-button type="primary" style="margin-right: 4px;" @click="vncVisible = true">realvnc</a-button>
      </template>
      <a-button-group v-if="!isViewer">
        <a-button @click="handleDisableHost">Disable host</a-button>
        <a-button @click="handleGoOffline">Go offline</a-button>
      </a-button-group>
      <a-button v-if="isAdmin" style="margin-left: 8px;" @click="pwdVisible = true">Update Password</a-button>
    </template>

    <template v-slot:extraContent>
      <div class="status-block">
        <div class="text">Status</div>
        <div class="status-pill" :style="{ background: statusBgColor, borderColor: statusColor }">
          <span class="status-dot" :style="{ background: statusColor }"></span>
          <span class="status-text" :style="{ color: statusColor }">{{ hostStatus }}</span>
        </div>
      </div>
    </template>

    <!-- Hardware Information：默认 JSON 树展示；可切换为与上一次的对比视图（样式同 Pending HOST 详情审核弹窗） -->
    <a-card v-if="tabActiveKey === 'hardware'" :bordered="false" title="Hardware Information">
      <template slot="extra">
        <div class="hardware-extra">
          <!-- 最后更新时间（后续接入后端时替换） -->
          <span class="last-updated">Last Updated: {{ hardwareLastUpdated }}</span>
          <!-- 视图切换：JSON 树 / 与上一次的对比 -->
          <a-radio-group v-model="hardwareView" button-style="solid" class="view-switch">
            <a-radio-button value="tree">JSON</a-radio-button>
            <a-radio-button value="diff">Compare</a-radio-button>
          </a-radio-group>
          <!-- 单个切换按钮：已展开显示 Collapse All，已收缩显示 Expand All（样式同 Pending HOST 详情弹窗） -->
          <a-button type="primary" :icon="hardwareExpanded ? 'up' : 'down'" @click="handleToggleAll">
            {{ hardwareExpanded ? 'Collapse All' : 'Expand All' }}
          </a-button>
        </div>
      </template>
      <!-- 视图1：JSON 树，按 key 收起/展开 -->
      <json-view
        v-show="hardwareView === 'tree'"
        :data="hardwareJson"
        :label="null"
        :init-expanded="true"
        :command="jsonCommand"
        @expanded-change="onJsonRootToggle"
      />
      <!-- 视图2：与上一次硬件信息的对比（折叠面板 + CodeDiff 左右对比：左=上一次，右=当前） -->
      <div v-show="hardwareView === 'diff'" class="diff-wrap">
        <a-alert
          class="diff-tip"
          type="info"
          show-icon
          message="Compare the current hardware information with the last updated version. Green: Added, Red: Deleted, Yellow: Modified"
        />
        <a-collapse v-model="diffActiveKey">
          <!-- 可收缩面板为硬件信息 JSON 第一层级的 key（revision、mainboard、hsio、memory、security、soc 等） -->
          <a-collapse-panel v-for="section in diffSections" :key="section">
            <template slot="header">
              <div class="diff-panel-header">
                <span class="diff-panel-title">{{ section }}</span>
                <span class="diff-panel-stat">
                  <a-badge v-if="diffStats[section] && diffStats[section].isChanged" :count="'+' + diffStats[section].addNum" :number-style="{ backgroundColor: '#52c41a', marginLeft: '8px' }" />
                  <a-badge v-if="diffStats[section] && diffStats[section].isChanged" :count="'~' + diffStats[section].modNum" :number-style="{ backgroundColor: '#faad14', marginLeft: '8px' }" />
                  <a-badge v-if="diffStats[section] && diffStats[section].isChanged" :count="'-' + diffStats[section].delNum" :number-style="{ backgroundColor: '#f5222d', marginLeft: '8px' }" />
                  <a-tag v-if="diffStats[section] && !diffStats[section].isChanged" color="default">No Change</a-tag>
                </span>
              </div>
            </template>
            <!-- 外框 + 左右标签头：左侧=上一次，右侧=当前 -->
            <div class="diff-frame">
              <div class="diff-side-header">
                <span class="side-label">Historical Data</span>
                <span class="side-label">Current Data</span>
              </div>
              <!-- 左右对比：左侧=上一次，右侧=当前（同 Pending HOST 详情弹窗 CodeDiff 配置） -->
              <CodeDiff
                :old-string="jTos(lastHardwareJson[section])"
                :new-string="jTos(hardwareJson[section])"
                output-format="side-by-side"
                :context="10"
                :highlight="true"
                language="json"
                maxHeight="60vh"
                :hide-header="true"
                :hide-stat="true"
              />
            </div>
          </a-collapse-panel>
        </a-collapse>
      </div>
    </a-card>

    <!-- Execution Logs：执行日志表格，分页 + 每页数量可选 -->
    <a-card v-else :bordered="false" title="Execution Logs">
      <a-table
        :columns="logsColumns"
        :dataSource="logsData"
        :pagination="logsPagination"
      >
        <template slot="status" slot-scope="text">
          <a-tag :color="logStatusColorMap[text]">{{ text }}</a-tag>
        </template>
      </a-table>
    </a-card>

    <!-- Connect to RealVNC 弹窗：每项信息均可一键复制 -->
    <a-modal
      title="Connect to RealVNC"
      :width="520"
      :visible="vncVisible"
      @cancel="vncVisible = false"
    >
      <p class="vnc-tip">You can use RealVNC to connect to HOST for first login</p>
      <div class="vnc-row">
        <span class="vnc-label">Address:</span>
        <span class="vnc-value">{{ vncInfo.address }}</span>
        <a-icon type="copy" class="vnc-copy" @click="handleCopy(vncInfo.address)" />
      </div>
      <div class="vnc-row">
        <span class="vnc-label">Username:</span>
        <span class="vnc-value">{{ vncInfo.username }}</span>
        <a-icon type="copy" class="vnc-copy" @click="handleCopy(vncInfo.username)" />
      </div>
      <div class="vnc-row">
        <span class="vnc-label">Password:</span>
        <span class="vnc-value">{{ vncInfo.password }}</span>
        <a-icon type="copy" class="vnc-copy" @click="handleCopy(vncInfo.password)" />
      </div>
      <template slot="footer">
        <a-button @click="vncVisible = false">Cancel</a-button>
        <a-button type="primary" @click="handleVncConnect">Connect</a-button>
      </template>
    </a-modal>

    <!-- Update Password 弹窗：原始密码 + 两次新密码 -->
    <a-modal
      title="Update Password"
      :width="520"
      :visible="pwdVisible"
      :confirmLoading="pwdSubmitting"
      @cancel="pwdVisible = false"
      @ok="handlePwdSubmit"
    >
      <!-- placeholder 只留简短内容提示，长引导/约束放 extra 常驻展示，避免窄弹窗内截断 -->
      <a-form :form="pwdForm" v-bind="pwdFormItemLayout">
        <a-form-item label="Original Password">
          <a-input-password
            v-decorator="['original', { rules: [{ required: true, message: 'Please enter original password' }] }]"
            placeholder="Current password"
          />
        </a-form-item>
        <a-form-item label="New Password">
          <a-input-password
            v-decorator="['password', { rules: [{ required: true, message: 'Please enter new password' }, { min: 6, message: 'Password must be at least 6 characters' }] }]"
            placeholder="Please enter"
          />
        </a-form-item>
        <a-form-item label="Confirm Password">
          <a-input-password
            v-decorator="['confirm', { rules: [{ required: true, message: 'Please confirm new password' }, { validator: handleConfirmPassword }] }]"
            placeholder="Please enter again"
          />
        </a-form-item>
      </a-form>
    </a-modal>

  </page-header-wrapper>
</template>

<script>
import { baseMixin } from '@/store/app-mixin'
import { roleMixin, PASSWORD_MASK } from '@/utils/roles'
import { CodeDiff } from 'v-code-diff'
import JsonView from './JsonView'
import hardwareJson from './hw.json'
import { countDiffStats } from './jsonDiff'

// 上一次的硬件信息快照示例：基于 hw.json 修改部分字段，便于演示对比效果（后续接入后端接口时替换）
const buildLastSnapshot = () => {
  const data = JSON.parse(JSON.stringify(hardwareJson))
  data.revision = '0.0.9'
  data.mainboard.board.lsio.nvme_installed = true
  data.mainboard.board.peripheral.flash_programmer_installed = true
  data.mainboard.misc.bmc_version = 'bhs-25.05-0-ge1a2b3-5c6def2'
  data.mainboard.misc.cpld_version = '0.38'
  data.memory[0].memory.memory_meta_data.total_memory_size.value = 128
  data.memory[0].memory.channel = data.memory[0].memory.channel.filter(ch => ch.socket_id === 0)
  data.soc[1].soc.soc_feature.ddr5_freq = 4800
  return data
}
const lastSnapshot = buildLastSnapshot()

export default {
  name: 'HostDetail',
  mixins: [baseMixin, roleMixin],
  components: {
    JsonView,
    CodeDiff
  },
  beforeCreate () {
    // Update Password 表单
    this.pwdForm = this.$form.createForm(this)
  },
  data () {
    return {
      tabList: [
        { key: 'hardware', tab: 'Hardware Information' },
        { key: 'logs', tab: 'Execution Logs' }
      ],
      tabActiveKey: 'hardware',

      // Update Password 弹窗
      pwdVisible: false,
      pwdSubmitting: false,
      pwdFormItemLayout: {
        labelCol: { lg: { span: 7 }, sm: { span: 7 } },
        wrapperCol: { lg: { span: 13 }, sm: { span: 15 } }
      },

      // RealVNC 弹窗
      vncVisible: false,
      // VNC 连接信息示例数据，后续接入后端时替换
      vncInfo: {
        address: '192.168.10.106',
        username: 'admin',
        password: 'Host001@2025'
      },

      // HOST 状态：Free / Occupied / Running / Offline（颜色映射，值来自路由 query）
      hostStatusColorMap: {
        Free: '#52c41a',
        Occupied: '#fa8c16',
        Running: '#1890ff',
        Offline: 'rgba(0, 0, 0, 0.45)'
      },
      // 状态 pill 浅色底（语义色 10% 左右的浅背景）
      hostStatusBgColorMap: {
        Free: '#f6ffed',
        Occupied: '#fff7e6',
        Running: '#e6f7ff',
        Offline: '#fafafa'
      },

      // 硬件信息 JSON 示例数据（当前）
      hardwareJson,
      // 上一次的硬件信息快照（对比视图 Historical Data 一侧）
      lastHardwareJson: lastSnapshot,
      // 硬件信息最后更新时间（后续接入后端时替换）
      hardwareLastUpdated: '2026-08-28 10:12',
      // 硬件信息展示视图：tree=JSON 树 / diff=与上一次的对比
      hardwareView: 'tree',
      // 对比视图折叠面板展开项（默认全部收缩）
      diffActiveKey: [],
      // JSON 树一键展开/收起命令（seq 自增保证重复点击也能触发 watch）
      jsonCommand: { action: '', seq: 0 },
      // JSON 树当前是否全部展开（初始为第一层级收缩态，按钮显示 Expand All）
      jsonExpanded: false,

      // 执行日志状态 -> 标签颜色
      logStatusColorMap: {
        Success: 'green',
        Start: 'blue',
        Failed: 'red'
      },
      logsColumns: [
        { title: 'Date', dataIndex: 'date' },
        { title: 'Time', dataIndex: 'time' },
        { title: 'Execute tc_id', dataIndex: 'tcId' },
        { title: 'User', dataIndex: 'user' },
        { title: 'Status', dataIndex: 'status', scopedSlots: { customRender: 'status' } },
        { title: 'Notes', dataIndex: 'notes' }
      ],
      // User 列为邮箱数据
      logsData: [
        { key: '1', date: '2025-11-13', time: '01:25:00', tcId: 'TC-EXEC-006-013', user: 'zhangsan@company.com', status: 'Success', notes: 'Execution succeeded' },
        { key: '2', date: '2025-11-12', time: '00:23:00', tcId: 'TC-EXEC-006-002', user: 'wangwu@company.com', status: 'Start', notes: '--' },
        { key: '3', date: '2025-11-12', time: '00:52:00', tcId: 'TC-EXEC-006-001', user: 'wangwu@company.com', status: 'Failed', notes: 'Execution failed: unknown error' },
        { key: '4', date: '--', time: '--', tcId: 'TC-EXEC-006-011', user: 'lisi@company.com', status: 'Success', notes: 'Execution succeeded' },
        { key: '5', date: '2025-11-11', time: '00:56:00', tcId: 'TC-EXEC-006-014', user: 'wangwu@company.com', status: 'Start', notes: '--' },
        { key: '6', date: '2025-11-11', time: '00:40:00', tcId: 'TC-EXEC-006-028', user: 'zhaoliu@company.com', status: 'Success', notes: 'Execution succeeded' },
        { key: '7', date: '2025-11-10', time: '01:46:00', tcId: 'TC-EXEC-006-026', user: 'lisi@company.com', status: 'Success', notes: 'Execution succeeded' }
      ],
      logsPagination: {
        pageSize: 10,
        showSizeChanger: true,
        pageSizeOptions: ['10', '20', '50'],
        showTotal: total => `Total ${total} items`
      }
    }
  },
  computed: {
    // 面包屑路由：Available HOST（父级功能，可点击）/ HOST 详情（当前页）
    breadcrumbRoutes () {
      return [
        { path: '/available-host', breadcrumbName: this.$t('menu.host-management') },
        { path: '/available-host/detail', breadcrumbName: 'HOST Detail' }
      ]
    },
    breadcrumb () {
      return { props: { routes: this.breadcrumbRoutes, itemRender: this.breadcrumbItemRender } }
    },
    // 来自 /available-host 列表页 View 跳转携带的 query；直接访问时用示例数据兜底
    // （与列表 mock 数据 HOST-002 对应，保持示例一致）
    hostId () {
      return this.$route.query.id || 'HOST-002'
    },
    hostInfo () {
      const query = this.$route.query
      return {
        hostname: query.hostname || 'PC-LISI',
        ip: query.ip || '192.168.1.102',
        mac: query.mac || '00:1A:2B:3C:4D:5F',
        machineGuid: query.machineGuid || 'MG-7f3a-002',
        password: query.password || 'Host001@2025',
        // 时间字段格式 YYYY-MM-DD HH:mm（UI设计规范 12.2），接入后端时替换
        lastModified: query.lastModified || '2026-08-28 10:12',
        lastRefresh: query.lastRefresh || '2026-08-28 11:02'
      }
    },
    hostStatus () {
      return this.$route.query.status || 'Occupied'
    },
    // 密码按登录角色展示：Admin 明文 / 其它角色（Lab Tech 等）掩码
    passwordDisplay () {
      return this.isAdmin ? this.hostInfo.password : PASSWORD_MASK
    },
    // 使用信息：仅 Occupied/Running 状态有人使用；Free/Offline 显示 -（与列表页口径一致）
    // 数据来自路由 query，直接访问时用示例数据兜底（与列表 mock 数据 HOST-002 对应）
    usageInfo () {
      const query = this.$route.query
      const occupied = this.hostStatus === 'Occupied' || this.hostStatus === 'Running'
      return {
        user: occupied ? (query.user || 'lisi@company.com') : '-',
        tcId: occupied ? (query.tcId || 'TC-EXEC-006-013') : '-',
        occupiedAt: occupied ? (query.occupiedAt || '2026-08-28 10:12') : '-',
        duration: occupied ? (query.duration || '51h23m') : '-',
        lastConnected: occupied ? (query.lastConnected || '2026-08-28 10:12') : '-'
      }
    },
    statusColor () {
      return this.hostStatusColorMap[this.hostStatus]
    },
    statusBgColor () {
      return this.hostStatusBgColorMap[this.hostStatus]
    },
    // 对比视图可收缩面板 = 硬件信息 JSON 第一层级的 key（revision、mainboard、hsio、memory、security、soc 等）
    diffSections () {
      return Object.keys(this.hardwareJson || {})
    },
    // 各面板的差异统计（新增/删除/修改叶子字段数），驱动面板标题右侧徽标
    diffStats () {
      const stats = {}
      const last = this.lastHardwareJson || {}
      Object.keys(this.hardwareJson || {}).forEach(key => {
        stats[key] = countDiffStats(last[key], this.hardwareJson[key])
      })
      return stats
    },
    // Expand/Collapse All 按钮状态跟随当前视图：JSON 树看 jsonExpanded，对比视图看折叠面板是否全部展开
    hardwareExpanded () {
      if (this.hardwareView === 'tree') {
        return this.jsonExpanded
      }
      return this.diffSections.length > 0 && this.diffActiveKey.length === this.diffSections.length
    }
  },
  watch: {
    // 切换到对比视图后标记「修改」行（CodeDiff 渲染完成后再扫描 DOM）
    hardwareView (v) {
      if (v === 'diff') {
        this.$nextTick(() => setTimeout(() => this.markModifiedRows(), 200))
      }
    },
    // 展开/收缩面板时 DOM 行可见性变化，重新标记
    diffActiveKey () {
      if (this.hardwareView === 'diff') {
        this.$nextTick(() => this.markModifiedRows())
      }
    }
  },
  methods: {
    // 面包屑项渲染：末级为当前页显示纯文本；非末级用 router-link 跳回父级功能
    // （history 路由模式下不能用 Breadcrumb 默认的 href="#/x" 链接）
    breadcrumbItemRender ({ route, h }) {
      const routes = this.breadcrumbRoutes
      if (route.path === routes[routes.length - 1].path) {
        return h('span', [route.breadcrumbName])
      }
      return h('router-link', { props: { to: route.path } }, [route.breadcrumbName])
    },
    handleTabChange (key) {
      this.tabActiveKey = key
      // 切回 Hardware tab 时 JsonView 重新挂载为默认未展开态，同步按钮状态
      if (key === 'hardware') {
        this.jsonExpanded = false
      }
    },
    // 一键复制：优先 Clipboard API，非安全上下文回退 execCommand
    handleCopy (text) {
      const fallback = () => {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        try {
          document.execCommand('copy')
          this.$message.success('Copied to clipboard')
        } catch (e) {
          this.$message.error('Copy failed')
        }
        document.body.removeChild(textarea)
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
          this.$message.success('Copied to clipboard')
        }).catch(fallback)
      } else {
        fallback()
      }
    },
    handleVncConnect () {
      // TODO: 对接 RealVNC 实际连接逻辑，目前仅关闭弹窗
      this.vncVisible = false
    },
    // 二级确认：禁用 Host（参考 available-host 列表页交互）
    handleDisableHost () {
      const that = this
      this.$confirm({
        title: 'Disable Host',
        // 询问是否禁用 + 说明禁用后果（进入 Pending HOST）
        content: `Are you sure you want to disable Host ${this.hostInfo.hostname} (${this.hostInfo.ip})? After being disabled, the Host will be moved to Pending HOST.`,
        onOk () {
          // TODO: 调用后端禁用接口
          that.$message.success(`Host ${that.hostInfo.hostname} has been disabled`)
        }
      })
    },
    // 二级确认：下线 Host（下发离线通知，Host 收到后进行初始化）
    handleGoOffline () {
      const that = this
      this.$confirm({
        title: 'Go Offline',
        content: `Are you sure to send an offline notification to Host ${this.hostInfo.hostname} (${this.hostInfo.ip})? Once the notification is sent, the host will be initialized.`,
        okText: 'Send Notification',
        onOk () {
          // TODO: 调用后端下发离线通知接口
          that.$message.success(`Offline notification has been sent to Host ${that.hostInfo.hostname}`)
        }
      })
    },
    // 确认新密码与新密码一致
    handleConfirmPassword (rule, value, callback) {
      const newPassword = this.pwdForm.getFieldValue('password')
      if (value && newPassword && value !== newPassword) {
        callback(new Error('Two passwords do not match'))
      } else {
        callback()
      }
    },
    handlePwdSubmit () {
      const that = this
      this.pwdForm.validateFields((err, values) => {
        if (err) return
        that.pwdSubmitting = true
        // TODO: 调用后端改密接口 updateHostPassword(values)
        setTimeout(() => {
          that.pwdSubmitting = false
          that.pwdVisible = false
          that.pwdForm.resetFields()
          that.$message.success('Password updated successfully')
        }, 500)
      })
    },
    // 切换 JSON 树：已全部展开则收缩到第一层级，否则全部展开
    // action 必须基于翻转前的状态计算（未展开 -> expand，已展开 -> collapse）
    toggleJsonTree () {
      const nextExpanded = !this.jsonExpanded
      this.jsonCommand = {
        action: nextExpanded ? 'expand' : 'collapse',
        seq: this.jsonCommand.seq + 1
      }
      this.jsonExpanded = nextExpanded
    },
    // Expand/Collapse All：跟随当前视图生效（JSON 树 / 对比视图折叠面板）
    handleToggleAll () {
      if (this.hardwareView === 'tree') {
        this.toggleJsonTree()
      } else {
        this.toggleAllPanels()
      }
    },
    // 对比视图：切换全部面板，已展开则全部收缩，已收缩则全部展开
    toggleAllPanels () {
      this.diffActiveKey = this.hardwareExpanded ? [] : [...this.diffSections]
    },
    // 对象转格式化 JSON 字符串（供 CodeDiff 左右对比展示）
    jTos (v) {
      return JSON.stringify(v, null, 2)
    },
    // 标记「修改」行：side-by-side 中 key 相同、value 变化表现为同一行左删右增，
    // 为这类行加 modified-row 类，配合样式染成黄色（纯新增/纯删除保持绿/红）
    // 注意：对比视图内嵌在卡片中（组件 $el 内），直接在 $el 范围内定位 diff 表格
    markModifiedRows () {
      if (!this.$el) return
      const rows = this.$el.querySelectorAll('.file-diff-split tr[data-diff-change]')
      rows.forEach(tr => {
        const left = tr.querySelector('.split-side-left')
        const right = tr.querySelector('.split-side-right')
        if (
          left && right &&
          left.classList.contains('blob-code-deletion') &&
          right.classList.contains('blob-code-addition')
        ) {
          tr.classList.add('modified-row')
        }
      })
    },
    // 根节点手动收缩时同步按钮状态（根节点重新展开后子层级仍为收缩态，保持 Expand All）
    onJsonRootToggle (expanded) {
      if (!expanded) {
        this.jsonExpanded = false
      }
    }
  }
}
</script>

<style lang="less" scoped>
  // 页头 tab 标签加粗显示（Hardware Information / Execution Logs）
  .host-detail-tabs {
    /deep/ .ant-tabs-tab {
      font-weight: 600;
    }

    overflow-y: auto !important;
    height: auto !important;
  }

  .text {
    color: rgba(0, 0, 0, .45);
  }

  // 描述信息区：技术标识符用等宽字体，字符无歧义、易于扫读比对
  .host-meta {
    // 分组标题：比页面标题小一级，与描述项紧凑排列
    /deep/ .ant-descriptions-title {
      margin-bottom: 8px;
      font-size: 14px;
    }

    /deep/ .ant-descriptions-item-content {
      color: rgba(0, 0, 0, 0.85);
    }

    .meta-value {
      font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
    }

    // Last Refresh 高亮：主色 + 加粗，突出数据新鲜度
    .meta-highlight {
      color: #1890ff;
      font-weight: 600;
    }
  }

  // 使用信息分组：与基础信息分组之间留出间距
  .usage-meta {
    margin-top: 8px;
  }

  // 状态区：语义色圆点 + 浅色底 pill，提升状态显著度
  .status-block {
    text-align: right;

    .text {
      margin-bottom: 4px;
      font-weight: 600;
    }
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border: 1px solid;
    border-radius: 4px;

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 8px;
    }

    .status-text {
      font-size: 16px;
      font-weight: 600;
      line-height: 24px;
    }
  }

  // Hardware Information 卡片 extra 区：最后更新时间 + 视图切换 + 展开/收起按钮
  .hardware-extra {
    display: inline-flex;
    align-items: center;

    .last-updated {
      margin-right: 16px;
      color: rgba(0, 0, 0, 0.45);
      font-size: 12px;
      line-height: 20px;
      white-space: nowrap;
    }

    .view-switch {
      margin-right: 8px;
    }
  }

  // 对比视图：提示条与折叠面板（样式同 Pending HOST 详情审核弹窗）
  .diff-wrap {
    .diff-tip {
      margin-bottom: 16px;
    }
  }

  .diff-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding-right: 8px;
  }

  .diff-panel-title {
    font-weight: 500;
    font-size: 14px;
    color: rgba(0, 0, 0, 0.85);
  }

  .diff-panel-stat {
    display: inline-flex;
    align-items: center;
  }

  /deep/ .ant-collapse {
    .ant-collapse-content {
      .ant-collapse-content-box {
        padding: 0;

        .code-diff-view {
          margin-top: 0;
          margin-bottom: 0;
          border: 1px solid #e8e8e8;
          border-top: none;
          border-radius: 0 0 4px 4px;
        }
      }
    }
  }

  // diff 区外框 + 左右标签头：标签头两格各占 50%，与 side-by-side 左右两栏对齐；
  // 标签头与下方 diff 表格拼成一个完整外框
  .diff-frame {
    .diff-side-header {
      display: flex;
      border: 1px solid #e8e8e8;
      border-bottom: none;
      border-radius: 4px 4px 0 0;
      background: #fafafa;

      .side-label {
        flex: 1;
        padding: 8px 22px;
        font-size: 13px;
        font-weight: 500;
        color: rgba(0, 0, 0, 0.85);

        &:first-child {
          border-right: 1px solid #e8e8e8;
        }
      }
    }
  }

  // 「修改」行：同一行左删右增（key 不变、value 变化），左右两侧统一染黄；
  // 纯新增行（左空右增）保持绿色、纯删除行（左删右空）保持红色
  /deep/ .file-diff-split {
    tr.modified-row {
      .blob-code-deletion,
      .blob-code-addition {
        background-color: #fffbe6;
      }

      .blob-num-deletion,
      .blob-num-addition {
        background-color: #fff1b8;
      }
    }
  }

  .mobile {
    .status-block {
      text-align: left;
    }
  }

  // RealVNC 弹窗：标签右对齐 + 值 + 复制图标
  .vnc-tip {
    color: rgba(0, 0, 0, 0.65);
    margin-bottom: 24px;
  }

  .vnc-row {
    display: flex;
    align-items: center;
    margin-bottom: 16px;

    &:last-of-type {
      margin-bottom: 0;
    }
  }

  .vnc-label {
    flex: 0 0 110px;
    text-align: right;
    margin-right: 12px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.85);
  }

  .vnc-value {
    color: rgba(0, 0, 0, 0.85);
  }

  .vnc-copy {
    margin-left: 8px;
    color: #1890ff;
    cursor: pointer;
    transition: color 0.3s;

    &:hover {
      color: #40a9ff;
    }
  }
</style>
