<template>
  <!-- 一级功能页：面包屑仅显示功能名本身（覆盖 matched 多层级默认渲染） -->
  <page-header-wrapper :breadcrumb="{ props: { routes: [{ path: '/pending-host', breadcrumbName: $t('menu.pending-host') }] } }">
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
                  <a-select-option value="Pending Activation">Pending Activation</a-select-option>
                  <a-select-option value="Hardware Modification">Hardware Modification</a-select-option>
                  <a-select-option value="Manually Disabled">Manually Disabled</a-select-option>
                  <a-select-option value="Updating">Updating</a-select-option>
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

      <!-- 操作按钮：Viewer 只读不可见 -->
      <div v-if="!isViewer" class="table-operator">
        <a-button type="primary" icon="check-circle" :disabled="!hasSelected" @click="handleBatchApprove">Batch Approve Version Upgrade</a-button>
        <a-button icon="mail" style="margin-left: 8px" @click="handleMaintainEmail">Maintain Notification Email</a-button>
      </div>

      <s-table
        ref="table"
        size="default"
        rowKey="id"
        :columns="columns"
        :data="loadData"
        :alert="{ show: true, clear: true }"
        :rowSelection="rowSelection"
        showPagination="auto"
      >
        <span slot="status" slot-scope="text">
          <a-tag :color="text | statusColorFilter">{{ text | statusFilter }}</a-tag>
        </span>

        <span slot="action" slot-scope="text, record" class="host-actions">
          <template>
            <!-- Approve Enable：Viewer 只读不可见 -->
            <template v-if="!isViewer">
              <a @click="handleApproveEnable(record)">Approve Enable</a>
              <a-divider type="vertical" />
            </template>
            <a @click="handleView(record)">View</a>
            <!-- Delete：仅 Admin 可见 -->
            <template v-if="isAdmin">
              <a-divider type="vertical" />
              <a class="danger-link" @click="handleDelete(record)">Delete</a>
            </template>
          </template>
        </span>
      </s-table>

      <!-- 维护通知邮箱弹窗 -->
      <a-modal
        title="Maintain Notification Email"
        :width="520"
        v-model="emailVisible"
        @ok="handleEmailOk"
      >
        <a-alert type="info" show-icon style="margin-bottom: 24px" :message="`Current email: ${currentEmail || 'Not set'}`" />
        <!-- 与 Update Password 弹窗一致的 a-form + v-decorator 写法，保证 label 和表单项间距正常渲染 -->
        <a-form :form="emailForm" v-bind="emailFormItemLayout" class="email-form">
          <a-form-item label="New Email">
            <a-input
              v-decorator="['email', { rules: [{ required: true, message: 'Please enter new email' }, { type: 'email', message: 'Invalid email format' }] }]"
              placeholder="Enter new email"
            />
          </a-form-item>
          <a-form-item label="Confirm Email">
            <a-input
              v-decorator="['confirmEmail', { rules: [{ required: true, message: 'Please confirm new email' }, { validator: handleConfirmEmail }] }]"
              placeholder="Confirm new email"
            />
          </a-form-item>
        </a-form>
      </a-modal>
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
    title: 'Submission Time',
    dataIndex: 'submissionTime'
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
  Idle: {
    color: 'green',
    text: 'Idle'
  },
  Locked: {
    color: 'gold',
    text: 'Locked'
  },
  Occupied: {
    color: 'orange',
    text: 'Occupied'
  },
  'Case Executing': {
    color: 'blue',
    text: 'Case Executing'
  },
  Offline: {
    color: 'red',
    text: 'Offline'
  },
  'Pending Activation': {
    color: 'purple',
    text: 'Pending Activation'
  },
  'Hardware Modification': {
    color: 'cyan',
    text: 'Hardware Modification'
  },
  'Manually Disabled': {
    color: 'volcano',
    text: 'Manually Disabled'
  },
  Updating: {
    color: 'geekblue',
    text: 'Updating'
  }
}

// 模拟数据，后续接入后端接口时替换
const mockData = [
  { id: '1853587106098639542', hostname: 'MG006', ip: '00:11:22:33:44:60', mac: '00:11:22:33:44:60', machineGuid: 'MG006', user: '', status: 'Pending Activation', submissionTime: '2026/3/18 20:09:21' },
  { id: '1853587105329048591', hostname: 'MG003', ip: '00:11:22:33:44:57', mac: '00:11:22:33:44:57', machineGuid: 'MG003', user: '', status: 'Pending Activation', submissionTime: '1970/1/1 08:00:00' },
  { id: '1853587105329084033', hostname: 'MG005', ip: '00:11:22:33:44:59', mac: '00:11:22:33:44:59', machineGuid: 'MG005', user: '', status: 'Pending Activation', submissionTime: '2026/3/18 20:10:51' },
  { id: '1853587105329296616', hostname: 'MG002', ip: '00:11:22:33:44:56', mac: '00:11:22:33:44:56', machineGuid: 'MG002', user: '', status: 'Pending Activation', submissionTime: '2026/3/18 20:11:18' },
  { id: '1853587105329430486', hostname: 'MG004', ip: '00:11:22:33:44:58', mac: '00:11:22:33:44:58', machineGuid: 'MG004', user: '', status: 'Pending Activation', submissionTime: '2026/3/18 20:20:40' },
  { id: '1853587105329837288', hostname: 'MG001', ip: '00:11:22:33:44:55', mac: '00:11:22:33:44:55', machineGuid: 'MG001', user: '', status: 'Pending Activation', submissionTime: '2026/3/18 20:21:28' },
  { id: '3000000002', hostname: 'MG-EXEC-002', ip: 'AA:11:22:33:44:56', mac: 'AA:11:22:33:44:56', machineGuid: 'MG-EXEC-002', user: '', status: 'Manually Disabled', submissionTime: '1970/1/1 08:00:00' },
  // 以下为补充的虚拟示例数据，覆盖其余状态便于查询筛选演示
  { id: '3000000003', hostname: 'MG-EXEC-003', ip: 'AB:11:22:33:44:57', mac: 'AB:11:22:33:44:57', machineGuid: 'MG-EXEC-003', user: '', status: 'Case Executing', submissionTime: '2026/3/19 09:15:00' },
  { id: '3000000004', hostname: 'MG-EXEC-004', ip: 'AC:11:22:33:44:58', mac: 'AC:11:22:33:44:58', machineGuid: 'MG-EXEC-004', user: '', status: 'Idle', submissionTime: '2026/3/19 10:30:00' },
  { id: '3000000005', hostname: 'MG-EXEC-005', ip: 'AD:11:22:33:44:59', mac: 'AD:11:22:33:44:59', machineGuid: 'MG-EXEC-005', user: '', status: 'Occupied', submissionTime: '2026/3/19 11:45:00' },
  { id: '3000000006', hostname: 'MG-EXEC-006', ip: 'AE:11:22:33:44:5A', mac: 'AE:11:22:33:44:5A', machineGuid: 'MG-EXEC-006', user: '', status: 'Offline', submissionTime: '2026/3/19 13:00:00' },
  { id: '3000000007', hostname: 'MG-EXEC-007', ip: 'AF:11:22:33:44:5B', mac: 'AF:11:22:33:44:5B', machineGuid: 'MG-EXEC-007', user: '', status: 'Hardware Modification', submissionTime: '2026/3/19 14:20:00' },
  { id: '3000000008', hostname: 'MG-EXEC-008', ip: 'B0:11:22:33:44:5C', mac: 'B0:11:22:33:44:5C', machineGuid: 'MG-EXEC-008', user: '', status: 'Updating', submissionTime: '2026/3/19 15:40:00' },
  { id: '3000000009', hostname: 'MG-EXEC-009', ip: 'B1:11:22:33:44:5D', mac: 'B1:11:22:33:44:5D', machineGuid: 'MG-EXEC-009', user: '', status: 'Locked', submissionTime: '2026/3/19 16:55:00' }
]

export default {
  name: 'PendingHostList',
  components: {
    STable,
    Ellipsis
  },
  mixins: [roleMixin],
  beforeCreate () {
    // 维护通知邮箱表单（a-form + v-decorator）
    this.emailForm = this.$form.createForm(this)
  },
  data () {
    this.columns = columns
    return {
      // 高级搜索 展开/关闭
      advanced: false,
      // 查询参数
      queryParam: {},
      // 表格多选
      selectedRowKeys: [],
      selectedRows: [],
      rowSelection: {
        selectedRowKeys: [],
        onChange: (selectedRowKeys, selectedRows) => {
          this.selectedRowKeys = selectedRowKeys
          this.selectedRows = selectedRows
        }
      },
      // 维护通知邮箱弹窗
      emailVisible: false,
      // 弹窗表单布局：与 Update Password 弹窗一致（labelCol 7 / wrapperCol 13）
      emailFormItemLayout: {
        labelCol: { lg: { span: 7 }, sm: { span: 7 } },
        wrapperCol: { lg: { span: 13 }, sm: { span: 15 } }
      },
      // 当前生效的通知邮箱，后续接入后端接口时替换
      currentEmail: 'ops-notify@company.com',
      // 加载数据方法 必须为 Promise 对象
      loadData: parameter => {
        const requestParameters = Object.assign({}, parameter, this.queryParam)
        // TODO: 替换为后端接口，如 getPendingHostList(requestParameters)
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
  computed: {
    hasSelected () {
      return this.selectedRowKeys.length > 0
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
    // 批量通过版本升级（需先勾选行）
    handleBatchApprove () {
      const that = this
      this.$confirm({
        title: 'Batch Approve Version Upgrade',
        content: `Are you sure to batch approve version upgrade for ${this.selectedRowKeys.length} selected hosts?`,
        onOk () {
          // TODO: 调用后端批量通过版本升级接口
          that.$message.success(`Version upgrade approved for ${that.selectedRowKeys.length} hosts`)
          that.selectedRowKeys = []
          that.$refs.table.refresh()
        }
      })
    },
    // 维护通知邮箱：弹窗填写并保存（打开时清空上次输入）
    handleMaintainEmail () {
      this.emailVisible = true
      this.$nextTick(() => {
        this.emailForm.resetFields()
      })
    },
    // 确认邮箱与新邮箱一致
    handleConfirmEmail (rule, value, callback) {
      const newEmail = this.emailForm.getFieldValue('email')
      if (value && newEmail && value !== newEmail) {
        callback(new Error('The two emails do not match'))
      } else {
        callback()
      }
    },
    handleEmailOk () {
      this.emailForm.validateFields((err, values) => {
        if (err) return
        // TODO: 调用后端维护通知邮箱接口
        this.$message.success(`Notification email saved: ${values.email}`)
        this.emailVisible = false
      })
    },
    // 单行审批启用
    handleApproveEnable (record) {
      const that = this
      this.$confirm({
        title: 'Approve Enable',
        content: `Are you sure to approve and enable Host ${record.hostname} (${record.ip})?`,
        onOk () {
          // TODO: 调用后端审批启用接口
          that.$message.success(`Host ${record.hostname} has been approved and enabled`)
          that.$refs.table.refresh()
        }
      })
    },
    // 跳转到 Pending HOST 详情页（/pending-host/detail），携带 Host 信息供详情页展示
    handleView (record) {
      this.$router.push({
        path: '/pending-host/detail',
        query: {
          id: record.id,
          hostname: record.hostname,
          ip: record.ip,
          mac: record.mac,
          machineGuid: record.machineGuid,
          status: record.status
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

// 操作按钮区域：与表格之间留出间距
.table-operator {
  margin-bottom: 16px;
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
  // 保证 Approve Enable~Delete 始终单行显示
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

// 维护通知邮箱弹窗：输入框行距加大（默认 24px 视觉偏挤），
// 末项去掉 margin，避免弹窗底部留白过大
.email-form {
  /deep/ .ant-form-item {
    margin-bottom: 32px;

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
