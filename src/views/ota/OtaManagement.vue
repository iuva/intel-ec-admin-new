<template>
  <!-- 一级功能页：面包屑仅显示功能名本身（覆盖 matched 多层级默认渲染） -->
  <page-header-wrapper :breadcrumb="{ props: { routes: [{ path: '/ota-management', breadcrumbName: $t('menu.ota-management') }] } }">
    <a-card :bordered="false">
      <div v-for="(sys, index) in systems" :key="sys.key" class="ota-section">
        <div class="section-header">
          <a-icon :type="sys.icon" class="sys-icon" />
          <span class="sys-name">{{ sys.key }}</span>
          <a-tag v-if="sys.version" class="sys-version-tag">v{{ sys.version }}</a-tag>
        </div>
        <!-- 部署表单：Viewer 可见配置组件，仅隐藏 Deploy 按键 -->
        <div class="deploy-form">
          <div class="field field-version" :class="{ 'has-error': showError(sys, 'version') }">
            <span class="field-label"><span class="required-star">*</span>Version:</span>
            <div class="field-control">
              <a-input
                v-model="sys.version"
                placeholder="Please enter"
                @blur="sys.touched.version = true"
              />
              <div class="error-msg">Please enter Version</div>
            </div>
          </div>
          <div class="field field-package" :class="{ 'has-error': showError(sys, 'package') }">
            <span class="field-label"><span class="required-star">*</span>Installation Package:</span>
            <div class="field-control">
              <!-- 点击加载本地文件：beforeUpload 拦截上传，仅取文件信息 -->
              <a-upload
                :showUploadList="false"
                :beforeUpload="file => handleFileSelect(sys, file)"
              >
                <div
                  class="package-input"
                  :title="sys.fileName || 'Click to select file'"
                >
                  <a-icon type="upload" class="package-icon" />
                  <span v-if="sys.fileName" class="package-name">{{ sys.fileName }}</span>
                  <span v-else class="package-placeholder">Click to select file</span>
                  <a-icon
                    v-if="sys.fileName"
                    type="close-circle"
                    theme="filled"
                    class="package-clear"
                    title="Remove"
                    @click.stop="clearFile(sys)"
                  />
                </div>
              </a-upload>
              <div class="error-msg">Please select Installation Package</div>
            </div>
          </div>
          <div class="field field-md5">
            <span class="field-label">MD5:</span>
            <div class="field-control">
              <a-input v-model="sys.md5" placeholder="Please enter" />
            </div>
          </div>
          <div v-if="!isViewer" class="field-action">
            <a-button type="primary" :loading="sys.deploying" @click="handleDeploy(sys)">
              Deploy
            </a-button>
          </div>
        </div>
        <a-divider v-if="index < systems.length - 1" style="margin: 24px 0" />
      </div>
    </a-card>
  </page-header-wrapper>
</template>

<script>
import { roleMixin } from '@/utils/roles'

export default {
  name: 'OtaManagement',
  mixins: [roleMixin],
  data () {
    return {
      systems: [
        { key: 'agent', icon: 'robot', version: '', fileName: '', file: null, md5: '', deploying: false, touched: { version: false, package: false } },
        { key: 'ek', icon: 'usb', version: '', fileName: '', file: null, md5: '', deploying: false, touched: { version: false, package: false } },
        { key: 'dmr_config', icon: 'setting', version: '', fileName: '', file: null, md5: '', deploying: false, touched: { version: false, package: false } }
      ]
    }
  },
  methods: {
    // blur 即时校验：字段触碰过且为空时标红
    showError (sys, field) {
      if (field === 'version') {
        return sys.touched.version && !sys.version.trim()
      }
      return sys.touched.package && !sys.fileName
    },
    // 选择本地安装包文件（拦截自动上传，仅记录文件）
    handleFileSelect (sys, file) {
      sys.file = file
      sys.fileName = file.name
      sys.touched.package = true
      // 文件变更后清空旧 MD5，需要重新填写
      sys.md5 = ''
      return false
    },
    // 移除已选安装包
    clearFile (sys) {
      sys.file = null
      sys.fileName = ''
      sys.md5 = ''
    },
    handleDeploy (sys) {
      sys.touched.version = true
      sys.touched.package = true
      if (!sys.version.trim()) {
        this.$message.warning('Please enter Version')
        return
      }
      if (!sys.fileName) {
        this.$message.warning('Please select Installation Package')
        return
      }
      this.$confirm({
        title: 'Deploy Confirmation',
        content: `Are you sure to deploy ${sys.key} version ${sys.version}?`,
        okText: 'Deploy',
        cancelText: 'Cancel',
        onOk: () => {
          sys.deploying = true
          // TODO: 对接部署接口，此处模拟请求反馈
          return new Promise(resolve => {
            setTimeout(() => {
              sys.deploying = false
              this.$message.success(`${sys.key} ${sys.version} deploy task submitted`)
              resolve()
            }, 800)
          })
        }
      })
    }
  }
}
</script>

<style lang="less" scoped>
.ota-section {
  .section-header {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
    font-weight: 600;
    font-size: 16px;
    color: rgba(0, 0, 0, 0.85);

    .sys-icon {
      margin-right: 8px;
      color: #1890ff;
      font-size: 16px;
    }

    .sys-name {
      margin-right: 8px;
    }

    // 版本号仅作摘要展示
    .sys-version-tag {
      margin-right: 24px;
      pointer-events: none;
    }
  }
}

.deploy-form {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 24px;
  padding: 8px 0 16px;

  .field {
    display: flex;
    align-items: flex-start;
    min-width: 300px;
    flex: 1 1 300px;
  }

  .field-version {
    flex: 0 1 320px;
  }

  .field-md5 {
    flex: 0 1 360px;
  }

  .field-label {
    flex: 0 0 auto;
    margin: 5px 8px 0 0;
    color: rgba(0, 0, 0, 0.85);
    white-space: nowrap;
  }

  .required-star {
    margin-right: 4px;
    color: #f5222d;
    font-family: SimSun, sans-serif;
  }

  .field-control {
    flex: 1 1 auto;
    min-width: 0;
    position: relative;
  }

  .field-action {
    margin-left: auto;
    padding-top: 0;

    .ant-btn {
      min-width: 88px;
    }
  }

  // blur 即时校验的错误态（对齐 antd has-error 视觉）
  .has-error {
    /deep/ .ant-input {
      border-color: #f5222d;
    }

    /deep/ .ant-input:hover,
    /deep/ .ant-input:focus {
      border-color: #f5222d;
      box-shadow: 0 0 0 2px rgba(245, 34, 45, 0.2);
    }

    .error-msg {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 4px;
      font-size: 12px;
      line-height: 20px;
      color: #f5222d;
      white-space: nowrap;
    }
  }

  .error-msg {
    display: none;
  }
}

// 伪输入框：点击触发文件选择
.package-input {
  display: flex;
  align-items: center;
  width: 100%;
  height: 32px;
  padding: 0 11px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background-color: #fff;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  transition: border-color 0.3s, box-shadow 0.3s;

  &:hover {
    border-color: #1890ff;

    .package-icon {
      color: #1890ff;
    }
  }

  .package-icon {
    flex: 0 0 auto;
    margin-right: 8px;
    color: rgba(0, 0, 0, 0.45);
    transition: color 0.3s;
  }

  .package-name,
  .package-placeholder {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 30px;
  }

  .package-name {
    color: rgba(0, 0, 0, 0.65);
  }

  .package-placeholder {
    color: rgba(0, 0, 0, 0.25);
  }

  .package-clear {
    flex: 0 0 auto;
    margin-left: 8px;
    color: rgba(0, 0, 0, 0.25);
    font-size: 14px;
    transition: color 0.3s;

    &:hover {
      color: rgba(0, 0, 0, 0.45);
    }
  }
}
</style>
