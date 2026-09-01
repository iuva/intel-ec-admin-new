<template>
  <!-- 一级功能页：面包屑仅显示功能名本身（覆盖 matched 多层级默认渲染） -->
  <page-header-wrapper :breadcrumb="{ props: { routes: [{ path: '/available-host', breadcrumbName: $t('menu.host-management') }] } }">
    <a-card :bordered="false">
      <div class="table-page-search-wrapper">
        <a-form layout="inline">
          <a-row :gutter="48">
            <a-col :md="8" :sm="24">
              <a-form-item label="Hostname">
                <a-input v-model="queryParam.hostname" placeholder="Enter Hostname" />
              </a-form-item>
            </a-col>
            <a-col :md="8" :sm="24">
              <a-form-item label="IP">
                <a-input v-model="queryParam.ip" placeholder="Enter IP" />
              </a-form-item>
            </a-col>
            <a-col :md="8" :sm="24">
              <a-form-item label="Status">
                <a-select v-model="queryParam.status" placeholder="Please select">
                  <a-select-option value="">All</a-select-option>
                  <a-select-option value="Free">Free</a-select-option>
                  <a-select-option value="Occupied">Occupied</a-select-option>
                  <a-select-option value="Running">Running</a-select-option>
                  <a-select-option value="Offline">Offline</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :md="8" :sm="24">
              <a-form-item label="User">
                <a-input v-model="queryParam.user" placeholder="Enter User" />
              </a-form-item>
            </a-col>
            <template v-if="advanced">
              <a-col :md="8" :sm="24">
                <a-form-item label="MAC">
                  <a-input v-model="queryParam.mac" placeholder="Enter MAC" />
                </a-form-item>
              </a-col>
              <a-col :md="8" :sm="24">
                <a-form-item label="MachineGuid">
                  <a-input v-model="queryParam.machineGuid" placeholder="Enter MachineGuid" />
                </a-form-item>
              </a-col>
            </template>
            <a-col :md="!advanced && 8 || 24" :sm="24">
              <span class="table-page-search-submitButtons" :class="{ 'buttons-collapsed': !advanced }" :style="advanced && { float: 'right', overflow: 'hidden' } || {} ">
                <a-button type="primary" @click="$refs.table.refresh(true)">Search</a-button>
                <a-button style="margin-left: 8px" @click="handleReset">Reset</a-button>
                <a @click="toggleAdvanced" style="margin-left: 8px">
                  {{ advanced ? 'Collapse' : 'Expand' }}
                  <a-icon :type="advanced ? 'up' : 'down'"/>
                </a>
              </span>
            </a-col>
          </a-row>
        </a-form>
      </div>

      <s-table
        ref="table"
        size="default"
        rowKey="hostname"
        :columns="columns"
        :data="loadData"
        showPagination="auto"
      >
        <span slot="status" slot-scope="text">
          <a-tag :color="text | statusColorFilter">{{ text | statusFilter }}</a-tag>
        </span>

        <span slot="action" slot-scope="text, record" class="host-actions">
          <template>
            <a @click="handleView(record)">View</a>
            <!-- Disable / Go Offline：Viewer 只读不可见 -->
            <template v-if="!isViewer">
              <a-divider type="vertical" />
              <a @click="handleDisable(record)">Disable</a>
              <a-divider type="vertical" />
              <!-- 已 Offline 的 Host 不允许再次下线，禁用 Go Offline -->
              <a
                :class="{ 'disabled-link': record.status === 'Offline' }"
                @click="handleOffline(record)"
              >Go Offline</a>
            </template>
            <!-- Delete：仅 Admin 可见 -->
            <template v-if="isAdmin">
              <a-divider type="vertical" />
              <a class="danger-link" @click="handleDelete(record)">Delete</a>
            </template>
          </template>
        </span>
      </s-table>
    </a-card>
  </page-header-wrapper>
</template>

<script>
import { STable, Ellipsis } from '@/components'
import { roleMixin } from '@/utils/roles'

const columns = [
  {
    title: 'Host ID',
    dataIndex: 'id'
  },
  {
    title: 'Hostname',
    dataIndex: 'hostname'
  },
  {
    title: 'IP',
    dataIndex: 'ip'
  },
  {
    title: 'Status',
    dataIndex: 'status',
    scopedSlots: { customRender: 'status' }
  },
  {
    title: 'User',
    dataIndex: 'user',
    // 仅 Occupied / Running 状态有使用者，其它状态显示「-」
    customRender: (text, record) => (record.status === 'Occupied' || record.status === 'Running' ? text : '-')
  },
  {
    title: 'Occupied Duration',
    dataIndex: 'duration',
    // 仅 Occupied / Running 状态有人使用才计时长，其它状态显示「-」
    customRender: (text, record) => (record.status === 'Occupied' || record.status === 'Running' ? (text || '-') : '-')
  },
  {
    title: 'Action',
    dataIndex: 'action',
    // width: '1%' 为最小宽度提示：操作列收缩到内容宽度并整体靠右，
    // 右缘到表格右侧的 16px 内边距与 ID 列左缘的 16px 间距对称；
    // 列内保持左对齐，富余宽度全部分给数据列
    width: '1%',
    scopedSlots: { customRender: 'action' }
  }
]

const statusMap = {
  Free: {
    color: 'green',
    text: 'Free'
  },
  Occupied: {
    color: 'orange',
    text: 'Occupied'
  },
  Running: {
    color: 'blue',
    text: 'Running'
  },
  Offline: {
    color: 'red',
    text: 'Offline'
  }
}

// 模拟数据，后续接入后端接口时替换
// 仅 Occupied / Running 状态有使用者、tc_id、占用时间和占用时长，
// 其它状态无人使用（user/tcId/occupiedAt/duration 为空，列表和详情页渲染为「-」）
const mockData = [
  { id: 'HOST-001', hostname: 'PC-ZHANGSAN', ip: '192.168.1.101', mac: '00:1A:2B:3C:4D:5E', machineGuid: 'MG-7f3a-001', user: '', tcId: '', occupiedAt: '', status: 'Free', duration: '', lastActive: '2026-08-28 10:00:00' },
  { id: 'HOST-002', hostname: 'PC-LISI', ip: '192.168.1.102', mac: '00:1A:2B:3C:4D:5F', machineGuid: 'MG-7f3a-002', user: 'lisi@company.com', tcId: 'TC-EXEC-006-013', occupiedAt: '2026-08-28 10:12', status: 'Occupied', duration: '51h23m', lastActive: '2026-08-28 10:12:00' },
  { id: 'HOST-003', hostname: 'PC-WANGWU', ip: '192.168.1.103', mac: '00:1A:2B:3C:4D:60', machineGuid: 'MG-7f3a-003', user: 'wangwu@company.com', tcId: 'TC-EXEC-006-001', occupiedAt: '2026-08-28 09:45', status: 'Running', duration: '5h42m', lastActive: '2026-08-28 09:45:00' },
  { id: 'HOST-004', hostname: 'PC-ZHAOLIU', ip: '192.168.1.104', mac: '00:1A:2B:3C:4D:61', machineGuid: 'MG-7f3a-004', user: '', tcId: '', occupiedAt: '', status: 'Offline', duration: '', lastActive: '2026-08-27 18:30:00' },
  { id: 'HOST-005', hostname: 'PC-SUNQI', ip: '192.168.1.105', mac: '00:1A:2B:3C:4D:62', machineGuid: 'MG-7f3a-005', user: '', tcId: '', occupiedAt: '', status: 'Free', duration: '', lastActive: '2026-08-28 11:02:00' }
]

export default {
  name: 'AvailableHostList',
  components: {
    STable,
    Ellipsis
  },
  mixins: [roleMixin],
  data () {
    this.columns = columns
    return {
      // 高级搜索 展开/关闭
      advanced: false,
      // 查询参数
      queryParam: {},
      // 加载数据方法 必须为 Promise 对象
      loadData: parameter => {
        const requestParameters = Object.assign({}, parameter, this.queryParam)
        // TODO: 替换为后端接口，如 getAvailableHostList(requestParameters)
        const filtered = mockData.filter(item => {
          return (!requestParameters.hostname || item.hostname.toLowerCase().includes(requestParameters.hostname.toLowerCase())) &&
            (!requestParameters.ip || item.ip.toLowerCase().includes(requestParameters.ip.toLowerCase())) &&
            (!requestParameters.status || item.status === requestParameters.status) &&
            (!requestParameters.user || item.user.toLowerCase().includes(requestParameters.user.toLowerCase())) &&
            (!requestParameters.mac || item.mac.toLowerCase().includes(requestParameters.mac.toLowerCase())) &&
            (!requestParameters.machineGuid || item.machineGuid.toLowerCase().includes(requestParameters.machineGuid.toLowerCase()))
        })
        return new Promise(resolve => {
          resolve({
            pageSize: parameter.pageSize || 10,
            pageNo: parameter.pageNo || 1,
            totalCount: filtered.length,
            totalPage: Math.ceil(filtered.length / (parameter.pageSize || 10)),
            data: filtered
          })
        })
      }
    }
  },
  filters: {
    statusFilter (type) {
      return statusMap[type] ? statusMap[type].text : type
    },
    statusColorFilter (type) {
      return statusMap[type] ? statusMap[type].color : 'default'
    }
  },
  methods: {
    toggleAdvanced () {
      this.advanced = !this.advanced
    },
    handleReset () {
      this.queryParam = {}
      this.$refs.table.refresh(true)
    },
    // 跳转到 Host 详情页（/available-host/detail），携带 Host 信息供详情页展示
    handleView (record) {
      this.$router.push({
        path: '/available-host/detail',
        query: {
          id: record.id,
          hostname: record.hostname,
          ip: record.ip,
          mac: record.mac,
          machineGuid: record.machineGuid,
          status: record.status,
          // 使用信息：详情页 Usage Information 区域展示
          user: record.user,
          tcId: record.tcId,
          occupiedAt: record.occupiedAt,
          duration: record.duration,
          // 最近连接时间取 lastActive，截取到分钟（YYYY-MM-DD HH:mm）
          lastConnected: record.lastActive ? record.lastActive.slice(0, 16) : ''
        }
      })
    },
    handleDisable (record) {
      const that = this
      this.$confirm({
        title: 'Disable Host',
        // 询问是否禁用 + 说明禁用后果（进入 Pending HOST）
        content: `Are you sure you want to disable Host ${record.hostname} (${record.ip})? After being disabled, the Host will be moved to Pending HOST.`,
        onOk () {
          // TODO: 调用后端禁用接口
          that.$message.success(`Host ${record.hostname} has been disabled`)
          that.$refs.table.refresh()
        }
      })
    },
    handleOffline (record) {
      // 已 Offline 的 Host 禁止再次下线
      if (record.status === 'Offline') return
      const that = this
      this.$confirm({
        title: 'Go Offline',
        // 下发离线通知，Host 收到后进行初始化
        content: `Are you sure to send an offline notification to Host ${record.hostname} (${record.ip})? Once the notification is sent, the host will be initialized.`,
        okText: 'Send Notification',
        onOk () {
          // TODO: 调用后端下发离线通知接口
          that.$message.success(`Offline notification has been sent to Host ${record.hostname}`)
          that.$refs.table.refresh()
        }
      })
    },
    handleDelete (record) {
      const that = this
      this.$confirm({
        title: 'Delete Host',
        content: `Are you sure to delete Host ${record.hostname} (${record.ip})? This cannot be undone!`,
        okType: 'danger',
        onOk () {
          // TODO: 调用后端删除接口
          that.$message.success(`Host ${record.hostname} has been deleted`)
          that.$refs.table.refresh()
        }
      })
    }
  }
}
</script>

<style lang="less" scoped>
// 搜索区域：标签固定宽度右对齐，保证各列控件起始位置统一
.table-page-search-wrapper {
  /deep/ .ant-form-item-label {
    flex: 0 0 96px;
    text-align: right;

    > label {
      width: 100%;
      text-align: right;
    }
  }

  // 收起状态时按钮与同行输入控件垂直对齐，并与上方输入框（如 IP）水平左对齐
  .table-page-search-submitButtons {
    height: 32px;
    line-height: 32px;
  }

  .table-page-search-submitButtons.buttons-collapsed {
    // 96px 与标签固定宽度一致，使按钮起始位置与输入框左边缘对齐
    padding-left: 96px;
  }
}

// 表格视觉：各列「均分」指列间距一致——单元格左右内边距统一（默认16px），
// 列宽由内容自适应动态重排；单词（如邮箱）内不折行
/deep/ .ant-table-tbody > tr > td {
  word-break: keep-all;
  padding-left: 16px;
  padding-right: 16px;
}

.host-actions {
  display: inline-flex;
  // 禁止折行：操作列按最小内容宽度收缩时，最小宽度即整行链接宽度，
  // 保证 View~Delete 始终单行显示
  flex-wrap: nowrap;
  white-space: nowrap;
  align-items: center;

  // 收紧分隔线间距，与单元格 padding 协调，保持列间距视觉一致
  /deep/ .ant-divider-vertical {
    margin: 0 4px;
  }
}

.danger-link {
  color: #f5222d;

  &:hover {
    color: #ff7875;
  }
}

// 禁用态操作链接：置灰、去除交互反馈
.disabled-link {
  color: rgba(0, 0, 0, 0.25);
  cursor: not-allowed;

  &:hover {
    color: rgba(0, 0, 0, 0.25);
  }
}
</style>
