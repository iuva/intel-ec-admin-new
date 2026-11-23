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
      <a-spin :spinning="detailLoading">
        <!-- Host 基础信息（字段以接口文档 §3.3 为准） -->
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
            <span class="meta-value">{{ hostInfo.port }}</span>
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
      </a-spin>
    </template>

    <!-- actions：realvnc 为高频主操作（primary），其余为次要操作；
         按钮权限：v-action 配置见 src/permission.js -> ROLE_CONFIG[role].actions
         （Viewer 只读全部隐藏，Lab Tech 可用 realvnc 但无 Update Password，Admin 全部） -->
    <template v-slot:extra>
      <a-button v-action:host:vnc type="primary" style="margin-right: 4px;" @click="vncVisible = true">realvnc</a-button>
      <a-button-group>
        <!-- 停用/启用互切：appr_state=0 已停用显示 Enable host（契约 §3.2：停用/启用共用 PUT /host/disable） -->
        <a-button v-action:host:disable :disabled="hostState === 1 || hostState === 3" @click="handleDisableHost">{{ apprState === 0 ? 'Enable host' : 'Disable host' }}</a-button>
        <a-button v-action:host:offline :disabled="hostState === 4" @click="handleGoOffline">Go offline</a-button>
      </a-button-group>
      <a-button v-action:host:password style="margin-left: 8px;" @click="pwdVisible = true">Update Password</a-button>
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
        :loading="logsLoading"
        :pagination="logsPagination"
        @change="handleLogsChange"
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
      <!-- 凭证由 §3.2 VNC 接口按 host_id 拉取，加载中显示 spin；Connect 按钮触发 RealVNC 协议拉起 -->
      <a-spin :spinning="vncLoading">
        <p class="vnc-tip">You can use RealVNC to connect to HOST for first login</p>
        <div class="vnc-row">
          <span class="vnc-label">Address:</span>
          <span class="vnc-value">{{ vncInfo.ip }}</span>
          <a-icon type="copy" class="vnc-copy" @click="handleCopy(vncInfo.ip)" />
        </div>
        <div class="vnc-row">
          <span class="vnc-label">Username:</span>
          <span class="vnc-value">{{ vncInfo.host_acct }}</span>
          <a-icon type="copy" class="vnc-copy" @click="handleCopy(vncInfo.host_acct)" />
        </div>
        <div class="vnc-row">
          <span class="vnc-label">Password:</span>
          <span class="vnc-value">{{ vncInfo.vnc_password }}</span>
          <a-icon type="copy" class="vnc-copy" @click="handleCopy(vncInfo.vnc_password)" />
        </div>
      </a-spin>
      <template slot="footer">
        <a-button @click="vncVisible = false">Cancel</a-button>
        <a-button type="primary" :loading="vncLoading" @click="handleVncConnect">Connect</a-button>
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
import moment from 'moment'
import { baseMixin } from '@/store/app-mixin'
import { CodeDiff } from 'v-code-diff'
import JsonView from './JsonView'
import { countDiffStats } from './jsonDiff'
import {
  fetchEnabledHostDetail,
  fetchLogs,
  deactivateHost,
  enableHost,
  forceOfflineHost,
  modifyHostPassword,
  getVncInfo
} from '@/api/host'

// host_state（int，见接口文档 §3.1）→ 状态文案，与列表页 stateDict 口径一致
const hostStateTextMap = {
  0: 'Free',
  1: 'Locked',
  2: 'Occupied',
  3: 'Running',
  4: 'Offline'
}

// 业务错误提示：优先展示服务端 message
const getErrMsg = (e, fallback) => (e && e.response && e.response.data && e.response.data.message) || fallback

export default {
  name: 'HostDetail',
  mixins: [baseMixin],
  components: {
    JsonView,
    CodeDiff
  },
  beforeCreate () {
    // Update Password 表单
    this.pwdForm = this.$form.createForm(this)
  },
  created () {
    // 路由唯一且必须携带 host_id（列表页 View / 首页告警跳转均按此规则），缺失时回列表页
    if (!this.hostId) {
      this.$message.warning('Missing required parameter: host_id')
      this.$router.replace('/available-host/list')
      return
    }
    this.fetchDetail()
  },
  data () {
    return {
      tabList: [
        { key: 'hardware', tab: 'Hardware Information' },
        { key: 'logs', tab: 'Execution Logs' }
      ],
      tabActiveKey: 'hardware',

      // 详情数据加载中
      detailLoading: false,
      // 主机详情（§3.3：GET /host/detail，字段以接口文档为准）
      detail: {},
      // 主机状态（int，host_state 0..4）
      hostState: null,
      // 审批状态（int，appr_state=1 已启用 / 0 已停用），驱动停用/启用按钮互切
      apprState: null,

      // Update Password 弹窗
      pwdVisible: false,
      pwdSubmitting: false,
      pwdFormItemLayout: {
        labelCol: { lg: { span: 7 }, sm: { span: 7 } },
        wrapperCol: { lg: { span: 13 }, sm: { span: 15 } }
      },

      // RealVNC 弹窗（凭证由 §3.2 VNC 接口按 host_id 拉取：ip/host_acct/vnc_password）
      vncVisible: false,
      vncLoading: false,
      vncInfo: {},

      // HOST 状态颜色映射（key 为状态文案，host_state→文案见 hostStateTextMap）
      hostStatusColorMap: {
        Free: '#52c41a',
        Locked: '#faad14',
        Occupied: '#fa8c16',
        Running: '#1890ff',
        Offline: 'rgba(0, 0, 0, 0.45)'
      },
      // 状态 pill 浅色底（语义色 10% 左右的浅背景）
      hostStatusBgColorMap: {
        Free: '#f6ffed',
        Locked: '#fff7e6',
        Occupied: '#fff7e6',
        Running: '#e6f7ff',
        Offline: '#fafafa'
      },

      // 硬件信息：当前生效 / 上一次审批版本（均来自详情接口；无历史数据时对比视图整块按新增渲染）
      hardwareJson: {},
      lastHardwareJson: null,
      // 硬件信息最后更新时间（hw_updated_time）
      hardwareLastUpdated: '--',
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
      logsData: [],
      logsLoading: false,
      // 服务端分页（§3.4：GET /host/exec-logs）
      logsPagination: {
        current: 1,
        pageSize: 10,
        total: 0,
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
    // 路由唯一且必须参数：host_id（所有跳转本页的入口均只携带该参数）
    hostId () {
      return this.$route.query.host_id || ''
    },
    // 基础信息：字段以接口文档 §3.3 为准（host_no/host_ip/mac/mg_id/host_port/host_pwd...）
    hostInfo () {
      const d = this.detail
      return {
        hostname: d.host_no || '-',
        ip: d.ip || '-',
        mac: d.mac || '-',
        machineGuid: d.mg_id || '-',
        port: d.port || '-',
        // 密码按角色由后端下发（admin=明文 / labtech=掩码 / viewer=null 不下发），空值展示 -
        password: d.password || '-',
        lastModified: this.formatTime(d.hw_updated_time),
        lastRefresh: this.formatTime(d.last_refresh_time)
      }
    },
    // 主机状态：host_state（int）映射为状态文案
    hostStatus () {
      return hostStateTextMap[this.hostState] || '-'
    },
    passwordDisplay () {
      return this.hostInfo.password
    },
    // 使用信息：仅 Occupied/Running 状态有人使用；其它状态显示 -（与列表页口径一致）
    // 占用时长由前端按 occupied_since 计算（now - occupied_since）
    usageInfo () {
      const occupied = this.hostState === 2 || this.hostState === 3
      const d = this.detail
      return {
        user: occupied ? (d.use_by || '-') : '-',
        // 详情契约（§3.3）未下发当前 TC ID / 最近连接时间，展示 -
        tcId: occupied ? (d.tc_id || '-') : '-',
        occupiedAt: occupied ? this.formatTime(d.occupied_since) : '-',
        duration: occupied && d.occupied_since ? this.formatDuration(d.occupied_since) : '-',
        lastConnected: occupied ? this.formatTime(d.last_connected) : '-'
      }
    },
    statusColor () {
      return this.hostStatusColorMap[this.hostStatus] || 'rgba(0, 0, 0, 0.45)'
    },
    statusBgColor () {
      return this.hostStatusBgColorMap[this.hostStatus] || '#fafafa'
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
    // 同路由不同 host_id（组件复用）时重新拉取详情
    '$route.query.host_id' () {
      if (this.hostId) {
        this.fetchDetail()
      }
    },
    // 打开 VNC 弹窗时按 host_id 拉取凭证，关闭时清空
    vncVisible (v) {
      if (v) {
        this.fetchVncInfo()
      } else {
        this.vncInfo = {}
      }
    },
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
    // 时间格式化：YYYY-MM-DD HH:mm（UI设计规范 12.2），空值展示 -
    formatTime (val) {
      return val ? moment(val).format('YYYY-MM-DD HH:mm') : '-'
    },
    // 占用时长：now - occupied_since，格式 Xh YYm（与列表页口径一致）
    formatDuration (occupiedSince) {
      const minutes = moment().diff(moment(occupiedSince), 'minutes')
      return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
    },
    // 拉取主机详情（§3.3：GET /host/detail?host_id=xxx）
    fetchDetail () {
      this.detailLoading = true
      fetchEnabledHostDetail({ host_id: this.hostId }).then(res => {
        const payload = (res && res.data) || {}
        // 兼容 data 直接展开 / data.host_details 两种返回包装
        const d = payload.host_details || payload
        this.detail = d
        this.hostState = typeof d.host_state === 'number' ? d.host_state : null
        this.apprState = typeof d.appr_state === 'number' ? d.appr_state : null
        this.hardwareJson = d.hw_info_current || {}
        this.lastHardwareJson = d.hw_info_previous || null
        this.hardwareLastUpdated = this.formatTime(d.hw_updated_time)
      }).catch(e => {
        this.$message.error(getErrMsg(e, 'Failed to load host detail'))
      }).finally(() => {
        this.detailLoading = false
      })
    },
    // 拉取执行日志（§3.4：GET /host/exec-logs?host_id=&page=&page_size=）
    fetchLogs () {
      this.logsLoading = true
      fetchLogs({
        host_id: this.hostId,
        page: this.logsPagination.current,
        page_size: this.logsPagination.pageSize
      }).then(res => {
        const payload = (res && res.data) || {}
        const rows = payload.logs || payload.list || []
        this.logsData = rows.map((row, index) => this.normalizeLogRow(row, index))
        this.logsPagination.total = payload.total || 0
      }).catch(e => {
        this.$message.error(getErrMsg(e, 'Failed to load execution logs'))
      }).finally(() => {
        this.logsLoading = false
      })
    },
    // 日志行归一化：契约列为 Date/Time/tc_id/User/Status/Notes；
    // 时间兼容整体时间戳（拆分为日期/时间）或已拆分的 date/time 字段
    normalizeLogRow (row, index) {
      let date = row.exec_date
      let time = row.exec_time
      if (date === undefined || date === null) {
        const ts = row.exec_time || row.begin_time || row.created_time || ''
        if (ts) {
          const m = moment(String(ts).replace(' ', 'T'))
          if (m.isValid()) {
            date = m.format('YYYY-MM-DD')
            time = m.format('HH:mm:ss')
          } else {
            date = String(ts)
          }
        }
      }
      const stateArr = ['', 'Start', 'Success', 'Failed']
      return {
        key: row.id !== undefined ? row.id : (row.log_id !== undefined ? row.log_id : index),
        date: date || '--',
        time: time || '--',
        tcId: row.tc_id || '--',
        user: row.use_by || '--',
        status: row.case_state ? stateArr[row.case_state] : '--',
        notes: row.result_msg || '--'
      }
    },
    // 分页变化（页码 / 每页数量），重新按服务端分页拉取
    handleLogsChange (pagination) {
      this.logsPagination.current = pagination.current
      this.logsPagination.pageSize = pagination.pageSize
      this.fetchLogs()
    },
    handleTabChange (key) {
      this.tabActiveKey = key
      // 切回 Hardware tab 时 JsonView 重新挂载为默认未展开态，同步按钮状态
      if (key === 'hardware') {
        this.jsonExpanded = false
      } else if (key === 'logs') {
        // 切到日志 tab 时拉取最新执行日志（服务端分页，重置到第一页）
        this.logsPagination.current = 1
        this.fetchLogs()
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
    // 拉取 VNC 凭证（§3.2：GET /host/{host_id}/vnc-credentials）
    fetchVncInfo () {
      this.vncLoading = true
      getVncInfo(this.hostId).then(res => {
        this.vncInfo = (res && res.data) || {}
      }).catch(e => {
        this.$message.error(getErrMsg(e, 'Failed to load VNC credentials'))
      }).finally(() => {
        this.vncLoading = false
      })
    },
    // 兼容地址可能带协议前缀/路径的情况，取纯 host[:port]
    normalizeVncAddress (raw) {
      let address = String(raw || '').trim()
      if (!address) {
        return ''
      }
      address = address.replace(/^com\.realvnc\.vncviewer\.connect:\/\//i, '')
      address = address.replace(/^vnc:\/\//i, '')
      address = address.replace(/^https?:\/\//i, '')
      return address.split('/')[0]
    },
    // 组装 RealVNC 协议拉起链接：com.realvnc.vncviewer.connect://address[:5900]?username=&password=
    buildVncLaunchUrl () {
      const address = this.normalizeVncAddress(this.vncInfo.ip)
      if (!address) {
        return ''
      }
      const username = String(this.vncInfo.host_acct || '').trim()
      const password = String(this.vncInfo.vnc_password || '').trim()
      const pairs = []
      if (username) {
        pairs.push('username=' + encodeURIComponent(username))
      }
      if (password) {
        pairs.push('password=' + encodeURIComponent(password))
      }
      const query = pairs.join('&')
      // 地址未携带端口时默认 VNC 端口 5900
      const portSuffix = address.includes(':') ? '' : ':5900'
      return query
        ? 'com.realvnc.vncviewer.connect://' + address + portSuffix + '?' + query
        : 'com.realvnc.vncviewer.connect://' + address + portSuffix
    },
    // 依次尝试三种方式拉起 RealVNC 客户端协议（链接点击 / location 跳转 / iframe 加载）
    tryOpenProtocol (url) {
      try {
        const link = document.createElement('a')
        link.href = url
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } catch (e) {
        // ignore
      }
      try {
        window.location.assign(url)
      } catch (e) {
        // ignore
      }
      try {
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        iframe.src = url
        document.body.appendChild(iframe)
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe)
          }
        }, 1200)
      } catch (e) {
        // ignore
      }
    },
    handleVncConnect () {
      const url = this.buildVncLaunchUrl()
      if (!url) {
        this.$message.error('VNC address is empty')
        return
      }
      this.vncLoading = true
      this.tryOpenProtocol(url)
      this.detectVncLaunch()
      setTimeout(() => {
        this.vncLoading = false
      }, 1000)
    },
    // 拉起失败检测：浏览器无 API 判断自定义协议是否拉起成功，
    // 以「拉起成功后窗口失焦/隐藏」为成功特征 —— 窗口期内未失焦则提示可能拉起失败
    detectVncLaunch () {
      let launched = false
      const markLaunched = () => { launched = true }
      window.addEventListener('blur', markLaunched)
      document.addEventListener('visibilitychange', markLaunched)
      setTimeout(() => {
        window.removeEventListener('blur', markLaunched)
        document.removeEventListener('visibilitychange', markLaunched)
        if (!launched) {
          this.$message.warning('Failed to launch RealVNC Viewer. Please make sure RealVNC Viewer is installed and the VNC protocol is registered on this computer.')
        }
      }, 3000)
    },
    // 二级确认：停用/启用 Host（§3.2：共用 PUT /host/disable，appr_state=0 已停用则执行启用）
    handleDisableHost () {
      if (this.apprState === 0) {
        this.handleEnableHost()
        return
      }
      const that = this
      this.$confirm({
        title: 'Disable Host',
        // 询问是否禁用 + 说明禁用后果（进入 Pending HOST）
        content: `Are you sure you want to disable Host ${this.hostInfo.hostname} (${this.hostInfo.ip})? After being disabled, the Host will be moved to Pending HOST.`,
        onOk () {
          deactivateHost({ host_id: that.hostId }).then(() => {
            that.$message.success(`Host ${that.hostInfo.hostname} has been disabled`)
            that.fetchDetail()
          }).catch(e => {
            that.$message.error(getErrMsg(e, `Failed to disable Host ${that.hostInfo.hostname}`))
          })
        }
      })
    },
    // 二级确认：启用已停用的 Host（§3.2：停用/启用共用 PUT /host/disable，启用后回到可用主机池）
    handleEnableHost () {
      const that = this
      this.$confirm({
        title: 'Enable Host',
        content: `Are you sure you want to enable Host ${this.hostInfo.hostname} (${this.hostInfo.ip})? The Host will be restored to the Available HOST pool.`,
        onOk () {
          enableHost({ host_id: that.hostId }).then(() => {
            that.$message.success(`Host ${that.hostInfo.hostname} has been enabled`)
            that.fetchDetail()
          }).catch(e => {
            that.$message.error(getErrMsg(e, `Failed to enable Host ${that.hostInfo.hostname}`))
          })
        }
      })
    },
    // 二级确认：下线 Host（§3.2 C4 分叉：FREE 态直接置 Offline；非 FREE 态转为审批申请进 Pending Approvals）
    handleGoOffline () {
      const that = this
      this.$confirm({
        title: 'Go Offline',
        content: `Are you sure to send an offline notification to Host ${this.hostInfo.hostname} (${this.hostInfo.ip})? Once the notification is sent, the host will be initialized.`,
        okText: 'Send Notification',
        onOk () {
          forceOfflineHost({ host_id: that.hostId }).then(res => {
            if (res && res.data && res.data.state === 'pending_approval') {
              that.$message.success(`A forced-offline approval request has been submitted for Host ${that.hostInfo.hostname}`)
            } else {
              that.$message.success(`Offline notification has been sent to Host ${that.hostInfo.hostname}`)
            }
            that.fetchDetail()
          }).catch(e => {
            that.$message.error(getErrMsg(e, `Failed to send offline notification to Host ${that.hostInfo.hostname}`))
          })
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
        // 修改主机密码（§3.4：PUT /host/password，body {host_id, password}）
        modifyHostPassword(that.hostId, values.password).then(() => {
          that.pwdSubmitting = false
          that.pwdVisible = false
          that.pwdForm.resetFields()
          that.$message.success('Password updated successfully')
          that.fetchDetail()
        }).catch(e => {
          that.pwdSubmitting = false
          that.$message.error(getErrMsg(e, 'Failed to update password'))
        })
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
    // 对象转格式化 JSON 字符串（供 CodeDiff 左右对比展示）；无历史数据（null/undefined）返回空串
    jTos (v) {
      return v === undefined || v === null ? '' : JSON.stringify(v, null, 2)
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
    height: calc(100vh - 64px)!important;
    display: block !important;
    overflow-y: auto !important;
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
